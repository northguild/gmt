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
import { KEY_POINTS_HEADING, partsHtml } from "../data/clock-change-text";
import { MOROCCO_HELP, MOROCCO_KEY_POINTS } from "../data/morocco-key-points";
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
  MOROCCO_STOPPED,
  MOROCCO_VERDICT,
  MOROCCO_ZONES,
  NODE_PROBE_COMMAND,
  expectedProbeOutput,
  localBefore,
  mapKindLabel,
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
import { bindClockGlow } from "./crystal-clock";
import { GMT_MODULES } from "./gmt-modules";
import { withBase } from "./site";
import {
  INERT_HANDLE,
  WidgetLoadError,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";
import { escapeAttr, escapeHtml, wireCopyButtons } from "./widget-ui";
import {
  mountZoneMap,
  renderPinPanelHtml,
  staleZoneIds,
  zoneListItemHtml,
} from "./zone-map";

const YEARS = [2026, 2027] as const;
const LEGEND = [
  ["stopped-2026", mapKindLabel("stopped-2026")],
  ["changes-2027", mapKindLabel("changes-2027")],
  ["none-2026-2027", mapKindLabel("none-2026-2027")],
] as const;
const CITIES = MOROCCO_ZONES.map((zone) => cityOf(zone));
const CLOCKS_NOTICE = `The server behind this page has old rules for ${placesHtml(CITIES)}, so these clocks show them an hour ahead for most of the year.`;

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

interface MoroccoLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
  getUtcNow(): string;
  isBeforeUtc(value1: string, value2: string): boolean;
}

function pick<T>(module: Record<string, unknown>, name: string): T {
  if (typeof module[name] !== "function") {
    throw new Error(`The library module has no ${name}.`);
  }
  return module[name] as T;
}

