/**
 * The Duration Parser Bench widget (CORE-85), mountable on its tool page and in
 * the chat rail.
 *
 * The reader types a duration the way people write it. Section 2 shows which
 * parser reads it, the ten duration fields, the compact form, the round trip and
 * the locale words. Section 3 holds two fixed tables: one for `1m` against `1mo`
 * and `P1M`, one for a laytime day against 24 hours across a clock change.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. The template
 * holds every element the widget ever shows, so a reader's first paint and the
 * mounted widget have the same structure; `mount` only fills them from real
 * calls. Typing re-draws section 2 alone. A locale change re-draws the
 * `formatDuration` cells alone. Every listener is delegated on the root, so the
 * host dropping the subtree is a complete teardown.
 */
import { codeFrameHtml } from "./code-frame";
import { CONVERTER_LOCALES } from "./curated-timezones";
import { renderCallResults, renderCalls } from "./edi-render";
import { inlineCodeHtml } from "./inline-code-html";
import { callSizer, holdHtml, outputSizer } from "./edi-picture";
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
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { DurationParserBenchArgs } from "./duration-parser-bench";

/** The sentinel a missing answer shows: the library gave `""` or `null`. */
export const CELL_NO_SIGNAL = "⟨ NO SIGNAL ⟩";
/** The whole-result sentinel for a string neither parser reads. */
export const RESULT_NO_SIGNAL = "⟨ NO SIGNAL — invalid input ⟩";
/** What a line reads when the call behind it was not made. */
export const NOT_CALLED_TEXT = "not called";
export const SAME_DURATION_TEXT = "returns the same duration";
export const DIFFERENT_DURATION_TEXT = "returns a different duration";

/** A cell's sentinel, which is amber and bracketed, never a blank. */
const signalLost = (): string =>
  `<span class="gmt-dbench-nosignal">${CELL_NO_SIGNAL}</span>`;

/** A result string as a cell: the string, or the sentinel for `""`. */
function resultHtml(value: string | null): string {
  return value === null || value === ""
    ? signalLost()
    : `<code class="gmt-dbench-result">${escapeHtml(value)}</code>`;
}

function localeOptionsHtml(selected: string): string {
  const locales: readonly string[] = (
    CONVERTER_LOCALES as readonly string[]
  ).includes(selected)
    ? CONVERTER_LOCALES
    : [...CONVERTER_LOCALES, selected];
  return locales
    .map(
      (l) =>
        `<option value="${escapeAttr(l)}"${l === selected ? " selected" : ""}>${escapeHtml(l)}</option>`,
    )
    .join("");
}

const CALL_SIZER = [
  'parseDuration("P1Y2M3W4DT5H6M7.008009010S")',
  'parseHumanDuration("P1Y2M3W4DT5H6M7.008009010S")',
  'formatHumanDuration("P1Y2M3W4DT5H6M7.008009010S")',
  'parseHumanDuration("1y 2mo 3w 4d 5h 6m 7s 8ms")',
  'formatDuration("P1Y2M3W4DT5H6M7.008009010S", "zh-Hant-TW")',
].join("\n");
const OUTPUT_SIZER = [
  '"P1Y2M3W4DT5H6M7.008009010S"',
  '""',
  '"1y 2mo 3w 4d 5h 6m 7s 8ms"',
  '"P1Y2M3W4DT5H6M7.008S"',
  '"1 year, 2 months, 3 weeks"',
].join("\n");

/** A column label, with a break point before "Human" so a narrow column breaks `parse|HumanDuration` between words. */
function headLabelHtml(label: string): string {
  return escapeHtml(label).replace(/(?<=[a-z])Human/g, "<wbr>Human");
}

