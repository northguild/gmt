/**
 * The Observance Comparator widget (CORE-54), mountable on its tool page and in
 * the chat rail.
 *
 * One to three month-day holidays, a span of years, a weekend and two to four
 * policy columns make one matrix: a row per year, a column per policy, and in
 * each cell the day the library observes each holiday. A row where two columns
 * disagree says so in words and by a pattern. Picking a cell shows that year's
 * weeks, one lane per column, the two result plates, and the printed
 * `observedDate` calls. Everything on screen is a library call
 * (`attributeRules`, `marksFromAttribution`); the widget computes no date.
 *
 * Built on the component kit: `renderObservanceComparatorTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids
 * and delegates every listener on the widget with the mount's `signal`. Typing in a field
 * redraws the matrix and the detail, never the field lists, so focus and IME composition
 * stay in the field; picking a cell redraws the matrix and puts focus back on its button.
 */
import { defineElements } from "~/widgets/define";
import {
  button,
  codeFrame,
  field,
  findWidget,
  html,
  idScope,
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  compareMatrix,
  type MatrixBlock,
  type MatrixColumn,
  type MatrixRow,
} from "~/widgets/families/holiday/compare-matrix";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import {
  holidayLegend,
  kindItems,
} from "~/widgets/families/holiday/holiday-legend";
import {
  policyEditor,
  policySelectId,
} from "~/widgets/families/holiday/policy-editor";
import {
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { weekStrip } from "~/widgets/families/holiday/week-strip";
import { yearStepper } from "~/widgets/families/holiday/year-stepper";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/observance-comparator.module.css";
import { formatPolicyText, parsePolicyText } from "./holiday-codec";
import { loadHolidayLib, type HolidayLib } from "./holiday-lib";
import {
  NO_SIGNAL_TEXT,
  YEAR_MAX,
  YEAR_MIN,
  normaliseWeekend,
  shortDate,
} from "./holiday-rule-builder";
import {
  policySummary,
  policyTextFromSelects,
  weekdayShort,
} from "./holiday-widgets";
import { onWidthChange } from "./label-fit";
import {
  COMPARATOR_LINKS,
  COMPARATOR_PRESETS,
  CUSTOM_OPTION,
  CUSTOM_PREFIX,
  FOLD_WIDTH,
  MAX_COLUMNS,
  MAX_HOLIDAYS,
  MAX_YEARS,
  MIN_COLUMNS,
  NO_YEARS_REASON,
  POLICY_PRESETS,
  builderHandoffHref,
  callLines,
  clusterDates,
  columnText,
  compare,
  isSeeded,
  laneDates,
  laneMarks,
  latestObserved,
  matchPreset,
  permalinkOf,
  presetColumnsNote,
  presetState,
  readArgs,
  selectedColumn,
  selectedYear,
  type ColumnModel,
  type ComparatorModel,
  type ComparatorState,
  type HolidayCell,
  type ObservanceComparatorArgs,
  type YearRow,
} from "./observance-comparator";
import { setToolLink } from "./widget-ui";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { ObservanceComparatorArgs } from "./observance-comparator";
export { FOLD_WIDTH, formatPolicyText };

const WIDGET_NAME = "observance-comparator";
const CUSTOM_PRESET = "custom";
const HINT_HANDOFF = "Fix the holiday dates and the policy first.";
const AGREE = "policies agree";
const DISAGREE = "policies disagree";
const NOTHING = "nothing to compare";

const SPAN_NOTES = [
  NO_YEARS_REASON,
  `${NO_SIGNAL_TEXT}: ${NO_YEARS_REASON}`,
  `More than ${MAX_YEARS} years: showing the first ${MAX_YEARS}.`,
  `${MAX_YEARS} years`,
];
const HOLIDAY_NOTE_SIZERS = [
  `${NO_SIGNAL_TEXT}: holidays 1, 2, 3 are not a date on the calendar (a month from 1 to 12 and a day that month has).`,
];
const COLUMN_NOTE_SIZERS = [
  COMPARATOR_PRESETS.map((p) => presetColumnsNote(presetState(p))).sort(
    (a, b) => b.length - a.length,
  )[0] ?? "",
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function labelOfId(id: string): string {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const policy = parsePolicyText(columnText(id));
    return policy === null
      ? "Custom, unreadable"
      : `Custom: ${policySummary(policy)}`;
  }
  return POLICY_PRESETS.find((p) => p.id === id)?.label ?? id;
}

const holidayId = (id: (l: string) => string, i: number, part: string) =>
  id(`h${i}-${part}`);
const columnId = (id: (l: string) => string, j: number, part: string) =>
  id(`c${j}-${part}`);

function holidaysHtml(
  state: ComparatorState,
  id: (local: string) => string,
): SafeHtml {
  return html`${state.holidays.map(
    (h, i) =>
      html`<li class="${styles.item}">
        <div class="${styles.head}">
          <span class="${styles.number}" aria-hidden="true">${String(i + 1)}</span>
          <div class="${styles.fields}">${field({
            id: holidayId(id, i, "month"),
            label: `Holiday ${i + 1} month`,
            control: ({ id: cid }) =>
              textInput({
                id: cid,
                value: h.month,
                inputMode: "numeric",
                autocomplete: "off",
                spellcheck: false,
              }),
          })}${field({
            id: holidayId(id, i, "day"),
            label: `Holiday ${i + 1} day`,
            control: ({ id: cid }) =>
              textInput({
                id: cid,
                value: h.day,
                inputMode: "numeric",
                autocomplete: "off",
                spellcheck: false,
              }),
          })}</div>${button({
            id: holidayId(id, i, "remove"),
            label: `Remove holiday ${i + 1}`,
          })}
        </div>
      </li>`,
  )}`;
}

function columnsHtml(
  state: ComparatorState,
  id: (local: string) => string,
  folded: boolean,
): SafeHtml {
  return html`${state.columns.map((colId, j) => {
    const custom = colId.startsWith(CUSTOM_PREFIX);
    const editor = custom
      ? html`<div class="${styles.policy}"
          ><span class="${styles.policyLabel}"
            >Observance when a holiday falls on a weekday (blank: none)</span
          >${policyEditor({
            id: columnId(id, j, "p"),
            policy: parsePolicyText(columnText(colId)) ?? {},
            label: `Column ${j + 1} observance`,
            folded,
          })}</div
        >`
      : "";
    return html`<li class="${styles.item}" data-series="${String((j % 4) + 1)}">
      <div class="${styles.head}">
        <span class="${styles.number}" aria-hidden="true">${String(j + 1)}</span>
        <div class="${styles.pick}">${field({
          id: columnId(id, j, "preset"),
          label: `Column ${j + 1} policy`,
          control: ({ id: cid }) =>
            select({
              id: cid,
              value: custom ? CUSTOM_OPTION : colId,
              options: [
                ...POLICY_PRESETS.map((p) => ({ value: p.id, label: p.label })),
                { value: CUSTOM_OPTION, label: "Custom policy" },
              ],
            }),
        })}</div>${button({
          id: columnId(id, j, "remove"),
          label: `Remove column ${j + 1}`,
        })}
      </div>${editor}
    </li>`;
  })}`;
}

function agreeWord(row: YearRow): string {
  return row.disagree ? DISAGREE : row.reference < 0 ? NOTHING : AGREE;
}

function blockOf(name: string, cell: HolidayCell): MatrixBlock {
  return {
    name,
    state: cell.state,
    line1: cell.line1,
    line2: cell.line2,
    note: cell.note,
  };
}

/** The matrix, drawn from the model, or as a header over hidden rows without one. */
function matrixOf(
  id: (local: string) => string,
  state: ComparatorState,
  model: ComparatorModel | null,
): SafeHtml {
  const columns: MatrixColumn[] =
    model?.columns.map((c) => ({
      label: c.label,
      reason: c.reason === "" ? "" : `${NO_SIGNAL_TEXT}: ${c.reason}.`,
    })) ??
    state.columns.map((colId) => ({ label: labelOfId(colId), reason: "" }));
  const rows: MatrixRow[] = (model?.rows ?? []).map((row) => ({
    year: row.year,
    disagree: row.disagree,
    word: agreeWord(row),
    cells: row.cells.map((cell) =>
      cell.map((c, i) => blockOf(model!.holidays[i]?.name ?? "", c)),
    ),
  }));
  const names = model
    ? model.holidays.map((h) => h.name).join(", ")
    : "the holidays";
  return compareMatrix({
    id: id("matrix"),
    caption: `Observed dates of ${names}, one row per year and one column per policy`,
    columns,
    rows,
    bodyRows: MAX_YEARS,
    holidays: model?.holidays.length ?? state.holidays.length,
    selectedYear: model ? selectedYear(model, state) : null,
    selectedColumn: model ? selectedColumn(model, state) : 0,
  });
}

function platesOf(
  model: ComparatorModel | null,
  row: YearRow | undefined,
): SafeHtml {
  const latest = row ? latestObserved(row) : null;
  const list: SignalPlate[] = [
    {
      caption: "Columns that disagree",
      value:
        row === undefined || model === null
          ? null
          : `${row.differing.length} of ${model.columns.length}`,
      line:
        row === undefined || row.reference < 0
          ? NOTHING
          : `differ from column ${row.reference + 1}`,
      series: 1,
      samples: [`${MAX_COLUMNS} of ${MAX_COLUMNS}`],
    },
    {
      caption: "Latest observed day",
      value:
        row === undefined || latest === null
          ? null
          : shortDate(latest.date, row.year),
      line: latest === null ? "no date" : `in column ${latest.column + 1}`,
      series: 2,
      samples: ["Wed 31 Dec 2099"],
    },
  ];
  return signalPlates(list);
}

function holdOf(
  label: string,
  text: string,
  state: HeldState,
  sizers: readonly string[],
): SafeHtml {
  return heldText({ label, text, state, sizers, gate: "hold" });
}

function presetOptions(): {
  value: string;
  label: string;
  description: string;
}[] {
  return [
    { value: CUSTOM_PRESET, label: "Custom", description: "" },
    ...COMPARATOR_PRESETS.map((p) => ({
      value: p.id,
      label: p.label,
      description: p.description,
    })),
  ];
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The matrix is drawn here as a header and
 * hidden rows; `mount` fills it from the library.
 */
export function renderObservanceComparatorTemplate(
  idPrefix: string,
  args: ObservanceComparatorArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(COMPARATOR_PRESETS[0]!);
  const presetId = matchPreset(state);
  const presetNote = presetColumnsNote(state);

  const inputs = section(
    { id: id("inputs"), heading: "1. Holidays, years and policies", level: 3 },
    html`<div class="${styles.stack}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId === "" ? CUSTOM_PRESET : presetId,
      options: presetOptions(),
    })}${holidayFrame(
      html`<h4 class="${styles.subhead}">Holidays</h4
        >${grow(html`<ol class="${styles.list}" id="${id("holidays")}" aria-label="Holidays">${holidaysHtml(state, id)}</ol>`)}<div class="${styles.addrow}">${button(
          {
            id: id("add-holiday"),
            label: "Add holiday",
          },
        )}<span class="${styles.count}" id="${id("holiday-count")}"
          >${String(state.holidays.length)} of ${String(MAX_HOLIDAYS)} holidays</span
        ></div
        ><div id="${id("holiday-note")}">${holdOf("Holiday note", "", "ok", HOLIDAY_NOTE_SIZERS)}</div>`,
      { gate: "frame" },
    )}<div class="${styles.addrow}">${yearStepper({
      id: id("from"),
      label: "First year",
      value: state.from,
      min: YEAR_MIN,
      max: YEAR_MAX,
      prevLabel: "Earlier first year",
      nextLabel: "Later first year",
    })}${yearStepper({
      id: id("to"),
      label: "Last year",
      value: state.to,
      min: YEAR_MIN,
      max: YEAR_MAX,
      prevLabel: "Earlier last year",
      nextLabel: "Later last year",
    })}</div>${chips({
      legend: "Weekend",
      kind: "checkbox",
      name: id("weekend-chip"),
      items: WEEKDAYS.map((d) => ({
        value: String(d),
        label: weekdayShort(d),
        checked: state.weekend.includes(d),
      })),
    })}<div id="${id("span-note")}">${holdOf("Span note", "", "ok", SPAN_NOTES)}</div>${holidayFrame(
      html`<h4 class="${styles.subhead}">Policy columns</h4
        >${grow(html`<ol class="${styles.list}" id="${id("columns")}" aria-label="Policy columns">${columnsHtml(state, id, false)}</ol>`)}<div class="${styles.addrow}">${button(
          {
            id: id("add-column"),
            label: "Add column",
          },
        )}<span class="${styles.count}" id="${id("column-count")}"
          >${String(state.columns.length)} of ${String(MAX_COLUMNS)} columns</span
        ></div
        ><div id="${id("column-note")}">${holdOf("Column note", presetNote, "note", COLUMN_NOTE_SIZERS)}</div>`,
      { gate: "frame" },
    )}</div>`,
  );

  const matrix = section(
    {
      id: id("matrix-section"),
      heading: "2. Where each holiday is observed",
      level: 3,
    },
    html`<div class="${styles.stack}">${grow(html`<div id="${id("matrix-box")}">${matrixOf(id, state, null)}</div>`)}<p class="${styles.hint}">Pick a cell to see that year's weeks. A row marked "${DISAGREE}" has at least two columns that put a holiday on different days.</p></div
    >`,
  );

  const year = section(
    { id: id("year-section"), heading: "3. The year", level: 3 },
    holidayFrame(
      html`<div class="${styles.plates}" aria-hidden="true" id="${id("plates")}">${platesOf(null, undefined)}</div
        ><p role="status" aria-label="Year summary" id="${id("year-sentence")}">${srOnly("")}</p
        >${grow(html`<div class="${styles.strip}" id="${id("strip")}"></div>`)}${holidayLegend(
          { label: "Marks", items: kindItems() },
        )}`,
      { gate: "frame" },
    ),
  );

  const call = section(
    { id: id("call-section"), heading: "4. The call", level: 3 },
    html`<div class="${styles.stack}">${grow(
      html`<div class="${styles.slot}" id="${id("call")}">${codeFrame({
        label: "observedDate calls",
        copyLabel: "Copy calls",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("links")}">${toolLinks({
        label: "Open this column in another tool",
        links: COMPARATOR_LINKS.map((l) => ({ text: l.text })),
      })}</div>`,
    )}<div id="${id("handoff")}">${holdOf("Hand-off hint", "", "ok", [HINT_HANDOFF])}</div></div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Observance Comparator", scope: idPrefix },
    html`${inputs}${matrix}${year}${call}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ComparatorState;
  apply(state: ComparatorState): void;
  release(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: HolidayLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const holidaysEl = el("holidays");
  const columnsEl = el("columns");
  const fromEl = el<HTMLInputElement>("from");
  const toEl = el<HTMLInputElement>("to");
  const addHoliday = el<HTMLButtonElement>("add-holiday");
  const addColumn = el<HTMLButtonElement>("add-column");
  const weekendEl = widgetEl.querySelector<GmtChips>(
    `gmt-chips:has([name="${CSS.escape(id("weekend-chip"))}"])`,
  )!;

  let state: ComparatorState = presetState(COMPARATOR_PRESETS[0]!);
  let model: ComparatorModel | null = null;
  let folded = false;

  const narrow = (): boolean => {
    const width = columnsEl.clientWidth;
    return width > 0 && width < FOLD_WIDTH;
  };

  function applyFold(): void {
    folded = narrow();
    for (const d of columnsEl.querySelectorAll("details")) d.open = !folded;
  }

  function syncControls(): void {
    fromEl.value = state.from;
    toEl.value = state.to;
    weekendEl.value = state.weekend.map(String);
  }

  function renderHolidays(): void {
    setHtml(holidaysEl, holidaysHtml(state, id));
    addHoliday.disabled = state.holidays.length >= MAX_HOLIDAYS;
    for (const b of holidaysEl.querySelectorAll("button")) {
      b.disabled = state.holidays.length <= 1;
    }
    el("holiday-count").textContent =
      `${state.holidays.length} of ${MAX_HOLIDAYS} holidays`;
  }

  function renderColumns(): void {
    folded = narrow();
    setHtml(columnsEl, columnsHtml(state, id, folded));
    addColumn.disabled = state.columns.length >= MAX_COLUMNS;
    for (const b of columnsEl.querySelectorAll("button")) {
      b.disabled = state.columns.length <= MIN_COLUMNS;
    }
    el("column-count").textContent =
      `${state.columns.length} of ${MAX_COLUMNS} columns`;
    const note = presetColumnsNote(state);
    setHtml(
      el("column-note"),
      holdOf("Column note", note, "note", COLUMN_NOTE_SIZERS),
    );
  }

  function focusId(local: string): void {
    const target = widgetEl.querySelector<HTMLElement>(
      `[id="${CSS.escape(id(local))}"]`,
    );
    if (target && !(target as HTMLButtonElement).disabled) target.focus();
  }

  function recompute(): void {
    presetEl.value =
      matchPreset(state) === "" ? CUSTOM_PRESET : matchPreset(state);
    model = compare(lib, state);
    if (model.years === null) {
      setHtml(
        el("span-note"),
        holdOf(
          "Span note",
          `${NO_SIGNAL_TEXT}: ${NO_YEARS_REASON}`,
          "sentinel",
          SPAN_NOTES,
        ),
      );
    } else {
      setHtml(
        el("span-note"),
        holdOf(
          "Span note",
          model.clamped
            ? `More than ${MAX_YEARS} years: showing the first ${MAX_YEARS}.`
            : `${model.years.length} ${model.years.length === 1 ? "year" : "years"}`,
          model.clamped ? "note" : "ok",
          SPAN_NOTES,
        ),
      );
    }
    const bad = model.holidays.flatMap((h, i) => (h.valid ? [] : [i + 1]));
    setHtml(
      el("holiday-note"),
      bad.length === 0
        ? holdOf("Holiday note", "", "ok", HOLIDAY_NOTE_SIZERS)
        : holdOf(
            "Holiday note",
            `${NO_SIGNAL_TEXT}: ${bad.length === 1 ? `holiday ${bad[0]} is` : `holidays ${bad.join(", ")} are`} not a date on the calendar (a month from 1 to 12 and a day that month has).`,
            "sentinel",
            HOLIDAY_NOTE_SIZERS,
          ),
    );
    drawMatrix();
    drawDetail();
  }

  function drawMatrix(): void {
    setHtml(el("matrix-box"), matrixOf(id, state, model));
  }

  function selection(): { year: number | null; column: number; row?: YearRow } {
    if (model === null) return { year: null, column: 0 };
    const year = selectedYear(model, state);
    return {
      year,
      column: selectedColumn(model, state),
      row: model.rows.find((r) => r.year === year),
    };
  }

  function laneOf(
    column: ColumnModel,
    j: number,
    row: YearRow,
    cluster: { from: string; to: string },
  ): SafeHtml {
    const attribution = row.attributions[j] ?? null;
    const name = html`<p class="${styles.laneName}">${String(j + 1)}. ${column.label}</p>`;
    if (attribution === null) {
      return html`<div class="${styles.lane}">${name}<p class="${styles.laneNone}">${NO_SIGNAL_TEXT}</p></div>`;
    }
    return html`<div class="${styles.lane}">${name}${weekStrip({
      from: cluster.from,
      to: cluster.to,
      marks: laneMarks(lib, attribution, row.year),
      weekend: state.weekend,
    })}</div>`;
  }

  function drawDetail(): void {
    const { year, column, row } = selection();
    setHtml(el("plates"), platesOf(model, row));

    if (model === null || row === undefined) {
      setHtml(el("strip"), html``);
    } else {
      const m = model;
      const clusters = clusterDates(row.attributions.flatMap(laneDates));
      setHtml(
        el("strip"),
        html`${clusters.map(
          (c) =>
            html`<div class="${styles.cluster}"
              ><h4 class="${styles.clusterName}">${`${shortDate(c.from, row.year)} to ${shortDate(c.to, row.year)}`}</h4
              ><div class="${styles.lanes}">${m.columns.map((col, j) => laneOf(col, j, row, c))}</div></div
            >`,
        )}`,
      );
    }

    setHtml(
      el("year-sentence"),
      srOnly(
        row === undefined || model === null
          ? "No year to show."
          : `${row.year}: ${agreeWord(row)}. Showing ${model.columns[column]?.label ?? ""}.`,
      ),
    );

    const text =
      model === null || row === undefined
        ? ""
        : [
            `// ${model.columns[column]?.label ?? ""}, ${row.year}`,
            ...callLines(model, row, column),
          ].join("\n");
    setHtml(
      el("call"),
      codeFrame({
        label: "observedDate calls",
        copyLabel: "Copy calls",
        copyText: text,
        code: html`${text}`,
        gate: "codeframe",
      }),
    );

    const href = builderHandoffHref(state, model?.columns[column], year);
    setToolLink(el("links").querySelector("a"), href);
    setHtml(
      el("handoff"),
      holdOf("Hand-off hint", href === null ? HINT_HANDOFF : "", "ok", [
        HINT_HANDOFF,
      ]),
    );
  }

  // --- state changes -------------------------------------------------------

  /** Reads `h<i>-<part>` or `c<j>-<part>` off a control's id. */
  const located = (
    target: EventTarget | null,
  ): { kind: "h" | "c"; index: number; key: string } | null => {
    if (!(target instanceof HTMLElement)) return null;
    const prefix = id("");
    if (!target.id.startsWith(prefix)) return null;
    const m = /^(h|c)(\d+)-(.+)$/u.exec(target.id.slice(prefix.length));
    return m
      ? { kind: m[1] as "h" | "c", index: Number(m[2]), key: m[3]! }
      : null;
  };

  function setColumnPolicy(j: number): void {
    const values: Record<number, string> = {};
    for (const d of WEEKDAYS) {
      values[d] = el<HTMLSelectElement>(policySelectId(`c${j}-p`, d)).value;
    }
    const text = policyTextFromSelects(values);
    state.columns[j] = `${CUSTOM_PREFIX}${text}`;
    const summary = el(`c${j}-p`).querySelector("summary");
    if (summary)
      summary.textContent = policySummary(parsePolicyText(text) ?? {});
    recompute();
  }

  function onField(e: Event): void {
    const target = e.target;
    if (target === presetEl) {
      if (e.type !== "change") return;
      const chosen = COMPARATOR_PRESETS.find((p) => p.id === presetEl.value);
      if (chosen) apply(presetState(chosen));
      return;
    }
    if (target === fromEl || target === toEl) {
      state[target === fromEl ? "from" : "to"] = (
        target as HTMLInputElement
      ).value;
      recompute();
      return;
    }
    if (target === weekendEl) {
      state.weekend = normaliseWeekend(
        (weekendEl.value as string[]).map(Number),
      );
      recompute();
      return;
    }
    const found = located(target);
    if (found === null) return;
    if (found.kind === "h" && (found.key === "month" || found.key === "day")) {
      const h = state.holidays[found.index];
      if (!h) return;
      h[found.key] = (target as HTMLInputElement).value;
      recompute();
    } else if (found.kind === "c" && /^p-\d$/u.test(found.key)) {
      setColumnPolicy(found.index);
    } else if (found.kind === "c" && found.key === "preset") {
      if (e.type !== "change") return;
      const value = (target as HTMLSelectElement).value;
      state.columns[found.index] =
        value === CUSTOM_OPTION ? CUSTOM_PREFIX : value;
      state.presetColumns = state.presetColumns.filter(
        (i) => i !== found.index,
      );
      state.column = -1;
      renderColumns();
      focusId(`c${found.index}-preset`);
      recompute();
    }
  }

  widgetEl.addEventListener("input", onField, { signal });
  widgetEl.addEventListener("change", onField, { signal });
  widgetEl.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      const picked =
        target instanceof HTMLElement
          ? target.closest<HTMLButtonElement>("button")
          : null;
      if (picked === null || picked.disabled) return;
      for (const [input, key] of [
        [fromEl, "from"],
        [toEl, "to"],
      ] as const) {
        const step =
          picked.id === `${input.id}-prev`
            ? -1
            : picked.id === `${input.id}-next`
              ? 1
              : 0;
        if (step === 0) continue;
        const now = Number(state[key]);
        const next = Math.min(
          YEAR_MAX,
          Math.max(YEAR_MIN, (Number.isInteger(now) ? now : YEAR_MIN) + step),
        );
        state[key] = String(next);
        input.value = state[key];
        recompute();
        return;
      }
      if (picked.id.startsWith(id("matrix-"))) {
        const tail = picked.id.slice(id("matrix-").length);
        const m = /^(col|year|cell)-(.+)$/u.exec(tail);
        if (m === null) return;
        if (m[1] === "col") state.column = Number(picked.dataset["col"]);
        else if (m[1] === "year") state.year = picked.dataset["year"]!;
        else {
          state.year = picked.dataset["year"]!;
          state.column = Number(picked.dataset["col"]);
        }
        drawMatrix();
        drawDetail();
        widgetEl
          .querySelector<HTMLElement>(`[id="${CSS.escape(picked.id)}"]`)
          ?.focus();
        return;
      }
      if (picked === addHoliday) {
        if (state.holidays.length >= MAX_HOLIDAYS) return;
        state.holidays.push({ month: "", day: "" });
        renderHolidays();
        focusId(`h${state.holidays.length - 1}-month`);
        recompute();
        return;
      }
      if (picked === addColumn) {
        if (state.columns.length >= MAX_COLUMNS) return;
        const unused = POLICY_PRESETS.find(
          (p) => !state.columns.includes(p.id),
        );
        state.columns.push(unused ? unused.id : POLICY_PRESETS[0]!.id);
        renderColumns();
        focusId(`c${state.columns.length - 1}-preset`);
        recompute();
        return;
      }
      const found = located(picked);
      if (found === null || found.key !== "remove") return;
      if (found.kind === "h") {
        if (state.holidays.length <= 1) return;
        state.holidays.splice(found.index, 1);
        renderHolidays();
        // The next row's remove button, else the previous one's, else the add button.
        const at = [found.index, found.index - 1].find((i) => {
          const b = widgetEl.querySelector<HTMLButtonElement>(
            `[id="${CSS.escape(holidayId(id, i, "remove"))}"]`,
          );
          return b !== null && !b.disabled;
        });
        if (at === undefined) addHoliday.focus();
        else focusId(`h${at}-remove`);
        recompute();
      } else {
        if (state.columns.length <= MIN_COLUMNS) return;
        state.columns.splice(found.index, 1);
        state.presetColumns = state.presetColumns
          .filter((i) => i !== found.index)
          .map((i) => (i > found.index ? i - 1 : i));
        state.column = -1;
        renderColumns();
        focusId(`c${Math.min(found.index, state.columns.length - 1)}-preset`);
        recompute();
      }
    },
    { signal },
  );

  const disposeWidth = onWidthChange(columnsEl, () => {
    if (narrow() !== folded) applyFold();
  });

  function apply(next: ComparatorState): void {
    state = next;
    syncControls();
    renderHolidays();
    renderColumns();
    recompute();
  }

  apply(presetState(COMPARATOR_PRESETS[0]!));

  return {
    readState: () => state,
    apply,
    release: disposeWidth,
  };
}

export const mountObservanceComparator: MountFn<
  ObservanceComparatorArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: HolidayLib;
  try {
    lib = await loadHolidayLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (isSeeded(args)) widget.apply(readArgs(args));

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
