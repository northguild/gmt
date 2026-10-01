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
  getDstTransitions,
  getTimeZoneOffset,
  getUnixNow,
  parseDayFromUtc,
  parseDayOfWeekFromUtc,
  parseHourFromUtc,
  parseMinuteFromUtc,
  parseMonthFromUtc,
  parseYearFromUtc,
} from "@northguild/gmt";

import { COORDINATES_BY_ID } from "./globe-zones";
import { bindClockGlow, renderCrystalClock } from "./crystal-clock";
import { formatDayLabel } from "./dwell-ledger";
import { enter } from "./enter";
import { readZoneAt } from "./zone-clock";
import { createZoneCombobox } from "./zone-combobox";
import { rangeFieldHtml, syncRange } from "./widget-ui";

export interface ScrubberHost {
  destroy: () => void;
}

/**
 * The zones the planner opens on.
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
 * The viewer's own zone is deliberately no longer pinned first: it made the
 * opening set different for every reader, which is the one thing a teaching
 * example cannot be. Anyone can still add it in a keystroke.
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
const SLIDER_RANGE_MIN = 36 * 60; // ±36 h
/** The granularity of everything the reader can move: the slider's step, the
 *  reference-time field's own step, and what a seeded or restored anchor is
 *  rounded to. Named once and derived everywhere — the field used to carry its
 *  own hardcoded `step="900"`, which is the same number said twice and the
 *  usual way two steppers end up disagreeing. */
const SLIDER_STEP_MIN = 5;
const BITE_CLEAR_MS = 4000;
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

interface ScrubberState {
  pinned: string[];
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

/** Earliest DST transition strictly after `fromMs` among the given zones. */
export function nextTransition(
  zones: readonly string[],
  fromMs: number,
): { zone: string; instantMs: number } | null {
  const year = Number(parseYearFromUtc(toUtc(fromMs)));
  if (!Number.isInteger(year)) return null;
  let best: { zone: string; instantMs: number } | null = null;
  for (const zone of zones) {
    for (const y of [year, year + 1]) {
      for (const transition of getDstTransitions(zone, y)) {
        const ms = fromUtc(transition.instant);
        if (ms !== null && ms > fromMs && (!best || ms < best.instantMs)) {
          best = { zone, instantMs: ms };
        }
      }
    }
  }
  return best;
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

export async function initScrubber(host: HTMLElement): Promise<ScrubberHost> {
  const parsed = decodeState(globalThis.location?.search ?? "");
  const state: ScrubberState = {
    pinned: parsed.pinned ?? defaultPins(),
    anchorMs: roundToStep(parsed.effectiveMs ?? getUnixNow() ?? 0),
    offsetMin: 0,
  };

  const lastOffset = new Map<string, string>();
  /** The `HH:MM` each zone's dial is currently drawn at, so it is only redrawn
      when that reading moves. */
  const lastFace = new Map<string, string>();
  const clockGlow = new AbortController();
  const biteTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
        Jump to a DST transition
      </button>
    </div>
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
  const presetButton = host.querySelector<HTMLElement>(
    "[data-role='dst-preset']",
  )!;

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
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const url = encodeState(state.pinned, effectiveMs());
      globalThis.history?.replaceState(null, "", url);
    }, 250);
  }

  function markBite(id: string, from: string, to: string): void {
    const row = rows.querySelector<HTMLElement>(`[data-zone-row="${id}"]`);
    if (!row) return;
    const badge = row.querySelector<HTMLElement>(".gmt-scrubber-bite");
    if (badge) badge.textContent = `DST ${from} → ${to}`;
    row.dataset.bite = "true";
    const existing = biteTimers.get(id);
    if (existing) clearTimeout(existing);
    biteTimers.set(
      id,
      setTimeout(() => {
        if (row.isConnected) row.dataset.bite = "false";
      }, BITE_CLEAR_MS),
    );
  }

  /** Rebuild card structure — only when the pinned set changes. */
  function buildRows(): void {
    rows.innerHTML = "";
    lastFace.clear();
    for (const id of state.pinned) {
      const row = document.createElement("div");
      row.className = "gmt-scrubber-clock";
      row.dataset.bite = "false";
      row.dataset.zoneRow = id;
      row.innerHTML =
        `<div class="gmt-scrubber-clock-face" data-field="face"></div>` +
        `<p class="gmt-scrubber-clock-time" data-field="time">&nbsp;</p>` +
        `<p class="gmt-scrubber-clock-date" data-field="date">&nbsp;</p>` +
        `<p class="gmt-scrubber-clock-zone" title="${escapeHtml(id)}">${escapeHtml(shortZone(id))}</p>` +
        `<p class="gmt-scrubber-clock-offset" data-field="offset">&nbsp;</p>` +
        `<span class="gmt-scrubber-bite" aria-live="polite"></span>` +
        `<button type="button" class="gmt-scrubber-remove" data-role="remove" ` +
        `aria-label="Remove ${escapeHtml(id)}">✕</button>`;
      row
        .querySelector<HTMLElement>("[data-role='remove']")
        ?.addEventListener("click", () => {
          state.pinned = state.pinned.filter((z) => z !== id);
          lastOffset.delete(id);
          lastFace.delete(id);
          buildRows();
          render();
        });
      rows.appendChild(row);
    }
  }

  /** Refresh values in the existing rows, and flag any DST "bite". */
  function updateRows(): void {
    const anchor = anchorZoned(effectiveMs());
    const instant = toUtc(effectiveMs());
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
      if (offsetEl) {
        offsetEl.textContent = currentOffset ? `UTC${currentOffset}` : "";
        offsetEl.title = !reading.observesDst
          ? "no DST"
          : reading.inDst
            ? "in DST"
            : "standard time";
      }

      const previous = lastOffset.get(id);
      if (previous && currentOffset && previous !== currentOffset) {
        markBite(id, previous, currentOffset);
      }
      if (currentOffset) lastOffset.set(id, currentOffset);
    }
  }

  function render(): void {
    readout.textContent = formatReadout(effectiveMs());
    updateRows();
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
      lastOffset.clear();
      syncControls();
      render();
    }
  });

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
  );

  /* The attached "+" opens the same list the typeahead shows, so the whole set
     is browsable without knowing an id to type. It mirrors the input's
     `aria-expanded` for its own open styling; the input keeps the one that
     names the listbox. */
  const addOpen = host.querySelector<HTMLElement>("[data-role='add-open']");
  addOpen?.addEventListener("click", () => {
    combobox.toggle();
    addOpen.setAttribute(
      "aria-expanded",
      addInput.getAttribute("aria-expanded") ?? "false",
    );
  });

  presetButton.addEventListener("click", () => {
    const transition = nextTransition(state.pinned, effectiveMs());
    if (!transition) {
      shareStatus.textContent =
        "No upcoming DST transition for the pinned zones.";
      return;
    }
    // Land the anchor an hour before the transition; the slider then drags across it.
    state.anchorMs = roundToStep(transition.instantMs - 60 * 60_000);
    state.offsetMin = 0;
    lastOffset.clear();
    syncControls();
    render();
    shareStatus.textContent = `Drag the slider forward — ${transition.zone} shifts at the boundary.`;
  });

  shareButton.addEventListener("click", async () => {
    const url = `${globalThis.location?.origin ?? ""}${
      globalThis.location?.pathname ?? ""
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
    destroy() {
      if (urlTimer) clearTimeout(urlTimer);
      for (const timer of biteTimers.values()) clearTimeout(timer);
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
