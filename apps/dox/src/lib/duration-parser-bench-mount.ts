/**
 * The Duration Parser Bench widget (CORE-85), mountable on its tool page and in the chat rail.
 *
 * The reader types a duration the way people write it. Section 2 shows which parser reads it,
 * the ten duration fields, the compact form, the round trip and the locale words. Section 3
 * holds two fixed tables: one for `1m` against `1mo` and `P1M`, one for a laytime day against
 * 24 hours across a clock change.
 *
 * Built on the component kit. `renderDurationParserBenchTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and holds every part the widget shows, so a
 * reader's first paint and the mounted widget have the same structure; `mount` fills them from
 * real calls. Typing re-draws section 2 alone. A locale change re-draws the `formatDuration`
 * cells alone. Every listener is delegated on the widget with the mount's `signal`.
 */
import { CONVERTER_LOCALES } from "./curated-timezones";
import { inlineCodeHtml } from "./inline-code-html";
import { loadDurationBenchLib } from "./duration-bench-lib";
import type { DurationBenchLib } from "./duration-bench-lib";
import {
  BENCH_MAX_TEXT,
  BIMCO_URL,
  CHAIN_TEXT,
  DURATION_FIELDS,
  LAYTIME_NOTE,
  LAYTIME_STARTS,
  LAYTIME_ZONE,
  NO_SPELLING_TEXT,
  PARSER_LABEL,
  TRY_STRINGS,
  benchView,
  laytimeRows,
  minuteOrMonthRows,
  permalinkOf,
  readArgs,
  type BenchState,
  type BenchView,
  type DurationParserBenchArgs,
} from "./duration-parser-bench";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  badge,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  table,
  widget,
  type Column,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  boundedTextInput,
  factList,
  notCalled,
  resultCell,
  resultOutput,
  roundTripCell,
  slotBox,
  tryButtons,
  unitStrip,
  writtenCell,
  CELL_NO_SIGNAL,
  DIFFERENT_DURATION_TEXT,
  NOT_CALLED_TEXT,
  RESULT_NO_SIGNAL,
  SAME_DURATION_TEXT,
  type StripCell,
} from "~/widgets/families/duration/bench-parts";
import { defineElements } from "~/widgets/define";
import { grow } from "~/widgets/primitives/grow/grow";
import styles from "~/widgets/tools/duration-parser-bench.module.css";

export type { DurationParserBenchArgs } from "./duration-parser-bench";
export {
  CELL_NO_SIGNAL,
  DIFFERENT_DURATION_TEXT,
  NOT_CALLED_TEXT,
  RESULT_NO_SIGNAL,
  SAME_DURATION_TEXT,
};

const WIDGET_NAME = "duration-parser-bench";

const MINUTE_CAPTION = "Seven spellings of a minute, a month and a millisecond";
const LAYTIME_CAPTION = `Rotterdam, ${LAYTIME_ZONE}`;

type MinuteKey = "written" | "human" | "iso" | "unit" | "compact" | "words";
type LaytimeKey = "written" | "human" | "compact" | "hoursA" | "hoursB";

const col = <K extends string>(
  key: K,
  header: string,
  numeric = false,
): Column<K> => ({ key, header, align: "start", numeric });

const MINUTE_COLUMNS: readonly Column<MinuteKey>[] = [
  col("written", "Written"),
  col("human", "parseHumanDuration"),
  col("iso", "parseDuration"),
  col("unit", "Unit"),
  col("compact", "formatHumanDuration"),
  col("words", "formatDuration"),
];

const LAYTIME_COLUMNS: readonly Column<LaytimeKey>[] = [
  col("written", "Written"),
  col("human", "parseHumanDuration"),
  col("compact", "formatHumanDuration"),
  col("hoursA", `Hours from ${LAYTIME_STARTS[0]!.label}`, true),
  col("hoursB", `Hours from ${LAYTIME_STARTS[1]!.label}`, true),
];

const minuteTable = (rows: readonly Record<MinuteKey, SafeHtml>[]): SafeHtml =>
  table<MinuteKey>({
    caption: MINUTE_CAPTION,
    columns: MINUTE_COLUMNS,
    rows,
    rowHeader: "written",
  });

const laytimeTable = (
  rows: readonly Record<LaytimeKey, SafeHtml>[],
): SafeHtml =>
  table<LaytimeKey>({
    caption: LAYTIME_CAPTION,
    columns: LAYTIME_COLUMNS,
    rows,
    rowHeader: "written",
  });

function localeOptions(selected: string) {
  const locales: readonly string[] = (
    CONVERTER_LOCALES as readonly string[]
  ).includes(selected)
    ? CONVERTER_LOCALES
    : [...CONVERTER_LOCALES, selected];
  return locales.map((l) => ({ value: l, label: l }));
}

