/**
 * The Cut-off Countdown widget (TRAN-10), mountable on its tool page and in
 * the chat rail.
 *
 * `isPastCutoff` and `timeToCutoff` compared against the viewer's clock or a
 * time dragged on a slider, with the half-open rule shown: at the cut-off
 * instant itself the window has closed.
 *
 * **The template never reads the clock.** In `live` mode it renders a
 * placeholder in the now, verdict and face slots, and the mount fills them
 * after mount, so the server-rendered page and the jsdom template stay
 * deterministic.
 *
 * **Why the page opens pinned.** A chat call or a permalink with no `now` is
 * live. The bare tool page opens on the `late` preset, pinned, because every
 * preset's cut-off is fixed in 2024 and against today's clock it would
 * always read "late by" thousands of hours. "Use my clock" is one click
 * away.
 *
 * **What is spoken.** The face, the verdict and the chart repaint every second in live mode
 * and on every slider step, so none of them is a live region. A separate, visually hidden
 * status is written to when a reader finishes a change, when the verdict changes kind and
 * about once a minute in live mode.
 *
 * Built on the component kit: `renderCutoffCountdownTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids.
 */
import { Temporal } from "@js-temporal/polyfill";
import { defineElements } from "~/widgets/define";
import {
  aside,
  badge,
  button,
  buttonRow,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  lane,
  mark,
  section,
  select,
  setHtml,
  textInput,
  verdict as verdictBlock,
  widget,
  type SafeHtml,
  type VerdictTone,
} from "~/widgets/builders";
import {
  cutoffBands,
  cutoffScale,
  type ScaleTick,
} from "~/widgets/families/cutoff/bands";
import { countdownFace } from "~/widgets/families/cutoff/countdown-face";
import { cutoffGate } from "~/widgets/families/cutoff/gate";
import { paintCalls } from "~/widgets/families/cutoff/paint-calls";
import { paintOutput } from "~/widgets/families/cutoff/paint-output";
import {
  setSelectValue,
  zoneChoices,
} from "~/widgets/families/cutoff/zone-choices";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import type { GmtReadout } from "~/widgets/primitives/readout/readout";
import styles from "~/widgets/tools/cutoff-countdown.module.css";
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
  type CountdownFacts,
  type CountdownState,
  type CutoffCountdownArgs,
  type VerdictKind,
} from "./cutoff-countdown";
import { loadCutoffLib } from "./cutoff-lib";
import {
  dayTickLabel,
  durationText,
  epochMs,
  hourTickLabel,
  isDayBoundary,
  isNegative,
  localLabel,
  localParts,
  minuteTickLabel,
  monthTickLabel,
  walkTicks,
  type CutoffLib,
} from "./cutoff-widgets";
import { onceDestroy, WidgetLoadError } from "./widget-mount";

export type { CutoffCountdownArgs } from "./cutoff-countdown";

const WIDGET_NAME = "cutoff-countdown";
const NBSP = " ";
const READING_YOUR_CLOCK = "Reading your clock…";
const NOW_LIVE = "Now is your clock, live.";
const NOW_PINNED = "Now is pinned.";
/** The widest face value, so the face keeps its width from one reading to the next. */
const FACE_SAMPLE = "−8888 h 88 min 88 s";
/** Live ticks between two spoken summaries: one a minute. */
const SPEAK_EVERY_TICKS = 60;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The verdict block for a verdict kind; a blank one keeps the slot's height. */
function verdictSlot(kind: VerdictKind | "reading", text: string): SafeHtml {
  const tone: VerdictTone =
    kind === "on-time"
      ? "good"
      : kind === "late" || kind === "closed"
        ? "bad"
        : "neutral";
  return verdictBlock({
    tone,
    title: kind === "reading" ? READING_YOUR_CLOCK : text === "" ? NBSP : text,
    detail: "",
  });
}

function ruleText(cutoffTime: string): string {
  const time = cutoffTime || "the cut-off";
  return `The window to meet a cut-off is half-open: [ … , ${time} ). At ${time} exactly it has closed: isPastCutoff is true and timeToCutoff is PT0S.`;
}

