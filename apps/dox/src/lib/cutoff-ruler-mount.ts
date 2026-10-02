/**
 * The Cut-off Ruler widget (TRAN-10), mountable on its tool page and in the
 * chat rail.
 *
 * One departure's "N days before" read three ways by `cutoffAt` — calendar
 * days, exact hours, a pinned local time — on one axis, with any DST change
 * between them marked. Every reading, every hours-before figure and the
 * transition marker come from `cutoffAt`, `timeToCutoff` and the polyfill's
 * `getTimeZoneTransition` alone.
 */
import { Temporal } from "@js-temporal/polyfill";
import {
  CUSTOM_PRESET_ID,
  RULER_PRESETS,
  collectRulerFacts,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readingsOf,
  rulerNullReason,
  rulerNullText,
  transitionBetween,
  transitionKind,
  transitionLabel,
  transitionShiftMinutes,
  type CutoffRulerArgs,
  type RulerFacts,
  type RulerReading,
  type RulerState,
} from "./cutoff-ruler";
import {
  TRANSPORT_ZONES,
  zoneOptionsHtml,
  callSource,
  dayTickLabel,
  durationText,
  hourTickLabel,
  isDayBoundary,
  localLabel,
  epochMs,
  walkTicks,
} from "./cutoff-widgets";
import { codeFrameHtml } from "./code-frame";
import { loadCutoffLib } from "./cutoff-lib";
import {
  layoutWidth,
  onWidthChange,
  pickLabelLeft,
  placeLabel,
  thinTickLabels,
} from "./label-fit";
import type { CutoffLib } from "./cutoff-widgets";
import { transportIcon } from "./transport-icons";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  drawOrRangeEdge,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { CutoffRulerArgs } from "./cutoff-ruler";

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    RULER_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

