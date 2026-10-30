/**
 * DOX-E1b — multi-zone time scrubber (the meeting-planner use case).
 *
 * Pin several IANA zones, drag one slider, and every pinned clock moves
 * together. When the slider crosses a DST transition for a pinned zone, that
 * zone's offset visibly changes and a clock-change pill names it — never a silent
 * reflow. The pinned-zones-plus-time configuration encodes into the URL so it
 * can be copied and shared to propose a meeting time.
 *
 * All time maths is `@northguild/gmt`: `convertZonedToZoned` + `getTimeZoneOffset`
 * for the per-zone readings (via `./zone-clock`), and `getDstTransitions` for
 * the "jump to a DST boundary" preset. The `@js-temporal/polyfill` rides along
 * in this lazy-loaded chunk, never on a page's critical path.
 *
 * Entry point: `initScrubber(root, options)`. `root` holds the markup
 * `renderScrubberTemplate` wrote (`widgets/families/zones/zone-planner-template`), which a
 * docs page server-renders and the `/dox` rail renders into its own host. This module is the
 * heavy half: it loads lazily, so the polyfill and the coordinate table stay out of both
 * pages' first download.
 */

import {
  convertUnixToUtc,
  convertUtcToUnix,
  getTimeZoneOffset,
  getUnixNow,
  parseDayFromUtc,
  parseDayOfWeekFromUtc,
  parseHourFromUtc,
  parseMinuteFromUtc,
  parseMonthFromUtc,
  parseYearFromUtc,
} from "@northguild/gmt";
import { roundUnix } from "@northguild/gmt/unix/calculate";
import { getSystemTimeZone } from "@northguild/gmt/zoned/get";

import { defineElements } from "~/widgets/define";
import { findWidget, html, setHtml, type SafeHtml } from "~/widgets/builders";
import { zoneTile } from "~/widgets/families/zones/zone-tile";
import {
  SLIDER_RANGE_MIN,
  SLIDER_STEP_MIN,
  formatShift,
} from "~/widgets/families/zones/zone-planner-template";
import type { GmtCombobox } from "~/widgets/primitives/combobox/combobox";
import type { GmtCopy } from "~/widgets/primitives/copy/copy";
import type { GmtRange } from "~/widgets/primitives/range/range";
import type { GmtReadout } from "~/widgets/primitives/readout/readout";
import styles from "~/widgets/tools/multi-zone-scrubber.module.css";
import { bindClockGlow, updateCrystalClock } from "./crystal-clock";
import { formatDayLabel } from "./dwell-ledger";
import { COORDINATES_BY_ID } from "./globe-zones";
import { readZoneAt } from "./zone-clock";
import {
  crossedSwitch,
  dstStatus,
  nextSwitch,
  switchesInWindow,
  type DstSwitch,
} from "./scrubber-dst";
import { MAX_SEEDED_ZONES } from "./zone-planner";

export interface ScrubberHost {
  destroy: () => void;
  /** The pinned zones and the reference time (UTC, `Z`) as the reader has them
   *  now, for a permalink. */
  getState: () => { pinned: string[]; time: string };
}

export interface ScrubberOptions {
  /** Zones to pin, instead of the URL's `tz` or the defaults. Ids with no
   *  coordinate are dropped, as they are from the URL. */
  pinned?: readonly string[];
  /** The reference time, a UTC instant ending in `Z`, instead of the URL's `t`
   *  or now. */
  time?: string;
  /** Whether to keep the page's query string in step with the state. On by
   *  default; off where the host is not the planner's own page, as in the chat
   *  rail, where `?tz=` would rewrite `/dox`. */
  syncUrl?: boolean;
  /** The clock, as epoch milliseconds, or `null` when it cannot be read. Defaults
   *  to gmt's `getUnixNow`; a test passes its own so nothing depends on the
   *  real time. */
  now?: () => number | null;
  /** The path "Copy shareable link" points at. Defaults to the current page,
   *  which is right on the planner's own page and wrong anywhere else. */
  sharePath?: string;
}

