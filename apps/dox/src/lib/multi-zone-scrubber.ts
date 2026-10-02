/**
 * DOX-E1b — multi-zone time scrubber (the meeting-planner use case).
 *
 * Pin several IANA zones, drag one slider, and every pinned clock moves
 * together. When the slider crosses a DST transition for a pinned zone, that
 * zone's offset visibly changes and a "bite" badge flags it — never a silent
 * reflow. The pinned-zones-plus-time configuration encodes into the URL so it
 * can be copied and shared to propose a meeting time.
 *
 * All time maths is `@northguild/gmt`: `convertZonedToZoned` + `getTimeZoneOffset`
 * for the per-zone readings (via `./zone-clock`), and `getDstTransitions` for
 * the "jump to a DST boundary" preset. The `@js-temporal/polyfill` rides along
 * in this lazy-loaded chunk, never on a page's critical path.
 *
 * Entry point: `initScrubber(host)` — host element in, matching the widget
 * mount pattern so DOX-C3a's `/dox` rail can adopt it unchanged.
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

import { COORDINATES_BY_ID } from "./globe-zones";
import { bindClockGlow, renderCrystalClock } from "./crystal-clock";
import { formatDayLabel } from "./dwell-ledger";
import { enter } from "./enter";
import { readZoneAt } from "./zone-clock";
import { createZoneCombobox } from "./zone-combobox";
import { settledAnnouncer } from "./punctuality-widgets";
import {
  crossedSwitch,
  dstStatus,
  nextSwitch,
  switchesInWindow,
  type DstSwitch,
} from "./scrubber-dst";
import { MAX_SEEDED_ZONES } from "./zone-planner";
import { rangeFieldHtml, syncRange } from "./widget-ui";

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
const SLIDER_RANGE_MIN = 36 * 60; // ±36 h
/** The granularity of everything the reader can move: the slider's step, the
 *  reference-time field's own step, and what a seeded or restored anchor is
 *  rounded to. Named once and derived everywhere — the field used to carry its
 *  own hardcoded `step="900"`, which is the same number said twice and the
 *  usual way two steppers end up disagreeing. */
const SLIDER_STEP_MIN = 5;
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

/** Earliest offset change strictly after `fromMs` among the given zones, from
 *  the library's transition list (`scrubber-dst.ts`). */
export function nextTransition(
  zones: readonly string[],
  fromMs: number,
): { zone: string; instantMs: number } | null {
  const next = nextSwitch(zones, fromMs);
  return next ? { zone: next.zone, instantMs: next.instantMs } : null;
}

function formatReadout(effectiveMs: number): string {
  const utc = toUtc(effectiveMs);
  const weekday = WEEKDAYS[(parseDayOfWeekFromUtc(utc) ?? 1) - 1];
  const day = Number(parseDayFromUtc(utc));
  const month = MONTHS[Number(parseMonthFromUtc(utc)) - 1];
  const year = parseYearFromUtc(utc);
  return `${weekday} ${day} ${month} ${year}, ${parseHourFromUtc(utc)}:${parseMinuteFromUtc(utc)} UTC`;
}

