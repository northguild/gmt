/**
 * The Canada 2026 clock-change checker's page widget (CORE-88): whether a runtime has the 2026 tz
 * data, the clock changes in 2026 and 2027, and live clocks for five zones.
 *
 * Every value in the transitions and the clocks comes from one
 * `GET /gmt/api/canada-clock-change` answer, computed on the Worker with the library at request
 * time. The widget draws it. The only values it makes itself are the browser column, which is
 * the point of that column, and the wall time of each clock, which is the library reading the
 * client's now at the Worker's offset. No named zone reaches the browser's tz data for a clock.
 *
 * The parts every checker shares (the browser card, the transitions, the clocks, the saved-times
 * form) are in `clock-check/template.ts` and `clock-check/mount.ts`. This module is Canada's page:
 * its words, its map, and the order of its rows. `renderCanadaClockChangeTemplate()` is pure
 * markup, so the server renders every table with its known rows and the page does not grow once
 * the answer arrives.
 */
import type { CanadaCheck } from "./canada-clock-change";
import {
  CANADA_FACTS,
  SERVERS_LINE,
  SERVERS_TITLE,
  TABLE_ZONES,
  TRANSITION_ZONES,
  cityOf,
  mapKindLabel,
} from "./canada-clock-change";
import zoneIds from "./canada-zones.json";
import {
  staleZoneIds,
  mountCanadaMap,
  renderPinPanelHtml,
  zoneListItemHtml,
} from "./canada-map";
import { MINIMUMS } from "../data/canada-runtime-minimums";
import { SAVED_EXAMPLE } from "./canada-saved-example";
import { HELP, KEY_POINTS } from "../data/canada-key-points";
import {
  ask,
  drawTransitions,
  failureText,
  fillBrowserColumn,
  loadCheckLib,
  mountClocks,
  mountStoredTimes,
  msToNextSecond,
  readBrowserOffset as readOffset,
  wireCopyAnnounce,
  type CheckLib,
  type StoredHandle,
} from "./clock-check/mount";
import {
  browserCardHtml,
  changesSectionHtml,
  checkShellHtml,
  clocksSectionHtml,
  helpCardHtml,
  keyPointsHtml,
  minimumsCardHtml,
  placesHtml,
  probeInlineSource as probeInlineSourceOf,
  serversCardHtml,
  storedSectionHtml,
  verdictHtml as verdictHtmlOf,
  type CheckPage,
} from "./clock-check/template";
import {
  INERT_HANDLE,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";
import { escapeHtml } from "./widget-ui";

export { placesHtml };
export {
  storedSummaryText,
  storedTruncatedText,
  msToNextMinute,
  msToNextSecond,
  type BrowserReading,
} from "./clock-check/mount";

const LEGEND = [
  ["stopped-2026", mapKindLabel("stopped-2026")],
  ["changes-2027", mapKindLabel("changes-2027")],
  ["none-2026-2027", mapKindLabel("none-2026-2027")],
] as const;

/** What the Canada page's saved-times textarea holds on load and after "Reset example": one moved, three that are fine or moved by a different zone. */
export const STORED_EXAMPLE = [
  "2026-11-15T09:00:00-08:00[America/Vancouver]",
  "2026-11-15T09:00:00-07:00[America/Vancouver]",
  "2026-11-15T09:00:00-05:00[America/Toronto]",
  "2026-12-01T18:00:00-06:00[America/Winnipeg]",
].join("\n");

/** Canada's page: the shared builders read this, and nothing else, for its words and data. */
export const CANADA_PAGE: CheckPage = {
  facts: CANADA_FACTS,
  idPrefix: "canada",
  table: TABLE_ZONES,
  probeLabel: "2 Nov 2026",
  copy: {
    verdictOk: "Your browser has the new rules for all four places.",
    verdictWrong: (places) => ({
      line: `Your browser has old time zone data for ${places}. From 1 November 2026 it shows their time an hour wrong.`,
      more: [
        `<strong>For you:</strong> update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.`,
        `<strong>For developers:</strong> your users&rsquo; browsers can be the same. See step 2 under <a href="#canada-developers">For developers</a>.`,
      ],
    }),
    correctNote: "tzdb 2026e",
    clocksNotice: `This browser has old rules for ${placesHtml(TABLE_ZONES.map((fact) => cityOf(fact.zone)))}. From 1 November 2026 these clocks show them an hour off.`,
    clocksHeading: "Live clocks",
    clocksHint: "Your time, and the time in each zone.",
    changesHeading: "Clock changes in 2026 and 2027",
    changesHint:
      "tzdb also records an abbreviation change on 2026-11-01 for the four zones that stop changing their clocks, with no change of UTC offset, so it is not listed. Times are the clock as it read just before the change.",
    serversTitle: SERVERS_TITLE,
    serversLine: SERVERS_LINE,
    storedLead:
      "Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.",
    savedDay: "15 Nov",
  },
  keyPoints: KEY_POINTS,
  help: HELP,
  minimums: MINIMUMS,
  storedPreset: STORED_EXAMPLE,
  saved: SAVED_EXAMPLE,
  transitionZones: TRANSITION_ZONES,
  staleZones: (answer) => staleZoneIds(answer.zones as CanadaCheck["zones"]),
};

// ---------------------------------------------------------------------------
// Wrappers bound to Canada's page
// ---------------------------------------------------------------------------

export const loadCanadaLib = loadCheckLib;

/** The Canada page's inline probe: see `clock-check/template.ts`. */
export function probeInlineSource(): string {
  return probeInlineSourceOf(CANADA_PAGE);
}

export function verdictHtml(wrong: readonly string[]): string {
  return verdictHtmlOf(CANADA_PAGE, wrong);
}

export function readBrowserOffset(zone: string) {
  return readOffset(CANADA_FACTS, zone);
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface CanadaTemplateOptions {
  /** Namespaces the heading ids, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the Key points above the checker. The page does; the chat rail does not. */
  keyPoints?: boolean;
}

export function renderCanadaClockChangeTemplate({
  idPrefix = "canada",
  keyPoints = false,
}: CanadaTemplateOptions = {}): string {
  const page: CheckPage = { ...CANADA_PAGE, idPrefix };
  const probeId = `${idPrefix}-probe-title`;
  const changesId = `${idPrefix}-changes-title`;
  const clocksId = `${idPrefix}-clocks-title`;
  const mapId = `${idPrefix}-map-title`;
  const storedId = `${idPrefix}-stored-title`;
  const pickId = `${idPrefix}-pick-title`;
  return checkShellHtml(
    page,
    // Row 1: the Key points on the left, the reader's own browser on the right.
    `<div class="gmt-check-row gmt-check-row--top">` +
      (keyPoints ? keyPointsHtml(CANADA_PAGE) : "") +
      browserCardHtml(page, probeId) +
      `</div>` +
      // Row 2: the map, the zone list with its pin panel, and the live clocks. The map is the taller card; the list
      //   takes the height it leaves.
      `<div class="gmt-canada-mapsec" data-role="map-section">` +
      `<div class="gmt-widget-section gmt-canada-stage">` +
      `<div class="gmt-canada-map-block" role="group" aria-labelledby="${mapId}">` +
      `<h4 id="${mapId}">Zones on the map</h4>` +
      // The map draws the sheet's boundaries; `canada-map.ts` puts the credits button in its corner
      // when it draws, under this id.
      `<div class="gmt-canada-map gmt-theme-dark" data-role="map" data-credits-id="${idPrefix}-data-credits"></div>` +
      `<ul class="gmt-canada-legend" aria-label="Map classes">` +
      LEGEND.map(
        ([kind, label]) =>
          `<li><span class="gmt-canada-swatch gmt-theme-dark" data-kind="${kind}" aria-hidden="true"></span><span>${escapeHtml(label)} (<span data-role="legend-count" data-kind="${kind}">&ndash;</span>)</span></li>`,
      ).join("") +
      `</ul>` +
      `</div>` +
      `</div>` +
      `<section class="gmt-widget-section gmt-canada-pickcard" aria-labelledby="${pickId}">` +
      `<h4 id="${pickId}">Pick a zone</h4>` +
      `<p class="gmt-widget-hint">Each zone is in one class. Press a zone, on the map or in the list, to pin its clock and its last and next change.</p>` +
      `<div class="gmt-canada-pick">` +
      `<div class="gmt-canada-zone-frame"><div class="gmt-canada-zone-scroll" data-role="zone-scroll" role="region" aria-label="Canada time zones, scrollable list" tabindex="0">` +
      `<ul class="gmt-canada-zone-list" data-role="zone-list" aria-label="Zones">${zoneIds.zones.map(zoneListItemHtml).join("")}</ul>` +
      `</div></div>` +
      `<div class="gmt-canada-pin" data-role="pin">${renderPinPanelHtml()}</div>` +
      `</div>` +
      `</section>` +
      clocksSectionHtml(page, clocksId) +
      `</div>` +
      // Row 3: the reader's servers beside the minimum releases. Both are info cards.
      `<div class="gmt-check-row">` +
      serversCardHtml(page) +
      minimumsCardHtml(page) +
      `</div>` +
      // Row 4: the clock changes beside what the library does about them.
      `<div class="gmt-check-row">` +
      changesSectionHtml(page, changesId) +
      helpCardHtml(page) +
      `</div>` +
      // Row 5: the saved events, the form on the left and the answers on the right.
      storedSectionHtml(page, storedId),
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface CanadaMountOptions {
  /** The fetch to call the Worker with. Tests pass a fake. */
  fetch?: typeof fetch;
  /** The client's now as a UTC instant. Defaults to the library's `getUtcNow`. */
  now?: () => string;
  /** A zone id to pin on the map once it is drawn. An id not on the map is ignored. */
  pinZone?: string;
  /** Where the map reads and writes `?zone=`. The chat passes inert ones: its URL is not the checker's. */
  location?: Pick<Location, "href">;
  history?: Pick<History, "replaceState">;
}

export async function mountCanadaClockChange(
  root: HTMLElement,
  signal: AbortSignal,
  options: CanadaMountOptions = {},
): Promise<void> {
  const q = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector);

  // The browser column needs no library and no answer: fill it first.
  fillBrowserColumn(CANADA_PAGE, root);

  let lib: CheckLib;
  try {
    lib = await loadCheckLib();
  } catch (error) {
    showUnavailable(root, error);
    return;
  }
  if (signal.aborted) return;

  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? lib.getUtcNow;
  const status = q<HTMLElement>('[data-role="status"]');
  const recheck = q<HTMLButtonElement>('[data-role="recheck"]');
  let busy = false;
  let mapMounted = false;
  let stored: StoredHandle | undefined;

  wireCopyAnnounce(root, signal);
  const clocks = mountClocks(CANADA_FACTS, root, signal, lib, now);

  // The clock of the zone picked in the list takes a full highlight; the other four stay as they are.
  const zoneList = root.querySelector<HTMLElement>('[data-role="zone-list"]');
  const markPicked = (): void => {
    const picked = zoneList?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.dataset.tzId;
    root.querySelectorAll<HTMLElement>(".gmt-check-clock").forEach((item) => {
      if (picked !== undefined && item.dataset.zone === picked)
        item.dataset.picked = "true";
      else delete item.dataset.picked;
    });
  };
  if (zoneList) {
    const watcher = new MutationObserver(markPicked);
    watcher.observe(zoneList, {
      attributes: true,
      attributeFilter: ["aria-pressed"],
      subtree: true,
    });
    signal.addEventListener("abort", () => watcher.disconnect(), {
      once: true,
    });
    markPicked();
  }

  // --- the fetch -----------------------------------------------------------
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    recheck?.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Checking…";
    const answer = await ask<CanadaCheck>(CANADA_FACTS, fetchFn, signal);
    busy = false;
    recheck?.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (answer.kind === "ok") {
      const check = answer.check;
      stored?.setStaleZones(CANADA_PAGE.staleZones(check));
      if (status) status.textContent = "";
      drawTransitions(CANADA_PAGE, root, check.transitions);
      clocks.start(check.zones);
      if (!mapMounted) {
        mapMounted = true;
        const map = mountCanadaMap(root, check.zones, signal, {
          responseNow: check.now,
          now,
          wall: (at, offset) =>
            lib.convertUtcToPlainDateTime(at, { timeZone: offset }),
          isBefore: lib.isBeforeUtc,
          msToNextSecond,
          fetch: fetchFn,
          location: options.location,
          history: options.history,
        });
        if (options.pinZone !== undefined) map.pin(options.pinZone);
      }
    } else {
      stored?.browserUnchecked();
      if (status) status.textContent = failureText(answer);
    }
  }

  recheck?.addEventListener("click", () => void load(), { signal });
  stored = mountStoredTimes(CANADA_PAGE, root, signal, fetchFn);
  await load();
  await stored.ready;
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

export interface CanadaClockChangeArgs {
  /** One zone id from `canada-zones.json` to pin on the map. */
  zone?: string;
}

const NO_LOCATION: Pick<Location, "href"> = { href: "https://dox.invalid/" };
const NO_HISTORY: Pick<History, "replaceState"> = { replaceState: () => {} };

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderCanadaClockChangeWidgetTemplate(
  idPrefix: string,
): string {
  return renderCanadaClockChangeTemplate({ idPrefix });
}

/**
 * Mounts the checker in the chat rail. The rail is narrow, so the map's container query shows
 * the zone list; the list pins the same zone. The widget fetches the Worker's endpoint like the
 * page does and computes nothing itself. `?zone=` on the chat's URL is neither read nor written.
 *
 * The library load is awaited so a failed load rejects with `WidgetLoadError`, which the host
 * turns into its retry state. The answer is not awaited: the handle returns at once, and the
 * widget's own status line carries a slow or failed Worker.
 */
export const mountCanadaClockChangeWidget: MountFn<
  CanadaClockChangeArgs
> = async (root, args, signal) => {
  await loadCheckLib();
  if (signal.aborted) return INERT_HANDLE;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  mountCanadaClockChange(root, controller.signal, {
    pinZone: args.zone,
    location: NO_LOCATION,
    history: NO_HISTORY,
  }).catch((error) => {
    if (!controller.signal.aborted) showUnavailable(root, error);
  });
  return onceDestroy(
    () => {
      signal.removeEventListener("abort", stop);
      controller.abort();
    },
    () => {
      const zone = root.querySelector<HTMLElement>(
        '.gmt-canada-zone-btn[aria-pressed="true"]',
      )?.dataset.tzId;
      return zone ? { zone } : null;
    },
  );
};