/**
 * The zones the planner opens on, after the reader's own.
 *
 * A deliberate tour of the awkward offsets rather than the largest cities, so
 * the first thing the reader sees is the set of facts a fixed-offset mental
 * model gets wrong:
 *
 *   Atlantic/Reykjavik    far west of Greenwich and still `+00:00`, all year,
 *                         with no daylight saving at all
 *   Europe/Helsinki       `+02:00` / `+03:00` — a plain, well-behaved DST zone
 *                         to read the others against
 *   America/Los_Angeles   `-08:00` / `-07:00`, and it changes on a different
 *                         date from Europe's
 *   Asia/Shanghai         one zone for the whole of China, five geographic
 *                         hours wide
 *   Asia/Calcutta         `+05:30` — not a whole hour
 *   Asia/Katmandu         `+05:45` — not even a half hour
 *
 * The reader's own zone is pinned ahead of these (`openingPins`), labelled as
 * theirs, so the first clock they read is the one they already know and the tour
 * is read against it.
 *
 * Filtered against the coordinate table for the same reason everything else
 * here is — a zone with no coordinate cannot be placed, and the globe and this
 * widget share that list.
 */
const DEFAULT_PINS = [
  "Atlantic/Reykjavik",
  "Europe/Helsinki",
  "America/Los_Angeles",
  "Asia/Shanghai",
  "Asia/Calcutta",
  "Asia/Katmandu",
];

function defaultPins(): string[] {
  return DEFAULT_PINS.filter((id) => COORDINATES_BY_ID.has(id));
}

/** Instants at which two ids for one place must show the same offset, in both
 *  halves of two years, to count as one zone. */
const ALIAS_PROBES = [
  "2000-01-15T12:00:00Z",
  "2000-07-15T12:00:00Z",
  "2024-01-15T12:00:00Z",
  "2024-07-15T12:00:00Z",
];

/**
 * Whether two ids are one zone under two names, so "Asia/Kolkata" and
 * "Asia/Calcutta" are not pinned twice. Decided here, from the coordinate table
 * (a link name shares its zone's place) and the library's offsets, rather than by
 * asking the engine to canonicalise: engines disagree about whether they do
 * (Chromium reports "Asia/Calcutta", WebKit keeps "Asia/Kolkata"). An id with no
 * coordinate is only itself.
 */
export function sameZone(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = COORDINATES_BY_ID.get(a);
  const pb = COORDINATES_BY_ID.get(b);
  if (!pa || !pb || pa.lat !== pb.lat || pa.lng !== pb.lng) return false;
  return ALIAS_PROBES.every((t) => {
    const offset = getTimeZoneOffset(a, t);
    return offset !== "" && offset === getTimeZoneOffset(b, t);
  });
}

/**
 * The zones the planner opens on when nothing seeds it: the reader's own zone
 * first, then the tour.
 *
 * - A zone already in the tour moves to first place instead of appearing twice
 *   (`sameZone`: one zone under two names counts as one).
 * - A zone with no coordinate, or the sentinel (`""`), leaves the tour as it
 *   was. The clock face would not need a coordinate, but a share link carries
 *   `tz=` through `decodeState`, which drops any id without one, so pinning it
 *   would give a link that does not reproduce what the reader sees.
 * - Never more than `MAX_SEEDED_ZONES`.
 *
 * `yours` is the pinned id that is the reader's own, or `null`.
 */
