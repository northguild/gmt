/**
 * The SWIFT Value Date Reader widget (FIN-96), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads one pasted SWIFT value date (`YYMMDD`) with `parseSwiftDate` and
 * `isValidSwiftDate`, both called on the text as typed. Section 2 tables the century SWIFT
 * states, derived by asking the library about every two-digit year, beside a quotation of the
 * rule. Section 3 writes an ISO date back with `formatSwiftDate` and reads it back.
 *
 * Built on the component kit and the EDI figure: `renderSwiftValueDateReaderTemplate` writes the
 * markup from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by
 * those ids. Every listener is delegated on the widget with the mount's `signal`; no timer runs.
 * The widget holds no SWIFT rule, range or band edge: the library says what each text reads as
 * and a refusal is explained by asking it again (`swift-value-date-reader.ts`).
 *
 * `""` from the library renders as NO SIGNAL (amber). An empty box makes no call and reads
 * "nothing typed", never amber.
 */
import { defineElements } from "~/widgets/define";
import {
  button,
  buttonRow,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  section,
  setHtml,
  table,
  textInput,
  toolLinks,
  verdict,
  widget,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import {
  callFrameContent,
  callFrameHold,
  callLines,
  emptyOutput,
  outputContent,
  outputHold,
  outputOf,
  type CallOutputState,
} from "~/widgets/families/edi/edi-call";
import {
  ediFigure,
  figureContent,
  type FigureValue,
} from "~/widgets/families/edi/edi-figure";
import { verdictHold } from "~/widgets/families/edi/edi-view";
import { reservedText } from "~/widgets/families/holiday/reserved-text";
import {
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/swift-value-date-reader.module.css";
import { callResultsText } from "./edi-render";
import type { EdiCall } from "./edi-widgets";
import { loadFinanceLib } from "./finance-lib";
import type { FinanceLib } from "./finance-widgets";
import { withBase } from "./site";
import {
  CUSTOM_PRESET_ID,
  EMPTY_READ_TEXT,
  NOTHING_TYPED,
  NOT_READ_TEXT,
  NOT_WRITTEN,
  NOT_WRITTEN_TEXT,
  READ_MAX_CHARS,
  READ_PRESETS,
  REFUSED_YEAR,
  T50,
  WIDTH_BANDS,
  WRITE_MAX_CHARS,
  WRITE_PRESETS,
  bandText,
  deriveBands,
  isSeeded,
  matchReadPreset,
  matchWritePreset,
  permalinkOf,
  pictureOf,
  presetState,
  readArgs,
  readReasonSamples,
  readValueDate,
  writeReasonSamples,
  writeValueDate,
  type Bands,
  type SwiftReaderState,
  type SwiftValueDateReaderArgs,
  type ValueReading,
  type WriteReading,
} from "./swift-value-date-reader";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { SwiftValueDateReaderArgs } from "./swift-value-date-reader";

const WIDGET_NAME = "swift-value-date-reader";
const USE_READ_LABEL = "Use the date read above";

/** The widest ISO date a plate shows. */
const ISO_SAMPLE = "2060-12-31";
const YEAR_SAMPLE = "2060";
const CODE_TEXT = `Error code ${T50}`;

/** Standards MT General Information (2025) §6.3.1 and §6.3.6, quoted; the site never runs it. */
const RULE_QUOTE = `§6.3.1 Dates
The six-digit date thus ranges
from 2001 to 2060

§6.3.6 Value Date Ordering
allowed: a year component …
'YY' in the range of 01 through 60
not allowed: any 'YY' component
outside of this range`;
const RULE_CITATION =
  "Quoted from SWIFT Standards MT General Information, Standards MT November 2025, §6.3.1 (p. 44) and §6.3.6 (p. 59), which gives error code T50. The site never runs this: every row above is a library answer.";

/** The links under the calls. */
const LINKS = [
  {
    text: "Finance message timestamps",
    href: "/guides/industries/finance-message-timestamps/",
  },
  { text: "FIX Timestamp Reader", href: "/tools/fix-timestamp-reader/" },
] as const;

// ---------------------------------------------------------------------------
// The widest each region holds, which sizes it
// ---------------------------------------------------------------------------

const figureOf = (text: string, read: boolean): FigureValue => ({
  halves: pictureOf(text, read).halves,
  separator: "",
  closing: "",
});

/** The two shapes the figure draws: a text cut into three, and one box holding any other. */
const RESERVED_FIGURES = [
  figureOf("990615", true),
  figureOf("0".repeat(READ_MAX_CHARS), false),
];

const LONGEST_READ = "0".repeat(READ_MAX_CHARS);
const LONGEST_WRITE = "0".repeat(WRITE_MAX_CHARS);

const readCalls = (text: string, iso: string, valid: boolean): EdiCall[] => [
  { fn: "parseSwiftDate", args: [text], result: iso },
  { fn: "isValidSwiftDate", args: [text], result: valid },
];
const writeCalls = (text: string, out: string): EdiCall[] => [
  { fn: "formatSwiftDate", args: [text], result: out },
  { fn: "isValidDate", args: [text], result: true },
  { fn: "parseSwiftDate", args: [out], result: ISO_SAMPLE },
];

const READ_CALL_SAMPLES = [
  callLines(readCalls(LONGEST_READ, ISO_SAMPLE, true)).plain,
];
const READ_OUTPUT_SAMPLES = [
  callResultsText(readCalls(LONGEST_READ, ISO_SAMPLE, true)),
];
const WRITE_CALL_SAMPLES = [
  callLines(writeCalls(LONGEST_WRITE, "991231")).plain,
];
const WRITE_OUTPUT_SAMPLES = [
  callResultsText(writeCalls(LONGEST_WRITE, "991231")),
];

const READ_TITLES = ["isValidSwiftDate is true", "isValidSwiftDate is false"];
const WRITE_TITLES = ["Same date", "Another date", "Refused"];

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

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

function readPlates(r: ValueReading | null): SafeHtml {
  const blank = r === null || r.kind === "empty";
  const list: SignalPlate[] = [
    {
      caption: "Date",
      value: blank ? NOTHING_TYPED : r.iso,
      line: "parseSwiftDate",
      lineSamples: ["parseSwiftDate"],
      series: 1,
      samples: [ISO_SAMPLE, NOTHING_TYPED],
    },
    {
      caption: "Year",
      value: blank ? NOTHING_TYPED : (r.year ?? REFUSED_YEAR),
      line: "from the date",
      lineSamples: ["from the date"],
      series: 2,
      samples: [YEAR_SAMPLE, REFUSED_YEAR, NOTHING_TYPED],
    },
  ];
  return signalPlates(list, { gate: "plates" });
}

function writePlates(w: WriteReading | null): SafeHtml {
  const blank = w === null || w.kind === "empty";
  const list: SignalPlate[] = [
    {
      caption: "Value date",
      value: blank ? NOTHING_TYPED : w.written,
      line: "formatSwiftDate",
      lineSamples: ["formatSwiftDate"],
      series: 1,
      samples: ["991231", NOTHING_TYPED],
    },
    {
      caption: "Reads back as",
      value: blank ? NOTHING_TYPED : (w.back ?? NOT_WRITTEN),
      line: "parseSwiftDate",
      lineSamples: ["parseSwiftDate"],
      series: 2,
      samples: [ISO_SAMPLE, NOTHING_TYPED, NOT_WRITTEN],
    },
  ];
  return signalPlates(list, { gate: "write-plates" });
}

/** The error code: always laid out, hidden with `visibility` when the reading shows none. */
function codeChip(code: string | null): SafeHtml {
  return html`<p class="${styles.chip}"
    >${reservedText({
      // Empty while no code shows: the ghost keeps the room, the reader hears nothing.
      text: code === null ? "" : CODE_TEXT,
      state: code === null ? "off" : "live",
      samples: [CODE_TEXT],
      gate: "chip",
    })}</p
  >`;
}

/** The band table's rows: the library's bands, or dashes before the library has loaded. */
function bandsOf(bands: Bands | null, current: number): SafeHtml {
  const rows = (bands?.list ?? WIDTH_BANDS.list).map((b) => ({
    yy: bands === null ? "–" : bandText(b),
    year:
      bands === null
        ? "–"
        : b.firstYear === null
          ? REFUSED_YEAR
          : `${b.firstYear}–${b.lastYear}`,
    swift:
      bands === null
        ? "–"
        : b.firstYear === null
          ? `refused, ${T50}`
          : `${Math.floor(b.firstYear / 100)}YY`,
  }));
  return html`<div class="${styles.strip}"
    >${table<"yy" | "year" | "swift">({
      caption: "How SWIFT reads the two-digit year, from parseSwiftDate",
      columns: [
        { key: "yy", header: "YY", align: "start", numeric: true },
        { key: "year", header: "Year", align: "start", numeric: true },
        { key: "swift", header: "SWIFT", align: "start", numeric: false },
      ],
      rows,
      rowHeader: "yy",
      layout: "fixed",
      widths: ["24%", "36%"],
      labelCells: true,
      currentRow: current,
      gate: "grid",
    })}</div
  >`;
}

function linkItems(): ToolLinkItem[] {
  return LINKS.map((l) => ({ text: l.text, href: withBase(l.href) }));
}

function readOutput(r: ValueReading): CallOutputState {
  if (r.kind === "empty") return emptyOutput(NOT_READ_TEXT);
  return outputOf(r.kind === "refused" ? "sentinel" : "ok", r.calls);
}

function writeOutput(w: WriteReading): CallOutputState {
  if (w.kind === "empty") return emptyOutput(NOT_WRITTEN_TEXT);
  return outputOf(w.kind === "refused" ? "sentinel" : "ok", w.calls);
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset of each section. The readings are drawn by `mount`, because they come from
 * real library calls.
 */
export function renderSwiftValueDateReaderTemplate(
  idPrefix: string,
  args: SwiftValueDateReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: SwiftReaderState = isSeeded(args)
    ? readArgs(args)
    : presetState();

  const input = (
    local: string,
    label: string,
    value: string,
    maxLength: number,
  ) =>
    field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          maxLength,
          describedBy,
        }),
    });

  const read = section(
    { id: id("read"), heading: "1. Read a value date", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchReadPreset(state.value),
      options: presetOptions(READ_PRESETS),
    })}${fieldGrid(
      input("value", "Value date (YYMMDD)", state.value, READ_MAX_CHARS),
    )}<p class="${styles.note}">The text goes to the library exactly as typed. A field 30 or the date of field 32A is a six-character value date.</p></div>
    <div class="${styles.split}">
      <div class="${styles.pane}"><div class="${styles.panel}">${ediFigure({
        id: id("figure"),
        spec: { kind: "empty", text: EMPTY_READ_TEXT },
        reserve: RESERVED_FIGURES,
      })}${grow(html`<div class="${styles.plates}" id="${id("plates")}">${readPlates(null)}</div>`)}<div id="${id("code")}">${codeChip(null)}</div>${verdictHold(
        {
          id: id("verdict"),
          titles: READ_TITLES,
          details: readReasonSamples(WIDTH_BANDS),
        },
      )}</div></div>
      <div class="${styles.pane}">${callFrameHold({
        id: id("read-call"),
        spec: { label: "Calls made", calls: [] },
        samples: READ_CALL_SAMPLES,
      })}${outputHold({
        id: id("read-output"),
        label: "What the calls returned",
        state: emptyOutput(NOT_READ_TEXT),
        samples: READ_OUTPUT_SAMPLES,
      })}</div>
    </div>`,
  );

  const century = section(
    { id: id("century"), heading: "2. The century SWIFT states", level: 4 },
    html`<p class="${styles.note}">Each row groups the two-digit years the library reads alike. The row for the year you typed is marked.</p><div id="${id("bands")}">${bandsOf(null, -1)}</div>${codeFrame(
      {
        label: "SWIFT year rule, General Information 2025",
        copyLabel: "Copy the SWIFT year rule",
        copyText: RULE_QUOTE,
        code: html`${RULE_QUOTE}`,
        gate: "codeframe",
        minLines: RULE_QUOTE.split("\n").length,
      },
    )}<p class="${styles.note}">${RULE_CITATION}</p>`,
  );

  const write = section(
    { id: id("write"), heading: "3. Write a value date", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("write-preset"),
      label: "Date preset",
      value: matchWritePreset(state.date),
      options: presetOptions(WRITE_PRESETS),
    })}${fieldGrid(
      input("date", "ISO date", state.date, WRITE_MAX_CHARS),
    )}<div class="${styles.action}">${buttonRow(
      button({
        id: id("use-read"),
        label: USE_READ_LABEL,
        describedBy: id("use-read-note"),
      }),
    )}<p class="${styles.note}" id="${id("use-read-note")}">Copies the date from section 1 into the box above.</p></div></div>
    <div class="${styles.split}">
      <div class="${styles.pane}"><div class="${styles.panel}">${grow(
        html`<div class="${styles.plates}" id="${id("write-plates")}">${writePlates(null)}</div>`,
      )}${verdictHold({
        id: id("write-verdict"),
        titles: WRITE_TITLES,
        details: writeReasonSamples(WIDTH_BANDS),
      })}</div></div>
      <div class="${styles.pane}">${callFrameHold({
        id: id("write-call"),
        spec: { label: "Calls made", calls: [] },
        samples: WRITE_CALL_SAMPLES,
      })}${outputHold({
        id: id("write-output"),
        label: "What the calls returned",
        state: emptyOutput(NOT_WRITTEN_TEXT),
        samples: WRITE_OUTPUT_SAMPLES,
      })}</div>
    </div>`,
  );

  const links = section(
    { id: id("links"), heading: "4. Related", level: 4 },
    html`${toolLinks({ label: "Related", links: linkItems() })}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "SWIFT Value Date Reader", scope: idPrefix },
    html`${read}${century}${write}${links}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): SwiftReaderState;
  apply(state: SwiftReaderState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: FinanceLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const writePresetEl = el("write-preset").closest<GmtPreset>("gmt-preset")!;
  const valueEl = el<HTMLInputElement>("value");
  const dateEl = el<HTMLInputElement>("date");
  const useEl = el<HTMLButtonElement>("use-read");
  const bands = deriveBands(lib);
  let reading: ValueReading | null = null;

  setHtml(el("bands"), bandsOf(bands, -1));
  const rowsOf = (): HTMLTableRowElement[] => [
    ...el("bands").querySelectorAll<HTMLTableRowElement>("tbody tr"),
  ];

  const readState = (): SwiftReaderState => ({
    value: valueEl.value,
    date: dateEl.value,
  });

  function syncPresets(): void {
    const s = readState();
    presetEl.value = matchReadPreset(s.value);
    writePresetEl.value = matchWritePreset(s.date);
  }

  function renderRead(text: string): void {
    const r = readValueDate(lib, text, bands);
    reading = r;
    setHtml(
      el("figure"),
      r.kind === "empty"
        ? figureContent({ kind: "empty", text: EMPTY_READ_TEXT })
        : (() => {
            const p = pictureOf(text, r.kind === "read");
            return figureContent({
              kind: "value",
              aria: p.aria,
              halves: p.halves,
              separator: "",
              closing: "",
            });
          })(),
    );
    setHtml(el("plates"), readPlates(r));
    setHtml(el("code"), codeChip(r.code));
    setHtml(
      el("verdict"),
      r.kind === "empty"
        ? html``
        : verdict({
            tone: r.kind === "read" ? "good" : "bad",
            title: `isValidSwiftDate is ${String(r.valid)}`,
            detail: r.reason,
          }),
    );
    setHtml(
      el("read-call"),
      callFrameContent({ label: "Calls made", calls: r.calls }),
    );
    setHtml(
      el("read-output"),
      outputContent("What the calls returned", readOutput(r)),
    );
    // Only the mark moves: the table's size and scroll position stay put.
    rowsOf().forEach((row, i) => {
      if (i === r.band) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    // A text that was not read has no date to copy.
    useEl.disabled = r.iso === null;
  }

  function renderWrite(text: string): void {
    const w = writeValueDate(lib, text, bands);
    setHtml(el("write-plates"), writePlates(w));
    setHtml(
      el("write-verdict"),
      w.kind === "empty"
        ? html``
        : verdict({
            tone: w.kind === "written" && w.same ? "good" : "bad",
            title:
              w.kind === "refused"
                ? "Refused"
                : w.same
                  ? "Same date"
                  : "Another date",
            detail: w.kind === "refused" ? w.reason : "",
          }),
    );
    setHtml(
      el("write-call"),
      callFrameContent({ label: "Calls made", calls: w.calls }),
    );
    setHtml(
      el("write-output"),
      outputContent("What the calls returned", writeOutput(w)),
    );
  }

  function render(): void {
    const s = readState();
    renderRead(s.value);
    renderWrite(s.date);
  }

  function apply(state: SwiftReaderState): void {
    valueEl.value = state.value;
    dateEl.value = state.date;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== valueEl && e.target !== dateEl) return;
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
        valueEl.value = chosen.text;
      } else if (e.target === writePresetEl) {
        const chosen = WRITE_PRESETS.find((p) => p.id === writePresetEl.value);
        if (!chosen) return;
        dateEl.value = chosen.text;
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
      const iso = reading?.iso;
      if (iso === null || iso === undefined) return;
      dateEl.value = iso;
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountSwiftValueDateReader: MountFn<
  SwiftValueDateReaderArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: FinanceLib;
  try {
    lib = await loadFinanceLib();
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