function stripHtml(): string {
  return (
    `<ol class="gmt-dbench-strip" data-role="strip">` +
    DURATION_FIELDS.map(
      (f) =>
        `<li class="gmt-dbench-cell" data-field="${f.field}">` +
        `<span class="gmt-dbench-symbol">${escapeHtml(f.symbol ?? NO_SPELLING_TEXT)}</span>` +
        `<span class="gmt-dbench-value" data-role="cell-${f.field}">&ndash;</span>` +
        `<span class="gmt-dbench-field">${escapeHtml(f.field)}</span>` +
        `</li>`,
    ).join("") +
    `</ol>`
  );
}

function factsHtml(): string {
  const row = (label: string, role: string) =>
    `<div class="gmt-dbench-fact"><dt>${escapeHtml(label)}</dt><dd data-role="${role}">${NOT_CALLED_TEXT}</dd></div>`;
  return (
    `<dl class="gmt-dbench-facts">` +
    row("Compact form", "compact") +
    row("Round trip", "roundtrip") +
    row("In words", "words") +
    `</dl>`
  );
}

const MIN_COLS = [
  ["Written", "written"],
  ["parseHumanDuration", "human"],
  ["parseDuration", "iso"],
  ["Unit", "unit"],
  ["formatHumanDuration", "compact"],
  ["formatDuration", "words"],
] as const;

function tableAHtml(): string {
  return (
    `<div class="gmt-dbench-table-box">` +
    `<table class="gmt-dbench-table gmt-dbench-table--minute" data-role="table-minute">` +
    `<caption>Seven spellings of a minute, a month and a millisecond</caption>` +
    `<thead><tr>` +
    MIN_COLS.map(
      ([label, col]) =>
        `<th scope="col" class="gmt-dbench-col-${col}">${headLabelHtml(label)}</th>`,
    ).join("") +
    `</tr></thead>` +
    `<tbody data-role="rows-minute"></tbody>` +
    `</table></div>`
  );
}

