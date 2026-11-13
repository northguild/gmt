/**
 * The GTFS Time Reader widget (RAI-99), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads one pasted GTFS `Time` value with `parseGtfsTime` and `isValidGtfsTime` and
 * writes the record back with `formatGtfsTime`. Section 2 puts the same text through a
 * clock-time check and folds it into one day, to show what a reader that does not know GTFS
 * loses. Section 3 writes a record from two typed numbers and reads it back. The clock note
 * under section 1 is always on screen.
 *
 * Built on the component kit and the holiday family: `renderGtfsTimeReaderTemplate` writes the
 * markup from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by
 * those ids. Every listener is delegated on the widget with the mount's `signal`; no timer
 * runs. The widget holds no GTFS rule: the library says what each text reads as and a refusal
 * is explained by asking it again (`gtfs-time-reader.ts`).
 *
 * `""` / `null` from the library renders as NO SIGNAL (amber). An empty box makes no call and
 * reads "nothing typed", never amber. Every region is laid out in every state and holds the
 * widest of its texts, so typing never moves a plate, a line, a badge or a calls frame.
 */
import { defineElements } from "~/widgets/define";
import {
  badge,
  button,
  buttonRow,
  codeFrame,
  field,
  findWidget,
  hint,
  hold,
  html,
  idScope,
  section,
  setHtml,
  textInput,
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
import styles from "~/widgets/tools/gtfs-time-reader.module.css";
import {
  CLOCK_NOTE_LEAD,
  CLOCK_NOTE_TAIL,
  CUSTOM_PRESET_ID,
  DIGITS_NOTE,
  EMPTY_READING,
  FOLD_MEANING_SAMPLES,
  FOLD_VERDICT_SAMPLES,
  NOTHING_TYPED,
  NOT_READ,
  NOT_READ_READING,
  NOT_WRITTEN,
  READING_SAMPLE,
  READ_MAX_CHARS,
  READ_PRESETS,
  READ_REASONS,
  RECORD_SAMPLE,
  WRITE_MAX_CHARS,
  WRITE_PRESETS,
  WRITE_REASONS,
  callsSizerText,
  daysText,
  foldGtfs,
  foldMeaning,
  foldVerdictText,
  isSeeded,
  matchReadPreset,
  matchWritePreset,
  permalinkOf,
  presetState,
  readArgs,
  readGtfs,
  readingText,
  recordText,
  writeGtfs,
  type CallsSection,
  type FoldResult,
  type GtfsState,
  type GtfsTimeReaderArgs,
  type ReadReasonKey,
  type ReadResult,
  type WriteReasonKey,
  type WriteResult,
} from "./gtfs-time-reader";
import { loadRailLib, type RailLib } from "./rail-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { GtfsTimeReaderArgs } from "./gtfs-time-reader";

const WIDGET_NAME = "gtfs-time-reader";
const USE_READ_LABEL = "Use the time read above";

/** The widest the seconds read when written with no days. */
const TIME_SAMPLE = "23:59:59";
/** The widest a written time reads (`999:59:59`'s length). */
const WIDEST_WRITTEN = "999:59:59";

const SECTION_LABELS: Record<CallsSection, string> = {
  read: "the read",
  fold: "the fold",
  write: "the write",
};

// ---------------------------------------------------------------------------
// Held lines
// ---------------------------------------------------------------------------

const READ_REASON_TEXTS = Object.values(READ_REASONS);
const WRITE_REASON_TEXTS = Object.values(WRITE_REASONS);

const readReasonState = (key: ReadReasonKey): HeldState =>
  key === "read" || key === "empty" ? "note" : "sentinel";

const writeReasonState = (key: WriteReasonKey): HeldState =>
  key === "written" || key === "empty" || key === "notNumber"
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

const RECORD_LEAD = "Record: ";
const WRITTEN_LEAD = "Written back: ";

/** The lines under the plates: the reading, the record, the write-back and its note. */
function readLines(r: ReadResult, text: string): SafeHtml {
  const blank = r.kind === "empty";
  const refused = r.kind === "refused";
  const reading = blank
    ? EMPTY_READING
    : refused || r.record === null
      ? NOT_READ_READING
      : readingText(r.record.dayOverflow, r.lessDays ?? SIGNAL_TEXT);
  const record = blank
    ? NOTHING_TYPED
    : r.record === null
      ? SIGNAL_TEXT
      : recordText(r.record);
  const written = blank
    ? NOTHING_TYPED
    : r.writtenBack === null
      ? SIGNAL_TEXT
      : r.writtenBack;
  const differs =
    r.kind === "read" && r.writtenBack !== null && r.writtenBack !== text;
  return html`${heldText({
    label: "Reading",
    text: reading,
    state: blank ? "note" : refused ? "sentinel" : "ok",
    sizers: [READING_SAMPLE, EMPTY_READING, NOT_READ_READING],
    gate: "hold",
  })}${heldText({
    label: "Record",
    text: `${RECORD_LEAD}${record}`,
    state: record === SIGNAL_TEXT ? "sentinel" : blank ? "note" : "ok",
    sizers: [
      `${RECORD_LEAD}${RECORD_SAMPLE}`,
      `${RECORD_LEAD}${NOTHING_TYPED}`,
      `${RECORD_LEAD}${SIGNAL_TEXT}`,
    ],
    gate: "hold",
  })}${heldText({
    label: "Written back",
    text: `${WRITTEN_LEAD}${written}`,
    state: written === SIGNAL_TEXT ? "sentinel" : blank ? "note" : "ok",
    sizers: [
      `${WRITTEN_LEAD}${WIDEST_WRITTEN}`,
      `${WRITTEN_LEAD}${NOTHING_TYPED}`,
      `${WRITTEN_LEAD}${SIGNAL_TEXT}`,
    ],
    gate: "hold",
  })}${heldText({
    label: "Note on the digits",
    text: differs ? DIGITS_NOTE : "",
    state: "note",
    sizers: [DIGITS_NOTE],
    gate: "hold",
  })}`;
}

// ---------------------------------------------------------------------------
// Plates
// ---------------------------------------------------------------------------

function readPlates(r: ReadResult): SafeHtml {
  const blank = r.kind === "empty";
  const list: SignalPlate[] = [
    {
      caption: "Less whole days",
      value: blank ? NOTHING_TYPED : r.lessDays,
      line: "formatGtfsTime",
      lineSamples: ["formatGtfsTime"],
      series: 1,
      samples: [TIME_SAMPLE, NOTHING_TYPED],
    },
    {
      caption: "Days past the service day",
      value: blank
        ? NOTHING_TYPED
        : r.record === null
          ? null
          : String(r.record.dayOverflow),
      line: "parseGtfsTime",
      lineSamples: ["parseGtfsTime"],
      series: 2,
      samples: ["41", NOTHING_TYPED],
    },
  ];
  return signalPlates(list, { gate: "hero" });
}

function foldPlates(f: FoldResult): SafeHtml {
  const blank = f.kind === "empty";
  const unread = f.kind === "notRead";
  const verdict = (valid: boolean | null): string =>
    valid === null ? NOT_READ : valid ? "accepts" : "refuses";
  const list: SignalPlate[] = [
    {
      caption: "Clock-time check",
      value: blank ? NOTHING_TYPED : unread ? NOT_READ : verdict(f.clockValid),
      line: "isValidTime",
      lineSamples: ["isValidTime"],
      series: 1,
      samples: ["accepts", "refuses", NOTHING_TYPED, NOT_READ],
    },
    {
      caption: "Folded to",
      value: blank ? NOTHING_TYPED : unread ? NOT_READ : f.folded,
      line: "formatGtfsTime",
      lineSamples: ["formatGtfsTime"],
      series: 2,
      samples: [TIME_SAMPLE, NOTHING_TYPED, NOT_READ],
    },
  ];
  return signalPlates(list, { gate: "fold-plates" });
}

function writePlates(w: WriteResult): SafeHtml {
  const blank = w.kind === "empty";
  const notNumber = w.kind === "notNumber";
  const list: SignalPlate[] = [
    {
      caption: "GTFS writes",
      value: blank ? NOTHING_TYPED : notNumber ? "not a number" : w.written,
      line: "formatGtfsTime",
      lineSamples: ["formatGtfsTime"],
      series: 1,
      samples: [WIDEST_WRITTEN, NOTHING_TYPED, "not a number"],
    },
    {
      caption: "Reads back as",
      value: blank
        ? NOTHING_TYPED
        : notNumber
          ? "not a number"
          : w.back === null
            ? w.kind === "refused"
              ? NOT_WRITTEN
              : null
            : daysText(w.back.dayOverflow),
      line: "parseGtfsTime",
      lineSamples: ["parseGtfsTime"],
      series: 2,
      samples: ["41 days", NOTHING_TYPED, "not a number", NOT_WRITTEN],
    },
  ];
  return signalPlates(list, { gate: "write-plates" });
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const validBadge = (valid: boolean) =>
  badge({ text: `isValidGtfsTime is ${String(valid)}`, tone: "neutral" });

/** The validity badge: always laid out, empty for an empty box. */
function validOf(valid: boolean | null): SafeHtml {
  return hold(valid === null ? html`` : validBadge(valid), [
    validBadge(true),
    validBadge(false),
  ]);
}

const foldBadge = (text: string) => badge({ text, tone: "neutral" });

function foldVerdictOf(f: FoldResult): SafeHtml {
  const text =
    f.kind === "folded"
      ? foldVerdictText(f.lost)
      : f.kind === "empty"
        ? ""
        : "not folded";
  return hold(
    text === "" ? html`` : foldBadge(text),
    FOLD_VERDICT_SAMPLES.map(foldBadge),
  );
}

const roundTripBadge = (text: string) => badge({ text, tone: "neutral" });
const ROUND_TRIP_TEXTS = ["round trip: same record", "round trip: different"];

function roundTripOf(w: WriteResult): SafeHtml {
  const text = w.kind === "written" ? ROUND_TRIP_TEXTS[w.same ? 0 : 1]! : "";
  return hold(
    text === "" ? html`` : roundTripBadge(text),
    ROUND_TRIP_TEXTS.map(roundTripBadge),
  );
}

function foldMeaningOf(f: FoldResult): SafeHtml {
  return heldText({
    label: "What the fold means",
    text: foldMeaning(f),
    state: "note",
    sizers: FOLD_MEANING_SAMPLES,
    gate: "hold",
  });
}

// ---------------------------------------------------------------------------
// Calls frames
// ---------------------------------------------------------------------------

const SIZER_LINES: Record<CallsSection, number> = {
  read: callsSizerText("read").split("\n").length,
  fold: callsSizerText("fold").split("\n").length,
  write: callsSizerText("write").split("\n").length,
};

const widestLine = (text: string): string =>
  text.split("\n").reduce((a, b) => (b.length > a.length ? b : a), "");

const SIZER_WIDEST: Record<CallsSection, string> = {
  read: widestLine(callsSizerText("read")),
  fold: widestLine(callsSizerText("fold")),
  write: widestLine(callsSizerText("write")),
};

function callsOf(which: CallsSection, text: string): SafeHtml {
  return codeFrame({
    label: `Calls made for ${SECTION_LABELS[which]}`,
    copyLabel: `Copy the calls for ${SECTION_LABELS[which]}`,
    copyText: text,
    code: html`${text}`,
    gate: "codeframe",
    // The widest reading prints every call; the frame holds that many lines.
    minLines: SIZER_LINES[which],
    // The widest line, hidden, so the frame scrolls (or not) the same way in every state.
    sizer: SIZER_WIDEST[which],
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
  lessDays: null,
  writtenBack: null,
  valid: null,
  reason: "empty",
  calls: [],
};

const blankFold: FoldResult = {
  kind: "empty",
  clockValid: null,
  folded: null,
  foldedBack: null,
  lost: 0,
  calls: [],
};

const blankWrite: WriteResult = {
  kind: "empty",
  written: null,
  back: null,
  same: false,
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
export function renderGtfsTimeReaderTemplate(
  idPrefix: string,
  args: GtfsTimeReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: GtfsState = isSeeded(args) ? readArgs(args) : presetState();

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
    { id: id("read"), heading: "1. Read a GTFS time", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchReadPreset(state.value),
      options: presetOptions(READ_PRESETS),
    })}</div>${input("value", "GTFS time", state.value, READ_MAX_CHARS, "text")}</div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("read-plates")}">${readPlates(blankRead)}</div
        ><div id="${id("read-lines")}">${readLines(blankRead, "")}</div
        ><div id="${id("valid")}">${validOf(null)}</div
        ><div id="${id("read-reason")}">${readReasonOf("empty")}</div>`,
      { gate: "frame" },
    )}<div class="${styles.clock}" id="${id("clock-note")}">${
      hint(
        id("clock-note-text"),
        html`${CLOCK_NOTE_LEAD}<code>gtfsToInstant</code>${CLOCK_NOTE_TAIL}`,
      ).html
    }</div>${callsSlot(id("read-calls"), "read")}`,
  );

  const fold = section(
    { id: id("fold"), heading: "2. Folded into one day", level: 3 },
    html`<p class="${styles.note}">This is what code that does not know GTFS does with the same text: a clock-time check, then the time with the days dropped.</p>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("fold-plates")}">${foldPlates(blankFold)}</div
        ><div id="${id("fold-verdict")}">${foldVerdictOf(blankFold)}</div
        ><div id="${id("fold-meaning")}">${foldMeaningOf(blankFold)}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("fold-calls"), "fold")}`,
  );

  const write = section(
    { id: id("write"), heading: "3. Write a GTFS time", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("write-preset"),
      label: "Write preset",
      value: matchWritePreset(state.seconds, state.dayOverflow),
      options: presetOptions(WRITE_PRESETS),
    })}</div>${input(
      "seconds",
      "Seconds (less whole days)",
      state.seconds,
      WRITE_MAX_CHARS,
      "numeric",
    )}${input(
      "days",
      "Days past the service day",
      state.dayOverflow,
      WRITE_MAX_CHARS,
      "numeric",
    )}<div class="${styles.wide}">${buttonRow(
      button({ id: id("use-read"), label: USE_READ_LABEL }),
    )}</div></div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("write-plates")}">${writePlates(blankWrite)}</div
        ><div id="${id("round-trip")}">${roundTripOf(blankWrite)}</div
        ><div id="${id("write-reason")}">${writeReasonOf("empty")}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("write-calls"), "write")}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "GTFS Time Reader", scope: idPrefix },
    html`${read}${fold}${write}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): GtfsState;
  apply(state: GtfsState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: RailLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const writePresetEl = el("write-preset").closest<GmtPreset>("gmt-preset")!;
  const valueEl = el<HTMLInputElement>("value");
  const secondsEl = el<HTMLInputElement>("seconds");
  const daysEl = el<HTMLInputElement>("days");
  const useEl = el<HTMLButtonElement>("use-read");
  let reading: ReadResult = blankRead;

  const readState = (): GtfsState => ({
    value: valueEl.value,
    seconds: secondsEl.value,
    dayOverflow: daysEl.value,
  });

  function syncPresets(): void {
    const s = readState();
    presetEl.value = matchReadPreset(s.value);
    writePresetEl.value = matchWritePreset(s.seconds, s.dayOverflow);
  }

  function renderRead(text: string): void {
    const r = readGtfs(lib, text);
    reading = r;
    setHtml(el("read-plates"), readPlates(r));
    setHtml(el("read-lines"), readLines(r, text));
    setHtml(el("valid"), validOf(r.valid));
    setHtml(el("read-reason"), readReasonOf(r.reason));
    setHtml(el("read-calls"), callsOf("read", r.calls.join("\n")));
    // A text that was not read has no record to copy.
    useEl.disabled = r.record === null;

    const f = foldGtfs(lib, text, r);
    setHtml(el("fold-plates"), foldPlates(f));
    setHtml(el("fold-verdict"), foldVerdictOf(f));
    setHtml(el("fold-meaning"), foldMeaningOf(f));
    setHtml(el("fold-calls"), callsOf("fold", f.calls.join("\n")));
  }

  function renderWrite(seconds: string, days: string): void {
    const w = writeGtfs(lib, seconds, days);
    setHtml(el("write-plates"), writePlates(w));
    setHtml(el("round-trip"), roundTripOf(w));
    setHtml(el("write-reason"), writeReasonOf(w.reason));
    setHtml(el("write-calls"), callsOf("write", w.calls.join("\n")));
  }

  function render(): void {
    const s = readState();
    renderRead(s.value);
    renderWrite(s.seconds, s.dayOverflow);
  }

  function apply(state: GtfsState): void {
    valueEl.value = state.value;
    secondsEl.value = state.seconds;
    daysEl.value = state.dayOverflow;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (
        e.target !== valueEl &&
        e.target !== secondsEl &&
        e.target !== daysEl
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
        valueEl.value = chosen.value;
      } else if (e.target === writePresetEl) {
        const chosen = WRITE_PRESETS.find((p) => p.id === writePresetEl.value);
        if (!chosen) return;
        secondsEl.value = chosen.seconds;
        daysEl.value = chosen.dayOverflow;
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
      const record = reading.record;
      if (record === null) return;
      secondsEl.value = String(record.seconds);
      daysEl.value = String(record.dayOverflow);
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountGtfsTimeReader: MountFn<GtfsTimeReaderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: RailLib;
  try {
    lib = await loadRailLib();
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
