/**
 * The Cut-off Countdown widget (TRAN-10), mountable on its tool page and in
 * the chat rail.
 *
 * `isPastCutoff` and `timeToCutoff` compared against the viewer's clock or a
 * time dragged on a slider, with the half-open rule shown: at the cut-off
 * instant itself the window has closed.
 *
 * **The template never reads the clock.** In `live` mode it renders a
 * placeholder in the now/verdict/output slots, and the mount fills them
 * after mount — the server-rendered page and the jsdom template stay
 * deterministic.
 *
 * **Why the page opens pinned.** A chat call or a permalink with no `now` is
 * live. The bare tool page opens on the `late` preset, pinned, because every
 * preset's cut-off is fixed in 2024 and against today's clock it would
 * always read "late by" thousands of hours. "Use my clock" is one click
 * away.
 */
import {
  COUNTDOWN_PRESETS,
  CUSTOM_PRESET_ID,
  axisWindow,
  collectCountdownFacts,
  countdownNullReason,
  countdownNullText,
  matchPreset,
  nowFromSlider,
  permalinkOf,
  presetState,
  readArgs,
  verdict,
  type AxisWindow,
  type CountdownState,
  type CutoffCountdownArgs,
} from "./cutoff-countdown";
import { Temporal } from "@js-temporal/polyfill";
import {
  TRANSPORT_ZONES,
  zoneOptionsHtml,
  callSource,
  dayTickLabel,
  durationText,
  epochMs,
  hourTickLabel,
  isNegative,
  localLabel,
  localParts,
  minuteTickLabel,
  monthTickLabel,
  walkTicks,
} from "./cutoff-widgets";
import { codeFrameHtml } from "./code-frame";
import { loadCutoffLib } from "./cutoff-lib";
import type { CutoffLib } from "./cutoff-widgets";
import {
  onWidthChange,
  pickLabelLeft,
  placeLabel,
  thinTickLabels,
} from "./label-fit";
import { onceDestroy, WidgetLoadError } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  syncRange,
  wireCopyButtons,
} from "./widget-ui";

export type { CutoffCountdownArgs } from "./cutoff-countdown";

const READING_YOUR_CLOCK = "Reading your clock…";

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    COUNTDOWN_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/**
 * `renderCutoffCountdownTemplate(args = {})`. Live mode (`args.now`
 * undefined and `args` seeded, or no args at all with a live permalink) is
 * seeded with placeholders, never a clock read; the mount fills them.
 */