/** The ten fields before any call: no value, nothing lit. */
function blankCells(): StripCell[] {
  return DURATION_FIELDS.map((f) => ({
    field: f.field,
    symbol: f.symbol,
    value: null,
    lit: false,
    title: `${f.field}: no duration to read`,
  }));
}

const stripOf = (cells: readonly StripCell[]): SafeHtml =>
  unitStrip({
    label: "Duration fields",
    noSpelling: NO_SPELLING_TEXT,
    cells,
  });

const factsOf = (
  compact: SafeHtml,
  roundtrip: SafeHtml,
  words: SafeHtml,
): SafeHtml =>
  factList([
    { label: "Compact form", value: compact },
    { label: "Round trip", value: roundtrip },
    { label: "In words", value: words },
  ]);

const parserBadge = (parser: BenchView["parser"] | "idle"): SafeHtml =>
  parser === "idle" || parser === "none"
    ? badge({
        text: parser === "none" ? "neither parser" : NOT_CALLED_TEXT,
        tone: "neutral",
        dim: true,
      })
    : badge({ text: PARSER_LABEL[parser], tone: "cyan" });

const CALLS_LABEL = "Calls made";
const OUTPUT_LABEL = "What the calls returned";

const callFrame = (code?: SafeHtml, copyText = ""): SafeHtml =>
  codeFrame({
    label: CALLS_LABEL,
    copyLabel: "Copy the calls",
    copyText,
    ...(code === undefined ? {} : { code }),
    gate: "codeframe",
  });

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. It holds every part the
 * widget shows; `mount` fills them from real library calls.
 */