function tableBHtml(): string {
  const heads = [
    ["Written", "written"],
    ["parseHumanDuration", "human"],
    ["formatHumanDuration", "compact"],
    [`Hours from ${LAYTIME_STARTS[0]!.label}`, "hours-a"],
    [`Hours from ${LAYTIME_STARTS[1]!.label}`, "hours-b"],
  ] as const;
  return (
    `<div class="gmt-dbench-table-box">` +
    `<table class="gmt-dbench-table gmt-dbench-table--laytime" data-role="table-laytime">` +
    `<caption>Rotterdam, <code>${escapeHtml(LAYTIME_ZONE)}</code></caption>` +
    `<thead><tr>` +
    heads
      .map(
        ([label, col]) =>
          `<th scope="col" class="gmt-dbench-col-${col}">${headLabelHtml(label)}</th>`,
      )
      .join("") +
    `</tr></thead>` +
    `<tbody data-role="rows-laytime"></tbody>` +
    `</table></div>` +
    `<p class="gmt-widget-hint gmt-dbench-laytime-note"><a href="${escapeAttr(BIMCO_URL)}" rel="noopener">${escapeHtml(LAYTIME_NOTE.link)}</a>${inlineCodeHtml(LAYTIME_NOTE.rest)}</p>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. It holds
 * every element the widget shows; `mount` fills them from real library calls.
 */
export function renderDurationParserBenchTemplate(
  args: DurationParserBenchArgs = {},
): string {
  const state = readArgs(args);
  return (
    `<div class="gmt-duration-bench gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. Your string
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Your string</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Duration string")}` +
    `<input class="gmt-input" data-role="text" type="text" maxlength="${BENCH_MAX_TEXT}" value="${escapeAttr(state.text)}" spellcheck="false" autocomplete="off" autocapitalize="off">` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Locale")}` +
    `<select class="gmt-select" data-role="locale">${localeOptionsHtml(state.locale)}</select>` +
    `</label>` +
    `</div>` +
    `<fieldset class="gmt-chip-group" data-role="try-group"><legend>Try</legend>` +
    TRY_STRINGS.map(
      (s) =>
        `<button class="gmt-button" type="button" data-role="try" data-try="${escapeAttr(s)}">${escapeHtml(s)}</button>`,
    ).join("") +
    `</fieldset>` +
    `</div>` +
    // 2. What it reads as
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What it reads as</h4>` +
    `<div class="gmt-dbench-parser">` +
    `<span class="gmt-dbench-badge" data-role="parser" data-parser="none">${NOT_CALLED_TEXT}</span>` +
    `<output class="gmt-widget-output gmt-dbench-iso" data-role="result">&nbsp;</output>` +
    `</div>` +
    `<p class="gmt-widget-hint gmt-dbench-refusal" data-role="refusal">&nbsp;</p>` +
    `<p class="gmt-widget-hint gmt-dbench-chain">A caller who takes either form writes <code class="gmt-dbench-chain-code">${escapeHtml(CHAIN_TEXT)}</code>.</p>` +
    stripHtml() +
    factsHtml() +
    holdHtml(
      codeFrameHtml("bench"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="bench-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    `</div>` +
    // 3. Minute or month, day or 24 hours
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. Minute or month, day or 24 hours</h4>` +
    tableAHtml() +
    tableBHtml() +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawSection2(root: HTMLElement, view: BenchView): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const badge = q("parser");
  if (badge) {
    badge.dataset["parser"] = view.parser;
    badge.textContent =
      view.parser === "none" ? "neither parser" : PARSER_LABEL[view.parser];
  }
  const result = q("result");
  if (result) {
    if (view.iso === "")
      renderWidgetOutput(result, RESULT_NO_SIGNAL, "sentinel");
    else renderWidgetOutput(result, view.iso, "live");
  }
  const refusal = q("refusal");
  if (refusal) refusal.textContent = view.refusal ?? " ";

  for (const cell of view.cells) {
    const el = q(`cell-${cell.field}`);
    const li = el?.parentElement;
    if (!el || !li) continue;
    el.textContent = cell.value === null ? "–" : String(cell.value);
    li.toggleAttribute("data-lit", cell.lit);
    li.title =
      cell.value === null
        ? `${cell.field}: no duration to read`
        : `getDurationUnit(${view.iso}, ${cell.field}) = ${cell.value}`;
  }

  const fill = (role: string, html: string) => {
    const el = q(role);
    if (el) el.innerHTML = html;
  };
  const notCalled = `<span class="gmt-dbench-dim">${NOT_CALLED_TEXT}</span>`;
  fill("compact", view.compact === null ? notCalled : resultHtml(view.compact));
  fill(
    "roundtrip",
    view.sameDuration === null
      ? notCalled
      : view.sameDuration
        ? `<span class="gmt-dbench-same">${SAME_DURATION_TEXT}</span>`
        : `<span class="gmt-dbench-nosignal">${DIFFERENT_DURATION_TEXT}</span>`,
  );
  fill("words", view.words === null ? notCalled : resultHtml(view.words));

  const calls = [
    view.calls.iso,
    view.calls.human,
    view.calls.compact,
    view.calls.roundtrip,
    view.calls.words,
  ].filter((c): c is NonNullable<typeof c> => c !== null);
  renderCalls(q("call-bench"), calls);
  const out = q("bench-output");
  if (out) {
    renderCallResults(out, calls, view.parser === "none", (v) =>
      JSON.stringify(v),
    );
  }
}

function minuteRowsHtml(lib: DurationBenchLib, locale: string): string {
  return minuteOrMonthRows(lib, locale)
    .map(
      (r, i) =>
        `<tr class="gmt-dbench-row" data-row="${i}">` +
        `<td data-label="Written"><code class="gmt-dbench-written">${escapeHtml(r.written)}</code><p class="gmt-dbench-rownote">${inlineCodeHtml(r.note)}</p></td>` +
        `<td data-label="parseHumanDuration">${resultHtml(r.human)}</td>` +
        `<td data-label="parseDuration">${resultHtml(r.iso)}</td>` +
        `<td data-label="Unit">${r.unitFound === null ? signalLost() : escapeHtml(r.unitFound)}</td>` +
        `<td data-label="formatHumanDuration">${resultHtml(r.compact)}</td>` +
        `<td data-label="formatDuration" data-role="words-cell">${resultHtml(r.words)}</td>` +
        `</tr>`,
    )
    .join("");
}

function laytimeRowsHtml(lib: DurationBenchLib): string {
  return laytimeRows(lib)
    .map(
      (r) =>
        `<tr class="gmt-dbench-row">` +
        `<td data-label="Written"><code class="gmt-dbench-written">${escapeHtml(r.written)}</code></td>` +
        `<td data-label="parseHumanDuration">${resultHtml(r.human)}</td>` +
        `<td data-label="formatHumanDuration">${resultHtml(r.compact)}</td>` +
        r.hours
          .map(
            (h, i) =>
              `<td data-label="Hours from ${escapeAttr(LAYTIME_STARTS[i]!.label)}" data-role="hours-cell">${
                h === null
                  ? signalLost()
                  : `<span class="gmt-dbench-hours">${h}</span>`
              }</td>`,
          )
          .join("") +
        `</tr>`,
    )
    .join("");
}

/** Re-draws only the `formatDuration` cells of table A. */
function drawWords(
  root: HTMLElement,
  lib: DurationBenchLib,
  locale: string,
): void {
  const rows = minuteOrMonthRows(lib, locale);
  root
    .querySelectorAll<HTMLElement>(
      '[data-role="rows-minute"] [data-role="words-cell"]',
    )
    .forEach((cell, i) => {
      cell.innerHTML = resultHtml(rows[i]?.words ?? "");
    });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Wire the widget and draw it once, with `initial` applied first when given. */
function setupWidget(
  root: HTMLElement,
  lib: DurationBenchLib,
  initial?: BenchState,
) {
  const text = root.querySelector<HTMLInputElement>('[data-role="text"]')!;
  const locale = root.querySelector<HTMLSelectElement>('[data-role="locale"]')!;

  const readState = (): BenchState => ({
    text: text.value,
    locale: locale.value,
  });

  function render(): void {
    // Never trimmed: a leading space is a case the reader should see refused.
    drawSection2(root, benchView(lib, text.value, locale.value));
  }

  function drawTables(): void {
    const a = root.querySelector('[data-role="rows-minute"]');
    if (a) a.innerHTML = minuteRowsHtml(lib, locale.value);
    const b = root.querySelector('[data-role="rows-laytime"]');
    if (b) b.innerHTML = laytimeRowsHtml(lib);
  }

  function apply(state: BenchState): void {
    text.value = state.text;
    if (![...locale.options].some((o) => o.value === state.locale)) {
      const opt = locale.ownerDocument.createElement("option");
      opt.value = state.locale;
      opt.textContent = state.locale;
      locale.append(opt);
    }
    locale.value = state.locale;
  }

  root.addEventListener("input", (e) => {
    if ((e.target as HTMLElement).dataset?.["role"] === "text") render();
  });
  root.addEventListener("change", (e) => {
    if ((e.target as HTMLElement).dataset?.["role"] !== "locale") return;
    render();
    drawWords(root, lib, locale.value);
  });
  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-role="try"]',
    );
    if (!btn) return;
    text.value = btn.dataset["try"] ?? "";
    render();
  });
  wireCopyButtons(root);

  if (initial) apply(initial);
  drawTables();
  render();
  return { readState };
}

export const mountDurationParserBench: MountFn<
  DurationParserBenchArgs
> = async (root, args, signal) => {
  let lib: DurationBenchLib;
  try {
    lib = await loadDurationBenchLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const seeded = args.text !== undefined || args.locale !== undefined;
  const widget = setupWidget(root, lib, seeded ? readArgs(args) : undefined);

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
