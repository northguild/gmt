/**
 * The Morocco 2026 clock-change checker's page widget (CORE-89): whether a runtime has tzdb
 * 2026c or later, the clock changes your data gets wrong, the clock changes in 2026 and 2027, and
 * two live clocks.
 *
 * Every value in the changes, the transitions and the clocks comes from one
 * `GET /gmt/api/morocco-clock-change` answer, computed on the Worker with the library at request
 * time. The widget draws it. The only values it makes itself are the browser column, which is the
 * point of that column, and the wall time of each clock and each stated change, which is the
 * library reading an instant at an offset. No named zone reaches the browser's tz data for a clock.
 *
 * The cards a dated checker shares with the others are in `clock-change-*.ts` and `zone-map.ts`;
 * this file is Morocco's page: its template, its words and its wiring.
 *
 * `renderMoroccoClockChangeTemplate()` is pure markup, so the server renders every table with its
 * known rows and the page does not grow once the answer arrives.
 */
import { minimumsCardHtml } from "../data/clock-change-minimums";
import { MOROCCO_HELP, moroccoKeyPoints } from "../data/morocco-key-points";
import { MOROCCO_MINIMUMS } from "../data/morocco-runtime-minimums";
import { clocksHtml, mountClocks } from "./clock-change-clocks";
import {
  NO_SIGNAL,
  SERVERS_LINE,
  cityOf,
  msToNextSecond,
  signedOffset,
} from "./clock-change-common";
import { helpCardHtml } from "./clock-change-help";
import {
  browserCardHtml,
  fillBrowserCard,
  idPrefixOf,
  placesHtml,
  serversCardHtml,
} from "./clock-change-probe";
import { mountStoredTimes, storedSectionHtml } from "./clock-change-stored";
import type { StoredHandle } from "./clock-change-stored";
import {
  MOROCCO_CHANGES,
  MOROCCO_MOMENTS,
  MOROCCO_STOP_YEAR,
  MOROCCO_STOPPED,
  MOROCCO_VERDICT,
  MOROCCO_ZONES,
  NODE_PROBE_COMMAND,
  expectedProbeOutput,
  localBefore,
  moroccoClassText,
  moroccoProbe,
  presentText,
  recordedByText,
} from "./morocco-clock-change";
import type {
  MoroccoCheck,
  MoroccoTransitionRow,
} from "./morocco-clock-change";
import { MOROCCO_MAP } from "./morocco-map";
import zoneIds from "./morocco-region-zones.json";
import { MOROCCO_STORED } from "./morocco-saved-example";
import {
  ask,
  clockChangeWidget,
  keyPointsHtml,
  legendHtml,
  loadClockLib,
  loadTenseView,
  transitionGroupHtml,
  wallText,
  wireCopy,
  yearsOf,
} from "./clock-change-mount";
import type { ClockChangeChatArgs, ClockLib } from "./clock-change-mount";
import { withBase } from "./site";
import { regionWhen, tenseView } from "./clock-change-tense";
import type { TenseView } from "./clock-change-tense";
import { bindClockGlow } from "./crystal-clock";
import { showUnavailable } from "./widget-mount";
import { escapeAttr, escapeHtml, zoneIdHtml } from "./widget-ui";
import {
  mountZoneMap,
  renderPinPanelHtml,
  staleZoneIds,
  zoneListItemHtml,
} from "./zone-map";

const YEARS = yearsOf(MOROCCO_STOP_YEAR);
const CITIES = MOROCCO_ZONES.map((zone) => cityOf(zone));
const CLOCKS_NOTICE = `The server behind this page has old rules for ${placesHtml(CITIES)}, so these clocks show them an hour ahead for most of the year.`;

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * One row for each stated change and zone. Everything but the server's answer is known when the
 * page is built, so the row is complete except its last cell, which holds NO SIGNAL until the
 * answer arrives. No colour carries a verdict.
 */