/** The blank axis: its box is drawn before there is a window, so nothing moves when it fills. */
function blankAxis(): SafeHtml {
  return axisOf(null);
}

/**
 * The cut-off axis: open and closed bands, the gate, the now mark and a scale under them.
 * With no window it is the same box, empty.
 */
function axisOf(
  drawn: {
    win: AxisWindow;
    cutoffMs: number;
    nowMs: number;
    timeZone: string;
    cutoffTime: string;
    nowTime: string;
  } | null,
): SafeHtml {
  if (drawn === null) {
    return html`<div class="${styles.legend}">${NBSP}</div>${lane(
      { label: "Time window" },
      cutoffBands([]),
    )}<div class="${styles.scaleRow}">${cutoffScale([])}</div>`;
  }
  const { win, cutoffMs, nowMs, timeZone, cutoffTime, nowTime } = drawn;
  const span = Math.max(1, win.endMs - win.startMs);
  const pct = (ms: number): number => (ms - win.startMs) / span;
  const cutoffAt = pct(cutoffMs);
  const { unit, step } = countdownTickPlan(span);
  const label =
    unit === "minutes"
      ? minuteTickLabel
      : unit === "hours"
        ? hourTickLabel
        : unit === "days"
          ? dayTickLabel
          : monthTickLabel;
  const ticks: ScaleTick[] = walkTicks(
    win.startMs,
    win.endMs,
    timeZone,
    unit,
    step,
    label,
  ).map((t, i) => ({
    at: pct(t.ms),
    label: t.label,
    rank: isDayBoundary(t.label) || i % 2 === 0 ? 0 : 1,
    day: isDayBoundary(t.label),
  }));
  return html`<div class="${styles.legend}">${badge({ text: `cut-off ${cutoffTime}`, tone: "cyan" })}${badge({ text: `now ${nowTime}`, tone: "neutral" })}</div>${lane(
    { label: "Time window" },
    html`${cutoffBands([
      { kind: "open", from: 0, to: cutoffAt, word: "open" },
      { kind: "closed", from: cutoffAt, to: 1, word: "closed" },
    ])}${cutoffGate({ label: `cut-off ${cutoffTime}`, at: cutoffAt })}${mark({
      label: `now ${nowTime}`,
      at: pct(nowMs),
      series: 2,
    })}`,
  )}<div class="${styles.scaleRow}">${cutoffScale(ticks)}</div>`;
}

/**
 * `renderCutoffCountdownTemplate(idPrefix, args = {})`. Live mode (`args.now`
 * undefined and `args` seeded) is seeded with placeholders, never a clock
 * read; the mount fills them.
 */