export function openingPins(systemZone: string): {
  pinned: string[];
  yours: string | null;
} {
  const tour = defaultPins();
  const mine = !systemZone
    ? null
    : COORDINATES_BY_ID.has(systemZone)
      ? systemZone
      : null;
  if (mine === null) return { pinned: tour, yours: null };
  const existing = tour.find((id) => sameZone(id, mine));
  const first = existing ?? mine;
  return {
    pinned: [first, ...tour.filter((id) => id !== first)].slice(
      0,
      MAX_SEEDED_ZONES,
    ),
    yours: first,
  };
}
/** ISO weekday order: `parseDayOfWeekFromUtc` returns 1 (Mon) … 7 (Sun). */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** How long before a transition the "next DST transition" button puts the
 *  reference time, and how far past the transition the slider then sits: the
 *  scrubbed instant lands an hour after it, so the tiles already show the new
 *  offset, while the reference time stays an hour before it, so the switch
 *  reads as crossed and dragging back shows the state before. */
const JUMP_LEAD_MIN = 60;
const JUMP_SHIFT_MIN = 2 * JUMP_LEAD_MIN;

interface ScrubberState {
  pinned: string[];
  /** The pinned id that is the reader's own zone, when the planner opened on its
   *  default set; `null` when a link or a call named the zones. */
  yours: string | null;
  anchorMs: number;
  offsetMin: number;
}

/** Epoch-ms -> `YYYY-MM-DDTHH:MM:SSZ`. All time maths goes through `@northguild/gmt`. */
function toUtc(effectiveMs: number): string {
  return convertUnixToUtc(effectiveMs, { epochUnit: "milliseconds" }).replace(
    /\.\d{3}Z$/,
    "Z",
  );
}

/** Epoch-ms, or `null` if the instant string is invalid. */
function fromUtc(utc: string): number | null {
  return convertUtcToUnix(utc, { epochUnit: "milliseconds" });
}

/** `?tz=a,b,c&t=<iso>` — the epic's first URL-state mechanism, minimal by design. */
export function encodeState(
  pinned: readonly string[],
  effectiveMs: number,
): string {
  const params = new URLSearchParams();
  params.set("tz", pinned.join(","));
  params.set("t", toUtc(effectiveMs));
  return `?${params.toString()}`;
}

export function decodeState(search: string): {
  pinned?: string[];
  effectiveMs?: number;
} {
  const params = new URLSearchParams(search);
  const result: { pinned?: string[]; effectiveMs?: number } = {};
  const tz = params.get("tz");
  if (tz) {
    const ids = tz.split(",").filter((id) => COORDINATES_BY_ID.has(id));
    if (ids.length > 0) result.pinned = ids;
  }
  const t = params.get("t");
  if (t) {
    const ms = fromUtc(t);
    if (ms !== null) result.effectiveMs = ms;
  }
  return result;
}

/** A zoned value in UTC, the `[UTC]`-bracketed form `convertZonedToZoned` needs. */
function anchorZoned(effectiveMs: number): string {
  return toUtc(effectiveMs).replace("Z", "+00:00[UTC]");
}

function formatReadout(effectiveMs: number): string {
  const utc = toUtc(effectiveMs);
  const weekday = WEEKDAYS[(parseDayOfWeekFromUtc(utc) ?? 1) - 1];
  const day = Number(parseDayFromUtc(utc));
  const month = MONTHS[Number(parseMonthFromUtc(utc)) - 1];
  const year = parseYearFromUtc(utc);
  return `${weekday} ${day} ${month} ${year}, ${parseHourFromUtc(utc)}:${parseMinuteFromUtc(utc)} UTC`;
}

export { formatShift };

function roundToStep(ms: number): number {
  const stepMs = SLIDER_STEP_MIN * 60_000;
  return Math.round(ms / stepMs) * stepMs;
}

/**
 * `ms` rounded forward to the next 5-minute boundary, which is itself when it is
 * already on one: the planner's default reference time is now, so a meeting
 * proposed from it starts on a boundary that has not passed. Rounded in UTC,
 * where a boundary is the same instant whatever zone the reader is in and no
 * transition can move it.
 */
export function roundUpToStep(ms: number): number | null {
  return roundUnix(ms, {
    smallestUnit: "minute",
    roundingIncrement: SLIDER_STEP_MIN,
    roundingMode: "ceil",
    timeZone: "UTC",
    epochUnit: "milliseconds",
  });
}

