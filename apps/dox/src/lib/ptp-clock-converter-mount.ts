/**
 * The PTP Clock Converter widget (IOT-101), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads a PTP timestamp (seconds, nanoseconds and the announced `currentUtcOffset`)
 * with `ptpToUtc`, next to the same count read with the offset ignored. Section 2 checks the
 * announced offset against the leap-second table (`taiMinusUtc`) and draws both on a fixed
 * ruler. Section 3 writes a UTC instant back with `utcToPtp`, using the same offset box.
 *
 * Built on the component kit and the holiday family: `renderPtpClockConverterTemplate` writes
 * the markup from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts
 * by those ids. Every listener is delegated on the widget with the mount's `signal`; no timer
 * runs and no clock is read. The widget holds no PTP rule: the library says what each text
 * reads as and a refusal is explained by asking it again (`ptp-clock-converter.ts`).
 *
 * `""` / `null` from the library renders as NO SIGNAL (amber). An empty box makes no call and
 * reads "nothing typed", never amber. Every region is laid out in every state and holds the
 * widest of its texts, so typing never moves a plate, a line, a badge or a calls frame. Only
 * the ruler's marks move, by design.
 */
import { defineElements } from "~/widgets/define";
import {
  axis,
  badge,
  button,
  buttonRow,
  codeFrame,
  field,
  findWidget,
  hold,
  html,
  idScope,
  lane,
  mark,
  section,
  setHtml,
  srOnly,
  textInput,
  tick,
  verdict,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import {
  SIGNAL_TEXT,
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/ptp-clock-converter.module.css";
import {
  BADGE_SAMPLES,
  CUSTOM_PRESET_ID,
  INSTANT_MAX_CHARS,
  MARK_WIDTH,
  NOTHING_TYPED,
  NOT_A_NUMBER,
  NOT_READ,
  NOT_WRITTEN,
  NUMBER_MAX_CHARS,
  READ_PRESETS,
  READ_REASONS,
  RULER_LABEL,
  RULER_SECONDS,
  VERDICT_SAMPLES,
  WRITE_PRESETS,
  WRITE_REASONS,
  badgeText,
  callsSizer,
  checkOffset,
  isSeeded,
  markStart,
  matchReadPreset,
  matchWritePreset,
  permalinkOf,
  presetState,
  readArgs,
  readPtp,
  roundTripText,
  rulerOf,
  writePtp,
  type CallsSection,
  type CheckResult,
  type PtpClockArgs,
  type PtpState,
  type ReadReasonKey,
  type ReadResult,
  type RulerModel,
  type WriteReasonKey,
  type WriteResult,
} from "./ptp-clock-converter";
import { WIDEST_INSTANT, WIDEST_SECONDS_TEXT } from "./ptp-clock-presets";
import { loadIotLib, type IotLib } from "./iot-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { PtpClockArgs } from "./ptp-clock-converter";

const WIDGET_NAME = "ptp-clock-converter";
const USE_READ_LABEL = "Use the reading above";

const SECTION_LABELS: Record<CallsSection, string> = {
  read: "the read",
  check: "the check",
  write: "the write",
};

// ---------------------------------------------------------------------------
// Held lines
// ---------------------------------------------------------------------------

const READ_REASON_TEXTS = Object.values(READ_REASONS);
const WRITE_REASON_TEXTS = Object.values(WRITE_REASONS);

const readReasonState = (key: ReadReasonKey): HeldState =>
  key === "read" || key === "empty" || key === "notNumber"
    ? "note"
    : "sentinel";

const writeReasonState = (key: WriteReasonKey): HeldState =>
  key === "written" ||
  key === "empty" ||
  key === "needOffset" ||
  key === "notNumber"
    ? "note"
    : "sentinel";

function readReasonOf(key: ReadReasonKey): SafeHtml {
  return heldText({
    label: "Reason for the read",
    text: READ_REASONS[key],
    state: readReasonState(key),
    sizers: READ_REASON_TEXTS,
    gate: "hold",
  });
}

function writeReasonOf(key: WriteReasonKey): SafeHtml {
  return heldText({
    label: "Reason for the write",
    text: WRITE_REASONS[key],
    state: writeReasonState(key),
    sizers: WRITE_REASON_TEXTS,
    gate: "hold",
  });
}

// ---------------------------------------------------------------------------
// Plates
// ---------------------------------------------------------------------------

const INSTANT_SAMPLES = [WIDEST_INSTANT, NOTHING_TYPED, NOT_A_NUMBER, NOT_READ];

/** A library string: `""` is the library's refusal, and renders as NO SIGNAL. */
const orSignal = (text: string | null): string | null =>
  text === null || text === "" ? null : text;

function readPlates(r: ReadResult): SafeHtml {
  const word =
    r.kind === "empty"
      ? NOTHING_TYPED
      : r.kind === "notNumber"
        ? NOT_A_NUMBER
        : undefined;
  const list: SignalPlate[] = [
    {
      caption: "UTC",
      value: word ?? orSignal(r.utc),
      line: "ptpToUtc",
      lineSamples: ["ptpToUtc"],
      series: 1,
      samples: INSTANT_SAMPLES,
    },
    {
      caption: "Offset ignored",
      value: word ?? orSignal(r.ignored),
      line: "ptpToUtc",
      lineSamples: ["ptpToUtc"],
      series: 2,
      samples: INSTANT_SAMPLES,
    },
  ];
  return signalPlates(list, { gate: "hero" });
}

const TABLE_SAMPLES = ["37 s", "-99 s", NOTHING_TYPED, NOT_READ];

function checkPlates(c: CheckResult): SafeHtml {
  const word =
    c.kind === "empty"
      ? NOTHING_TYPED
      : c.kind === "noReading"
        ? NOT_READ
        : undefined;
  const list: SignalPlate[] = [
    {
      caption: "Table offset",
      value: word ?? (c.table === null ? null : `${c.table} s`),
      line: "taiMinusUtc",
      lineSamples: ["taiMinusUtc"],
      series: 1,
      samples: TABLE_SAMPLES,
    },
    {
      caption: "Table reading",
      value: word ?? orSignal(c.tableUtc),
      line: "ptpToUtc",
      lineSamples: ["ptpToUtc"],
      series: 2,
      samples: INSTANT_SAMPLES,
    },
  ];
  return signalPlates(list, { gate: "check-plates" });
}

const SECONDS_SAMPLES = [
  `${WIDEST_SECONDS_TEXT}n`,
  NOTHING_TYPED,
  NOT_A_NUMBER,
];
const NANOS_SAMPLES = ["123456789", NOTHING_TYPED, NOT_A_NUMBER];

function writePlates(w: WriteResult): SafeHtml {
  const word =
    w.kind === "empty"
      ? NOTHING_TYPED
      : w.kind === "notNumber"
        ? NOT_A_NUMBER
        : undefined;
  const list: SignalPlate[] = [
    {
      caption: "Seconds",
      value: word ?? (w.seconds === null ? null : `${w.seconds}n`),
      line: "utcToPtp",
      lineSamples: ["utcToPtp"],
      series: 1,
      samples: SECONDS_SAMPLES,
    },
    {
      caption: "Nanoseconds",
      value: word ?? (w.nanoseconds === null ? null : String(w.nanoseconds)),
      line: "utcToPtp",
      lineSamples: ["utcToPtp"],
      series: 2,
      samples: NANOS_SAMPLES,
    },
  ];
  return signalPlates(list, { gate: "write-plates" });
}

// ---------------------------------------------------------------------------
// Badge, verdict, round trip
// ---------------------------------------------------------------------------

const recordBadge = (text: string) => badge({ text, tone: "neutral" });

/** The record badge: always laid out, empty until a record was typed. */
function badgeOf(valid: boolean | null): SafeHtml {
  return hold(
    valid === null ? html`` : recordBadge(badgeText(valid)),
    BADGE_SAMPLES.map(recordBadge),
  );
}

function verdictOf(c: CheckResult): SafeHtml {
  return hold(verdict(c.verdict), VERDICT_SAMPLES.map(verdict));
}

function roundTripOf(w: WriteResult): SafeHtml {
  const text =
    w.kind === "written"
      ? roundTripText(orSignal(w.back) ?? SIGNAL_TEXT)
      : w.kind === "refused"
        ? roundTripText(NOT_WRITTEN)
        : roundTripText(NOTHING_TYPED);
  return heldText({
    label: "Round trip",
    text,
    state: text.endsWith(SIGNAL_TEXT) ? "sentinel" : "ok",
    sizers: [
      roundTripText(WIDEST_INSTANT),
      roundTripText(NOTHING_TYPED),
      roundTripText(NOT_WRITTEN),
      roundTripText(SIGNAL_TEXT),
    ],
    gate: "hold",
  });
}

// ---------------------------------------------------------------------------
// The ruler
// ---------------------------------------------------------------------------

const TICKS = [0, 10, 20, 30, 40];

function rulerHtml(model: RulerModel): SafeHtml {
  const marks = model.marks.map((m) =>
    mark({
      label: m.label,
      at: markStart(m.at),
      span: MARK_WIDTH,
      series: m.kind === "table" ? 2 : 1,
      pattern: m.kind === "table" ? "hatch" : "solid",
    }),
  );
  const gap =
    model.gap === null
      ? ""
      : mark({
          label: model.gap.label,
          at: markStart(model.gap.at) + MARK_WIDTH / 2,
          span: model.gap.span,
          series: 3,
          pattern: "dotted",
        });
  return html`<div class="${styles.ruler}"
    ><span class="${styles.moving}" data-gate="moving"
      >${lane({ label: RULER_LABEL, gate: "drawn" }, html`${gap}${marks}`)}</span
    >${axis(
      TICKS.map(
        (t) =>
          html`<span class="${t % 20 === 0 ? styles.major : styles.minor}">${tick(
            { at: t / RULER_SECONDS, label: String(t) },
          )}</span>`,
      ),
    )}${srOnly(model.facts.join(" "))}</div
  >`;
}

// ---------------------------------------------------------------------------
// Calls frames
// ---------------------------------------------------------------------------

const SIZERS: Record<CallsSection, { lines: number; widest: string }> = {
  read: callsSizer("read"),
  check: callsSizer("check"),
  write: callsSizer("write"),
};

function callsOf(which: CallsSection, text: string): SafeHtml {
  return codeFrame({
    label: `Calls made for ${SECTION_LABELS[which]}`,
    copyLabel: `Copy the calls for ${SECTION_LABELS[which]}`,
    copyText: text,
    code: html`${text}`,
    gate: "codeframe",
    // The widest reading prints every call; the frame holds that many lines.
    minLines: SIZERS[which].lines,
    // The widest line, hidden, so the frame scrolls (or not) the same way in every state.
    sizer: SIZERS[which].widest,
  });
}

function callsSlot(id: string, which: CallsSection): SafeHtml {
  return grow(
    html`<div class="${styles.slot}" id="${id}">${callsOf(which, "")}</div>`,
  );
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const blankRead: ReadResult = {
  kind: "empty",
  record: null,
  offset: null,
  utc: null,
  ignored: null,
  valid: null,
  reason: "empty",
  calls: [],
};

const blankCheck: CheckResult = {
  kind: "empty",
  announced: null,
  table: null,
  tableUtc: null,
  verdict: VERDICT_SAMPLES[0]!,
  calls: [],
};

const blankWrite: WriteResult = {
  kind: "empty",
  seconds: null,
  nanoseconds: null,
  back: null,
  reason: "empty",
  calls: [],
};

const presetOptions = (
  presets: readonly { id: string; label: string; description: string }[],
) => [
  { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
  ...presets.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  })),
];

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset of each section. The readings are drawn blank here, without the library;
 * `mount` draws every result.
 */
export function renderPtpClockConverterTemplate(
  idPrefix: string,
  args: PtpClockArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: PtpState = isSeeded(args) ? readArgs(args) : presetState();

  const input = (
    local: string,
    label: string,
    value: string,
    maxLength: number,
    inputMode: "text" | "numeric",
  ) =>
    field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          inputMode,
          autocomplete: "off",
          spellcheck: false,
          maxLength,
          describedBy,
        }),
    });

  const read = section(
    { id: id("read"), heading: "1. Read a PTP timestamp", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchReadPreset(state),
      options: presetOptions(READ_PRESETS),
    })}</div>${input(
      "seconds",
      "Seconds",
      state.seconds,
      NUMBER_MAX_CHARS,
      "numeric",
    )}${input(
      "nanoseconds",
      "Nanoseconds",
      state.nanoseconds,
      NUMBER_MAX_CHARS,
      "numeric",
    )}${input(
      "offset",
      "currentUtcOffset (s)",
      state.offset,
      NUMBER_MAX_CHARS,
      "numeric",
    )}</div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("read-plates")}">${readPlates(blankRead)}</div
        ><div id="${id("badge")}">${badgeOf(null)}</div
        ><div id="${id("read-reason")}">${readReasonOf("empty")}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("read-calls"), "read")}`,
  );

  const check = section(
    { id: id("check"), heading: "2. Check the offset", level: 3 },
    html`<p class="${styles.note}">The announced offset against the leap-second table, read at the announced UTC reading.</p>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("check-plates")}">${checkPlates(blankCheck)}</div
        ><div id="${id("verdict")}">${verdictOf(blankCheck)}</div
        ><div class="${styles.slot}" id="${id("ruler")}">${rulerHtml(rulerOf(blankCheck))}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("check-calls"), "check")}`,
  );

  const write = section(
    { id: id("write"), heading: "3. Write a PTP timestamp", level: 3 },
    html`<p class="${styles.note}">Writing uses the offset typed in section 1.</p><div class="${styles.controls}"><div class="${styles.wide}">${preset(
      {
        id: id("write-preset"),
        label: "Write preset",
        value: matchWritePreset(state.instant),
        options: presetOptions(WRITE_PRESETS),
      },
    )}</div><div class="${styles.wide}">${input(
      "instant",
      "UTC instant",
      state.instant,
      INSTANT_MAX_CHARS,
      "text",
    )}</div><div class="${styles.wide}">${buttonRow(
      button({ id: id("use-read"), label: USE_READ_LABEL }),
    )}</div></div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("write-plates")}">${writePlates(blankWrite)}</div
        ><div id="${id("round-trip")}">${roundTripOf(blankWrite)}</div
        ><div id="${id("write-reason")}">${writeReasonOf("empty")}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("write-calls"), "write")}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "PTP Clock Converter", scope: idPrefix },
    html`${read}${check}${write}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): PtpState;
  apply(state: PtpState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: IotLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const writePresetEl = el("write-preset").closest<GmtPreset>("gmt-preset")!;
  const secondsEl = el<HTMLInputElement>("seconds");
  const nanosEl = el<HTMLInputElement>("nanoseconds");
  const offsetEl = el<HTMLInputElement>("offset");
  const instantEl = el<HTMLInputElement>("instant");
  const useEl = el<HTMLButtonElement>("use-read");
  let reading: ReadResult = blankRead;

  const readState = (): PtpState => ({
    seconds: secondsEl.value,
    nanoseconds: nanosEl.value,
    offset: offsetEl.value,
    instant: instantEl.value,
  });

  function syncPresets(): void {
    const s = readState();
    presetEl.value = matchReadPreset(s);
    writePresetEl.value = matchWritePreset(s.instant);
  }

  function render(): void {
    const s = readState();
    const r = readPtp(lib, s);
    reading = r;
    setHtml(el("read-plates"), readPlates(r));
    setHtml(el("badge"), badgeOf(r.valid));
    setHtml(el("read-reason"), readReasonOf(r.reason));
    setHtml(el("read-calls"), callsOf("read", r.calls.join("\n")));
    // Only a reading the library gave can be copied.
    useEl.disabled = orSignal(r.utc) === null;

    const c = checkOffset(lib, r);
    setHtml(el("check-plates"), checkPlates(c));
    setHtml(el("verdict"), verdictOf(c));
    setHtml(el("ruler"), rulerHtml(rulerOf(c)));
    setHtml(el("check-calls"), callsOf("check", c.calls.join("\n")));

    const w = writePtp(lib, s);
    setHtml(el("write-plates"), writePlates(w));
    setHtml(el("round-trip"), roundTripOf(w));
    setHtml(el("write-reason"), writeReasonOf(w.reason));
    setHtml(el("write-calls"), callsOf("write", w.calls.join("\n")));
  }

  function apply(state: PtpState): void {
    secondsEl.value = state.seconds;
    nanosEl.value = state.nanoseconds;
    offsetEl.value = state.offset;
    instantEl.value = state.instant;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (
        e.target !== secondsEl &&
        e.target !== nanosEl &&
        e.target !== offsetEl &&
        e.target !== instantEl
      ) {
        return;
      }
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === presetEl) {
        const chosen = READ_PRESETS.find((p) => p.id === presetEl.value);
        // "Your values" keeps what is typed.
        if (!chosen) return;
        secondsEl.value = chosen.seconds;
        nanosEl.value = chosen.nanoseconds;
        offsetEl.value = chosen.offset;
      } else if (e.target === writePresetEl) {
        const chosen = WRITE_PRESETS.find((p) => p.id === writePresetEl.value);
        if (!chosen) return;
        instantEl.value = chosen.instant;
      } else return;
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "click",
    (e) => {
      if (
        !(e.target instanceof Element) ||
        e.target.closest("button") !== useEl
      ) {
        return;
      }
      const utc = orSignal(reading.utc);
      if (utc === null) return;
      instantEl.value = utc;
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountPtpClockConverter: MountFn<PtpClockArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: IotLib;
  try {
    lib = await loadIotLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPresets();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