export function renderCutoffCountdownTemplate(
  idPrefix: string,
  args: CutoffCountdownArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const seeded = args.cutoff !== undefined;
  const state: CountdownState = seeded
    ? readArgs(args)
    : presetState(COUNTDOWN_PRESETS[0]!);
  const live = state.mode === "live";
  const nowMode = hint(id("now-mode"), live ? NOW_LIVE : NOW_PINNED);

  const pick = section(
    { id: id("pick"), heading: "1. The cut-off and now", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...COUNTDOWN_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("cutoff"),
        label: "Cut-off",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.cutoff,
            autocomplete: "off",
            spellcheck: false,
          }),
      })}${field({
        id: id("zone"),
        label: "Clock",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.timeZone,
            options: zoneChoices(state.timeZone),
          }),
      })}${field({
        id: id("now"),
        label: "Now",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: live ? "" : state.now,
            placeholder: live ? READING_YOUR_CLOCK : "",
            autocomplete: "off",
            spellcheck: false,
          }),
      })}`,
    )}${buttonRow(
      html`${button({ id: id("use-clock"), label: "Use my clock" })}${button({ id: id("snap"), label: "Now = the cut-off" })}`,
    )}${nowMode.html}`,
  );

  const read = section(
    { id: id("read"), heading: "2. Late or on time", level: 4 },
    html`${grow(
      html`<div id="${id("verdict-slot")}">${verdictSlot(live ? "reading" : "none", "")}</div>`,
    )}<div class="${styles.status}" role="status" aria-label="Cut-off announcement" id="${id("status")}"></div>${countdownFace(
      {
        id: id("face"),
        caption: "Time to cut-off",
        value: live ? READING_YOUR_CLOCK : NBSP,
        iso: "",
        samples: [FACE_SAMPLE],
        live,
      },
    )}<div class="${styles.axis}" id="${id("axis-slot")}">${blankAxis()}</div>${range(
      {
        id: id("slider"),
        label: "Drag now",
        min: -60,
        max: 60,
        step: 1,
        value: 0,
        valueText: "",
        ends: [NBSP, NBSP],
        disabled: true,
      },
    )}${grow(html`<p class="${styles.rule}" id="${id("rule")}">${NBSP}</p>`)}${grow(
      html`<p class="${styles.summary}" id="${id("summary")}">${NBSP}</p>`,
    )}${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What the calls return", level: 4 },
    html`${grow(
      html`<div id="${id("past-slot")}">${codeFrame({
        label: "isPastCutoff call",
        copyLabel: "Copy isPastCutoff call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("past-output")}">${callOutput({
        label: "isPastCutoff returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(
      html`<div id="${id("left-slot")}">${codeFrame({
        label: "timeToCutoff call",
        copyLabel: "Copy timeToCutoff call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("left-output")}">${callOutput({
        label: "timeToCutoff returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Cut-off Countdown", scope: idPrefix },
    html`${pick}${read}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Hours, then days, then months, as the window grows: the tick unit and
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
      step: spanMs <= 24 * HOUR_MS ? 3 : 6,
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
 *  then asked about, never a result computed by this rounding. */
function floorToSecond(text: string): string {
  try {
    return Temporal.Instant.fromEpochMilliseconds(
      Math.floor(epochMs(text) / 1000) * 1000,
    ).toString();
  } catch {
    return text;
  }
}

interface Controller {
  readState(): CountdownState;
  apply(args: CutoffCountdownArgs): void;
  start(initial: "pinned" | "live"): void;
  destroy(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: CutoffLib,
  clock: () => string,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const rangeEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const faceEl = widgetEl.querySelector<GmtReadout>("gmt-readout")!;
  const cutoffEl = el<HTMLInputElement>("cutoff");
  const zoneEl = el<HTMLSelectElement>("zone");
  const nowEl = el<HTMLInputElement>("now");
  const useClockEl = el<HTMLButtonElement>("use-clock");
  const snapEl = el<HTMLButtonElement>("snap");

  let mode: "pinned" | "live" = "pinned";
  let window_: AxisWindow | null = null;
  let interval: ReturnType<typeof setInterval> | undefined;
  let destroyed = false;
  let announcedKind: VerdictKind | undefined;
  let ticks = 0;
  /** What the status says next: the summary the last render wrote. */
  let spoken = "";

  const speak = (text: string): void => {
    el("status").textContent = text;
  };

  function readState(): CountdownState {
    return {
      cutoff: cutoffEl.value.trim(),
      now: nowEl.value.trim(),
      timeZone: zoneEl.value.trim(),
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
    const s = readState();
    window_ = axisWindow(s.cutoff, s.now);
  }

  function syncPreset(): void {
    presetEl.value =
      mode === "pinned" ? matchPreset(readState()) : CUSTOM_PRESET_ID;
  }

  function showMode(): void {
    el("now-mode").textContent = mode === "live" ? NOW_LIVE : NOW_PINNED;
    faceEl.closest("figure")!.dataset["live"] = String(mode === "live");
  }

  function drawSlider(
    s: CountdownState,
    facts: CountdownFacts,
    win: AxisWindow | null,
  ): void {
    const cutoffEpoch = safeEpochMs(s.cutoff);
    const nowEpoch = safeEpochMs(s.now);
    const nowTime = facts.nowLocal ? localParts(facts.nowLocal).time : "";
    /* The chip, the spoken value and the face all read what `timeToCutoff`
       returned, so they cannot disagree: one sign (positive is time left), one
       precision. With no signal there is no value, and the control says so
       rather than keeping the last reading. */
    const hasValue = nowTime !== "" && facts.left !== "";
    const signed = isNegative(facts.left)
      ? "−"
      : facts.left === "PT0S"
        ? ""
        : "+";
    const leftText = durationText(facts.left);
    const chip = hasValue ? `${nowTime} · ${signed}${leftText}` : "";
    const sentence = !hasValue
      ? ""
      : facts.left === "PT0S"
        ? `${nowTime}, at the cut-off`
        : `${nowTime}, ${leftText} ${isNegative(facts.left) ? "after" : "before"} the cut-off`;

    if (win !== null && cutoffEpoch !== null) {
      rangeEl.min = Math.round((win.startMs - cutoffEpoch) / 60_000);
      rangeEl.max = Math.round((win.endMs - cutoffEpoch) / 60_000);
      rangeEl.ends = [
        windowEndLabel(win, win.startMs, s),
        windowEndLabel(win, win.endMs, s),
      ];
      if (nowEpoch !== null) {
        rangeEl.value = Math.round((nowEpoch - cutoffEpoch) / 60_000);
      }
      rangeEl.disabled = false;
    } else {
      rangeEl.ends = ["", ""];
      rangeEl.disabled = true;
    }
    // The chip is short ("16:45 · +1 h 15 min") so it fits a phone-width
    // box; aria-valuetext keeps the whole sentence. The range writes both
    // from one formatter, so the spoken sentence goes on last.
    rangeEl.formatValue = () => chip;
    rangeEl.input?.setAttribute("aria-valuetext", sentence);
  }

  function render(): void {
    const s = readState();
    const facts = collectCountdownFacts(s, lib);
    const v = verdict(facts);
    const lost = facts.left === "";

    setHtml(el("verdict-slot"), verdictSlot(v.kind, v.text));
    // A live tick that crosses the cut-off changes the verdict's kind and is
    // worth announcing; one that only counts down is not.
    const flipped = announcedKind !== undefined && v.kind !== announcedKind;
    announcedKind = v.kind;

    paintCalls(el("past-slot"), [
      { fn: "isPastCutoff", args: [s.now, s.cutoff], result: facts.past },
    ]);
    paintCalls(el("left-slot"), [
      { fn: "timeToCutoff", args: [s.now, s.cutoff], result: facts.left },
    ]);
    paintOutput(el("past-output"), {
      label: "isPastCutoff returned",
      state: lost ? "sentinel" : "live",
      lines: lost
        ? [{ text: "NO SIGNAL", lost: true }]
        : [{ text: String(facts.past), lost: false }],
    });
    paintOutput(el("left-output"), {
      label: "timeToCutoff returned",
      state: lost ? "sentinel" : "live",
      lines: lost
        ? [{ text: "NO SIGNAL", lost: true }]
        : [{ text: facts.left, lost: false }],
    });

    showMode();
    const cutoffTime = facts.cutoffLocal
      ? localParts(facts.cutoffLocal).time
      : "";
    const nowTime = facts.nowLocal ? localParts(facts.nowLocal).time : "";
    el("rule").textContent = ruleText(cutoffTime);

    if (window_ === null) recomputeWindow();
    const win = window_;
    drawSlider(s, facts, win);

    // The face reads what `timeToCutoff` returned: the sign is the returned
    // ISO's own, never computed here. An empty value is the sentinel.
    const sign = isNegative(facts.left)
      ? "−"
      : facts.left === "PT0S"
        ? ""
        : "+";
    faceEl.value = lost ? "" : `${sign}${durationText(facts.left)}`;
    el("face-iso").textContent = facts.left;

    const cutoffMs = safeEpochMs(s.cutoff);
    const nowMs = safeEpochMs(s.now);
    setHtml(
      el("axis-slot"),
      !win || lost || cutoffMs === null || nowMs === null
        ? blankAxis()
        : axisOf({
            win,
            cutoffMs,
            nowMs,
            timeZone: s.timeZone,
            cutoffTime,
            nowTime,
          }),
    );

    spoken = lost
      ? "No signal."
      : `Now is ${localLabel(facts.nowLocal)}; the cut-off is ${localLabel(facts.cutoffLocal)}. ${v.text}`;
    el("summary").textContent = spoken;

    setHtml(
      el("reason"),
      lost
        ? aside(
            {
              label: "Why NO SIGNAL",
              tone: "caution",
              title: "Why NO SIGNAL",
            },
            html`<p>${countdownNullText(countdownNullReason(s, lib))}</p>`,
          )
        : html``,
    );

    if (flipped) speak(spoken);
  }

  function readLiveNow(): void {
    nowEl.value = floorToSecond(clock());
  }

  function startLive(): void {
    stopLive();
    mode = "live";
    ticks = 0;
    readLiveNow();
    recomputeWindow();
    render();
    interval = setInterval(() => {
      readLiveNow();
      // Recompute the window only once the live reading actually leaves
      // it: not on every tick, and never while dragging.
      const nowMs = safeEpochMs(readState().now);
      if (
        window_ &&
        nowMs !== null &&
        (nowMs < window_.startMs || nowMs > window_.endMs)
      ) {
        recomputeWindow();
      }
      render();
      ticks += 1;
      if (ticks % SPEAK_EVERY_TICKS === 0) speak(spoken);
    }, 1000);
  }

  function switchToPinned(): void {
    if (mode === "live") {
      stopLive();
      mode = "pinned";
    }
  }

  function applyPreset(): void {
    const chosen = COUNTDOWN_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    stopLive();
    mode = "pinned";
    cutoffEl.value = chosen.cutoff;
    setSelectValue(zoneEl, chosen.timeZone);
    nowEl.value = chosen.now;
    recomputeWindow();
    syncPreset();
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === rangeEl) {
        switchToPinned();
        nowEl.value = nowFromSlider(
          cutoffEl.value.trim(),
          rangeEl.value,
          zoneEl.value.trim(),
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
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        applyPreset();
        speak(spoken);
        return;
      }
      if (target === zoneEl) {
        syncPreset();
        render();
        speak(spoken);
        return;
      }
      // A reader finishing a change: the slider released, a field left.
      if (target === rangeEl || target === cutoffEl || target === nowEl) {
        speak(spoken);
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (target === useClockEl) {
        startLive();
        syncPreset();
        speak(spoken);
        return;
      }
      if (target === snapEl) {
        switchToPinned();
        nowEl.value = nowFromSlider(
          cutoffEl.value.trim(),
          0,
          zoneEl.value.trim(),
        );
        recomputeWindow();
        syncPreset();
        render();
        speak(spoken);
      }
    },
    { signal },
  );

  return {
    readState,
    apply(args) {
      if (args.cutoff === undefined) return;
      const s = readArgs(args);
      cutoffEl.value = s.cutoff;
      setSelectValue(zoneEl, s.timeZone);
      if (s.mode === "pinned") {
        nowEl.value = s.now;
        presetEl.value = matchPreset(s);
      }
    },
    start(initial) {
      if (initial === "live") {
        startLive();
      } else {
        recomputeWindow();
        render();
      }
      syncPreset();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLive();
    },
  };
}

/** `MountFn<CutoffCountdownArgs>`'s three parameters, plus one more the
 *  contract does not carry: `clock`, which defaults to `lib.getUtcNow` and
 *  exists only as a seam for a test that wants its own clock. An extra
 *  optional trailing parameter is still assignable to
 *  `MountFn<CutoffCountdownArgs>` wherever the registry needs one. */
export const mountCutoffCountdown = async (
  root: HTMLElement,
  args: CutoffCountdownArgs,
  signal: AbortSignal,
  options?: { clock?: () => string },
) => {
  defineElements();
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const clock = options?.clock ?? lib.getUtcNow;
  const controller = setupWidget(root, lib, clock, signal);
  controller.apply(args);
  const seeded = args.cutoff !== undefined;
  controller.start(seeded ? readArgs(args).mode : "pinned");

  const onAbort = () => controller.destroy();
  signal.addEventListener("abort", onAbort);

  return onceDestroy(
    () => {
      signal.removeEventListener("abort", onAbort);
      controller.destroy();
    },
    () => permalinkOf(controller.readState()),
  );
};
