/**
 * The SSIM Date Reader widget (AV-97), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads an IATA SSIM date (`DDMMMYY`) with `parseSsimDate` and `isValidSsimDate`,
 * in the window the reader states. Section 2 puts the same text through the locale pattern
 * parser beside a table of the SSIM month letters and the locale's own short names: a different
 * function, used wrongly. Section 3 writes an ISO date back with `formatSsimDate`, in the same
 * window. Everything on screen is a library call; the widget computes no date and holds no
 * month-letter table (`ssim-date-reader.ts` builds the readings).
 *
 * Built on the component kit: `renderSsimDateReaderTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids and
 * delegates every listener on the widget with the mount's `signal`. Every region is laid out in
 * every state and holds the widest of its texts, so typing never moves a plate, the badge, the
 * reason line, the table or a calls frame.
 *
 * A refusal from the library reads NO SIGNAL (amber). The pattern parser's "no date" is the
 * right answer from that function and stays neutral. A box nobody typed in makes no call and
 * reads "nothing typed".
 */
import { defineElements } from "~/widgets/define";
import {
  badge,
  codeFrame,
  field,
  findWidget,
  hint,
  html,
  idScope,
  plates,
  section,
  select,
  setHtml,
  table,
  textInput,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import { reservedText } from "~/widgets/families/holiday/reserved-text";
import {
  SIGNAL_TEXT,
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/ssim-date-reader.module.css";
import { loadAviationLib, type AviationLib } from "./aviation-lib";
import { CONVERTER_LOCALES } from "./curated-timezones";
import {
  CUSTOM_PRESET_ID,
  ISO_SAMPLE,
  NOTHING_TYPED,
  NO_DATE,
  NO_NAME,
  PATTERN,
  PATTERN_LEAD,
  READ_REASONS,
  SSIM_PRESETS,
  WRITE_NOTE,
  WRITE_REASONS,
  callsSizerText,
  isSeeded,
  matchPreset,
  monthTable,
  permalinkOf,
  presetState,
  readArgs,
  readPattern,
  readSsim,
  writeSsim,
  type CallsSection,
  type MonthTable,
  type PatternResult,
  type ReadReasonKey,
  type ReadResult,
  type SsimArgs,
  type SsimState,
  type WriteReasonKey,
  type WriteResult,
} from "./ssim-date-reader";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { SsimArgs as SsimDateReaderArgs } from "./ssim-date-reader";

const WIDGET_NAME = "ssim-date-reader";

/** What the written-back plate reads while nothing has been written. */
export const NOT_WRITTEN = "nothing written";

/** The badge on the pattern plate when it disagrees with section 1. */
export const DIFFERS_TEXT = "differs from SSIM";

/** The words of the validity plate. */
const VALID_WORD = "valid";
const NOT_VALID_WORD = "not valid";

/** The widest a written SSIM date reads (`26SEP26`'s length, seven characters). */
const WIDEST_SSIM = "26SEP26";

/** The widest month name any CLDR short name takes, for the table before a locale is read. */
const FALLBACK_NAME = "sept.";

const WINDOW_ITEMS = [
  { value: "fixed", label: "Fixed from" },
  { value: "rolling", label: "Rolling" },
] as const;

// ---------------------------------------------------------------------------
// Held texts
// ---------------------------------------------------------------------------

const READ_REASON_TEXTS = Object.values(READ_REASONS);
const WRITE_REASON_TEXTS = Object.values(WRITE_REASONS);

const SECTION_LABELS: Record<CallsSection, string> = {
  read: "the SSIM read",
  pattern: "the pattern and the table",
  write: "the write",
};

function readReasonState(key: ReadReasonKey): HeldState {
  return key === "read" || key === "empty" ? "note" : "sentinel";
}

function writeReasonState(key: WriteReasonKey): HeldState {
  return key === "outside" || key === "refused" ? "sentinel" : "note";
}

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

/** A library result as a plate value: its date, NO SIGNAL for a refusal, or nothing typed. */
function dateOrSignal(blank: boolean, value: string | null): string | null {
  return blank ? NOTHING_TYPED : value;
}

function readPlates(r: ReadResult): SafeHtml {
  const list: SignalPlate[] = [
    {
      caption: "SSIM reads",
      value: dateOrSignal(r.blank, r.ssim),
      line: "parseSsimDate",
      lineSamples: ["parseSsimDate"],
      series: 1,
      samples: [ISO_SAMPLE, NOTHING_TYPED],
    },
    {
      caption: "Valid",
      value: r.blank ? NOTHING_TYPED : r.valid ? VALID_WORD : NOT_VALID_WORD,
      line: "isValidSsimDate",
      lineSamples: ["isValidSsimDate"],
      series: 2,
      samples: [VALID_WORD, NOT_VALID_WORD, NOTHING_TYPED],
    },
  ];
  return signalPlates(list, { gate: "hero" });
}

function writePlates(w: WriteResult): SafeHtml {
  const written = w.written !== null;
  const list: SignalPlate[] = [
    {
      caption: "SSIM writes",
      value: dateOrSignal(w.blank, w.written),
      line: "formatSsimDate",
      lineSamples: ["formatSsimDate"],
      series: 1,
      samples: [WIDEST_SSIM, NOTHING_TYPED],
    },
    {
      caption: "Reads back as",
      value: w.blank ? NOTHING_TYPED : written ? w.back : NOT_WRITTEN,
      line: "parseSsimDate",
      lineSamples: ["parseSsimDate"],
      series: 2,
      samples: [ISO_SAMPLE, NOTHING_TYPED, NOT_WRITTEN],
    },
  ];
  return signalPlates(list, { gate: "write-plates" });
}

/** Every locale the caption can name, so the pattern plate holds the widest caption. */
function captionOf(locale: string): string {
  return `Pattern reads (${PATTERN}, ${locale})`;
}

function localeList(locale: string): string[] {
  const list: string[] = [...CONVERTER_LOCALES];
  return list.includes(locale) ? list : [...list, locale];
}

function patternPlate(p: PatternResult, locale: string): SafeHtml {
  const list: Plate[] = [
    {
      caption: captionOf(locale),
      captions: localeList(locale).map(captionOf),
      value: p.date === undefined ? NOTHING_TYPED : (p.date ?? NO_DATE),
      lines: ["parseDateWithPattern"],
      lineSamples: [["parseDateWithPattern"]],
      series: 3,
      samples: [ISO_SAMPLE, NO_DATE, NOTHING_TYPED],
    },
  ];
  return plates(list, { gate: "pattern-plate" });
}

/**
 * The badge slot: the badge always takes its room (a hidden twin), and shows only when the
 * pattern parser disagrees with section 1. Its accent is a bottom edge, never a left one.
 */
function differsOf(on: boolean): SafeHtml {
  const mark = badge({ text: DIFFERS_TEXT, tone: "neutral" });
  return html`<div class="${styles.differsHold}" data-gate="differs"
    >${on ? html`<span class="${styles.differs}">${mark}</span>` : ""}<span
      class="${styles.differsGhost}"
      aria-hidden="true"
      >${mark}</span
    ></div
  >`;
}

// ---------------------------------------------------------------------------
// The month table
// ---------------------------------------------------------------------------

type ColumnKey = "month" | "letters" | "name";

// The header and the caption name no locale: in the stacked layout the header becomes each
// cell's label and the caption is a block, so a longer locale code (`fr-FR`) wrapped onto a
// second line and `en` did not, moving everything below by 12 rows. The Locale select names it.
function columnsOf() {
  return [
    { key: "month", header: "Month", align: "start", numeric: true },
    { key: "letters", header: "SSIM letters", align: "start", numeric: false },
    {
      key: "name",
      header: "Short name",
      align: "start",
      numeric: false,
    },
  ] as const;
}

function monthCell(
  text: string | null,
  samples: readonly string[],
  absent: string,
  signal: boolean,
): SafeHtml {
  return html`<span class="${styles.cell}"
    >${reservedText({
      text: text ?? (signal ? SIGNAL_TEXT : absent),
      state: text === null && signal ? "signal" : "live",
      samples: [...samples, SIGNAL_TEXT, absent],
    })}</span
  >`;
}

function monthsOf(t: MonthTable | null): SafeHtml {
  const widest = t === null || t.widest === "" ? FALLBACK_NAME : t.widest;
  const rows = (
    t?.rows ??
    Array.from({ length: 12 }, (_, i) => ({
      month: String(i + 1).padStart(2, "0"),
      letters: null,
      name: null,
    }))
  ).map((row) => ({
    month: row.month,
    letters: monthCell(row.letters, ["SEP"], NO_NAME, t !== null),
    name: monthCell(row.name, [widest], NO_NAME, false),
  }));
  return html`<div class="${styles.strip}"
    >${table<ColumnKey>({
      caption: `The twelve months: SSIM letters from formatSsimDate in the window 2000, and the short names of the chosen locale`,
      columns: columnsOf(),
      rows,
      rowHeader: "month",
      layout: "fixed",
      widths: ["16%", "28%"],
      labelCells: true,
      gate: "grid",
    })}</div
  >`;
}

// ---------------------------------------------------------------------------
// Calls frames
// ---------------------------------------------------------------------------

const SIZER_LINES: Record<CallsSection, number> = {
  read: callsSizerText("read").split("\n").length,
  pattern: callsSizerText("pattern").split("\n").length,
  write: callsSizerText("write").split("\n").length,
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

function localeOptions(locale: string): { value: string; label: string }[] {
  return localeList(locale).map((l) => ({ value: l, label: l }));
}

const blankRead: ReadResult = {
  blank: true,
  ssim: null,
  valid: null,
  reason: "empty",
  calls: [],
};

const blankWrite: WriteResult = {
  blank: true,
  written: null,
  back: null,
  reason: "empty",
  calls: [],
};

const blankPattern: PatternResult = {
  date: undefined,
  differs: false,
  calls: [],
};

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The readings are drawn blank here, without the library; `mount` draws every
 * result.
 */
export function renderSsimDateReaderTemplate(
  idPrefix: string,
  args: SsimArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args) ? readArgs(args) : presetState(SSIM_PRESETS[0]!);
  const rolling = state.mode === "rolling";

  const readSection = section(
    { id: id("read"), heading: "1. Read an SSIM date", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...SSIM_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}</div>${field({
      id: id("value"),
      label: "SSIM date",
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.value,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 16,
          describedBy,
        }),
    })}<div class="${styles.wide}" id="${id("window-slot")}">${chips({
      legend: "Window",
      kind: "radio",
      name: id("window"),
      items: WINDOW_ITEMS.map((i) => ({
        ...i,
        checked: i.value === (rolling ? "rolling" : "fixed"),
      })),
    })}</div><div id="${id("first-field")}" ${rolling ? html`hidden` : ""}>${field(
      {
        id: id("first"),
        label: "First year",
        hint: hint(
          id("first-hint"),
          "The first of the hundred years a two-digit year can mean.",
        ),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.first,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
            maxLength: 6,
            describedBy,
          }),
      },
    )}</div>${field({
      id: id("locale"),
      label: "Locale",
      hint: hint(
        id("locale-hint"),
        "Feeds only the comparison below. parseSsimDate takes no locale.",
      ),
      control: ({ id: cid, describedBy }) =>
        select({
          id: cid,
          value: state.locale,
          options: localeOptions(state.locale),
          describedBy,
        }),
    })}</div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("read-plates")}">${readPlates(blankRead)}</div
        ><div id="${id("read-reason")}">${readReasonOf("empty")}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("read-calls"), "read")}`,
  );

  const patternSection = section(
    {
      id: id("pattern"),
      heading: "2. The same text through a locale pattern",
      level: 3,
    },
    html`<p class="${styles.note}">${PATTERN_LEAD}</p>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("pattern-plate")}">${patternPlate(blankPattern, state.locale)}</div
        ><div id="${id("differs")}">${differsOf(false)}</div
        ><div id="${id("months")}">${monthsOf(null)}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("pattern-calls"), "pattern")}`,
  );

  const writeSection = section(
    { id: id("write"), heading: "3. Write a date back", level: 3 },
    html`<div class="${styles.controls}">${field({
      id: id("date"),
      label: "ISO date",
      hint: hint(id("date-hint"), WRITE_NOTE),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.date,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 32,
          describedBy,
        }),
    })}</div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("write-plates")}">${writePlates(blankWrite)}</div
        ><div id="${id("write-reason")}">${writeReasonOf("empty")}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("write-calls"), "write")}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "SSIM Date Reader", scope: idPrefix },
    html`${readSection}${patternSection}${writeSection}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): SsimState;
  apply(state: SsimState): void;
}

/** Which sections a change redraws. A locale change redraws section 2 alone. */
type Scope = "all" | "locale" | "date";

function setupWidget(
  root: HTMLElement,
  lib: AviationLib,
  signal: AbortSignal,
  initial: SsimState,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const valueEl = el<HTMLInputElement>("value");
  const firstEl = el<HTMLInputElement>("first");
  const localeEl = el<HTMLSelectElement>("locale");
  const dateEl = el<HTMLInputElement>("date");
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const windowEl = el("window-slot").querySelector<GmtChips>("gmt-chips")!;

  let state: SsimState = initial;
  let lastRead: ReadResult = blankRead;
  /** The locale the month table was last drawn for. */
  let drawnLocale = "";
  let months: MonthTable | null = null;

  function syncControls(): void {
    valueEl.value = state.value;
    firstEl.value = state.first;
    dateEl.value = state.date;
    windowEl.value = state.mode;
    el("first-field").hidden = state.mode === "rolling";
    if (![...localeEl.options].some((o) => o.value === state.locale)) {
      const opt = localeEl.ownerDocument.createElement("option");
      opt.value = state.locale;
      opt.textContent = state.locale;
      localeEl.append(opt);
    }
    localeEl.value = state.locale;
  }

  function drawRead(): void {
    lastRead = readSsim(lib, state);
    setHtml(el("read-plates"), readPlates(lastRead));
    setHtml(el("read-reason"), readReasonOf(lastRead.reason));
    setHtml(el("read-calls"), callsOf("read", lastRead.calls.join("\n")));
  }

  function drawPattern(): void {
    const pattern = readPattern(lib, state, lastRead);
    if (drawnLocale !== state.locale) {
      drawnLocale = state.locale;
      months = monthTable(lib, state.locale);
      setHtml(el("months"), monthsOf(months));
    }
    setHtml(el("pattern-plate"), patternPlate(pattern, state.locale));
    setHtml(el("differs"), differsOf(pattern.differs));
    setHtml(
      el("pattern-calls"),
      callsOf(
        "pattern",
        [...pattern.calls, ...(months?.calls ?? [])].join("\n"),
      ),
    );
  }

  function drawWrite(): void {
    const write = writeSsim(lib, state);
    setHtml(el("write-plates"), writePlates(write));
    setHtml(el("write-reason"), writeReasonOf(write.reason));
    setHtml(el("write-calls"), callsOf("write", write.calls.join("\n")));
  }

  function draw(scope: Scope): void {
    presetEl.value = matchPreset(state);
    if (scope === "all") {
      drawRead();
      drawPattern();
      drawWrite();
    } else if (scope === "locale") {
      drawPattern();
    } else {
      drawWrite();
    }
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === valueEl) {
        state.value = valueEl.value;
        draw("all");
      } else if (target === firstEl) {
        state.first = firstEl.value;
        draw("all");
      } else if (target === dateEl) {
        state.date = dateEl.value;
        draw("date");
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === localeEl) {
        state.locale = localeEl.value;
        draw("locale");
      } else if (target === presetEl) {
        const chosen = SSIM_PRESETS.find((p) => p.id === presetEl.value);
        // Custom keeps what is typed.
        if (chosen) apply(presetState(chosen));
      } else if (
        target instanceof Element &&
        target.closest("gmt-chips") === windowEl
      ) {
        const mode = windowEl.value === "rolling" ? "rolling" : "fixed";
        if (mode === state.mode) return;
        state.mode = mode;
        el("first-field").hidden = mode === "rolling";
        draw("all");
      }
    },
    { signal },
  );

  function apply(next: SsimState): void {
    state = next;
    syncControls();
    draw("all");
  }

  apply(state);

  return { readState: () => state, apply };
}

export const mountSsimDateReader: MountFn<SsimArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: AviationLib;
  try {
    lib = await loadAviationLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  // One draw, of what the reader asked for: no stray call for a preset that is never shown.
  const controller = setupWidget(
    root,
    lib,
    signal,
    isSeeded(args) ? readArgs(args) : presetState(SSIM_PRESETS[0]!),
  );

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
