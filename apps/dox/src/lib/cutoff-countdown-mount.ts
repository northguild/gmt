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
  epochMs,
  hourTickLabel,
  localLabel,
  localParts,
  monthTickLabel,
  walkTicks,
} from "./cutoff-widgets";
import { codeFrameHtml } from "./code-frame";
import { loadCutoffLib } from "./cutoff-lib";
import type { CutoffLib } from "./cutoff-widgets";
import { onceDestroy, WidgetLoadError } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
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
    `<div class="gmt-cutoff-countdown gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The cut-off and now</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Cut-off</span>` +
    `<input class="gmt-input" data-role="cutoff" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.cutoff)}"></label>` +
    `<label class="gmt-label"><span>Clock</span>` +
    `<select class="gmt-select" data-role="time-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `<label class="gmt-label gmt-label-wide"><span>Now</span>` +
    `<input class="gmt-input" data-role="now" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(isLive ? "" : state.now)}" placeholder="${isLive ? escapeAttr(READING_YOUR_CLOCK) : ""}"></label>` +
    `</div>` +
    `<div class="gmt-widget-controls">` +
    `<button class="gmt-button" type="button" data-role="use-clock">Use my clock</button>` +
    `<button class="gmt-button" type="button" data-role="snap">Now = the cut-off</button>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="now-mode">${isLive ? "Now is your clock, live." : "Now is pinned."}</p>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Late or on time</h4>` +
    `<p class="gmt-transport-verdict" data-role="verdict" aria-live="polite">${isLive ? escapeHtml(READING_YOUR_CLOCK) : ""}</p>` +
    `<div class="gmt-cutoff-countdown-axis" data-role="countdown-axis" role="img" aria-labelledby="countdown-summary" tabindex="-1"></div>` +
    `<label class="gmt-label gmt-label-wide gmt-cutoff-countdown-drag"><span>Drag now</span>` +
    `<input class="gmt-range" data-role="now-slider" type="range" step="1" min="-60" max="60" value="0">` +
    `</label>` +
    `<output data-role="now-value"></output>` +
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
    const nowValue = q("now-value");
    if (nowValue) {
      nowValue.textContent = facts.nowLocal
        ? localParts(facts.nowLocal).time
        : "";
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
  unit: "hours" | "days" | "months";
  step: number;
} {
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
    unit === "hours"
      ? hourTickLabel
      : unit === "days"
        ? dayTickLabel
        : monthTickLabel;
  const ticks = walkTicks(win.startMs, win.endMs, timeZone, unit, step, label);
  const ticksHtml = ticks
    .map(
      (t) =>
        `<span class="gmt-cutoff-axis-tick" style="left:${pct(t.ms)}%">${escapeHtml(t.label)}</span>`,
    )
    .join("");

  el.innerHTML =
    `<div class="gmt-cutoff-countdown-track">` +
    `<div class="gmt-cutoff-countdown-open" style="width:${cutoffPct}%"><span>open</span></div>` +
    `<div class="gmt-cutoff-countdown-closed" style="left:${cutoffPct}%;width:${Math.max(0, 100 - cutoffPct)}%"><span>closed</span></div>` +
    `<span class="gmt-cutoff-countdown-marker gmt-cutoff-countdown-marker--cutoff" style="left:${cutoffPct}%" title="${escapeAttr(`Cut-off ${cutoffTime}`)}"></span>` +
    `<span class="gmt-cutoff-countdown-marker gmt-cutoff-countdown-marker--now" style="left:${nowPct}%" title="${escapeAttr(`Now ${nowTime}`)}"></span>` +
    `</div>` +
    `<div class="gmt-cutoff-countdown-ticks" data-role="countdown-ticks">${ticksHtml}</div>`;
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