export function renderDurationParserBenchTemplate(
  idPrefix: string,
  args: DurationParserBenchArgs = {},
): string {
  const id = idScope(idPrefix);
  const state = readArgs(args);

  const yourString = section(
    { id: id("string"), heading: "1. Your string", level: 4 },
    html`${fieldGrid(
      html`${field({
        id: id("text"),
        label: "Duration string",
        control: ({ id: cid, describedBy }) =>
          boundedTextInput({
            id: cid,
            value: state.text,
            max: BENCH_MAX_TEXT,
            describedBy,
          }),
      })}${field({
        id: id("locale"),
        label: "Locale",
        control: ({ id: cid }) =>
          select({
            id: cid,
            options: localeOptions(state.locale),
            value: state.locale,
          }),
      })}`,
    )}
      <div id="${id("try")}">
        ${tryButtons({ label: "Try", values: TRY_STRINGS })}
      </div>`,
  );

  const reads = section(
    { id: id("reads"), heading: "2. What it reads as", level: 4 },
    html`<div class="${styles.parser}">
        <div class="${styles.badgeSlot}" id="${id("parser")}">
          ${parserBadge("idle")}
        </div>
        ${resultOutput({ id: id("result"), label: "Parsed duration", className: styles.result })}
      </div>
      <p class="${styles.refusal}" id="${id("refusal")}"></p>
      <p class="${styles.chain}">
        A caller who takes either form writes
        <code class="${styles.chainCode}">${CHAIN_TEXT}</code>.
      </p>
      <div class="${styles.slot}" id="${id("strip")}">
        ${stripOf(blankCells())}
      </div>
      <div class="${styles.slot}" id="${id("facts")}">
        ${factsOf(notCalled(), notCalled(), notCalled())}
      </div>
      ${grow(html`<div id="${id("calls")}">${callFrame()}</div>`)}
      ${grow(
        html`<div id="${id("returned")}">
          ${callOutput({ label: OUTPUT_LABEL, state: "empty", lines: [] })}
        </div>`,
      )}`,
  );

  const tables = section(
    {
      id: id("tables"),
      heading: "3. Minute or month, day or 24 hours",
      level: 4,
    },
    html`<div class="${styles.stack}">
      ${grow(html`<div id="${id("minute")}">${minuteTable([])}</div>`)}
      ${grow(html`<div id="${id("laytime")}">${laytimeTable([])}</div>`)}
      <p class="${styles.laytimeNote}">
        <a href="${BIMCO_URL}" rel="noopener">${LAYTIME_NOTE.link}</a
        >${raw(inlineCodeHtml(LAYTIME_NOTE.rest))}
      </p>
    </div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Duration Parser Bench", scope: idPrefix },
    html`${yourString}${reads}${tables}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function minuteRows(
  lib: DurationBenchLib,
  locale: string,
  id: (local: string) => string,
): Record<MinuteKey, SafeHtml>[] {
  return minuteOrMonthRows(lib, locale).map((r, i) => ({
    written: writtenCell(r.written, inlineCodeHtml(r.note)),
    human: resultCell(r.human),
    iso: resultCell(r.iso),
    unit: r.unitFound === null ? resultCell(null) : html`${r.unitFound}`,
    compact: resultCell(r.compact),
    words: wordsSlot(i, r.words, id),
  }));
}

/** The `formatDuration` cell's content: a slot a locale change writes into alone. */
const wordsSlot = (
  index: number,
  words: string | null,
  id: (local: string) => string,
): SafeHtml => slotBox(id(`words-${index}`), resultCell(words));

function laytimeRowsOf(lib: DurationBenchLib): Record<LaytimeKey, SafeHtml>[] {
  const hours = (h: number | null | undefined): SafeHtml =>
    h === null || h === undefined ? resultCell(null) : html`${String(h)}`;
  return laytimeRows(lib).map((r) => ({
    written: writtenCell(r.written),
    human: resultCell(r.human),
    compact: resultCell(r.compact),
    hoursA: hours(r.hours[0]),
    hoursB: hours(r.hours[1]),
  }));
}

function cellsOf(view: BenchView): StripCell[] {
  return view.cells.map((c) => ({
    field: c.field,
    symbol: c.symbol,
    value: c.value,
    lit: c.lit,
    title:
      c.value === null
        ? `${c.field}: no duration to read`
        : `getDurationUnit(${view.iso}, ${c.field}) = ${c.value}`,
  }));
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Wire the widget and draw it once, with `initial` applied first when given. */
function setupWidget(
  root: HTMLElement,
  lib: DurationBenchLib,
  signal: AbortSignal,
  initial?: BenchState,
) {
  const { el: widgetEl, id, part } = findWidget(root, WIDGET_NAME);
  const text = part<HTMLInputElement>("text");
  const locale = part<HTMLSelectElement>("locale");
  const tryEl = part("try");
  const result = part("result");

  const readState = (): BenchState => ({
    text: text.value,
    locale: locale.value,
  });

  function render(): void {
    // Never trimmed: a leading space is a case the reader should see refused.
    const view = benchView(lib, text.value, locale.value);

    setHtml(part("parser"), parserBadge(view.parser));
    result.textContent = view.iso === "" ? RESULT_NO_SIGNAL : view.iso;
    result.dataset["state"] = view.iso === "" ? "sentinel" : "live";
    part("refusal").textContent = view.refusal ?? "";
    setHtml(part("strip"), stripOf(cellsOf(view)));
    setHtml(
      part("facts"),
      factsOf(
        view.compact === null ? notCalled() : resultCell(view.compact),
        roundTripCell(view.sameDuration),
        view.words === null ? notCalled() : resultCell(view.words),
      ),
    );

    const calls = [
      view.calls.iso,
      view.calls.human,
      view.calls.compact,
      view.calls.roundtrip,
      view.calls.words,
    ].filter((c): c is NonNullable<typeof c> => c !== null);
    const lines = callLines(calls);
    setHtml(part("calls"), callFrame(lines.code, lines.plain));
    const out = outputOf(view.parser === "none" ? "sentinel" : "ok", calls);
    setHtml(
      part("returned"),
      callOutput({ label: OUTPUT_LABEL, state: out.state, lines: out.lines }),
    );
  }

  function drawTables(): void {
    setHtml(part("minute"), minuteTable(minuteRows(lib, locale.value, id)));
    setHtml(part("laytime"), laytimeTable(laytimeRowsOf(lib)));
  }

  /** Re-draws only the `formatDuration` cells of the first table. */
  function drawWords(): void {
    minuteOrMonthRows(lib, locale.value).forEach((r, i) => {
      setHtml(part(`words-${i}`), resultCell(r.words));
    });
  }

  function apply(state: BenchState): void {
    text.value = state.text;
    if (![...locale.options].some((o) => o.value === state.locale)) {
      locale.append(new Option(state.locale, state.locale));
    }
    locale.value = state.locale;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === text) render();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== locale) return;
      render();
      drawWords();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "click",
    (e) => {
      const button =
        e.target instanceof Element ? e.target.closest("button") : null;
      if (button === null || !tryEl.contains(button)) return;
      text.value = button.value;
      render();
    },
    { signal },
  );

  if (initial) apply(initial);
  drawTables();
  render();
  return { readState };
}

export const mountDurationParserBench: MountFn<
  DurationParserBenchArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: DurationBenchLib;
  try {
    lib = await loadDurationBenchLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const seeded = args.text !== undefined || args.locale !== undefined;
  const bench = setupWidget(
    root,
    lib,
    signal,
    seeded ? readArgs(args) : undefined,
  );

  return onceDestroy(
    () => {},
    () => permalinkOf(bench.readState()),
  );
};
