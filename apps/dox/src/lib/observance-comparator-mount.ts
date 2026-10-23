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
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root. Typing in a field redraws the matrix only,
 * so focus and IME composition stay in the field; picking a cell moves the
 * selection in place and redraws the detail only.
 */
import { codeFrameHtml } from "./code-frame";
import { callSizer, holdHtml, textSizers } from "./edi-picture";
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
  legendHtml,
  policyEditorHtml,
  policySummary,
  policyTextFromSelects,
  weekdayShort,
  weekRowsHtml,
} from "./holiday-widgets";
import { onWidthChange } from "./label-fit";
import {
  descriptionHoldHtml,
  plateHtml,
  type PlateSpec,
} from "./ledger-widgets";
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
import { setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  setToolLink,
  toolLinksHtml,
  wireCopyButtons,
} from "./widget-ui";

export type { ObservanceComparatorArgs } from "./observance-comparator";
export { FOLD_WIDTH };

const CUSTOM_PRESET = "custom";
const HINT_HANDOFF = "Fix the holiday dates and the policy first.";
const AGREE = "policies agree";
const DISAGREE = "policies disagree";
const NOTHING = "nothing to compare";

// Three holidays that each walk: two lines apiece, the longest the calls print.
const CALL_SIZER =
  '// calendar: "UTC", weekend [6, 7], every holiday that does not walk\n' +
  'observedDate("2021-12-26", { 6: "nextWorkingDay", 7: "nextWorkingDay" }, calendar); // "2021-12-28"\n' +
  '// calendar: "UTC", weekend [6, 7], every holiday that does not walk, and the walks of holidays 1 to 1\n' +
  'observedDate("2021-12-26", { 6: "nextWorkingDay", 7: "nextWorkingDay" }, calendar); // "2021-12-28"\n' +
  '// calendar: "UTC", weekend [6, 7], every holiday that does not walk, and the walks of holidays 1 to 2\n' +
  'observedDate("2021-12-26", { 6: "nextWorkingDay", 7: "nextWorkingDay" }, calendar); // "2021-12-28"';

const SPAN_NOTES = [
  NO_YEARS_REASON,
  `More than ${MAX_YEARS} years: showing the first ${MAX_YEARS}.`,
  `${MAX_YEARS} years`,
];

let counter = 0;

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

const numberField = (
  field: string,
  label: string,
  value: string,
  extra = "",
): string =>
  `<label class="gmt-label">${labelTextHtml(label)}` +
  `<input class="gmt-input" data-field="${field}" type="number" step="1" inputmode="numeric" ${extra} value="${escapeAttr(value)}"></label>`;

function holidaysHtml(state: ComparatorState): string {
  const button = (action: string, glyph: string, name: string, off = false) =>
    `<button type="button" class="gmt-button gmt-obs-btn" data-action="${action}" aria-label="${escapeAttr(name)}"${off ? " disabled" : ""}>${glyph}</button>`;
  return state.holidays
    .map(
      (h, i) =>
        `<li class="gmt-holiday-card gmt-obs-holiday" data-holiday="${i}">` +
        `<span class="gmt-obs-num" aria-hidden="true">${i + 1}</span>` +
        `<div class="gmt-obs-holiday-fields">` +
        numberField(
          "month",
          `Holiday ${i + 1} month`,
          h.month,
          'min="1" max="12"',
        ) +
        numberField("day", `Holiday ${i + 1} day`, h.day, 'min="1" max="31"') +
        `</div>` +
        button(
          "remove-holiday",
          "×",
          `Remove holiday ${i + 1}`,
          state.holidays.length <= 1,
        ) +
        `</li>`,
    )
    .join("");
}