export async function loadMoroccoLib(): Promise<MoroccoLib> {
  try {
    const [convert, get, compare] = await Promise.all([
      GMT_MODULES["utc/convert"]!(),
      GMT_MODULES["utc/get"]!(),
      GMT_MODULES["utc/compare"]!(),
    ]);
    return {
      convertUtcToPlainDateTime: pick(convert, "convertUtcToPlainDateTime"),
      getUtcNow: pick(get, "getUtcNow"),
      isBeforeUtc: pick(compare, "isBeforeUtc"),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function transitionGroupHtml(zone: string): string {
  return (
    `<li class="gmt-morocco-group" data-zone="${escapeAttr(zone)}">` +
    `<h5 class="gmt-morocco-group-title"><code>${escapeHtml(zone)}</code></h5>` +
    `<ul class="gmt-morocco-changes" data-role="changes">` +
    YEARS.map((year) => `<li data-year="${year}">${NO_SIGNAL}</li>`).join("") +
    `</ul></li>`
  );
}

/**
 * One row for each stated change and zone. Everything but the server's answer is known when the
 * page is built, so the row is complete except its last cell, which holds NO SIGNAL until the
 * answer arrives. No colour carries a verdict.
 */
function wrongRowHtml(zone: string, change: (typeof MOROCCO_CHANGES)[number]) {
  return (
    `<li class="gmt-morocco-wrong-row" data-zone="${escapeAttr(zone)}" data-at="${escapeAttr(change.at)}">` +
    `<span class="gmt-morocco-wrong-zone"><code>${escapeHtml(zone)}</code></span>` +
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
}

export function renderMoroccoClockChangeTemplate({
  idPrefix = "morocco",
  keyPoints = false,
}: MoroccoTemplateOptions = {}): string {
  const changesId = `${idPrefix}-changes-title`;
  const transitionsId = `${idPrefix}-transitions-title`;
  const clocksId = `${idPrefix}-clocks-title`;
  const mapId = `${idPrefix}-map-title`;
  const pickId = `${idPrefix}-pick-title`;
  return (
    `<div class="gmt-morocco gmt-widget not-content">` +
    `<div class="gmt-morocco-stack">` +
    // Row 1: the Key points on the left, the reader's own browser on the right.
    `<div class="gmt-morocco-row gmt-morocco-row--top">` +
    (keyPoints ? keyPointsHtml(idPrefix) : "") +
    browserCardHtml(moroccoProbe(idPrefix), MOROCCO_VERDICT) +
    `</div>` +
    // Row 2: the map, the zone list with its pin panel, and the two live clocks.
    `<div class="gmt-zonemap-mapsec" data-role="map-section">` +
    `<div class="gmt-widget-section gmt-zonemap-stage">` +
    `<div class="gmt-zonemap-map-block" role="group" aria-labelledby="${mapId}">` +
    `<h4 id="${mapId}">Zones on the map</h4>` +
    // The map draws the sheet's boundaries; `zone-map.ts` puts the credits button in its corner
    // when it draws, under this id.
    `<div class="gmt-zonemap-map gmt-theme-dark" data-role="map" style="--zonemap-map-height:${MOROCCO_MAP.height}" data-credits-id="${idPrefix}-data-credits"></div>` +
    `<ul class="gmt-zonemap-legend" aria-label="Map classes">` +
    LEGEND.map(
      ([kind, label]) =>
        `<li><span class="gmt-zonemap-swatch gmt-theme-dark" data-kind="${kind}" aria-hidden="true"></span><span>${escapeHtml(label)} (<span data-role="legend-count" data-kind="${kind}">&ndash;</span>)</span></li>`,
    ).join("") +
    `</ul>` +
    `</div>` +
    `</div>` +
    `<section class="gmt-widget-section gmt-morocco-pickcard" aria-labelledby="${pickId}">` +
    `<h4 id="${pickId}">Pick a zone</h4>` +
    `<p class="gmt-widget-hint">Each zone is in one class. Press a zone, on the map or in the list, to pin its clock and its last and next change.</p>` +
    `<div class="gmt-morocco-pick">` +
    `<div class="gmt-zonemap-zone-frame"><div class="gmt-zonemap-zone-scroll" data-role="zone-scroll" role="region" aria-label="Morocco and neighbouring time zones, scrollable list" tabindex="0">` +
    `<ul class="gmt-zonemap-zone-list" data-role="zone-list" aria-label="Zones">${zoneIds.zones.map(zoneListItemHtml).join("")}</ul>` +
    `</div></div>` +
    `<div class="gmt-zonemap-pin" data-role="pin">${renderPinPanelHtml()}</div>` +
    `</div>` +
    `</section>` +
    `<section class="gmt-widget-section gmt-morocco-nowsec" aria-labelledby="${clocksId}">` +
    `<h4 id="${clocksId}">Live clocks</h4>` +
    `<p class="gmt-morocco-now-notice" data-role="clocks-notice" hidden>${CLOCKS_NOTICE}</p>` +
    clocksHtml(MOROCCO_ZONES, MOROCCO_STOPPED) +
    `<p class="gmt-widget-hint gmt-morocco-now-hint">Your time, and the time in each zone.</p>` +
    `</section>` +
    `</div>` +
    // Row 3: the reader's servers beside the minimum releases. Both are info cards.
    `<div class="gmt-morocco-row">` +
    serversCardHtml({
      idPrefix,
      command: NODE_PROBE_COMMAND,
      expected: expectedProbeOutput(),
      line: SERVERS_LINE,
    }) +
    minimumsCardHtml(idPrefix, MOROCCO_MINIMUMS) +
    `</div>` +
    // Row 4: the clock changes your data gets wrong, beside what the library does about them.
    `<div class="gmt-morocco-row">` +
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
    `<ul class="gmt-morocco-groups" data-role="transitions">${MOROCCO_ZONES.map(transitionGroupHtml).join("")}</ul>` +
    `</section>` +
    // Row 6: the saved events, the form on the left and the answers on the right.
    storedSectionHtml({ ...MOROCCO_STORED, idPrefix }) +
    `</div>` +
    `</div>`
  );
}

/** The Key points: three cards. */
function keyPointsHtml(idPrefix: string): string {
  return (
    `<section class="gmt-keypoints" aria-labelledby="${idPrefix}-keypoints-title">` +
    `<h2 id="${idPrefix}-keypoints-title">${escapeHtml(KEY_POINTS_HEADING)}</h2>` +
    `<div class="gmt-keypoints-grid">` +
    MOROCCO_KEY_POINTS.map(
      (card) =>
        `<div class="gmt-keypoints-card"${card.id ? ` id="${escapeAttr(card.id)}"` : ""}>` +
        `<h3>${escapeHtml(card.heading)}</h3>` +
        card.blocks
          .map((block) =>
            block.kind === "p"
              ? `<p>${partsHtml(block.parts)}</p>`
              : `<ol>${block.items.map((item) => `<li>${partsHtml(item)}</li>`).join("")}</ol>`,
          )
          .join("") +
        `</div>`,
    ).join("") +
    `</div></section>`
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

type Answer =
  | { kind: "ok"; check: MoroccoCheck }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "failed" };

async function ask(
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<Answer> {
  try {
    const response = await fetchFn(withBase("/api/morocco-clock-change"), {
      signal,
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      return {
        kind: "rate-limited",
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as MoroccoCheck };
  } catch {
    return { kind: "failed" };
  }
}

function wallText(wall: string): string {
  return wall.replace("T", " ").slice(0, 16);
}

function changeRowHtml(
  change: MoroccoTransitionRow["changes"][number],
  wall: string,
): string {
  if (wall === "") return `<li>${NO_SIGNAL}</li>`;
  return (
    `<li class="gmt-morocco-change">` +
    `<span class="gmt-morocco-when">${escapeHtml(wallText(wall))}</span>` +
    `<span class="gmt-morocco-shift">${escapeHtml(signedOffset(change.offsetBefore))} → ${escapeHtml(signedOffset(change.offsetAfter))}</span>` +
    `<span class="gmt-morocco-utc">${escapeHtml(change.instant)}</span></li>`
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

  let lib: MoroccoLib;
  try {
    lib = await loadMoroccoLib();
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

  // --- the copy button announces -------------------------------------------
  wireCopyButtons(root);
  const copyStatus = q<HTMLElement>('[data-role="copy-status"]');
  q<HTMLElement>('[data-role="copy-node-probe"]')?.addEventListener(
    "click",
    () => {
      if (copyStatus) copyStatus.textContent = "Copied";
    },
    { signal },
  );
  bindClockGlow(root, signal);

  // --- the changes your data gets wrong -------------------------------------
  function drawWrong(answer: MoroccoCheck): void {
    for (const row of answer.changes) {
      const cell = q<HTMLElement>(
        `.gmt-morocco-wrong-row[data-zone="${row.zone}"][data-at="${row.at}"] [data-role="present"]`,
      );
      if (cell) cell.textContent = presentText(row.present);
    }
  }

  // --- the transitions -----------------------------------------------------
  function drawTransitions(answer: MoroccoCheck): void {
    for (const zone of MOROCCO_ZONES) {
      const list = q<HTMLElement>(
        `.gmt-morocco-group[data-zone="${zone}"] [data-role="changes"]`,
      );
      if (!list) continue;
      list.innerHTML = YEARS.map((year) => {
        const row = answer.transitions.find(
          (item) => item.zone === zone && item.year === year,
        );
        const changes = row?.changes ?? [];
        return changes.length === 0
          ? `<li class="gmt-morocco-none">No clock change in ${year}</li>`
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
    if (status) status.textContent = "Checking…";
    const answer = await ask(fetchFn, signal);
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
      if (!mapMounted) {
        mapMounted = true;
        const map = mountZoneMap(
          root,
          check.zones,
          signal,
          {
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
      if (status) {
        status.textContent =
          answer.seconds === null
            ? "Too many checks. Try again shortly."
            : `Try again in ${answer.seconds} s`;
      }
    } else {
      stored?.browserUnchecked();
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

export interface MoroccoClockChangeArgs {
  /** One zone id from `morocco-region-zones.json` to pin on the map. */
  zone?: string;
}

const NO_LOCATION: Pick<Location, "href"> = { href: "https://dox.invalid/" };
const NO_HISTORY: Pick<History, "replaceState"> = { replaceState: () => {} };

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderMoroccoClockChangeWidgetTemplate(
  idPrefix: string,
): string {
  return renderMoroccoClockChangeTemplate({ idPrefix });
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
export const mountMoroccoClockChangeWidget: MountFn<
  MoroccoClockChangeArgs
> = async (root, args, signal) => {
  await loadMoroccoLib();
  if (signal.aborted) return INERT_HANDLE;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  mountMoroccoClockChange(root, controller.signal, {
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
        '.gmt-zonemap-zone-btn[aria-pressed="true"]',
      )?.dataset.tzId;
      return zone ? { zone } : null;
    },
  );
};