/** "Sun 8 Mar, 07:00 UTC" for the status line. */
function formatInstantShort(utc: string): string {
  const weekday = WEEKDAYS[(parseDayOfWeekFromUtc(utc) ?? 1) - 1];
  const month = MONTHS[Number(parseMonthFromUtc(utc)) - 1];
  return `${weekday} ${Number(parseDayFromUtc(utc))} ${month}, ${parseHourFromUtc(utc)}:${parseMinuteFromUtc(utc)} UTC`;
}

/** How long the scrub must rest before the planner says what changed. The slider speaks its
 *  own value on every step, so a live region rewritten on the same steps would talk over it. */
const SETTLE_MS = 500;

/** The `HH:MM` and the parts of a tile, found once when the tiles are built. */
interface TileParts {
  zone: string;
  face: HTMLElement;
  time: HTMLElement;
  date: HTMLElement;
  offset: HTMLElement;
  dst: HTMLElement;
  change: HTMLElement;
  remove: HTMLElement;
}

/**
 * Mounts the planner into `root`, which holds the markup `renderScrubberTemplate` wrote (a
 * docs page server-renders it; the chat rail renders it into its own host).
 */
export async function initScrubber(
  root: HTMLElement,
  options: ScrubberOptions = {},
): Promise<ScrubberHost> {
  defineElements();
  const { el: widgetEl, id, part } = findWidget(root, "multi-zone-scrubber");
  const parsed = decodeState(globalThis.location?.search ?? "");
  const seededPins = (options.pinned ?? []).filter((zone) =>
    COORDINATES_BY_ID.has(zone),
  );
  const seededMs = options.time === undefined ? null : fromUtc(options.time);
  const syncUrl = options.syncUrl ?? true;
  const clock = options.now ?? getUnixNow;
  /** Now, rounded forward to the next 5 minutes: the default reference time and
   *  what "Reset to today" returns to. */
  const nowRounded = (): number => {
    const now = clock();
    return (now === null ? null : roundUpToStep(now)) ?? 0;
  };
  /* A permalink's or a call's time is the reader's own and is kept (to the
     slider's step); only the absence of one means now. */
  const givenMs = seededMs ?? parsed.effectiveMs ?? null;
  /* Only the default state gets the reader's zone: a link or a call that names
     zones is shown as given, with nothing prepended. */
  const named = seededPins.length > 0 ? seededPins : parsed.pinned;
  const opening = named ? null : openingPins(getSystemTimeZone());
  const state: ScrubberState = {
    pinned: named ?? opening!.pinned,
    yours: opening?.yours ?? null,
    anchorMs: givenMs === null ? nowRounded() : roundToStep(givenMs),
    offsetMin: 0,
  };

  const controller = new AbortController();
  const { signal } = controller;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const anchorInput = part<HTMLInputElement>("anchor");
  const jumpButton = part<HTMLButtonElement>("jump");
  const resetButton = part<HTMLButtonElement>("reset");
  const jumpStatus = part("jump-status");
  const liveRegion = part("live");
  const marks = part("marks");
  const rows = part("rows");
  const combobox = widgetEl.querySelector<GmtCombobox>("gmt-combobox")!;
  const rangeEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const readoutEl = widgetEl.querySelector<GmtReadout>("gmt-readout")!;
  const copyEl = widgetEl.querySelector<GmtCopy>("gmt-copy")!;

  /* The choices come at mount, not in the template: the coordinate table stays out of the
     markup, and so out of the chat's first download. */
  combobox.items = [...COORDINATES_BY_ID.keys()];
  rangeEl.formatValue = formatShift;

  /** Said once the scrub settles. `read` runs when the timer ends, not when it starts. */
  function say(read: () => string): void {
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = undefined;
      liveRegion.textContent = read();
    }, SETTLE_MS);
  }

  function effectiveMs(): number {
    return state.anchorMs + state.offsetMin * 60_000;
  }

  function syncControls(): void {
    // `<input type="datetime-local">` wants `YYYY-MM-DDTHH:MM`.
    anchorInput.value = toUtc(state.anchorMs).slice(0, 16);
    rangeEl.value = state.offsetMin;
  }

  function scheduleUrl(): void {
    if (!syncUrl) return;
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const url = encodeState(state.pinned, effectiveMs());
      globalThis.history?.replaceState(null, "", url);
    }, 250);
  }

  /** The `HH:MM` each zone's dial is currently drawn at, so it is only redrawn
   *  when that reading moves. */
  const lastFace = new Map<string, string>();
  let tiles: TileParts[] = [];

  /** Rebuild the tiles — only when the pinned set changes. */
  function buildRows(): void {
    lastFace.clear();
    setHtml(
      rows,
      html`${state.pinned.map((zone, index) =>
        zoneTile({
          id: (local) => id(`z${index}-${local}`),
          zone,
          name: shortZone(zone),
          yours: zone === state.yours,
        }),
      )}`,
    );
    tiles = state.pinned.map((zone, index) => {
      const at = (local: string) => part(`z${index}-${local}`);
      return {
        zone,
        face: at("face"),
        time: at("time"),
        date: at("date"),
        offset: at("offset"),
        dst: at("dst"),
        change: at("change"),
        remove: at("remove"),
      };
    });
  }

  /** Refresh values in the existing tiles: the reading, the DST state at this
   *  instant, and the switch the scrub has crossed since the reference time.
   *  Returns the sentence about each crossed switch, for the settled
   *  announcement. */
  function updateRows(): string {
    const instantMs = effectiveMs();
    const anchor = anchorZoned(instantMs);
    const instant = toUtc(instantMs);
    const crossings: string[] = [];
    tiles.forEach((tile, index) => {
      const zone = tile.zone;
      const reading = readZoneAt(zone, anchor);
      const currentOffset = reading.ok
        ? reading.offset
        : getTimeZoneOffset(zone, instant);

      tile.time.textContent = reading.ok ? hhmm(reading.time) : "⟨ NO SIGNAL ⟩";
      tile.time.dataset["state"] = reading.ok ? "live" : "lost";
      tile.date.textContent = reading.ok ? formatDayLabel(reading.date) : "";

      /* The dial is drawn once and then only its hands and name move, and only when the minute
         it shows changes: a drag steps in whole-minute increments, so there is at most one
         update per step per clock, and none for the many input events inside one step. */
      const stamp = reading.ok ? hhmm(reading.time) : "";
      if (lastFace.get(zone) !== stamp) {
        lastFace.set(zone, stamp);
        if (stamp === "") {
          tile.face.replaceChildren();
        } else {
          const [hh, mm] = stamp.split(":");
          updateCrystalClock(tile.face, {
            id: id(`z${index}-clock`),
            hour: Number(hh),
            minute: Number(mm),
            label: `${shortZone(zone)} clock`,
            sublabel: `${stamp}, ${formatDayLabel(reading.date)}`,
          });
        }
      }

      /* DST at this instant, from the library for this instant, in this zone's
         own year. The tile always says it in words (never colour alone); only a
         zone actually in DST draws the pill. */
      const status = reading.ok
        ? dstStatus(zone, Number(reading.date.slice(0, 4)), reading.inDst)
        : null;
      tile.offset.textContent = currentOffset ? `UTC${currentOffset}` : "";
      tile.dst.dataset["state"] = status ?? "lost";
      tile.dst.textContent =
        status === "dst"
          ? "DST"
          : status === "standard"
            ? "Standard time"
            : status === "none"
              ? "No DST"
              : "";
      tile.dst.title =
        status === "dst"
          ? "Daylight saving time is in effect at this instant"
          : status === "standard"
            ? "Standard time at this instant; this zone changes its clocks this year"
            : status === "none"
              ? "This zone keeps one offset all year"
              : "";

      /* The switch the scrub has crossed since the reference time, from the
         library's transition list for this zone: named, with its size, and the
         new offset is the offset line above it. It shows for as long as the
         scrub stays past it, and goes when the scrub comes back. */
      const crossed = reading.ok
        ? crossedSwitch(zone, state.anchorMs, instantMs)
        : null;
      tile.change.textContent = crossed ? switchLabel(crossed) : "";
      tile.change.title = crossed ? switchTitle(crossed) : "";
      if (crossed) {
        crossings.push(
          `${shortZone(zone)}: ${switchLabel(crossed).toLowerCase()}, now UTC${currentOffset}${status === "dst" ? ", daylight saving time" : ""}`,
        );
      }
    });
    return crossings.join(". ");
  }

  /** "Spring forward +1 h" or "Fall back −1 h". */
  function switchLabel(s: DstSwitch): string {
    return `${s.shiftMin > 0 ? "Spring forward" : "Fall back"} ${formatShift(s.shiftMin)}`;
  }

  function switchTitle(s: DstSwitch): string {
    return `${s.zone}: UTC${s.offsetBefore} to UTC${s.offsetAfter} at ${formatInstantShort(s.instant)}`;
  }

  let lastCrossings = "";
  let lastMarksKey = "";

  /** Marks at each shown zone's switch inside the slider's range. They hang off
   *  the reference time, so they move when it does, not on every drag step. */
  function renderMarks(): void {
    const key = `${state.anchorMs}|${state.pinned.join(",")}`;
    if (key === lastMarksKey) return;
    lastMarksKey = key;
    const seen = new Set<string>();
    const list: SafeHtml[] = [];
    for (const s of switchesInWindow(
      state.pinned,
      state.anchorMs,
      SLIDER_RANGE_MIN * 60_000,
    )) {
      const kind = s.shiftMin > 0 ? "forward" : "back";
      const dedupe = `${s.instantMs}|${kind}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const minutes = (s.instantMs - state.anchorMs) / 60_000;
      const pct = ((minutes + SLIDER_RANGE_MIN) / (2 * SLIDER_RANGE_MIN)) * 100;
      list.push(
        html`<span class="${styles.mark}" data-kind="${kind}" style="--gmt-mark-pct: ${String(pct)}"></span>`,
      );
    }
    setHtml(marks, html`${list}`);
  }

  /** The button is only for a switch there is to go to. */
  let reasonShown = false;
  /* The switch the button last landed on, and the instant it landed the scrub
     at. While the scrub is still where it landed, the next press searches after
     that switch, not after the landing: the landing is an hour past the switch,
     and another zone's switch inside that hour would otherwise be stepped over. */
  let lastJump: { switchMs: number; landedMs: number } | null = null;
  const jumpAfterMs = (): number =>
    lastJump !== null && effectiveMs() === lastJump.landedMs
      ? lastJump.switchMs
      : effectiveMs();
  function updateJumpState(): void {
    const next = nextSwitch(state.pinned, jumpAfterMs());
    jumpButton.disabled = next === null;
    if (next === null) {
      jumpStatus.textContent =
        "None of the shown zones changes its clocks in the next two years.";
      reasonShown = true;
    } else if (reasonShown) {
      jumpStatus.textContent = "";
      reasonShown = false;
    }
  }

  /** The link "Copy shareable link" puts on the clipboard. */
  function shareUrl(): string {
    return `${globalThis.location?.origin ?? ""}${
      options.sharePath ?? globalThis.location?.pathname ?? ""
    }${encodeState(state.pinned, effectiveMs())}`;
  }

  function render(): void {
    readoutEl.value = formatReadout(effectiveMs());
    const crossings = updateRows();
    renderMarks();
    updateJumpState();
    copyEl.text = shareUrl();
    /* Said once the scrub settles, and only when it changed. */
    if (crossings !== lastCrossings) {
      lastCrossings = crossings;
      say(
        () =>
          crossings ||
          "No clock change between the reference time and this time.",
      );
    }
    scheduleUrl();
  }

  // --- events ---------------------------------------------------------
  rangeEl.addEventListener(
    "input",
    () => {
      state.offsetMin = rangeEl.value;
      render();
    },
    { signal },
  );

  anchorInput.addEventListener(
    "change",
    () => {
      const ms = fromUtc(`${anchorInput.value}:00Z`);
      if (ms !== null) {
        state.anchorMs = ms;
        state.offsetMin = 0;
        syncControls();
        render();
      }
    },
    { signal },
  );

  /* The combobox says `change` when a zone is picked or an exact id is typed and entered. The
     text input's own `change` bubbles through it too, with no `detail`: ignored. */
  combobox.addEventListener(
    "change",
    (event) => {
      if (!(event instanceof CustomEvent)) return;
      const value: unknown = event.detail?.value;
      if (typeof value !== "string" || state.pinned.includes(value)) return;
      state.pinned = [...state.pinned, value];
      combobox.value = "";
      buildRows();
      render();
    },
    { signal },
  );

  rows.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tile = tiles.find((t) => t.remove.contains(target));
      if (!tile) return;
      state.pinned = state.pinned.filter((zone) => zone !== tile.zone);
      buildRows();
      render();
    },
    { signal },
  );

  /* The earliest switch after the scrubbed instant among the shown zones,
     whichever way it goes. Pressing again goes on to the next one, searching after
     the switch it landed on (see `lastJump`), so a switch of another zone that
     falls inside the landing hour is still named. */
  jumpButton.addEventListener(
    "click",
    () => {
      const next = nextSwitch(state.pinned, jumpAfterMs());
      if (!next) {
        updateJumpState();
        return;
      }
      state.anchorMs = roundToStep(next.instantMs - JUMP_LEAD_MIN * 60_000);
      state.offsetMin = JUMP_SHIFT_MIN;
      lastJump = { switchMs: next.instantMs, landedMs: effectiveMs() };
      reasonShown = false;
      syncControls();
      render();
      const city = shortZone(next.zone);
      const what =
        next.shiftMin > 0
          ? `${city} springs forward ${formatShift(next.shiftMin)}`
          : `${city} falls back ${formatShift(next.shiftMin)}`;
      const text = `${what} at ${formatInstantShort(next.instant)}. Showing one hour after it.`;
      jumpStatus.textContent = text;
      lastCrossings = text;
      say(() => text);
    },
    { signal },
  );

  /* Back to the opening reference time: now, rounded forward, taken at the
     press. The link then carries that concrete time, so what it opens on is
     what the reader sees. */
  resetButton.addEventListener(
    "click",
    () => {
      state.anchorMs = nowRounded();
      state.offsetMin = 0;
      syncControls();
      render();
      const text = `Reset to now, rounded forward to ${formatInstantShort(toUtc(state.anchorMs))}.`;
      jumpStatus.textContent = text;
      reasonShown = false;
      lastCrossings = "";
      say(() => text);
    },
    { signal },
  );

  syncControls();
  buildRows();
  render();
  /* The night-light easter egg every crystal face on the site shares. Bound on the widget, so
     faces built later by `buildRows` are covered too. */
  bindClockGlow(widgetEl, signal);

  return {
    getState: () => ({ pinned: [...state.pinned], time: toUtc(effectiveMs()) }),
    destroy() {
      if (urlTimer) clearTimeout(urlTimer);
      if (settleTimer) clearTimeout(settleTimer);
      controller.abort();
    },
  };
}

/** `"Asia/Tokyo"` -> `"Tokyo"`; a fixed offset keeps its own name. */
function shortZone(id: string): string {
  if (/^[+-]\d{2}:\d{2}$/.test(id)) return id;
  return (id.split("/").pop() ?? id).replace(/_/g, " ");
}

/** The `HH:MM` of an `HH:MM:SS` reading. The dial has no second hand and the
 *  caption names a minute, so the seconds are noise in both. */
function hhmm(time: string): string {
  return time.slice(0, 5);
}