/** The slider's shift as a signed, worded offset: `+1 h 15 min`, `−45 min`, `0 min`. */
export function formatShift(minutes: number): string {
  if (minutes === 0) return "0 min";
  const sign = minutes < 0 ? "\u2212" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${[h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ")}`;
}

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

export async function initScrubber(
  host: HTMLElement,
  options: ScrubberOptions = {},
): Promise<ScrubberHost> {
  const parsed = decodeState(globalThis.location?.search ?? "");
  const seededPins = (options.pinned ?? []).filter((id) =>
    COORDINATES_BY_ID.has(id),
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

  /** The `HH:MM` each zone's dial is currently drawn at, so it is only redrawn
      when that reading moves. */
  const lastFace = new Map<string, string>();
  const clockGlow = new AbortController();
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  host.classList.add("gmt-scrubber", "gmt-widget", "not-content");
  /* The two numbered cards of the shared widget grid (styles/gmt-widget.css):
     card 1 takes the input, card 2 draws the answer. Card 2 is the chart card,
     so it takes the rest of the row on a wide pane — which is what gives the
     clock faces room to sit several across instead of in a list. */
  host.innerHTML = `
    <div class="gmt-widget-card">
    <div class="gmt-widget-section">
    <h4>1. Pin the zones and pick a time</h4>
    <div class="gmt-scrubber-controls">
      <label>Reference time (UTC)
        <input type="datetime-local" class="gmt-field" data-role="anchor" step="${SLIDER_STEP_MIN * 60}" />
      </label>
      <div class="gmt-combobox">
        <label for="scrubber-add">Add a zone</label>
        <div class="gmt-scrubber-field-row">
          <input type="search" id="scrubber-add" class="gmt-field" placeholder="e.g. Australia/Sydney"
            autocomplete="off" data-role="add" />
          <button type="button" class="gmt-button gmt-scrubber-add-addon" data-role="add-open"
            aria-expanded="false" aria-label="Browse every zone">+</button>
        </div>
      </div>
    </div>
    <div class="gmt-scrubber-actions">
      <button type="button" class="gmt-button" data-role="dst-preset">
        Jump to the next DST transition
      </button>
      <button type="button" class="gmt-button" data-role="reset"
        title="Set the reference time to now, rounded forward to the next 5 minutes">
        Reset to today
      </button>
    </div>
    <p class="gmt-scrubber-jump-status" data-role="jump-status"></p>
    <p class="gmt-scrubber-visually-hidden" role="status" aria-live="polite" data-role="live"></p>
    <div class="gmt-scrubber-slider">${rangeFieldHtml({
      role: "slider",
      min: -SLIDER_RANGE_MIN,
      max: SLIDER_RANGE_MIN,
      step: SLIDER_STEP_MIN,
      value: 0,
      valueText: formatShift(0),
      ends: [formatShift(-SLIDER_RANGE_MIN), formatShift(SLIDER_RANGE_MIN)],
      label: `Shift every pinned clock, in ${SLIDER_STEP_MIN}-minute steps`,
    })}</div>
    <p class="gmt-scrubber-readout" data-role="readout" aria-live="polite"></p>
    <div class="gmt-scrubber-share">
      <button type="button" class="gmt-button" data-role="share">Copy shareable link</button>
      <span data-role="share-status" aria-live="polite"></span>
    </div>
    </div>
    <div class="gmt-widget-section">
    <h4>2. Every pinned clock</h4>
    <div class="gmt-scrubber-rows" data-role="rows"></div>
    </div>
    </div>`;

  const anchorInput = host.querySelector<HTMLInputElement>(
    "[data-role='anchor']",
  )!;
  const slider = host.querySelector<HTMLInputElement>("[data-role='slider']")!;
  const readout = host.querySelector<HTMLElement>("[data-role='readout']")!;
  const rows = host.querySelector<HTMLElement>("[data-role='rows']")!;
  const addInput = host.querySelector<HTMLInputElement>("[data-role='add']")!;
  const shareButton = host.querySelector<HTMLElement>("[data-role='share']")!;
  const shareStatus = host.querySelector<HTMLElement>(
    "[data-role='share-status']",
  )!;
  const presetButton = host.querySelector<HTMLButtonElement>(
    "[data-role='dst-preset']",
  )!;
  const resetButton = host.querySelector<HTMLButtonElement>(
    "[data-role='reset']",
  )!;
  const jumpStatus = host.querySelector<HTMLElement>(
    "[data-role='jump-status']",
  )!;
  const announcer = settledAnnouncer(
    host.querySelector<HTMLElement>("[data-role='live']"),
  );
  /* Marks on the slider's track at every switch the shown zones make within its
     range. Decorative: each tile says the same in words. */
  const marks = document.createElement("span");
  marks.className = "gmt-scrubber-marks";
  marks.setAttribute("aria-hidden", "true");
  host.querySelector(".gmt-range-field")?.append(marks);

  function effectiveMs(): number {
    return state.anchorMs + state.offsetMin * 60_000;
  }

  function syncControls(): void {
    // `<input type="datetime-local">` wants `YYYY-MM-DDTHH:MM`.
    anchorInput.value = toUtc(state.anchorMs).slice(0, 16);
    slider.value = String(state.offsetMin);
    syncRange(slider, formatShift(state.offsetMin));
  }

  function scheduleUrl(): void {
    if (!syncUrl) return;
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const url = encodeState(state.pinned, effectiveMs());
      globalThis.history?.replaceState(null, "", url);
    }, 250);
  }

  /** Rebuild card structure — only when the pinned set changes. */
  function buildRows(): void {
    rows.innerHTML = "";
    lastFace.clear();
    for (const id of state.pinned) {
      const row = document.createElement("div");
      row.className = "gmt-scrubber-clock";
      row.dataset.switched = "false";
      row.dataset.zoneRow = id;
      const yours = id === state.yours;
      if (yours) row.dataset.yours = "true";
      row.innerHTML =
        `<div class="gmt-scrubber-clock-face" data-field="face"></div>` +
        `<p class="gmt-scrubber-clock-time" data-field="time">&nbsp;</p>` +
        `<p class="gmt-scrubber-clock-date" data-field="date">&nbsp;</p>` +
        `<p class="gmt-scrubber-clock-zone" title="${escapeHtml(id)}">${escapeHtml(shortZone(id))}</p>` +
        `<p class="gmt-scrubber-clock-offset" data-field="offset">&nbsp;</p>` +
        `<p class="gmt-scrubber-dst-slot"><span class="gmt-scrubber-dst" data-field="dst" data-state="none"></span></p>` +
        `<p class="gmt-scrubber-switch-slot"><span class="gmt-scrubber-switch" data-field="switch"></span></p>` +
        (yours
          ? `<p class="gmt-scrubber-clock-yours" data-field="yours">Your time zone</p>`
          : "") +
        `<button type="button" class="gmt-scrubber-remove" data-role="remove" ` +
        `aria-label="Remove ${escapeHtml(id)}${yours ? " (your time zone)" : ""}">✕</button>`;
      row
        .querySelector<HTMLElement>("[data-role='remove']")
        ?.addEventListener("click", () => {
          state.pinned = state.pinned.filter((z) => z !== id);
          lastFace.delete(id);
          buildRows();
          render();
        });
      rows.appendChild(row);
    }
  }

  /** Refresh values in the existing rows: the reading, the DST state at this
   *  instant, and the switch the scrub has crossed since the reference time.
   *  Returns the sentence about each crossed switch, for the settled
   *  announcement. */
  function updateRows(): string {
    const instantMs = effectiveMs();
    const anchor = anchorZoned(instantMs);
    const instant = toUtc(instantMs);
    const crossings: string[] = [];
    for (const id of state.pinned) {
      const row = rows.querySelector<HTMLElement>(`[data-zone-row="${id}"]`);
      if (!row) continue;
      const reading = readZoneAt(id, anchor);
      const timeEl = row.querySelector<HTMLElement>("[data-field='time']");
      const offsetEl = row.querySelector<HTMLElement>("[data-field='offset']");
      const currentOffset = reading.ok
        ? reading.offset
        : getTimeZoneOffset(id, instant);

      const dateEl = row.querySelector<HTMLElement>("[data-field='date']");
      const faceEl = row.querySelector<HTMLElement>("[data-field='face']");

      if (timeEl) {
        timeEl.textContent = reading.ok ? hhmm(reading.time) : "⟨ NO SIGNAL ⟩";
        timeEl.classList.toggle("gmt-signal-lost", !reading.ok);
      }
      if (dateEl) {
        dateEl.textContent = reading.ok ? formatDayLabel(reading.date) : "";
      }
      /* The dial is an SVG string, so it is rebuilt rather than mutated — but
         only when the minute it shows actually changes. A drag steps in whole
         whole-minute increments, so this is at most one rebuild per step per
         clock, and none at all for the many input events that land inside the
         same step. */
      if (faceEl) {
        const stamp = reading.ok ? hhmm(reading.time) : "";
        if (lastFace.get(id) !== stamp) {
          lastFace.set(id, stamp);
          const appearing = !faceEl.firstElementChild;
          if (stamp === "") {
            faceEl.innerHTML = "";
          } else {
            const [hh, mm] = stamp.split(":");
            faceEl.innerHTML = renderCrystalClock({
              id: `scrubber-${id.replace(/[^a-zA-Z0-9]/g, "-")}`,
              hour: Number(hh),
              minute: Number(mm),
              label: `${shortZone(id)} clock`,
              sublabel: `${stamp}, ${formatDayLabel(reading.date)}`,
            });
            if (appearing) enter(faceEl);
          }
        }
      }

      /* DST at this instant, from the library for this instant, in this zone's
         own year. The tile always says it in words (never colour alone); only a
         zone actually in DST draws the pill. */
      const status = reading.ok
        ? dstStatus(id, Number(reading.date.slice(0, 4)), reading.inDst)
        : null;
      if (offsetEl) {
        offsetEl.textContent = currentOffset ? `UTC${currentOffset}` : "";
      }
      const dstEl = row.querySelector<HTMLElement>("[data-field='dst']");
      if (dstEl) {
        dstEl.dataset["state"] = status ?? "lost";
        dstEl.textContent =
          status === "dst"
            ? "DST"
            : status === "standard"
              ? "Standard time"
              : status === "none"
                ? "No DST"
                : "";
        dstEl.title =
          status === "dst"
            ? "Daylight saving time is in effect at this instant"
            : status === "standard"
              ? "Standard time at this instant; this zone changes its clocks this year"
              : status === "none"
                ? "This zone keeps one offset all year"
                : "";
      }

      /* The switch the scrub has crossed since the reference time, from the
         library's transition list for this zone: named, with its size, and the
         new offset is the offset line above it. It shows for as long as the
         scrub stays past it, and goes when the scrub comes back. */
      const crossed = reading.ok
        ? crossedSwitch(id, state.anchorMs, instantMs)
        : null;
      const switchEl = row.querySelector<HTMLElement>("[data-field='switch']");
      if (switchEl) {
        switchEl.textContent = crossed ? switchLabel(crossed) : "";
        switchEl.title = crossed ? switchTitle(crossed) : "";
      }
      row.dataset["switched"] = crossed ? "true" : "false";
      if (crossed) {
        crossings.push(
          `${shortZone(id)}: ${switchLabel(crossed).toLowerCase()}, now UTC${currentOffset}${status === "dst" ? ", daylight saving time" : ""}`,
        );
      }
    }
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
    marks.replaceChildren();
    const seen = new Set<string>();
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
      const mark = document.createElement("span");
      mark.className = "gmt-scrubber-mark";
      mark.dataset["kind"] = kind;
      mark.style.setProperty("--gmt-mark-pct", String(pct));
      marks.append(mark);
    }
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
    presetButton.disabled = next === null;
    if (next === null) {
      jumpStatus.textContent =
        "None of the shown zones changes its clocks in the next two years.";
      reasonShown = true;
    } else if (reasonShown) {
      jumpStatus.textContent = "";
      reasonShown = false;
    }
  }

  function render(): void {
    readout.textContent = formatReadout(effectiveMs());
    const crossings = updateRows();
    renderMarks();
    updateJumpState();
    /* Said once the scrub settles, and only when it changed: the slider speaks
       its own value on every step. */
    if (crossings !== lastCrossings) {
      lastCrossings = crossings;
      announcer.say(
        () =>
          crossings ||
          "No clock change between the reference time and this time.",
      );
    }
    scheduleUrl();
  }

  // --- events ---------------------------------------------------------
  slider.addEventListener("input", () => {
    state.offsetMin = Number(slider.value);
    syncRange(slider, formatShift(state.offsetMin));
    render();
  });

  anchorInput.addEventListener("change", () => {
    const ms = fromUtc(`${anchorInput.value}:00Z`);
    if (ms !== null) {
      state.anchorMs = ms;
      state.offsetMin = 0;
      syncControls();
      render();
    }
  });

  /* The attached "+" opens the same list the typeahead shows, so the whole set
     is browsable without knowing an id to type. It mirrors the list's open
     state for its own styling and for assistive tech; the input keeps the
     `aria-expanded` that names the listbox. */
  const addOpen = host.querySelector<HTMLElement>("[data-role='add-open']");
  const combobox = createZoneCombobox(
    addInput,
    [...COORDINATES_BY_ID.keys()],
    (value) => {
      if (!state.pinned.includes(value)) {
        state.pinned = [...state.pinned, value];
        addInput.value = "";
        buildRows();
        render();
      }
    },
    (open) => addOpen?.setAttribute("aria-expanded", String(open)),
  );
  /* Pressing the button must not take focus from the input: the blur would
     start the list's close timer, and a press longer than that shuts the list
     just before the click reopens it. */
  addOpen?.addEventListener("mousedown", (event) => event.preventDefault());
  addOpen?.addEventListener("click", () => combobox.toggle());

  /* The earliest switch after the scrubbed instant among the shown zones,
     whichever way it goes. Pressing again goes on to the next one, searching after
     the switch it landed on (see `lastJump`), so a switch of another zone that
     falls inside the landing hour is still named. */
  presetButton.addEventListener("click", () => {
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
    jumpStatus.textContent = `${what} at ${formatInstantShort(next.instant)}. Showing one hour after it.`;
    jumpStatus.title = switchTitle(next);
    lastCrossings = jumpStatus.textContent;
    announcer.say(() => jumpStatus.textContent ?? "");
  });

  /* Back to the opening reference time: now, rounded forward, taken at the
     press. The link then carries that concrete time, so what it opens on is
     what the reader sees. */
  resetButton.addEventListener("click", () => {
    state.anchorMs = nowRounded();
    state.offsetMin = 0;
    syncControls();
    render();
    jumpStatus.textContent = `Reset to now, rounded forward to ${formatInstantShort(toUtc(state.anchorMs))}.`;
    jumpStatus.title = "";
    reasonShown = false;
    lastCrossings = "";
    announcer.say(() => jumpStatus.textContent ?? "");
  });

  shareButton.addEventListener("click", async () => {
    const url = `${globalThis.location?.origin ?? ""}${
      options.sharePath ?? globalThis.location?.pathname ?? ""
    }${encodeState(state.pinned, effectiveMs())}`;
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = "Link copied.";
    } catch {
      shareStatus.textContent = url;
    }
  });

  syncControls();
  buildRows();
  render();
  /* The night-light easter egg every crystal face on the site shares. Bound on
     the host, so faces built later by `buildRows` are covered too. */
  bindClockGlow(host, clockGlow.signal);

  return {
    getState: () => ({ pinned: [...state.pinned], time: toUtc(effectiveMs()) }),
    destroy() {
      if (urlTimer) clearTimeout(urlTimer);
      announcer.cancel();
      combobox.destroy();
      clockGlow.abort();
      host.innerHTML = "";
      host.classList.remove("gmt-scrubber", "gmt-widget", "not-content");
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

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}