export function renderCutoffRulerTemplate(args: CutoffRulerArgs = {}): string {
  const seeded = args.anchor !== undefined || args.days !== undefined;
  const state: RulerState = seeded
    ? readArgs(args)
    : presetState(RULER_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = RULER_PRESETS.find((p) => p.id === presetId);
  const days = Number.parseInt(state.days, 10) || 1;

  return (
    `<div class="gmt-cutoff-ruler gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The departure and the rule</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Departs")}` +
    `<input class="gmt-input" data-role="anchor" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.anchor)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Terminal clock")}` +
    `<select class="gmt-select" data-role="time-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Days before")}` +
    `<select class="gmt-select" data-role="days">${(days >= 1 && days <= 7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7, days]).map((n) => `<option value="${n}"${n === days ? " selected" : ""}>${n}</option>`).join("")}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("At local time")}` +
    `<input class="gmt-input" data-role="at-local-time" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.atLocalTime)}"></label>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Three readings of "<span data-role="days-heading">${days}</span> days before"</h4>` +
    `<div class="gmt-cutoff-ruler-overview" data-role="ruler-overview" role="img" aria-labelledby="ruler-summary" tabindex="-1"></div>` +
    `<div class="gmt-cutoff-ruler-closeup" data-role="ruler-closeup" role="img" aria-labelledby="ruler-summary" tabindex="-1"></div>` +
    `<p class="gmt-widget-hint" id="ruler-summary" data-role="ruler-summary"></p>` +
    `<ul class="gmt-cutoff-ruler-readings" data-role="readings"></ul>` +
    `<p class="gmt-widget-hint" data-role="static-caption"></p>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>cutoffAt</code> returns</h4>` +
    codeFrameHtml("ruler-calendar") +
    `<output class="gmt-widget-output" data-role="ruler-output-calendar">&nbsp;</output>` +
    codeFrameHtml("ruler-exact") +
    `<output class="gmt-widget-output" data-role="ruler-output-exact">&nbsp;</output>` +
    codeFrameHtml("ruler-pinned") +
    `<output class="gmt-widget-output" data-role="ruler-output-pinned">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const READING_ROLE: Record<string, string> = {
  calendar: "ruler-calendar",
  exact: "ruler-exact",
  pinned: "ruler-pinned",
};

/** The series each reading is drawn in, in the lane, the close-up and its
 *  card: calendar 1, exact 2, pinned 3. Names a reading, computes nothing. */
const READING_SERIES: Record<string, number> = {
  calendar: 1,
  exact: 2,
  pinned: 3,
};

const seriesOf = (r: RulerReading): number => READING_SERIES[r.key] ?? 1;

const SWATCH = `<span class="gmt-cutoff-series-swatch" aria-hidden="true"></span>`;

function tickHtml(t: { ms: number; label: string }, pct: number): string {
  return `<span class="gmt-cutoff-axis-tick${isDayBoundary(t.label) ? " gmt-cutoff-axis-tick--day" : ""}" style="left:${pct}%">${escapeHtml(t.label)}</span>`;
}

/** The local midnight at or before `ms`, in `zone` — the polyfill's own
 *  `startOfDay`, for the overview's exact-time axis start. `ms` unchanged
 *  when the zone does not resolve. */
function localMidnightBefore(ms: number, zone: string): number {
  try {
    return Temporal.Instant.fromEpochMilliseconds(ms)
      .toZonedDateTimeISO(zone)
      .startOfDay().epochMilliseconds;
  } catch {
    return ms;
  }
}

function renderOverview(
  el: HTMLElement,
  state: RulerState,
  facts: RulerFacts,
): void {
  if (!facts.departure) {
    el.innerHTML = "";
    return;
  }
  const timeZone = state.timeZone.trim();
  const departureMs = epochMs(facts.departure);
  const resolvedMs = facts.readings
    .filter((r) => r.at !== "")
    .map((r) => epochMs(r.at));
  const earliestMs =
    resolvedMs.length > 0 ? Math.min(...resolvedMs) : departureMs;
  const startMs = localMidnightBefore(earliestMs, timeZone);
  const span = Math.max(1, departureMs - startMs);
  const pct = (ms: number) => ((ms - startMs) / span) * 100;

  const transition = transitionBetween(state, facts);
  const kind = transition ? transitionKind(transition) : null;
  const gate = `<span class="gmt-cutoff-gate"></span>`;
  // The DST change through a track: a dashed line, and for an overlap the
  // repeated hour as a faint band `|Δoffset|` wide after the instant.
  const transitionMarks = transition
    ? (kind === "overlap"
        ? `<span class="gmt-cutoff-ruler-dst-band" style="left:${pct(epochMs(transition.instant))}%;width:${(Math.abs(transitionShiftMinutes(transition)) * 60_000 * 100) / span}%"></span>`
        : "") +
      `<span class="gmt-cutoff-ruler-transition-line gmt-cutoff-ruler-transition-line--${kind}" style="left:${pct(epochMs(transition.instant))}%"></span>`
    : "";
  const lanes = facts.readings
    .map((r) => {
      const label =
        `<span class="gmt-cutoff-ruler-lane-label">${SWATCH}` +
        `<span>${escapeHtml(r.label)}</span></span>`;
      if (r.at === "") {
        return (
          `<div class="gmt-cutoff-ruler-lane" data-series="${seriesOf(r)}">` +
          label +
          `<div class="gmt-cutoff-ruler-track"><span class="gmt-widget-output gmt-playground-sentinel">NO SIGNAL</span>${gate}</div>` +
          `</div>`
        );
      }
      const left = pct(epochMs(r.at));
      return (
        `<div class="gmt-cutoff-ruler-lane" data-series="${seriesOf(r)}">` +
        label +
        `<div class="gmt-cutoff-ruler-track">` +
        transitionMarks +
        `<div class="gmt-cutoff-ruler-bar" style="left:${left}%">` +
        `<span class="gmt-cutoff-mark gmt-cutoff-ruler-marker gmt-cutoff-ruler-marker--solid"></span>` +
        `<span class="gmt-cutoff-chip gmt-cutoff-ruler-bar-label">${escapeHtml(localLabel(r.at))} · ${escapeHtml(durationText(r.hoursBefore))}</span>` +
        `</div>` +
        gate +
        `</div>` +
        `</div>`
      );
    })
    .join("");

  /* The label sits in its own row above the lanes, so it can never land on a
     lane's text; the dashed line itself is drawn inside each lane's track. */
  const transitionRow = transition
    ? (() => {
        const left = pct(epochMs(transition.instant));
        const label = transitionLabel(transition, state.timeZone.trim());
        return (
          `<div class="gmt-cutoff-ruler-transition-row">` +
          `<span class="gmt-cutoff-chip gmt-cutoff-dst gmt-cutoff-dst--${kind} gmt-cutoff-ruler-transition" style="--gmt-at: ${left}%" title="${escapeAttr(label)}">${escapeHtml(label)}</span>` +
          `</div>`
        );
      })()
    : "";

  // Day and 6-hour ticks in local time: a day boundary shows the date, the
  // three in between show the hour.
  const ticks = walkTicks(startMs, departureMs, timeZone, "hours", 6, (z) =>
    z.hour === 0 ? dayTickLabel(z) : hourTickLabel(z),
  );
  const ticksHtml = ticks.map((t) => tickHtml(t, pct(t.ms))).join("");

  el.innerHTML =
    transitionRow +
    `<div class="gmt-cutoff-ruler-lanes">${lanes}</div>` +
    `<div class="gmt-cutoff-ruler-ticks gmt-cutoff-ruler-ticks--track" data-role="ruler-overview-ticks">${ticksHtml}</div>` +
    `<div class="gmt-cutoff-ruler-departure-line gmt-cutoff-chip">${transportIcon("ship", { className: "gmt-cutoff-icon", size: 14 })}<span>Departs ${escapeHtml(localLabel(facts.departure))}</span></div>`;
  fitRuler(el);
}

/**
 * An hour ruler from 2 h before the earliest resolved reading to 2 h after
 * the latest, with every local hour labelled as visible text — this is
 * where "an hour apart" (R1) has to be seen, not read from a tooltip. Each
 * reading gets its own row, so its label is never fighting another
 * reading's for the same space.
 */
function renderCloseup(
  el: HTMLElement,
  state: RulerState,
  facts: RulerFacts,
): void {
  const resolved = facts.readings.filter((r) => r.at !== "");
  if (resolved.length === 0) {
    el.innerHTML = "";
    return;
  }
  const timeZone = state.timeZone.trim();
  const ms = resolved.map((r) => epochMs(r.at));
  const startMs = Math.min(...ms) - 2 * 3_600_000;
  const endMs = Math.max(...ms) + 2 * 3_600_000;
  const span = Math.max(1, endMs - startMs);
  const pct = (v: number) => ((v - startMs) / span) * 100;

  const ticks = walkTicks(startMs, endMs, timeZone, "hours", 1, hourTickLabel);
  const ticksHtml = ticks.map((t) => tickHtml(t, pct(t.ms))).join("");

  // One band per pair of adjacent hour ticks, every other one tinted.
  const bands = ticks
    .slice(0, -1)
    .map(
      (t, i) =>
        `<span class="gmt-cutoff-ruler-band${i % 2 === 1 ? " gmt-cutoff-ruler-band--tint" : ""}" style="left:${pct(t.ms)}%;width:${pct(ticks[i + 1]!.ms) - pct(t.ms)}%"></span>`,
    )
    .join("");

  const rows = resolved
    .map((r) => {
      const x = pct(epochMs(r.at));
      return (
        `<div class="gmt-cutoff-ruler-closeup-row" data-series="${seriesOf(r)}">` +
        `<span class="gmt-cutoff-ruler-guide" style="left:${x}%"></span>` +
        `<span class="gmt-cutoff-mark gmt-cutoff-ruler-marker gmt-cutoff-ruler-marker--solid" style="left:${x}%"></span>` +
        `<span class="gmt-cutoff-chip gmt-cutoff-ruler-closeup-label" data-x="${x}" style="left:${x}%">${escapeHtml(r.label)}</span>` +
        `</div>`
      );
    })
    .join("");

  el.innerHTML =
    `<div class="gmt-cutoff-ruler-hourline">` +
    `<div class="gmt-cutoff-ruler-bands" aria-hidden="true">${bands}</div>${rows}</div>` +
    `<div class="gmt-cutoff-ruler-ticks" data-role="ruler-closeup-ticks">${ticksHtml}</div>`;
  fitRuler(el);
}

/** Thin the tick labels, flip a close-up label that would run past the
 *  track, and move an overview bar label under its bar when it does not fit
 *  beside the marker. Measured, so it re-runs when the width changes. */
function fitRuler(el: HTMLElement): void {
  for (const ticks of el.querySelectorAll<HTMLElement>(
    ".gmt-cutoff-ruler-ticks",
  )) {
    thinTickLabels(ticks);
  }
  for (const row of el.querySelectorAll<HTMLElement>(
    ".gmt-cutoff-ruler-closeup-row",
  )) {
    const label = row.querySelector<HTMLElement>(
      ".gmt-cutoff-ruler-closeup-label",
    );
    if (!label || row.clientWidth === 0) continue;
    label.classList.remove("gmt-cutoff-ruler-closeup-label--end");
    row.classList.remove("gmt-cutoff-ruler-closeup-row--stack");
    const x = parseFloat(label.dataset.x ?? "0");
    label.style.left = `${x}%`;
    const trackPx = row.clientWidth;
    const atPx = (x / 100) * trackPx;
    const labelPx = layoutWidth(label);
    const OFFSET = 14;
    const side = placeLabel({ atPx, labelPx, trackPx, offsetPx: OFFSET });
    const room =
      side === "start"
        ? atPx + OFFSET + labelPx <= trackPx + 0.5
        : atPx - OFFSET - labelPx >= -0.5;
    if (room) {
      label.classList.toggle(
        "gmt-cutoff-ruler-closeup-label--end",
        side === "end",
      );
    } else {
      // Neither side of the marker holds the label: stack it above the marker,
      // kept inside the track.
      row.classList.add("gmt-cutoff-ruler-closeup-row--stack");
      const left = Math.max(0, Math.min(atPx - labelPx / 2, trackPx - labelPx));
      label.style.left = `${left}px`;
    }
  }
  for (const row of el.querySelectorAll<HTMLElement>(
    ".gmt-cutoff-ruler-transition-row",
  )) {
    const label = row.querySelector<HTMLElement>(
      ".gmt-cutoff-ruler-transition",
    );
    if (!label || row.clientWidth === 0) continue;
    label.classList.remove(
      "gmt-cutoff-ruler-transition--end",
      "gmt-cutoff-ruler-transition--wrap",
    );
    const trackPx = row.clientWidth;
    const atPx =
      (parseFloat(label.style.getPropertyValue("--gmt-at")) / 100) * trackPx;
    const width = layoutWidth(label);
    // Right of the line when it fits, else left of it, else wrap on the roomier side.
    const side = placeLabel({ atPx, labelPx: width, trackPx, offsetPx: 0 });
    const fits = side === "start" ? atPx + width <= trackPx : atPx >= width;
    const end = fits ? side === "end" : atPx > trackPx - atPx;
    label.classList.toggle("gmt-cutoff-ruler-transition--end", end);
    label.classList.toggle("gmt-cutoff-ruler-transition--wrap", !fits);
  }
  for (const track of el.querySelectorAll<HTMLElement>(
    ".gmt-cutoff-ruler-track",
  )) {
    const bar = track.querySelector<HTMLElement>(".gmt-cutoff-ruler-bar");
    const label = bar?.querySelector<HTMLElement>(
      ".gmt-cutoff-ruler-bar-label",
    );
    if (!bar || !label || track.clientWidth === 0) continue;
    const barLeft = (parseFloat(bar.style.left) / 100) * track.clientWidth;
    const line = track.querySelector<HTMLElement>(
      ".gmt-cutoff-ruler-transition-line",
    );
    const lineX = line
      ? (parseFloat(line.style.left) / 100) * track.clientWidth
      : null;
    const width = layoutWidth(label);
    // Beside the marker; else clear of the DST line; else right-aligned.
    const left = pickLabelLeft(
      [
        barLeft + 14,
        ...(lineX === null ? [] : [lineX + 6]),
        track.clientWidth - width - 6,
      ],
      width,
      track.clientWidth,
      lineX === null ? [] : [lineX],
    );
    label.style.left = `${left - barLeft}px`;
  }
}

/** `localLabel`'s text in two no-wrap spans (date, time), so a narrow card can
 *  only wrap between them. The text content is unchanged. */
function readingTimeHtml(label: string): string {
  const i = label.lastIndexOf(" ");
  if (i < 0) return escapeHtml(label);
  return `<span>${escapeHtml(label.slice(0, i))}</span> <span>${escapeHtml(label.slice(i + 1))}</span>`;
}

function readingsList(facts: RulerFacts): string {
  return facts.readings
    .map((r) => {
      const gloss =
        r.key === "calendar"
          ? "keeps the departure's time of day"
          : r.key === "exact"
            ? "elapsed time, whatever the clock does"
            : "keeps the local time you pin, and lets the elapsed time move";
      const head = `<div class="gmt-cutoff-ruler-reading-head">${SWATCH}<span>${escapeHtml(r.label)}</span></div>`;
      const body =
        r.at === ""
          ? `<div class="gmt-cutoff-ruler-reading-time"><span class="gmt-widget-output gmt-playground-sentinel">NO SIGNAL</span></div>`
          : `<div class="gmt-cutoff-ruler-reading-time">${readingTimeHtml(localLabel(r.at))}</div>` +
            `<div class="gmt-cutoff-ruler-reading-meta">${escapeHtml(r.at)} · ${escapeHtml(durationText(r.hoursBefore))} before departure · (${escapeHtml(r.hoursBefore)})</div>`;
      return (
        `<li class="gmt-cutoff-ruler-card" data-series="${seriesOf(r)}">` +
        head +
        body +
        `<div class="gmt-cutoff-ruler-reading-gloss">${escapeHtml(gloss)}</div>` +
        `</li>`
      );
    })
    .join("");
}

function summaryText(facts: RulerFacts): string {
  return facts.readings
    .map((r) =>
      r.at === ""
        ? `${r.label} is NO SIGNAL.`
        : `${r.label} is ${localLabel(r.at)}, ${durationText(r.hoursBefore)} before departure.`,
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: CutoffLib): () => void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const anchorEl = q<HTMLInputElement>("anchor");
  const timeZoneEl = q<HTMLSelectElement>("time-zone");
  const daysEl = q<HTMLSelectElement>("days");
  const atLocalTimeEl = q<HTMLInputElement>("at-local-time");
  if (!presetEl || !anchorEl || !timeZoneEl || !daysEl || !atLocalTimeEl)
    return () => {};

  function state(): RulerState {
    return {
      anchor: anchorEl!.value.trim(),
      timeZone: timeZoneEl!.value.trim(),
      days: daysEl!.value.trim(),
      atLocalTime: atLocalTimeEl!.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        RULER_PRESETS.find((p) => p.id === presetEl!.value)?.description ?? "";
    }
  }

  function render(): void {
    const s = state();
    const heading = q("days-heading");
    if (heading) heading.textContent = s.days;

    const facts = collectRulerFacts(s, lib);
    for (const spec of readingsOf(s)) {
      const role = READING_ROLE[spec.key]!;
      const [callHtml, callPlain] = callSource("cutoffAt", [
        s.anchor.trim(),
        spec.offset,
        spec.options,
      ]);
      renderCallLine(q(`call-${role}`), "cutoffAt", callHtml, callPlain);
      const reading = facts.readings.find((r) => r.key === spec.key)!;
      const out = q(`ruler-output-${spec.key}`);
      if (out) {
        if (reading.at === "") renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(out, reading.at, "live");
      }
    }

    const overview = q<HTMLElement>("ruler-overview");
    if (overview) {
      drawOrRangeEdge(overview, () => renderOverview(overview, s, facts));
    }
    const closeup = q<HTMLElement>("ruler-closeup");
    if (closeup) {
      drawOrRangeEdge(closeup, () => renderCloseup(closeup, s, facts));
    }
    const summary = q("ruler-summary");
    if (summary) summary.textContent = summaryText(facts);
    const readingsEl = q("readings");
    if (readingsEl) readingsEl.innerHTML = readingsList(facts);
    const caption = q("static-caption");
    if (caption) {
      caption.textContent = `Date arithmetic that subtracts ${s.days.trim() || "N"} × 86,400,000 ms is the exact-hours row.`;
    }

    const aside = q("reason-aside");
    if (aside) {
      const failing = facts.readings.find((r: RulerReading) => r.at === "");
      if (failing) {
        const reason = rulerNullReason(failing, s, lib);
        renderAside(
          aside,
          "caution",
          "Why NO SIGNAL",
          `<p>${escapeHtml(reason ? rulerNullText(reason) : "This reading could not be computed.")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = RULER_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    anchorEl!.value = preset.anchor;
    timeZoneEl!.value = preset.timeZone;
    daysEl!.value = preset.days;
    atLocalTimeEl!.value = preset.atLocalTime;
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    if (e.target === presetEl) return;
    syncPreset();
    render();
  });
  root.addEventListener("change", (e) => {
    if (e.target === presetEl) {
      applyPreset();
      return;
    }
    syncPreset();
    render();
  });

  wireCopyButtons(root);
  render();
  const disposers: Array<() => void> = [];
  for (const role of ["ruler-overview", "ruler-closeup"]) {
    const surface = q<HTMLElement>(role);
    if (surface)
      disposers.push(onWidthChange(surface, () => fitRuler(surface)));
  }
  return () => {
    for (const dispose of disposers) dispose();
  };
}

function applyArgs(root: HTMLElement, args: CutoffRulerArgs): void {
  if (args.anchor === undefined && args.days === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    setControlValue(el, value);
  };
  set("anchor", s.anchor);
  set("time-zone", s.timeZone);
  set("days", s.days);
  set("at-local-time", s.atLocalTime);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        RULER_PRESETS.find((p) => p.id === presetEl.value)?.description ?? "";
    }
  }
}

export const mountCutoffRuler: MountFn<CutoffRulerArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  const disposeWidget = setupWidget(root, lib);

  return onceDestroy(disposeWidget, () => {
    const q = <T extends HTMLElement>(role: string) =>
      root.querySelector(`[data-role="${role}"]`) as T | null;
    const anchorEl = q<HTMLInputElement>("anchor");
    if (!anchorEl) return null;
    const state: RulerState = {
      anchor: anchorEl.value,
      timeZone: q<HTMLSelectElement>("time-zone")?.value ?? "",
      days: q<HTMLSelectElement>("days")?.value ?? "",
      atLocalTime: q<HTMLInputElement>("at-local-time")?.value ?? "",
    };
    return permalinkOf(state);
  });
};