function columnsHtml(
  state: ComparatorState,
  uid: string,
  folded: boolean,
): string {
  return state.columns
    .map((id, j) => {
      const custom = id.startsWith(CUSTOM_PREFIX);
      const options =
        POLICY_PRESETS.map(
          (p) =>
            `<option value="${escapeAttr(p.id)}"${p.id === id ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
        ).join("") +
        `<option value="${CUSTOM_OPTION}"${custom ? " selected" : ""}>Custom policy</option>`;
      const editor = custom
        ? `<div class="gmt-obs-editor"><span class="gmt-label-text">Observance when a holiday falls on a weekday (blank: none)</span>` +
          policyEditorHtml({
            idPrefix: `${uid}-c${j}`,
            policy: parsePolicyText(columnText(id)) ?? {},
            folded,
          }) +
          `</div>`
        : "";
      return (
        `<li class="gmt-holiday-card gmt-obs-column" data-column="${j}" data-series="${(j % 4) + 1}">` +
        `<div class="gmt-obs-column-head">` +
        `<span class="gmt-obs-num" aria-hidden="true">${j + 1}</span>` +
        `<label class="gmt-label gmt-obs-column-pick">${labelTextHtml(`Column ${j + 1} policy`)}` +
        `<select class="gmt-select" data-field="col-preset">${options}</select></label>` +
        `<button type="button" class="gmt-button gmt-obs-btn" data-action="remove-column" aria-label="${escapeAttr(`Remove column ${j + 1}`)}"${state.columns.length <= MIN_COLUMNS ? " disabled" : ""}>×</button>` +
        `</div>` +
        editor +
        `</li>`
      );
    })
    .join("");
}

/** One holiday inside a cell: two lines, the second always there. */
function blockHtml(name: string, cell: HolidayCell, index: number): string {
  const hidden = (text: string) =>
    `<span class="gmt-holiday-visually-hidden">${escapeHtml(text)}</span>`;
  if (cell.state === "sentinel") {
    return (
      `<span class="gmt-obs-hol gmt-obs-nosignal" data-holiday="${index}" data-state="sentinel">` +
      hidden(`${name}: `) +
      `<span class="gmt-obs-l1">⟨ NO SIGNAL —</span> ` +
      `<span class="gmt-obs-l2">invalid input ⟩</span></span>`
    );
  }
  return (
    `<span class="gmt-obs-hol" data-holiday="${index}" data-state="${cell.state}"` +
    (cell.note === "" ? "" : ` title="${escapeAttr(cell.note)}"`) +
    `>` +
    hidden(`${name}: `) +
    `<span class="gmt-obs-l1">${escapeHtml(cell.line1)}</span> ` +
    `<span class="gmt-obs-l2">${cell.line2 === "" ? "&nbsp;" : escapeHtml(cell.line2)}</span>` +
    (cell.note === "" ? "" : hidden(cell.note)) +
    `</span>`
  );
}

const blankBlock = (index: number): string =>
  `<span class="gmt-obs-hol" data-holiday="${index}" data-state="blank"><span class="gmt-obs-l1">&nbsp;</span> <span class="gmt-obs-l2">&nbsp;</span></span>`;

function headCell(
  column: { label: string; reason: string },
  j: number,
  selected: boolean,
): string {
  return (
    `<th scope="col" data-col="${j}">` +
    `<button type="button" class="gmt-obs-colbtn" data-action="pick-col" data-col="${j}" aria-pressed="${selected}">${escapeHtml(column.label)}</button>` +
    (column.reason === ""
      ? ""
      : `<span class="gmt-obs-reason gmt-obs-nosignal">${escapeHtml(`${NO_SIGNAL_TEXT}: ${column.reason}.`)}</span>`) +
    `</th>`
  );
}

function agreeWord(row: YearRow): string {
  return row.disagree ? DISAGREE : row.reference < 0 ? NOTHING : AGREE;
}

function realRowHtml(
  model: ComparatorModel,
  row: YearRow,
  selected: { year: number | null; column: number },
): string {
  const on = row.year === selected.year;
  const cells = model.columns.map((column, j) => {
    const pressed = on && j === selected.column;
    return (
      `<td data-label="${escapeAttr(column.label)}">` +
      `<button type="button" class="gmt-obs-cell" data-action="pick-cell" data-year="${row.year}" data-col="${j}" aria-pressed="${pressed}">` +
      model.holidays
        .map((h, i) => blockHtml(h.name, row.cells[j]![i]!, i))
        .join("") +
      `</button></td>`
    );
  });
  return (
    `<tr data-year="${row.year}"${row.disagree ? ' data-disagree="true"' : ""}${on ? " data-selected" : ""}>` +
    `<th scope="row" class="gmt-obs-year">` +
    `<button type="button" class="gmt-obs-yearbtn" data-action="pick-year" data-year="${row.year}" aria-pressed="${on}">${row.year}</button>` +
    `<span class="gmt-obs-agree">${agreeWord(row)}</span></th>` +
    cells.join("") +
    `</tr>`
  );
}

function placeholderRowHtml(
  labels: readonly string[],
  holidays: number,
): string {
  const blocks = Array.from({ length: holidays }, (_, i) => blankBlock(i)).join(
    "",
  );
  return (
    `<tr data-placeholder aria-hidden="true" inert>` +
    `<th scope="row" class="gmt-obs-year"><span class="gmt-obs-yearbtn">&nbsp;</span><span class="gmt-obs-agree">&nbsp;</span></th>` +
    labels
      .map(
        (label) =>
          `<td data-label="${escapeAttr(label)}"><span class="gmt-obs-cell">${blocks}</span></td>`,
      )
      .join("") +
    `</tr>`
  );
}

/**
 * The matrix: a native table, always `MAX_YEARS` body rows. A span shorter than
 * that is padded with hidden rows of the same structure, so stepping `to` never
 * changes the table's height or moves what sits under it.
 */
export function matrixHtml(
  state: ComparatorState,
  model: ComparatorModel | null,
): string {
  const columns: { label: string; reason: string }[] =
    model?.columns ??
    state.columns.map((id) => ({ label: labelOfId(id), reason: "" }));
  const holidays = model?.holidays.length ?? state.holidays.length;
  const labels = columns.map((c) => c.label);
  const selYear = model ? selectedYear(model, state) : null;
  const selCol = model ? selectedColumn(model, state) : 0;
  const real = (model?.rows ?? []).map((row) =>
    realRowHtml(model!, row, { year: selYear, column: selCol }),
  );
  const pad = Array.from({ length: Math.max(0, MAX_YEARS - real.length) }, () =>
    placeholderRowHtml(labels, holidays),
  );
  const names = model
    ? model.holidays.map((h) => h.name).join(", ")
    : "the holidays";
  return (
    `<table class="gmt-obs-table" data-role="matrix">` +
    `<caption>Observed dates of ${escapeHtml(names)}, one row per year and one column per policy</caption>` +
    `<thead><tr><th scope="col" class="gmt-obs-corner">Year</th>` +
    columns
      .map((c, j) => headCell(c, j, model !== null && j === selCol))
      .join("") +
    `</tr></thead>` +
    `<tbody>${real.join("")}${pad.join("")}</tbody></table>`
  );
}

function plates(
  model: ComparatorModel | null,
  row: YearRow | undefined,
): PlateSpec[] {
  const latest = row ? latestObserved(row) : null;
  return [
    {
      role: "hero-disagree",
      caption: "Columns that disagree",
      value:
        row === undefined || model === null
          ? null
          : `${row.differing.length} of ${model.columns.length}`,
      lines: [
        row === undefined || row.reference < 0
          ? "nothing to compare"
          : `differ from column ${row.reference + 1}`,
      ],
      series: 1,
    },
    {
      role: "hero-latest",
      caption: "Latest observed day",
      value:
        row === undefined || latest === null
          ? null
          : shortDate(latest.date, row.year),
      lines: [latest === null ? "no date" : `in column ${latest.column + 1}`],
      series: 2,
    },
  ];
}

function presetOptionsHtml(id: string): string {
  return (
    `<option value="${CUSTOM_PRESET}"${id === "" ? " selected" : ""}>Custom</option>` +
    COMPARATOR_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === id ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The matrix is drawn here as a header and
 * hidden rows; `mount` fills it from the library.
 */
export function renderObservanceComparatorTemplate(
  args: ObservanceComparatorArgs = {},
): string {
  const uid = `gmt-obs-${++counter}`;
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(COMPARATOR_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = COMPARATOR_PRESETS.find((p) => p.id === presetId);
  const weekendBoxes = [1, 2, 3, 4, 5, 6, 7]
    .map((d) =>
      chipToggleHtml({
        type: "checkbox",
        role: "weekend",
        value: String(d),
        label: weekdayShort(d),
        checked: state.weekend.includes(d),
      }),
    )
    .join("");

  return (
    `<div class="gmt-observance-comparator gmt-widget not-content" data-uid="${uid}">` +
    `<div class="gmt-widget-card">` +
    // 1. Inputs
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Holidays, years and policies</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      COMPARATOR_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-holiday-frame">` +
    `<h5 class="gmt-obs-subhead">Holidays</h5>` +
    `<ol class="gmt-obs-list" data-role="holidays" data-grow="slot">${holidaysHtml(state)}</ol>` +
    `<div class="gmt-obs-addrow"><button type="button" class="gmt-button gmt-button--pad" data-action="add-holiday"${state.holidays.length >= MAX_HOLIDAYS ? " disabled" : ""}>Add holiday</button>` +
    `<span class="gmt-widget-hint" data-role="holiday-count">${state.holidays.length} of ${MAX_HOLIDAYS} holidays</span></div>` +
    `<p class="gmt-widget-hint" data-role="holiday-note" data-state="sentinel" hidden></p>` +
    `</div>` +
    `<div class="gmt-field-grid gmt-obs-years">` +
    numberField(
      "from",
      "First year",
      state.from,
      `min="${YEAR_MIN}" max="${YEAR_MAX}"`,
    ).replace('class="gmt-input"', 'class="gmt-input" data-role="from"') +
    numberField(
      "to",
      "Last year",
      state.to,
      `min="${YEAR_MIN}" max="${YEAR_MAX}"`,
    ).replace('class="gmt-input"', 'class="gmt-input" data-role="to"') +
    `<fieldset class="gmt-chip-group gmt-field-wide"><legend>Weekend</legend>${weekendBoxes}</fieldset>` +
    `</div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="span-note"></p>`,
      textSizers("p", "gmt-widget-hint", SPAN_NOTES),
      "gmt-ledger-hold",
    ) +
    `<div class="gmt-holiday-frame" data-role="columns-frame">` +
    `<h5 class="gmt-obs-subhead">Policy columns</h5>` +
    `<ol class="gmt-obs-list" data-role="columns">${columnsHtml(state, uid, false)}</ol>` +
    `<div class="gmt-obs-addrow"><button type="button" class="gmt-button gmt-button--pad" data-action="add-column"${state.columns.length >= MAX_COLUMNS ? " disabled" : ""}>Add column</button>` +
    `<span class="gmt-widget-hint" data-role="column-count">${state.columns.length} of ${MAX_COLUMNS} columns</span></div>` +
    `</div>` +
    `</div>` +
    // 2. The matrix
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Where each holiday is observed</h4>` +
    `<div class="gmt-obs-table-box" data-role="matrix-box">${matrixHtml(state, null)}</div>` +
    `<p class="gmt-widget-hint">Pick a cell to see that year's weeks. A row marked "${DISAGREE}" has at least two columns that put a holiday on different days.</p>` +
    `</div>` +
    // 3. The year
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The year</h4>` +
    `<div class="gmt-holiday-frame">` +
    `<div class="gmt-punct-heroes gmt-obs-heroes" data-role="heroes" aria-hidden="true">${plates(null, undefined).map(plateHtml).join("")}</div>` +
    `<p class="gmt-ledger-sr" data-role="year-sentence" aria-live="polite"></p>` +
    `<div class="gmt-obs-strip" data-role="strip"></div>` +
    legendHtml() +
    `</div>` +
    `</div>` +
    // 4. The call
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>4. The call</h4>` +
    holdHtml(
      codeFrameHtml("observed"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(COMPARATOR_LINKS) +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="handoff-hint"></p>`,
      textSizers("p", "gmt-widget-hint", [HINT_HANDOFF]),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    `</div>` +
    `</div>`
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

function setupWidget(root: HTMLElement, lib: HolidayLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const uid = root.dataset["uid"] ?? `gmt-obs-${++counter}`;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const holidaysEl = q<HTMLElement>("holidays")!;
  const columnsEl = q<HTMLElement>("columns")!;
  const fromEl = q<HTMLInputElement>("from")!;
  const toEl = q<HTMLInputElement>("to")!;
  const matrixBox = q<HTMLElement>("matrix-box")!;
  const weekendEls = [
    ...root.querySelectorAll<HTMLInputElement>('[data-role="weekend"]'),
  ];

  let state: ComparatorState = presetState(COMPARATOR_PRESETS[0]!);
  let model: ComparatorModel | null = null;
  let folded = false;

  const narrow = (): boolean => {
    const width = columnsEl.clientWidth;
    return width > 0 && width < FOLD_WIDTH;
  };

  function applyFold(): void {
    folded = narrow();
    for (const d of columnsEl.querySelectorAll<HTMLDetailsElement>(
      ".gmt-holiday-policy",
    )) {
      d.open = !folded;
    }
  }

  function syncControls(): void {
    fromEl.value = state.from;
    toEl.value = state.to;
    for (const el of weekendEls) {
      el.checked = state.weekend.includes(Number(el.value));
    }
  }

  function syncPreset(): void {
    const id = matchPreset(state);
    presetEl.value = id === "" ? CUSTOM_PRESET : id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        COMPARATOR_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function renderHolidays(focusLast = false): void {
    holidaysEl.innerHTML = holidaysHtml(state);
    root.querySelector<HTMLButtonElement>(
      '[data-action="add-holiday"]',
    )!.disabled = state.holidays.length >= MAX_HOLIDAYS;
    q("holiday-count")!.textContent =
      `${state.holidays.length} of ${MAX_HOLIDAYS} holidays`;
    if (focusLast) {
      holidaysEl
        .querySelector<HTMLElement>(
          `[data-holiday="${state.holidays.length - 1}"] input`,
        )
        ?.focus();
    }
  }

  /** Next row's remove button, else the previous one's, else the add button. */
  function refocusAfterRemoveHoliday(removed: number): void {
    for (const at of [removed, removed - 1]) {
      const btn = holidaysEl.querySelector<HTMLButtonElement>(
        `[data-holiday="${at}"] [data-action="remove-holiday"]`,
      );
      if (btn && !btn.disabled) {
        btn.focus();
        return;
      }
    }
    root
      .querySelector<HTMLButtonElement>('[data-action="add-holiday"]')
      ?.focus();
  }

  function renderColumns(focus?: { column: number; sel: string }): void {
    folded = narrow();
    columnsEl.innerHTML = columnsHtml(state, uid, folded);
    root.querySelector<HTMLButtonElement>(
      '[data-action="add-column"]',
    )!.disabled = state.columns.length >= MAX_COLUMNS;
    q("column-count")!.textContent =
      `${state.columns.length} of ${MAX_COLUMNS} columns`;
    if (focus) {
      const li = columnsEl.querySelector<HTMLElement>(
        `[data-column="${Math.min(focus.column, state.columns.length - 1)}"]`,
      );
      li?.querySelector<HTMLElement>(focus.sel)?.focus();
    }
  }

  function recompute(): void {
    syncPreset();
    model = compare(lib, state);
    const span = q("span-note");
    if (span) {
      if (model.years === null) {
        span.textContent = `${NO_SIGNAL_TEXT}: ${NO_YEARS_REASON}`;
        span.dataset["state"] = "sentinel";
      } else {
        span.textContent = model.clamped
          ? `More than ${MAX_YEARS} years: showing the first ${MAX_YEARS}.`
          : `${model.years.length} ${model.years.length === 1 ? "year" : "years"}`;
        span.dataset["state"] = model.clamped ? "note" : "ok";
      }
    }
    const note = q("holiday-note");
    if (note) {
      const bad = model.holidays.flatMap((h, i) => (h.valid ? [] : [i + 1]));
      note.hidden = bad.length === 0;
      note.textContent =
        bad.length === 0
          ? ""
          : `${NO_SIGNAL_TEXT}: ${bad.length === 1 ? `holiday ${bad[0]} is` : `holidays ${bad.join(", ")} are`} not a date on the calendar (a month from 1 to 12 and a day that month has).`;
    }
    matrixBox.innerHTML = matrixHtml(state, model);
    drawDetail();
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

  /** Moves the pressed state in the table, without drawing it again. */
  function markSelection(): void {
    const { year, column } = selection();
    for (const tr of matrixBox.querySelectorAll<HTMLElement>("tr[data-year]")) {
      const on = Number(tr.dataset["year"]) === year;
      if (on) tr.setAttribute("data-selected", "");
      else tr.removeAttribute("data-selected");
      tr.querySelector("[data-action='pick-year']")?.setAttribute(
        "aria-pressed",
        String(on),
      );
      for (const b of tr.querySelectorAll<HTMLElement>(
        "[data-action='pick-cell']",
      )) {
        b.setAttribute(
          "aria-pressed",
          String(on && Number(b.dataset["col"]) === column),
        );
      }
    }
    for (const b of matrixBox.querySelectorAll<HTMLElement>(
      "[data-action='pick-col']",
    )) {
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset["col"]) === column),
      );
    }
  }

  function laneHtml(
    column: ColumnModel,
    j: number,
    row: YearRow,
    cluster: { from: string; to: string },
  ): string {
    const attribution = row.attributions[j] ?? null;
    const name = `<p class="gmt-obs-lane-name">${j + 1}. ${escapeHtml(column.label)}</p>`;
    if (attribution === null) {
      return (
        `<div class="gmt-obs-lane" data-col="${j}" data-state="sentinel">${name}` +
        `<p class="gmt-obs-nosignal gmt-obs-lane-none">${escapeHtml(NO_SIGNAL_TEXT)}</p></div>`
      );
    }
    return (
      `<div class="gmt-obs-lane" data-col="${j}">${name}` +
      weekRowsHtml(
        cluster.from,
        cluster.to,
        laneMarks(lib, attribution, row.year),
        state.weekend,
      ) +
      `</div>`
    );
  }

  function drawDetail(): void {
    const { year, column, row } = selection();
    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = plates(model, row).map(plateHtml).join("");

    const strip = q("strip");
    if (strip) {
      if (model === null || row === undefined) {
        strip.innerHTML = "";
      } else {
        const clusters = clusterDates(row.attributions.flatMap(laneDates));
        strip.innerHTML = clusters
          .map(
            (c, i) =>
              `<section class="gmt-obs-cluster" data-cluster="${i}">` +
              `<h5 class="gmt-obs-cluster-name">${escapeHtml(`${shortDate(c.from, row.year)} to ${shortDate(c.to, row.year)}`)}</h5>` +
              model!.columns
                .map((col, j) => laneHtml(col, j, row, c))
                .join("") +
              `</section>`,
          )
          .join("");
      }
    }

    const sentence = q("year-sentence");
    if (sentence) {
      sentence.textContent =
        row === undefined || model === null
          ? "No year to show."
          : `${row.year}: ${agreeWord(row)}. Showing ${model.columns[column]?.label ?? ""}.`;
    }

    // The call and the hand-off.
    const code = q("call-observed");
    const copy = root.querySelector<HTMLButtonElement>(
      '[data-role="copy-observed"]',
    );
    const text =
      model === null || row === undefined
        ? ""
        : [
            `// ${model.columns[column]?.label ?? ""}, ${row.year}`,
            ...callLines(model, row, column),
          ].join("\n");
    if (code) code.textContent = text;
    if (copy) copy.dataset["copyText"] = text;

    const href = builderHandoffHref(state, model?.columns[column], year);
    setToolLink(q("link-builder"), href);
    const hint = q("handoff-hint");
    if (hint) hint.textContent = href === null ? HINT_HANDOFF : "";
    markSelection();
  }

  // --- state changes -------------------------------------------------------

  const indexOf = (el: HTMLElement, attr: string): number => {
    const li = el.closest<HTMLElement>(`[${attr}]`);
    return li ? Number(li.getAttribute(attr)) : -1;
  };

  function setColumnPolicy(el: HTMLSelectElement, j: number): void {
    const details = el.closest<HTMLElement>(".gmt-holiday-policy");
    if (!details || j < 0) return;
    const values: Record<number, string> = {};
    for (const s of details.querySelectorAll<HTMLSelectElement>("select")) {
      values[Number(s.dataset["weekday"])] = s.value;
    }
    const text = policyTextFromSelects(values);
    state.columns[j] = `${CUSTOM_PREFIX}${text}`;
    const summary = details.querySelector(".gmt-holiday-policy-summary");
    if (summary) {
      summary.textContent = policySummary(parsePolicyText(text) ?? {});
    }
    recompute();
  }

  function onField(e: Event): void {
    const el = e.target as HTMLElement;
    const role = el.dataset?.["role"];
    const field = el.dataset?.["field"];
    if (role === "preset") {
      if (e.type !== "change") return;
      const preset = COMPARATOR_PRESETS.find(
        (p) => p.id === (el as HTMLSelectElement).value,
      );
      if (!preset) return;
      apply(presetState(preset));
    } else if (role === "from" || role === "to") {
      state[role] = (el as HTMLInputElement).value;
      recompute();
    } else if (role === "weekend") {
      state.weekend = normaliseWeekend(
        weekendEls.filter((c) => c.checked).map((c) => Number(c.value)),
      );
      recompute();
    } else if (field === "month" || field === "day") {
      const h = state.holidays[indexOf(el, "data-holiday")];
      if (!h) return;
      h[field] = (el as HTMLInputElement).value;
      recompute();
    } else if (el.dataset?.["weekday"] !== undefined) {
      setColumnPolicy(el as HTMLSelectElement, indexOf(el, "data-column"));
    } else if (field === "col-preset") {
      if (e.type !== "change") return;
      const j = indexOf(el, "data-column");
      const value = (el as HTMLSelectElement).value;
      if (j < 0) return;
      state.columns[j] = value === CUSTOM_OPTION ? CUSTOM_PREFIX : value;
      state.column = -1;
      renderColumns({ column: j, sel: '[data-field="col-preset"]' });
      recompute();
    }
  }

  root.addEventListener("input", onField);
  root.addEventListener("change", onField);
  root.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!button || !root.contains(button) || button.disabled) return;
    switch (button.dataset["action"]) {
      case "pick-cell":
        state.year = button.dataset["year"]!;
        state.column = Number(button.dataset["col"]);
        drawDetail();
        break;
      case "pick-year":
        state.year = button.dataset["year"]!;
        drawDetail();
        break;
      case "pick-col":
        state.column = Number(button.dataset["col"]);
        drawDetail();
        break;
      case "add-holiday":
        if (state.holidays.length >= MAX_HOLIDAYS) break;
        state.holidays.push({ month: "", day: "" });
        renderHolidays(true);
        recompute();
        break;
      case "remove-holiday": {
        const i = indexOf(button, "data-holiday");
        if (i < 0 || state.holidays.length <= 1) break;
        state.holidays.splice(i, 1);
        renderHolidays();
        refocusAfterRemoveHoliday(i);
        recompute();
        break;
      }
      case "add-column": {
        if (state.columns.length >= MAX_COLUMNS) break;
        const unused = POLICY_PRESETS.find(
          (p) => !state.columns.includes(p.id),
        );
        state.columns.push(unused ? unused.id : POLICY_PRESETS[0]!.id);
        renderColumns({ column: state.columns.length - 1, sel: "select" });
        recompute();
        break;
      }
      case "remove-column": {
        const j = indexOf(button, "data-column");
        if (j < 0 || state.columns.length <= MIN_COLUMNS) break;
        state.columns.splice(j, 1);
        state.column = -1;
        renderColumns({ column: j, sel: '[data-field="col-preset"]' });
        recompute();
        break;
      }
    }
  });
  wireCopyButtons(root);

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
  let lib: HolidayLib;
  try {
    lib = await loadHolidayLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) widget.apply(readArgs(args));

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};

export { formatPolicyText };