export function renderCutoffCountdownTemplate(
  args: CutoffCountdownArgs = {},
): string {
  const seeded = args.cutoff !== undefined;
  const state: CountdownState = seeded
    ? readArgs(args)
    : presetState(COUNTDOWN_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = COUNTDOWN_PRESETS.find((p) => p.id === presetId);
  const isLive = state.mode === "live";

  return (
    `<div class="gmt-cutoff-countdown gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The cut-off and now</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Cut-off")}` +
    `<input class="gmt-input" data-role="cutoff" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.cutoff)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Clock")}` +
    `<select class="gmt-select" data-role="time-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Now")}` +
    `<input class="gmt-input" data-role="now" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(isLive ? "" : state.now)}" placeholder="${isLive ? escapeAttr(READING_YOUR_CLOCK) : ""}"></label>` +
    `</div>` +
    `<div class="gmt-widget-controls">` +
    `<button class="gmt-button gmt-button--pad" type="button" data-role="use-clock">Use my clock</button>` +
    `<button class="gmt-button gmt-button--pad" type="button" data-role="snap">Now = the cut-off</button>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="now-mode">${isLive ? "Now is your clock, live." : "Now is pinned."}</p>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Late or on time</h4>` +
    `<p class="gmt-transport-verdict" data-role="verdict" aria-live="polite">${isLive ? escapeHtml(READING_YOUR_CLOCK) : ""}</p>` +
    `<div class="gmt-cutoff-countdown-axis" data-role="countdown-axis" role="img" aria-labelledby="countdown-summary" tabindex="-1"></div>` +
    `<label class="gmt-label gmt-cutoff-countdown-drag">${labelTextHtml("Drag now")}` +
    rangeFieldHtml({
      role: "now-slider",
      chipRole: "now-value",
      min: -60,
      max: 60,
      step: 1,
      value: 0,
      valueText: "",
      ends: ["", ""],
    }) +
    `</label>` +
    `<div class="gmt-cutoff-countdown-rule" data-role="rule"></div>` +
    `<p class="gmt-widget-hint" id="countdown-summary" data-role="countdown-summary"></p>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What the calls return</h4>` +
    codeFrameHtml("countdown-past") +
    `<output class="gmt-widget-output" data-role="countdown-output-past">${isLive ? "&nbsp;" : ""}</output>` +
    codeFrameHtml("countdown-left") +
    `<output class="gmt-widget-output" data-role="countdown-output-left">${isLive ? "&nbsp;" : ""}</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function ruleBoxHtml(cutoffLocalTime: string): string {
  const time = cutoffLocalTime || "the cut-off";
  return `The window to meet a cut-off is half-open: [ … , ${escapeHtml(time)} ). At ${escapeHtml(time)} exactly it has closed: isPastCutoff is true and timeToCutoff is PT0S.`;
}

function setupWidget(
  root: HTMLElement,
  lib: CutoffLib,
  clock: () => string,
  initialMode: "pinned" | "live",
): { destroy(): void } {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const cutoffEl = q<HTMLInputElement>("cutoff");
  const timeZoneEl = q<HTMLSelectElement>("time-zone");
  const nowEl = q<HTMLInputElement>("now");
  const sliderEl = q<HTMLInputElement>("now-slider");
  if (!presetEl || !cutoffEl || !timeZoneEl || !nowEl || !sliderEl) {
    return { destroy() {} };
  }

  let mode: "pinned" | "live" = initialMode;
  let window_: AxisWindow | null = null;
  let interval: ReturnType<typeof setInterval> | undefined;
  let destroyed = false;

  function state(): CountdownState {
    return {
      cutoff: cutoffEl!.value.trim(),
      now: nowEl!.value.trim(),
      timeZone: timeZoneEl!.value.trim(),
      mode,
    };
  }

  function stopLive(): void {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  function recomputeWindow(): void {
    const s = state();
    window_ = axisWindow(s.cutoff, s.now);
  }

  function syncPreset(): void {
    presetEl!.value =
      mode === "pinned" ? matchPreset(state()) : CUSTOM_PRESET_ID;
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        COUNTDOWN_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
  }

  function render(): void {
    const s = state();
    const facts = collectCountdownFacts(s, lib);
    const v = verdict(facts);

    const verdictEl = q("verdict");
    if (verdictEl) verdictEl.textContent = v.text;

    const [callPastHtml, callPastPlain] = callSource("isPastCutoff", [
      s.now,
      s.cutoff,
    ]);
    renderCallLine(
      q("call-countdown-past"),
      "isPastCutoff",
      callPastHtml,
      callPastPlain,
    );
    const [callLeftHtml, callLeftPlain] = callSource("timeToCutoff", [
      s.now,
      s.cutoff,
    ]);
    renderCallLine(
      q("call-countdown-left"),
      "timeToCutoff",
      callLeftHtml,
      callLeftPlain,
    );

    const outPast = q("countdown-output-past");
    const outLeft = q("countdown-output-left");
    if (facts.left === "") {
      if (outPast) renderWidgetOutput(outPast, "NO SIGNAL", "sentinel");
      if (outLeft) renderWidgetOutput(outLeft, "NO SIGNAL", "sentinel");
    } else {
      if (outPast) renderWidgetOutput(outPast, String(facts.past), "live");
      if (outLeft) renderWidgetOutput(outLeft, facts.left, "live");
    }

    const nowMode = q("now-mode");
    if (nowMode) {
      nowMode.textContent =
        mode === "live" ? "Now is your clock, live." : "Now is pinned.";
    }

    const cutoffLocalTime = facts.cutoffLocal
      ? localParts(facts.cutoffLocal).time
      : "";
    const rule = q("rule");
    if (rule) rule.innerHTML = ruleBoxHtml(cutoffLocalTime);

    if (window_ === null) recomputeWindow();
    const win = window_;
    if (win && sliderEl) {
      const cutoffEpoch = safeEpochMs(s.cutoff);
      if (cutoffEpoch !== null) {
        sliderEl.min = String(Math.round((win.startMs - cutoffEpoch) / 60_000));
        sliderEl.max = String(Math.round((win.endMs - cutoffEpoch) / 60_000));
        const nowEpoch = safeEpochMs(s.now);
        if (nowEpoch !== null) {
          sliderEl.value = String(
            Math.round((nowEpoch - cutoffEpoch) / 60_000),
          );
        }
        sliderEl.disabled = false;
      } else {
        sliderEl.disabled = true;
      }
    } else if (sliderEl) {
      sliderEl.disabled = true;
    }
    const nowTime = facts.nowLocal ? localParts(facts.nowLocal).time : "";
    const offsetMin = Number.parseInt(sliderEl!.value, 10) || 0;
    syncRange(
      sliderEl!,
      nowTime === ""
        ? ""
        : `${nowTime}, ${offsetMin === 0 ? "at" : `${offsetMin < 0 ? "−" : "+"}${Math.abs(offsetMin)} min from`} the cut-off`,
    );
    // The chip is short ("16:45 · −75 min") so it fits a phone-width field;
    // aria-valuetext keeps the whole sentence.
    const chip = q("now-value");
    if (chip) {
      chip.textContent =
        nowTime === ""
          ? ""
          : `${nowTime} · ${offsetMin === 0 ? "0" : `${offsetMin < 0 ? "−" : "+"}${Math.abs(offsetMin)}`} min`;
    }
    const ends = sliderEl!
      .closest(".gmt-range-field")
      ?.querySelectorAll<HTMLElement>(".gmt-range-ends span");
    if (ends && ends.length === 2) {
      const [startEl, endEl] = [ends[0]!, ends[1]!];
      startEl.textContent = win ? windowEndLabel(win, win.startMs, s) : "";
      endEl.textContent = win ? windowEndLabel(win, win.endMs, s) : "";
    }

    const axis = q<HTMLElement>("countdown-axis");
    if (axis) renderAxis(axis, s, facts, win);

    const summary = q("countdown-summary");
    if (summary) {
      summary.textContent =
        facts.left === ""
          ? "No signal."
          : `Now is ${localLabel(facts.nowLocal)}; the cut-off is ${localLabel(facts.cutoffLocal)}. ${v.text}`;
    }

    const aside = q("reason-aside");
    if (aside) {
      if (facts.left === "") {
        const reason = countdownNullReason(s, lib);
        renderAside(
          aside,
          "caution",
          "Why NO SIGNAL",
          `<p>${escapeHtml(countdownNullText(reason))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  /** `epochMs` throws on invalid text; the slider is disabled rather than
   *  shown at a NaN position. */
  function safeEpochMs(text: string): number | null {
    try {
      return epochMs(text);
    } catch {
      return null;
    }
  }

  /** Floors a real instant string to the whole second, for a live reading.
   *  Sub-second precision from `Temporal.Now.instant()` is real but not
   *  meaningful here, and left in it would print as noise in the duration
   *  text every single tick. Presentation only: the floored instant is
   *  still a real instant, and is what `isPastCutoff`/`timeToCutoff` are
   *  then asked about — never a result computed by this rounding. */
  function floorToSecond(text: string): string {
    try {
      return Temporal.Instant.fromEpochMilliseconds(
        Math.floor(epochMs(text) / 1000) * 1000,
      ).toString();
    } catch {
      return text;
    }
  }

  function readLiveNow(): void {
    nowEl!.value = floorToSecond(clock());
    recomputeWindow();
    render();
  }

  function startLive(): void {
    stopLive();
    mode = "live";
    readLiveNow();
    interval = setInterval(() => {
      nowEl!.value = floorToSecond(clock());
      const s = state();
      // Recompute the window only once the live reading actually leaves
      // it — not on every tick, and never while dragging (this runs on no
      // drag at all).
      const nowMs = safeEpochMs(s.now);
      if (
        window_ &&
        nowMs !== null &&
        (nowMs < window_.startMs || nowMs > window_.endMs)
      ) {
        recomputeWindow();
      }
      render();
    }, 1000);
  }

  function switchToPinned(): void {
    if (mode === "live") {
      stopLive();
      mode = "pinned";
    }
  }

  function applyPreset(): void {
    const preset = COUNTDOWN_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    stopLive();
    mode = "pinned";
    cutoffEl!.value = preset.cutoff;
    timeZoneEl!.value = preset.timeZone;
    nowEl!.value = preset.now;
    recomputeWindow();
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) return;
    if (target === sliderEl) {
      switchToPinned();
      const minutes = Number.parseInt(sliderEl!.value, 10) || 0;
      nowEl!.value = nowFromSlider(
        cutoffEl!.value.trim(),
        minutes,
        timeZoneEl!.value.trim(),
      );
      syncPreset();
      render();
      return;
    }
    if (target === cutoffEl || target === nowEl) {
      switchToPinned();
      recomputeWindow();
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
      return;
    }
    if (target === timeZoneEl) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest("[data-role]");
    if (target === q("use-clock")) {
      startLive();
      syncPreset();
      return;
    }
    if (target === q("snap")) {
      switchToPinned();
      sliderEl!.value = "0";
      nowEl!.value = nowFromSlider(
        cutoffEl!.value.trim(),
        0,
        timeZoneEl!.value.trim(),
      );
      recomputeWindow();
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);

  if (initialMode === "live") {
    startLive();
  } else {
    recomputeWindow();
    render();
  }
  syncPreset();
  const axisEl = q<HTMLElement>("countdown-axis");
  if (axisEl) onWidthChange(axisEl, () => fitCountdownAxis(axisEl));

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLive();
    },
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Hours, then days, then months, as the window grows — the tick unit and
 *  step chosen only from the span, never from the values themselves. */
function countdownTickPlan(spanMs: number): {
  unit: "minutes" | "hours" | "days" | "months";
  step: number;
} {
  // Short windows tick every quarter or half hour, so a window inside one
  // hour still carries labelled times.
  if (spanMs <= 2 * HOUR_MS) return { unit: "minutes", step: 15 };
  if (spanMs <= 6 * HOUR_MS) return { unit: "minutes", step: 30 };
  if (spanMs <= 3 * DAY_MS) {
    return {
      unit: "hours",
      step: spanMs <= 6 * HOUR_MS ? 1 : spanMs <= 24 * HOUR_MS ? 3 : 6,
    };
  }
  if (spanMs <= 60 * DAY_MS) {
    return {
      unit: "days",
      step: spanMs <= 14 * DAY_MS ? 1 : spanMs <= 30 * DAY_MS ? 2 : 5,
    };
  }
  return { unit: "months", step: 1 };
}

/** An end label of the slider's window, in the clock's zone: the time alone
 *  inside a day, with the date when the window is longer. */
function windowEndLabel(
  win: AxisWindow,
  ms: number,
  state: CountdownState,
): string {
  try {
    const z = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(
      state.timeZone.trim(),
    );
    const time = `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
    return win.endMs - win.startMs > DAY_MS
      ? `${dayTickLabel(z)} ${time}`
      : time;
  } catch {
    return "";
  }
}

function renderAxis(
  el: HTMLElement,
  state: CountdownState,
  facts: ReturnType<typeof collectCountdownFacts>,
  win: AxisWindow | null,
): void {
  if (!win || facts.left === "") {
    el.innerHTML = "";
    return;
  }
  const span = Math.max(1, win.endMs - win.startMs);
  const timeZone = state.timeZone.trim();
  const cutoffMs = epochMs(state.cutoff.trim());
  const nowMs = epochMs(state.now.trim());
  const pct = (ms: number) => ((ms - win.startMs) / span) * 100;
  const cutoffPct = pct(cutoffMs);
  const nowPct = pct(nowMs);
  const cutoffTime = facts.cutoffLocal
    ? localParts(facts.cutoffLocal).time
    : "";
  const nowTime = facts.nowLocal ? localParts(facts.nowLocal).time : "";

  const { unit, step } = countdownTickPlan(span);
  const label =
    unit === "minutes"
      ? minuteTickLabel
      : unit === "hours"
        ? hourTickLabel
        : unit === "days"
          ? dayTickLabel
          : monthTickLabel;
  const ticks = walkTicks(win.startMs, win.endMs, timeZone, unit, step, label);
  const ticksHtml = ticks
    .map(
      (t) =>
        `<span class="gmt-cutoff-axis-tick${isDayBoundary(t.label) ? " gmt-cutoff-axis-tick--day" : ""}" style="left:${pct(t.ms)}%">${escapeHtml(t.label)}</span>`,
    )
    .join("");

  // The signed duration `timeToCutoff` returned, as words: the sign is the
  // returned ISO's own, never computed here.
  const sign = isNegative(facts.left) ? "−" : facts.left === "PT0S" ? "" : "+";
  const heroText = `${sign}${durationText(facts.left)}`;
  const live = state.mode === "live";

  el.innerHTML =
    `<div class="gmt-cutoff-countdown-hero" data-role="countdown-hero"${live ? " data-live" : ""}>` +
    `<span class="gmt-cutoff-countdown-hero-cap">time to cut-off</span>` +
    `<span class="gmt-cutoff-countdown-hero-value">${escapeHtml(heroText)}</span>` +
    `<span class="gmt-cutoff-countdown-hero-iso">${escapeHtml(facts.left)}</span>` +
    `</div>` +
    `<div class="gmt-cutoff-countdown-plot" data-role="countdown-plot">` +
    `<div class="gmt-cutoff-countdown-chiprow">` +
    `<span class="gmt-cutoff-chip gmt-cutoff-countdown-chip--gate" style="left:calc(${cutoffPct}% + 12px)">cut-off ${escapeHtml(cutoffTime)}</span>` +
    `<span class="gmt-cutoff-chip gmt-cutoff-countdown-chip--now" style="left:calc(${nowPct}% + 12px)">now ${escapeHtml(nowTime)}</span>` +
    `</div>` +
    `<div class="gmt-cutoff-countdown-track">` +
    `<div class="gmt-cutoff-countdown-open" style="width:${cutoffPct}%"></div>` +
    `<div class="gmt-cutoff-countdown-closed gmt-cutoff-closed" style="left:${cutoffPct}%;width:${Math.max(0, 100 - cutoffPct)}%"></div>` +
    `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim gmt-cutoff-countdown-region-chip gmt-cutoff-countdown-region-chip--open" style="left:8px">open</span>` +
    `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim gmt-cutoff-countdown-region-chip gmt-cutoff-countdown-region-chip--closed" style="left:calc(${cutoffPct}% + 8px)">closed</span>` +
    `</div>` +
    `<span class="gmt-cutoff-gate gmt-cutoff-countdown-marker gmt-cutoff-countdown-marker--cutoff" style="left:${cutoffPct}%" title="${escapeAttr(`Cut-off ${cutoffTime}`)}"></span>` +
    `<span class="gmt-cutoff-countdown-marker gmt-cutoff-countdown-marker--now" style="left:${nowPct}%" title="${escapeAttr(`Now ${nowTime}`)}"></span>` +
    `</div>` +
    `<div class="gmt-cutoff-countdown-ticks" data-role="countdown-ticks">${ticksHtml}</div>`;
  fitCountdownAxis(el);
}

/** A tick that names a day or a month (or midnight), not an hour of one. */
function isDayBoundary(label: string): boolean {
  return label === "00:00" || !/^\d{2}:\d{2}$/.test(label);
}

/**
 * Place the chip row, the open/closed chips and the tick labels by measure, so
 * nothing overlaps at any width: the gate chip goes on the side away from now,
 * the now chip beside its pin and clear of the gate, and an open/closed chip a
 * region cannot hold is hidden. Re-runs when the axis width changes.
 */
function fitCountdownAxis(el: HTMLElement): void {
  const ticks = el.querySelector<HTMLElement>('[data-role="countdown-ticks"]');
  if (ticks) thinTickLabels(ticks);
  const plot = el.querySelector<HTMLElement>(".gmt-cutoff-countdown-plot");
  if (!plot || plot.clientWidth === 0) return;
  const W = plot.clientWidth;
  const px = (node: HTMLElement | null) =>
    node ? (parseFloat(node.style.left) / 100) * W : Number.NaN;
  const gatePx = px(
    plot.querySelector<HTMLElement>(".gmt-cutoff-countdown-marker--cutoff"),
  );
  const nowPx = px(
    plot.querySelector<HTMLElement>(".gmt-cutoff-countdown-marker--now"),
  );
  const gateChip = plot.querySelector<HTMLElement>(
    ".gmt-cutoff-countdown-chip--gate",
  );
  const nowChip = plot.querySelector<HTMLElement>(
    ".gmt-cutoff-countdown-chip--now",
  );
  if (Number.isNaN(gatePx) || Number.isNaN(nowPx) || !gateChip || !nowChip) {
    return;
  }

  const OFFSET = 12;
  const GAP = 4;
  const width = (chip: HTMLElement) => chip.getBoundingClientRect().width;
  const gw = width(gateChip);
  const nw = width(nowChip);
  type Span = [number, number];
  /** The chip's three places on its pin: to its right, to its left, or (when
   *  neither side is free) centred on the pin and kept inside the track. */
  const places = (at: number, w: number): Record<string, Span> => {
    const mid = Math.max(0, Math.min(at - w / 2, W - w));
    return {
      start: [at + OFFSET, at + OFFSET + w],
      end: [at - OFFSET - w, at - OFFSET],
      mid: [mid, mid + w],
    };
  };
  const inside = ([l, r]: Span) => l >= -0.5 && r <= W + 0.5;
  const crosses = ([l, r]: Span, x: number) => x > l - GAP && x < r + GAP;
  const apart = (a: Span, b: Span) => a[1] + GAP <= b[0] || b[1] + GAP <= a[0];

  // Away from now; on a tie the gate chip goes left and the now chip right.
  const gatePref = nowPx < gatePx ? "start" : "end";
  const gateOrder = [gatePref, gatePref === "start" ? "end" : "start", "mid"];
  // The now chip's default side is the one `placeLabel` picks with the gate as
  // a blocker; the other side is the fallback.
  const nowPref = placeLabel({
    atPx: nowPx,
    labelPx: nw,
    trackPx: W,
    offsetPx: OFFSET,
    blockers: [gatePx],
  });
  const nowOrder = [nowPref, nowPref === "start" ? "end" : "start", "mid"];

  // A chip row has room for both chips only when the track is wide enough;
  // otherwise one chip drops to a second row (its pin still reaches it). A
  // chip only covers the other pin when nothing cleaner fits.
  const rows: [0 | 1, 0 | 1][] = [
    [0, 0],
    [0, 1],
    [1, 0],
  ];
  let chosen: { gate: Span; now: Span; gateRow: 0 | 1; nowRow: 0 | 1 } | null =
    null;
  search: for (const strict of [true, false]) {
    for (const [gateRow, nowRow] of rows) {
      for (const g of gateOrder) {
        const gs = places(gatePx, gw)[g]!;
        if (!inside(gs) || (strict && crosses(gs, nowPx))) continue;
        for (const n of nowOrder) {
          const ns = places(nowPx, nw)[n]!;
          if (!inside(ns) || (strict && crosses(ns, gatePx))) continue;
          if (gateRow === nowRow && !apart(gs, ns)) continue;
          chosen = { gate: gs, now: ns, gateRow, nowRow };
          break search;
        }
      }
    }
  }
  const fallbackGate = places(gatePx, gw).mid!;
  gateChip.style.left = `${(chosen?.gate ?? fallbackGate)[0]}px`;
  gateChip.classList.toggle("gmt-cutoff-chip--row2", chosen?.gateRow === 1);
  nowChip.hidden = chosen === null;
  if (chosen) nowChip.style.left = `${chosen.now[0]}px`;
  nowChip.classList.toggle("gmt-cutoff-chip--row2", chosen?.nowRow === 1);
  plot.classList.toggle(
    "gmt-cutoff-countdown-plot--tiers",
    chosen !== null && (chosen.gateRow === 1 || chosen.nowRow === 1),
  );

  // "open" / "closed" inside their own regions, clear of both pins.
  const regionChip = (
    node: HTMLElement | null,
    from: number,
    to: number,
  ): void => {
    if (!node) return;
    const w = width(node);
    const left = pickLabelLeft(
      [from + 8, to - 8 - w],
      w,
      to,
      [nowPx, gatePx].filter((x) => x > from + 1 && x < to - 1),
      6,
    );
    const fits =
      left >= from + 4 &&
      left + w <= to - 4 &&
      !(nowPx > left - 6 && nowPx < left + w + 6);
    node.hidden = !fits;
    if (fits) node.style.left = `${left}px`;
  };
  regionChip(
    plot.querySelector<HTMLElement>(".gmt-cutoff-countdown-region-chip--open"),
    0,
    gatePx,
  );
  regionChip(
    plot.querySelector<HTMLElement>(
      ".gmt-cutoff-countdown-region-chip--closed",
    ),
    gatePx,
    W,
  );
}

function applyArgs(root: HTMLElement, args: CutoffCountdownArgs): void {
  if (args.cutoff === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    if (el) el.value = value;
  };
  set("cutoff", s.cutoff);
  set("time-zone", s.timeZone);
  if (s.mode === "pinned") set("now", s.now);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl && s.mode === "pinned") {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        COUNTDOWN_PRESETS.find((p) => p.id === presetEl.value)?.description ??
        "";
    }
  }
}

/** `MountFn<CutoffCountdownArgs>`'s three parameters, plus one more the
 *  contract does not carry: `clock`, which defaults to `lib.getUtcNow` and
 *  exists only for the fake-timer fallback section 0 describes (unused in
 *  practice — `getUtcNow` does follow `vi.setSystemTime`, confirmed before
 *  writing the mount tests). An extra optional trailing parameter is still
 *  assignable to `MountFn<CutoffCountdownArgs>` wherever the registry needs
 *  one. */
export const mountCutoffCountdown = async (
  root: HTMLElement,
  args: CutoffCountdownArgs,
  signal: AbortSignal,
  options?: { clock?: () => string },
) => {
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const seeded = args.cutoff !== undefined;
  const initialMode: "pinned" | "live" = seeded
    ? readArgs(args).mode
    : "pinned";

  applyArgs(root, args);
  const clock = options?.clock ?? lib.getUtcNow;
  const controller = setupWidget(root, lib, clock, initialMode);

  const onAbort = () => controller.destroy();
  signal.addEventListener("abort", onAbort);

  return onceDestroy(
    () => {
      signal.removeEventListener("abort", onAbort);
      controller.destroy();
    },
    () => {
      const q = <T extends HTMLElement>(role: string) =>
        root.querySelector(`[data-role="${role}"]`) as T | null;
      const cutoffEl = q<HTMLInputElement>("cutoff");
      if (!cutoffEl) return null;
      const nowModeText = q("now-mode")?.textContent ?? "";
      const mode: "pinned" | "live" = nowModeText.includes("live")
        ? "live"
        : "pinned";
      const state: CountdownState = {
        cutoff: cutoffEl.value,
        now: q<HTMLInputElement>("now")?.value ?? "",
        timeZone: q<HTMLSelectElement>("time-zone")?.value ?? "",
        mode,
      };
      return permalinkOf(state);
    },
  );
};