function wrongRowHtml(zone: string, change: (typeof MOROCCO_CHANGES)[number]) {
  return (
    `<li class="gmt-morocco-wrong-row" data-zone="${escapeAttr(zone)}" data-at="${escapeAttr(change.at)}">` +
    `<span class="gmt-morocco-wrong-zone"><code>${zoneIdHtml(zone)}</code></span>` +
    `<span class="gmt-morocco-wrong-when">${escapeHtml(localBefore(change))} local</span>` +
    `<span class="gmt-morocco-wrong-shift">${escapeHtml(signedOffset(change.from))} → ${escapeHtml(signedOffset(change.to))}</span>` +
    `<span class="gmt-morocco-wrong-utc">${escapeHtml(change.at)}</span>` +
    `<span class="gmt-morocco-wrong-by">${escapeHtml(recordedByText(change))}</span>` +
    `<span class="gmt-morocco-wrong-present" data-role="present">${NO_SIGNAL}</span>` +
    `</li>`
  );
}

export interface MoroccoTemplateOptions {
  /** Namespaces the heading ids, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the Key points above the checker. The page does; the chat rail does not. */
  keyPoints?: boolean;
  /** The change in words, written by the library: the page's server render and the chat read it. */
  tense: TenseView;
}

/** Reads the words of the Morocco change from the library. */
export const loadMoroccoTense = (): Promise<TenseView> =>
  loadTenseView(MOROCCO_MOMENTS);

