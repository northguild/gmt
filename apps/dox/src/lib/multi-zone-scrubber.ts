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
  getSystemTimeZone,
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
import { readZoneAt } from "./zone-clock";
import { createZoneCombobox } from "./zone-combobox";

export interface ScrubberHost {
  destroy: () => void;
}

const FALLBACK_PINS = ["America/New_York", "Europe/London", "Asia/Tokyo"];

/** The viewer's own zone first, then a spread of others — deduped, coord-backed. */
function defaultPins(): string[] {
  const system = getSystemTimeZone();
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const id of [system, ...FALLBACK_PINS]) {
    if (id && !seen.has(id) && COORDINATES_BY_ID.has(id)) {
      seen.add(id);
      pins.push(id);
    }
  }
  return pins.slice(0, 3);
}
const SLIDER_RANGE_MIN = 36 * 60; // ±36 h
const SLIDER_STEP_MIN = 15;
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
  return convertUnixToUtc(effectiveMs, "milliseconds").replace(
    /\.\d{3}Z$/,
    "Z",
  );
}

/** Epoch-ms, or `null` if the instant string is invalid. */
function fromUtc(utc: string): number | null {
  return convertUtcToUnix(utc, "milliseconds");
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

function roundToStep(ms: number): number {
  const stepMs = SLIDER_STEP_MIN * 60_000;
  return Math.round(ms / stepMs) * stepMs;
}

export async function initScrubber(host: HTMLElement): Promise<ScrubberHost> {
  const parsed = decodeState(globalThis.location?.search ?? "");
  const state: ScrubberState = {
    pinned: parsed.pinned ?? defaultPins(),
    anchorMs: roundToStep(parsed.effectiveMs ?? getUnixNow()),
    offsetMin: 0,
  };

  const lastOffset = new Map<string, string>();
  const biteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  host.classList.add("gmt-scrubber");
  host.innerHTML = `
    <div class="gmt-scrubber-controls">
      <label>Reference time (UTC)
        <input type="datetime-local" data-role="anchor" step="900" />
      </label>
      <button type="button" class="gmt-clock-entry" data-role="dst-preset">
        Jump to a DST transition
      </button>
      <div class="gmt-combobox">
        <label for="scrubber-add">Add a zone</label>
        <input type="search" id="scrubber-add" placeholder="e.g. Australia/Sydney"
          autocomplete="off" data-role="add" />
      </div>
    </div>
    <div class="gmt-scrubber-slider">
      <input type="range" data-role="slider"
        min="${-SLIDER_RANGE_MIN}" max="${SLIDER_RANGE_MIN}" step="${SLIDER_STEP_MIN}" value="0"
        aria-label="Shift every pinned clock, in 15-minute steps" />
    </div>
    <p class="gmt-scrubber-readout" data-role="readout" aria-live="polite"></p>
    <div class="gmt-scrubber-rows" data-role="rows"></div>
    <div class="gmt-scrubber-share">
      <button type="button" class="gmt-clock-entry" data-role="share">Copy shareable link</button>
      <span data-role="share-status" aria-live="polite"></span>
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

  /** Rebuild row structure — only when the pinned set changes. */
  function buildRows(): void {
    rows.innerHTML = "";
    for (const id of state.pinned) {
      const row = document.createElement("div");
      row.className = "gmt-scrubber-row";
      row.dataset.bite = "false";
      row.dataset.zoneRow = id;
      row.innerHTML =
        `<span class="gmt-scrubber-zone">${escapeHtml(id)}</span>` +
        `<span class="gmt-scrubber-time" data-field="time"></span>` +
        `<span class="gmt-scrubber-offset" data-field="offset"></span>` +
        `<span class="gmt-scrubber-bite" aria-live="polite"></span>` +
        `<button type="button" class="gmt-scrubber-remove" data-role="remove" ` +
        `aria-label="Remove ${escapeHtml(id)}">✕</button>`;
      row
        .querySelector<HTMLElement>("[data-role='remove']")
        ?.addEventListener("click", () => {
          state.pinned = state.pinned.filter((z) => z !== id);
          lastOffset.delete(id);
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

      if (timeEl) {
        timeEl.textContent = reading.ok
          ? `${reading.date} ${reading.time}`
          : "⟨ NO SIGNAL ⟩";
        timeEl.classList.toggle("gmt-signal-lost", !reading.ok);
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

  return {
    destroy() {
      if (urlTimer) clearTimeout(urlTimer);
      for (const timer of biteTimers.values()) clearTimeout(timer);
      combobox.destroy();
      host.innerHTML = "";
      host.classList.remove("gmt-scrubber");
    },
  };
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