export function renderMoroccoClockChangeTemplate({
  idPrefix = "morocco",
  keyPoints = false,
  tense,
}: MoroccoTemplateOptions): string {
  const changesId = `${idPrefix}-changes-title`;
  const transitionsId = `${idPrefix}-transitions-title`;
  const clocksId = `${idPrefix}-clocks-title`;
  const mapId = `${idPrefix}-map-title`;
  const pickId = `${idPrefix}-pick-title`;
  return (
    `<div class="gmt-morocco gmt-widget not-content">` +
    `<div class="gmt-clockcheck-stack">` +
    // Row 1: the Key points on the left, the reader's own browser on the right.
    `<div class="gmt-clockcheck-row gmt-clockcheck-row--top">` +
    (keyPoints
      ? keyPointsHtml(idPrefix, moroccoKeyPoints(regionWhen(tense)), tense)
      : "") +
    browserCardHtml(moroccoProbe(idPrefix), MOROCCO_VERDICT) +
    `</div>` +
    // Row 2: the map, the zone list, the pin panel and the live clocks.
    `<div class="gmt-zonemap-mapsec" data-role="map-section" style="--zonemap-map-height:${MOROCCO_MAP.height}">` +
    `<div class="gmt-widget-section gmt-zonemap-stage">` +
    `<div class="gmt-zonemap-map-block" role="group" aria-labelledby="${mapId}">` +
    `<h4 id="${mapId}">Zones on the map</h4>` +
    // The map draws the sheet's boundaries; `zone-map.ts` puts the credits button in its corner
    // when it draws, under this id.
    `<div class="gmt-zonemap-map gmt-theme-dark" data-role="map" data-credits-id="${idPrefix}-data-credits"></div>` +
    `<ul class="gmt-zonemap-legend" aria-label="Map classes">` +
    legendHtml(moroccoClassText, tense) +
    `</ul>` +
    `</div>` +
    `</div>` +
    `<section class="gmt-widget-section gmt-clockcheck-pickcard" aria-labelledby="${pickId}">` +
    `<h4 id="${pickId}">Pick a zone</h4>` +
    `<p class="gmt-widget-hint">Each zone is in one class. Press a zone, on the map or in the list, to pin its clock and its last and next change.</p>` +
    `<div class="gmt-clockcheck-pick">` +
    `<div class="gmt-zonemap-zone-frame"><div class="gmt-zonemap-zone-scroll" data-role="zone-scroll" role="region" aria-label="Morocco and neighbouring time zones, scrollable list" tabindex="0">` +
    `<ul class="gmt-zonemap-zone-list" data-role="zone-list" aria-label="Zones">${zoneIds.zones.map(zoneListItemHtml).join("")}</ul>` +
    `</div></div>` +
    `</div>` +
    `</section>` +
    `<div class="gmt-zonemap-pin" data-role="pin">${renderPinPanelHtml()}</div>` +
    `<section class="gmt-widget-section gmt-clockcheck-nowsec" aria-labelledby="${clocksId}">` +
    `<h4 id="${clocksId}">Live clocks</h4>` +
    `<p class="gmt-clockcheck-now-notice" data-role="clocks-notice" hidden>${CLOCKS_NOTICE}</p>` +
    clocksHtml(MOROCCO_ZONES, MOROCCO_STOPPED) +
    `<p class="gmt-widget-hint gmt-clockcheck-now-hint">Your time, and the time in each zone.</p>` +
    `</section>` +
    `</div>` +
    // Row 3: the reader's servers beside the minimum releases. Both are info cards.
    `<div class="gmt-clockcheck-row">` +
    serversCardHtml({
      idPrefix,
      command: NODE_PROBE_COMMAND,
      expected: expectedProbeOutput(),
      line: SERVERS_LINE,
    }) +
    minimumsCardHtml(idPrefix, MOROCCO_MINIMUMS) +
    `</div>` +
    // Row 4: the clock changes your data gets wrong, beside what the library does about them.
    `<div class="gmt-clockcheck-row">` +
    `<section class="gmt-widget-section" aria-labelledby="${changesId}">` +
    `<h4 id="${changesId}">Clock changes your data gets wrong</h4>` +
    `<p class="gmt-widget-hint">Each row is a clock change that the old data and the new data disagree about. Times are the clock as it read just before the change.</p>` +
    `<ul class="gmt-morocco-wrong" data-role="wrong">${MOROCCO_ZONES.flatMap(
      (zone) => MOROCCO_CHANGES.map((change) => wrongRowHtml(zone, change)),
    ).join("")}</ul>` +
    `</section>` +
    helpCardHtml(idPrefix, MOROCCO_HELP) +
    `</div>` +
    // Row 5: the clock changes of 2026 and 2027, full width.
    `<section class="gmt-widget-section" aria-labelledby="${transitionsId}">` +
    `<h4 id="${transitionsId}">Clock changes in 2026 and 2027</h4>` +
    `<ul class="gmt-clockcheck-groups" data-role="transitions">${MOROCCO_ZONES.map((zone) => transitionGroupHtml(zone, YEARS)).join("")}</ul>` +
    `</section>` +
    // Row 6: the saved events, the form on the left and the answers on the right.
    storedSectionHtml({ ...MOROCCO_STORED, idPrefix }) +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface MoroccoMountOptions {
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

function changeRowHtml(
  change: MoroccoTransitionRow["changes"][number],
  wall: string,
): string {
  if (wall === "") return `<li>${NO_SIGNAL}</li>`;
  return (
    `<li class="gmt-clockcheck-change">` +
    `<span class="gmt-clockcheck-change-when">${escapeHtml(wallText(wall))}</span>` +
    `<span class="gmt-clockcheck-change-shift">${escapeHtml(signedOffset(change.offsetBefore))} → ${escapeHtml(signedOffset(change.offsetAfter))}</span>` +
    `<span class="gmt-clockcheck-change-utc">${escapeHtml(change.instant)}</span></li>`
  );
}

export async function mountMoroccoClockChange(
  root: HTMLElement,
  signal: AbortSignal,
  options: MoroccoMountOptions = {},
): Promise<void> {
  const q = <T extends HTMLElement>(
    selector: string,
    within: ParentNode = root,
  ) => within.querySelector<T>(selector);

  // Every id this mount makes (the clocks' clipPath, gradient and filter ids, the pin clock, the
  // credits button) comes from the prefix the template was rendered with, so a page and a chat
  // widget, or two widgets, never share one.
  const idPrefix = idPrefixOf(root, "morocco");

  // The browser column needs no library and no answer: fill it first.
  fillBrowserCard(root, moroccoProbe(idPrefix), MOROCCO_VERDICT);

  let lib: ClockLib;
  try {
    lib = await loadClockLib();
  } catch (error) {
    showUnavailable(root, error);
    return;
  }
  if (signal.aborted) return;

  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? lib.getUtcNow;
  const status = q<HTMLElement>('[data-role="status"]');
  const recheck = q<HTMLButtonElement>('[data-role="recheck"]');
  let check: MoroccoCheck | null = null;
  let busy = false;
  let mapMounted = false;
  let stored: StoredHandle | undefined;

  // --- the words: the change is past, so its date and time are written once, with no tense to follow ---
  const tense = tenseView(lib, MOROCCO_MOMENTS, now());

  // --- the copy button announces -------------------------------------------
  wireCopy(root, signal);
  bindClockGlow(root, signal);

  // --- the changes your data gets wrong -------------------------------------
  function drawWrong(answer: MoroccoCheck): void {
    for (const row of answer.changes) {
      const cell = q<HTMLElement>(
        `.gmt-morocco-wrong-row[data-zone="${row.zone}"][data-at="${row.at}"] [data-role="present"]`,
      );
      if (cell) cell.textContent = presentText(row);
    }
  }

  // --- the transitions -----------------------------------------------------
  function drawTransitions(answer: MoroccoCheck): void {
    for (const zone of MOROCCO_ZONES) {
      const list = q<HTMLElement>(
        `.gmt-clockcheck-group[data-zone="${zone}"] [data-role="changes"]`,
      );
      if (!list) continue;
      list.innerHTML = YEARS.map((year) => {
        const row = answer.transitions.find(
          (item) => item.zone === zone && item.year === year,
        );
        const changes = row?.changes ?? [];
        return changes.length === 0
          ? `<li class="gmt-clockcheck-change-none">No clock change in ${year}</li>`
          : changes
              .map((change) =>
                changeRowHtml(
                  change,
                  lib.convertUtcToPlainDateTime(change.instant, {
                    timeZone: change.offsetBefore,
                  }),
                ),
              )
              .join("");
      }).join("");
    }
  }

  // --- the clocks ----------------------------------------------------------
  const clocks = mountClocks(root, {
    idPrefix,
    lib,
    now,
    signal,
    read: () => check?.zones ?? null,
  });

  // --- the fetch -----------------------------------------------------------
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    recheck?.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Checking\u2026";
    const answer = await ask<MoroccoCheck>(
      withBase("/api/morocco-clock-change"),
      fetchFn,
      signal,
    );
    busy = false;
    recheck?.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (answer.kind === "ok") {
      check = answer.check;
      stored?.setStaleZones(staleZoneIds(MOROCCO_STOPPED, check.zones));
      if (status) status.textContent = "";
      drawWrong(check);
      drawTransitions(check);
      clocks.tick();
      // The ready signal for the browser checks: the answer is drawn and the clocks have ticked.
      root.dataset.state = "ready";
      if (!mapMounted) {
        mapMounted = true;
        const map = mountZoneMap(
          root,
          check.zones,
          signal,
          {
            tense: () => tense,
            responseNow: check.now,
            now,
            wall: (at, offset) =>
              lib.convertUtcToPlainDateTime(at, { timeZone: offset }),
            isBefore: lib.isBeforeUtc,
            msToNextSecond,
            fetch: fetchFn,
            location: options.location,
            history: options.history,
          },
          { ...MOROCCO_MAP, idPrefix },
        );
        if (options.pinZone !== undefined) map.pin(options.pinZone);
      }
    } else if (answer.kind === "rate-limited") {
      stored?.browserUnchecked();
      root.dataset.state = "error";
      if (status) {
        status.textContent =
          answer.seconds === null
            ? "Too many checks. Try again shortly."
            : `Try again in ${answer.seconds} s`;
      }
    } else {
      stored?.browserUnchecked();
      root.dataset.state = "error";
      if (status) status.textContent = "The check could not finish.";
    }
  }

  recheck?.addEventListener("click", () => void load(), { signal });
  stored = mountStoredTimes(
    root,
    { ...MOROCCO_STORED, idPrefix },
    signal,
    fetchFn,
  );
  await load();
  await stored.ready;
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderMoroccoClockChangeWidgetTemplate(
  idPrefix: string,
  tense: TenseView,
): string {
  return renderMoroccoClockChangeTemplate({ idPrefix, tense });
}

/** Mounts the checker in the chat rail; the wrapper is shared (`clock-change-mount.ts`). */
export type MoroccoClockChangeArgs = ClockChangeChatArgs;

export const mountMoroccoClockChangeWidget = clockChangeWidget(
  mountMoroccoClockChange,
);
