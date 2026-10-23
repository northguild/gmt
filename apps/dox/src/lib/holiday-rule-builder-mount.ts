/**
 * The Holiday Rule Builder widget (CORE-54), mountable on its tool page and in
 * the chat rail.
 *
 * The reader edits an ordered list of holiday rules, a weekend, a zone and a
 * year. Each rule row shows the days it closes, the plates count the year, 12
 * month grids draw it, and the printed `buildBusinessCalendar` call shows the
 * library's own answer. Everything on screen is a library call
 * (`attributeRules`, `marksFromAttribution`); the widget computes no date.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root. The rows are drawn again only when the
 * list changes shape (add, remove, move, a new kind, a preset or a seed); a
 * field edit only recomputes the outputs, so focus and IME composition stay in
 * the field being typed in.
 */
import { codeFrameHtml } from "./code-frame";
import { callSizer, holdHtml, outputSizer, textSizers } from "./edi-picture";
import { MAX_RULES, formatPolicyText, parsePolicyText } from "./holiday-codec";
import { loadHolidayLib, type HolidayLib } from "./holiday-lib";
import {
  BUILDER_LINKS,
  BUILDER_PRESETS,
  CUSTOM_PRESET_ID,
  HANDOFF_NO_CALENDAR,
  HANDOFF_NO_YEAR,
  HANDOFF_TOO_LONG,
  INVALID_REASON,
  KIND_LABELS,
  NO_SIGNAL_TEXT,
  RULE_KINDS,
  YEAR_MAX,
  YEAR_MIN,
  blankRow,
  callArgsText,
  easterLabel,
  hasPolicy,
  isSeeded,
  ledgerHandoff,
  literal,
  matchPreset,
  movedCount,
  normaliseWeekend,
  permalinkOf,
  presetState,
  readArgs,
  rowResult,
  rulesOf,
  ruleCallLines,
  ruleCallSizerText,
  weekendNames,
  yearOf,
  type BuilderState,
  type HolidayRuleBuilderArgs,
  type RowResult,
  type RowState,
  type RuleKind,
} from "./holiday-rule-builder";
import {
  attributeRules,
  legendHtml,
  marksFromAttribution,
  monthGridHtml,
  monthName,
  policyEditorHtml,
  policySummary,
  policyTextFromSelects,
  weekdayShort,
  type Attribution,
} from "./holiday-widgets";
import { LEDGER_ZONES } from "./free-time-ledger";
import { onWidthChange } from "./label-fit";
import {
  descriptionHoldHtml,
  plateHtml,
  type PlateSpec,
} from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { compareHandoffHref } from "./observance-comparator";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  chipToggleHtml,
  clearCallLine,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderCallLine,
  renderWidgetOutput,
  setControlValue,
  setToolLink,
  toolLinksHtml,
  wireCopyButtons,
} from "./widget-ui";

export type { HolidayRuleBuilderArgs } from "./holiday-rule-builder";

/** The container width under which the policy editor folds, in px (30rem). */
export const FOLD_WIDTH = 480;

const HINT_ORDER =
  "Swap the two rows: the order decides which day each holiday lands on.";
const YEAR_NOTE_NULL = `${NO_SIGNAL_TEXT}: the calendar cannot be built until every rule is valid.`;
const YEAR_RANGE = `the year is not a whole number from ${YEAR_MIN} to ${YEAR_MAX}`;
const YEAR_NOTE_INVALID = `${NO_SIGNAL_TEXT}: ${YEAR_RANGE}.`;
const ROW_NO_YEAR = `${NO_SIGNAL_TEXT}: there is no year to place it in.`;

// Neutral filler as wide as the longest zone id, so the sizer names no place.
const SIZER_ZONE = "Xxxxxxx/Xxxxxxxxx/Xxxxxxxxxxxxxx";
const CALL_SIZER =
  "buildBusinessCalendar({\n" +
  `  timeZone: "${SIZER_ZONE}",\n` +
  "  weekend: [6, 7],\n" +
  "  rules: [\n" +
  '    { name: "Easter +1 (Easter Monday)", kind: "easterRelative", offsetDays: 1 },\n' +
  '    { name: "25 Dec", kind: "fixed", month: 12, day: 25, observed: { 6: { previous: 5 }, 7: { next: 1 } } },\n' +
  "  ],\n" +
  "  years: { from: 2026, to: 2026 },\n" +
  "})";
const OUTPUT_SIZER =
  "{ weekend: [6, 7],\n" +
  '  holidays: ["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25", "2026-12-26"],\n' +
  `  timeZone: "${SIZER_ZONE}" }`;

let counter = 0;

const ordinalLabel = (value: string): string =>
  value === "last"
    ? "last"
    : Number(value) < 0
      ? `${-Number(value)} from the end`
      : `${value}`;

function options(
  values: readonly string[],
  label: (v: string) => string,
  selected: string,
): string {
  const list = values.includes(selected) ? values : [...values, selected];
  return list
    .map(
      (v) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(label(v))}</option>`,
    )
    .join("");
}

const numberField = (
  field: string,
  label: string,
  value: string,
  extra = "",
): string =>
  `<label class="gmt-label">${labelTextHtml(label)}` +
  `<input class="gmt-input" data-field="${field}" type="number" step="1" inputmode="numeric" ${extra} value="${escapeAttr(value)}"></label>`;

function kindFieldsHtml(row: RowState): string {
  const days = ["1", "2", "3", "4", "5", "6", "7"];
  switch (row.kind) {
    case "fixed":
      return (
        numberField("month", "Month", row.month, 'min="1" max="12"') +
        numberField("day", "Day", row.day, 'min="1" max="31"')
      );
    case "calendarFixed":
      return (
        `<label class="gmt-label">${labelTextHtml("Calendar")}` +
        `<select class="gmt-select" data-field="calendar">` +
        options(
          [
            "islamic-umalqura",
            "islamic-civil",
            "islamic-tbla",
            "hebrew",
            "persian",
            "indian",
            "buddhist",
            "japanese",
            "roc",
            "ethiopic",
            "ethioaa",
            "coptic",
            "gregory",
            "iso8601",
          ],
          (v) => v,
          row.calendar === "" ? "islamic-umalqura" : row.calendar,
        ) +
        `</select></label>` +
        `<label class="gmt-label">${labelTextHtml("Month code")}` +
        `<input class="gmt-input" data-field="monthCode" type="text" spellcheck="false" autocomplete="off" placeholder="M01" value="${escapeAttr(row.monthCode)}"></label>` +
        numberField("day", "Day", row.day, 'min="1" max="31"')
      );
    case "nthWeekday":
      return (
        numberField("month", "Month", row.month, 'min="1" max="12"') +
        `<label class="gmt-label">${labelTextHtml("Weekday")}` +
        `<select class="gmt-select" data-field="weekday">` +
        days
          .map(
            (d) =>
              `<option value="${d}"${d === row.weekday ? " selected" : ""}>${weekdayShort(Number(d))}</option>`,
          )
          .join("") +
        `</select></label>` +
        `<label class="gmt-label">${labelTextHtml("Which")}` +
        `<select class="gmt-select" data-field="ordinal">` +
        options(["1", "2", "3", "4", "5", "last"], ordinalLabel, row.ordinal) +
        `</select></label>`
      );
    case "easterRelative":
      return (
        numberField("offset", "Days from Easter", row.offset) +
        `<span class="gmt-hrb-easter" data-role="easter-label">${escapeHtml(easterLabel(row.offset))}</span>` +
        `<label class="gmt-chip-toggle"><input type="checkbox" data-field="julian"${row.julian ? " checked" : ""}><span class="gmt-chip-toggle-face">Julian computus</span></label>`
      );
    case "dates":
      return (
        `<label class="gmt-label gmt-hrb-wide">${labelTextHtml("Dates, comma separated")}` +
        `<input class="gmt-input" data-field="dates" type="text" spellcheck="false" autocomplete="off" placeholder="2026-03-20, 2026-03-21" value="${escapeAttr(row.dates)}"></label>`
      );
  }
}

const RESULT_SIZERS = [
  ...RULE_KINDS.map((k) => `${NO_SIGNAL_TEXT}: ${INVALID_REASON[k]}.`),
  "Closes Mon 27 Dec, moved from Sat 25 Dec",
];

/** One rule row: a full bevelled card, never a coloured left edge. */
export function ruleRowHtml(
  row: RowState,
  index: number,
  total: number,
  uid: string,
  folded: boolean,
): string {
  const n = index + 1;
  const kindOptions = RULE_KINDS.map(
    (k) =>
      `<option value="${k}"${k === row.kind ? " selected" : ""}>${escapeHtml(KIND_LABELS[k])}</option>`,
  ).join("");
  const button = (action: string, glyph: string, name: string, off = false) =>
    `<button type="button" class="gmt-button gmt-hrb-btn" data-action="${action}" aria-label="${escapeAttr(name)}"${off ? " disabled" : ""}>${glyph}</button>`;
  const policy = hasPolicy(row.kind)
    ? `<div class="gmt-hrb-policy"><span class="gmt-label-text">Observance when it falls on a weekday (blank: none)</span>` +
      policyEditorHtml({
        idPrefix: `${uid}-p${index}`,
        policy: parsePolicyText(row.policy) ?? {},
        folded,
      }) +
      `</div>`
    : "";
  const compare =
    row.kind === "fixed"
      ? `<a class="gmt-button gmt-button--pad gmt-hrb-compare" data-role="link-compare" aria-disabled="true">Compare policies for this date</a>`
      : "";
  return (
    `<li class="gmt-holiday-card gmt-hrb-row" data-row="${index}" data-kind="${row.kind}">` +
    `<div class="gmt-hrb-head">` +
    `<span class="gmt-hrb-num" aria-hidden="true">${n}</span>` +
    `<label class="gmt-label gmt-hrb-name">${labelTextHtml(`Rule ${n} name`)}` +
    `<input class="gmt-input" data-field="name" type="text" autocomplete="off" maxlength="40" value="${escapeAttr(row.name)}"></label>` +
    `<label class="gmt-label gmt-hrb-kind">${labelTextHtml(`Rule ${n} kind`)}` +
    `<select class="gmt-select" data-field="kind">${kindOptions}</select></label>` +
    `<div class="gmt-hrb-actions">` +
    button("up", "↑", `Move rule ${n} up`, index === 0) +
    button("down", "↓", `Move rule ${n} down`, index === total - 1) +
    button("remove", "×", `Remove rule ${n}`) +
    `</div></div>` +
    `<div class="gmt-hrb-fields">${kindFieldsHtml(row)}</div>` +
    policy +
    compare +
    holdHtml(
      `<p class="gmt-hrb-result" data-role="row-result" aria-live="off"></p>`,
      textSizers("p", "gmt-hrb-result", RESULT_SIZERS),
      "gmt-ledger-hold",
    ) +
    `</li>`
  );
}

function rowsHtml(state: BuilderState, uid: string, folded: boolean): string {
  return state.rows
    .map((row, i) => ruleRowHtml(row, i, state.rows.length, uid, folded))
    .join("");
}

function plates(
  year: number | null,
  closed: number | null,
  moved: number | null,
  weekend: readonly number[],
): PlateSpec[] {
  return [
    {
      role: "hero-closed",
      caption: "Closed days",
      value: closed === null ? null : String(closed),
      lines: [year === null ? "" : `holidays in ${year}`],
      series: 1,
    },
    {
      role: "hero-moved",
      caption: "Moved",
      value: moved === null ? null : String(moved),
      lines: ["observed on another day"],
      series: 2,
    },
    {
      role: "hero-weekend",
      caption: "Weekend",
      value: weekendNames(weekend),
      lines: ["closed every week"],
      quiet: true,
    },
  ];
}

function zoneOptions(selected: string): string {
  const list = LEDGER_ZONES.includes(selected)
    ? LEDGER_ZONES
    : [...LEDGER_ZONES, selected];
  return options(list, (v) => v, selected);
}

function presetOptionsHtml(id: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${id === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    BUILDER_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === id ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The rows, the month grids and the plates
 * are drawn here without the library (weekend cells only); `mount` draws the
 * closed days and every printed result.
 */
export function renderHolidayRuleBuilderTemplate(
  args: HolidayRuleBuilderArgs = {},
): string {
  const uid = `gmt-hrb-${++counter}`;
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(BUILDER_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = BUILDER_PRESETS.find((p) => p.id === presetId);
  const year = yearOf(state) ?? BUILDER_PRESETS[0]!.year;
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
    `<div class="gmt-holiday-rule-builder gmt-widget not-content" data-uid="${uid}">` +
    `<div class="gmt-widget-card">` +
    // 1. Rules
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Rules</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      BUILDER_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Zone")}` +
    `<select class="gmt-select" data-role="zone">${zoneOptions(state.zone)}</select></label>` +
    `<div class="gmt-label gmt-hrb-year">` +
    `<label class="gmt-label-text" for="${uid}-year">Year</label>` +
    `<div class="gmt-hrb-yearrow">` +
    `<button type="button" class="gmt-button gmt-hrb-btn" data-action="year-down" aria-label="Previous year">−</button>` +
    `<input class="gmt-input" id="${uid}-year" data-role="year" type="number" min="${YEAR_MIN}" max="${YEAR_MAX}" step="1" inputmode="numeric" value="${escapeAttr(state.year)}">` +
    `<button type="button" class="gmt-button gmt-hrb-btn" data-action="year-up" aria-label="Next year">+</button>` +
    `</div></div>` +
    `<fieldset class="gmt-chip-group gmt-field-wide"><legend>Weekend</legend>${weekendBoxes}</fieldset>` +
    `</div>` +
    `<div class="gmt-holiday-frame" data-role="rules-frame">` +
    `<ol class="gmt-hrb-rules" data-role="rules" data-grow="slot">${rowsHtml(state, uid, false)}</ol>` +
    `<div class="gmt-hrb-addrow">` +
    `<button type="button" class="gmt-button gmt-button--pad" data-action="add"${state.rows.length >= MAX_RULES ? " disabled" : ""}>Add rule</button>` +
    `<span class="gmt-widget-hint" data-role="rule-count">${state.rows.length} of ${MAX_RULES} rules</span>` +
    `</div>` +
    `<p class="gmt-widget-hint">${escapeHtml(HINT_ORDER)}</p>` +
    `</div>` +
    `</div>` +
    // 2. The year
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. The year</h4>` +
    `<div class="gmt-holiday-frame">` +
    `<div class="gmt-punct-heroes gmt-hrb-heroes" data-role="heroes" aria-hidden="true">${plates(year, null, 0, state.weekend).map(plateHtml).join("")}</div>` +
    `<p class="gmt-ledger-sr" data-role="year-sentence" aria-live="polite"></p>` +
    `<div data-role="grid">${monthGridHtml({ year, months: { from: 1, to: 12 }, marks: {}, weekend: state.weekend })}</div>` +
    legendHtml() +
    `<p class="gmt-hrb-note" data-role="year-note"></p>` +
    `</div>` +
    `</div>` +
    // 3. The call
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The call</h4>` +
    holdHtml(
      codeFrameHtml("calendar"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="calendar-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    `<details class="gmt-hrb-calls"><summary>Each rule's own calls</summary>` +
    // The pre sits in a hold: a hidden twin holds the tallest text the rules
    // can print (`ruleCallSizerText`), so a year that moves a date across 1
    // January adds a line the frame already has room for.
    `<div class="gmt-ledger-hold">` +
    `<pre class="gmt-codeframe-pre"><code data-role="rule-calls"></code></pre>` +
    `<pre class="gmt-codeframe-pre gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore><code data-role="rule-calls-sizer"></code></pre>` +
    `</div></details>` +
    toolLinksHtml(BUILDER_LINKS) +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="handoff-hint"></p>`,
      textSizers("p", "gmt-widget-hint", [
        HANDOFF_NO_CALENDAR,
        HANDOFF_TOO_LONG,
      ]),
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

const FIELD_KEYS = [
  "name",
  "month",
  "day",
  "calendar",
  "monthCode",
  "weekday",
  "ordinal",
  "offset",
  "dates",
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function drawResult(el: HTMLElement | null, result: RowResult): void {
  if (!el) return;
  if (result.state === "sentinel") {
    renderWidgetOutput(el, result.text, "sentinel");
  } else {
    // A correct answer, including "no date this year": never the sentinel.
    el.classList.remove(
      "gmt-playground-live",
      "gmt-playground-sentinel",
      "gmt-widget-output--empty",
    );
    el.textContent = result.text;
  }
  el.dataset["state"] = result.state;
}

interface Controller {
  readState(): BuilderState;
  apply(state: BuilderState): void;
  release(): void;
}

function setupWidget(root: HTMLElement, lib: HolidayLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const uid = root.dataset["uid"] ?? `gmt-hrb-${++counter}`;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const zoneEl = q<HTMLSelectElement>("zone")!;
  const yearEl = q<HTMLInputElement>("year")!;
  const rulesEl = q<HTMLElement>("rules")!;
  const addEl = root.querySelector<HTMLButtonElement>('[data-action="add"]')!;
  const weekendEls = [
    ...root.querySelectorAll<HTMLInputElement>('[data-role="weekend"]'),
  ];

  let state: BuilderState = presetState(BUILDER_PRESETS[0]!);
  let folded = false;

  const narrow = (): boolean => {
    const width = rulesEl.clientWidth;
    return width > 0 && width < FOLD_WIDTH;
  };

  function applyFold(): void {
    folded = narrow();
    for (const d of rulesEl.querySelectorAll<HTMLDetailsElement>(
      ".gmt-holiday-policy",
    )) {
      d.open = !folded;
    }
  }

  function syncControls(): void {
    setControlValue(zoneEl, state.zone);
    yearEl.value = state.year;
    for (const el of weekendEls) {
      el.checked = state.weekend.includes(Number(el.value));
    }
  }

  function syncPreset(): void {
    const id = matchPreset(state);
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        BUILDER_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** Draws the rows again, then puts focus where `focus` says. */
  function renderRows(focus?: { row: number; sel: string } | "add"): void {
    folded = narrow();
    rulesEl.innerHTML = rowsHtml(state, uid, folded);
    addEl.disabled = state.rows.length >= MAX_RULES;
    const count = q("rule-count");
    if (count) count.textContent = `${state.rows.length} of ${MAX_RULES} rules`;
    if (focus === "add") {
      addEl.focus();
    } else if (focus) {
      const li = rulesEl.querySelector<HTMLElement>(
        `[data-row="${Math.min(focus.row, state.rows.length - 1)}"]`,
      );
      // `sel` lists alternates; the first enabled one takes focus.
      const target = [
        ...(li?.querySelectorAll<HTMLElement>(focus.sel) ?? []),
      ].find((el) => !(el as HTMLButtonElement).disabled);
      if (target) target.focus();
      else li?.querySelector<HTMLElement>("[data-field]")?.focus();
    }
    recompute();
  }

  let lastYear = yearOf(state) ?? BUILDER_PRESETS[0]!.year;

  function recompute(): void {
    const year = yearOf(state);
    if (year === null) {
      yearEl.setAttribute("aria-invalid", "true");
      drawNoYear();
      return;
    }
    yearEl.removeAttribute("aria-invalid");
    lastYear = year;
    syncPreset();

    const rules = rulesOf(state);
    const attribution = attributeRules(
      lib,
      { timeZone: state.zone, weekend: state.weekend, rules },
      year,
    );
    drawRows(rules, attribution, year);
    drawYear(attribution, year);
    drawCall(rules, attribution, year);
  }

  /** An invalid year: every readout of the year goes to NO SIGNAL or empty, so
   *  none goes on showing the last valid year's answer as this one's. The grid
   *  keeps its frame, unmarked, and a row's compare link, which needs no year,
   *  stays. */
  function drawNoYear(): void {
    rulesEl.querySelectorAll<HTMLElement>("[data-row]").forEach((li, i) => {
      drawResult(li.querySelector('[data-role="row-result"]'), {
        state: "sentinel",
        text: ROW_NO_YEAR,
      });
      const source = state.rows[i];
      const link = li.querySelector<HTMLElement>('[data-role="link-compare"]');
      if (link && source) {
        setToolLink(link, compareHandoffHref(lib, source, state.weekend, null));
      }
    });
    const heroes = q("heroes");
    if (heroes) {
      heroes.innerHTML = plates(null, null, null, state.weekend)
        .map(plateHtml)
        .join("");
    }
    const grid = q("grid");
    if (grid) {
      grid.innerHTML = monthGridHtml({
        year: lastYear,
        months: { from: 1, to: 12 },
        marks: {},
        weekend: state.weekend,
      });
    }
    const note = q("year-note");
    if (note) renderWidgetOutput(note, YEAR_NOTE_INVALID, "sentinel");
    const sentence = q("year-sentence");
    if (sentence) sentence.textContent = `No calendar: ${YEAR_RANGE}.`;
    clearCallLine(q("call-calendar"));
    const out = q("calendar-output");
    if (out) renderWidgetOutput(out, NO_SIGNAL_TEXT, "sentinel");
    const calls = q("rule-calls");
    if (calls) calls.textContent = "";
    setToolLink(q("link-ledger"), null);
    const hint = q("handoff-hint");
    if (hint) hint.textContent = HANDOFF_NO_YEAR;
  }

  function drawRows(
    rules: ReturnType<typeof rulesOf>,
    attribution: Attribution,
    year: number,
  ): void {
    rulesEl.querySelectorAll<HTMLElement>("[data-row]").forEach((li, i) => {
      const rule = rules[i];
      const row = attribution.rows[i];
      if (!rule || !row) return;
      drawResult(
        li.querySelector('[data-role="row-result"]'),
        rowResult(rule, row.valid, row.pairs, year),
      );
      const source = state.rows[i];
      const link = li.querySelector<HTMLElement>('[data-role="link-compare"]');
      if (link && source) {
        setToolLink(link, compareHandoffHref(lib, source, state.weekend, year));
      }
    });
  }

  function drawYear(attribution: Attribution, year: number): void {
    const { full } = attribution;
    const moved = movedCount(
      lib,
      attribution.rows.map((r) => r.pairs),
    );
    const heroes = q("heroes");
    if (heroes) {
      heroes.innerHTML = plates(
        year,
        full === null ? null : full.holidays.length,
        moved,
        state.weekend,
      )
        .map(plateHtml)
        .join("");
    }
    const grid = q("grid");
    if (grid) {
      grid.innerHTML = monthGridHtml({
        year,
        months: { from: 1, to: 12 },
        marks: marksFromAttribution(lib, attribution, year),
        weekend: state.weekend,
      });
    }
    const note = q("year-note");
    if (note) {
      if (full === null) renderWidgetOutput(note, YEAR_NOTE_NULL, "sentinel");
      else {
        renderWidgetOutput(note, "", "empty");
        note.classList.remove("gmt-widget-output--empty");
      }
    }
    const sentence = q("year-sentence");
    if (sentence) {
      sentence.textContent =
        full === null
          ? `${year}: no calendar, a rule is not valid.`
          : `${year}: ${full.holidays.length} closed ${full.holidays.length === 1 ? "day" : "days"}, ${moved} moved. Weekend: ${weekendNames(state.weekend)}.`;
    }
  }

  function drawCall(
    rules: ReturnType<typeof rulesOf>,
    attribution: Attribution,
    year: number,
  ): void {
    const { full } = attribution;
    const args = callArgsText(state, year);
    renderCallLine(
      q("call-calendar"),
      "buildBusinessCalendar",
      escapeHtml(args),
      args,
    );
    const out = q("calendar-output");
    if (out) {
      if (full === null) {
        renderWidgetOutput(out, `null\n${NO_SIGNAL_TEXT}`, "sentinel");
      } else {
        const text =
          `{ weekend: ${literal(full.weekend)},\n` +
          `  holidays: ${literal(full.holidays)},\n` +
          `  timeZone: ${literal(full.timeZone)} }`;
        renderWidgetOutput(
          out,
          text,
          full.holidays.length > 0 ? "live" : "empty",
        );
      }
    }
    const calls = q("rule-calls");
    if (calls) {
      calls.textContent = ruleCallLines(
        rules,
        attribution.rows.map((r) => r.pairs),
        year,
      ).join("\n");
    }
    const callsSizer = q("rule-calls-sizer");
    if (callsSizer) callsSizer.textContent = ruleCallSizerText(rules);
    const handoff = ledgerHandoff(full, state.zone, state.weekend);
    setToolLink(q("link-ledger"), handoff.href);
    const hint = q("handoff-hint");
    if (hint) hint.textContent = handoff.href === null ? handoff.hint : "";
  }

  // --- state changes -------------------------------------------------------

  const rowIndex = (el: HTMLElement): number => {
    const li = el.closest<HTMLElement>("[data-row]");
    return li ? Number(li.dataset["row"]) : -1;
  };

  function setField(el: HTMLElement, i: number): void {
    const row = state.rows[i];
    if (!row) return;
    const key = el.dataset["field"] as FieldKey | "julian" | "kind" | undefined;
    if (key === "julian") {
      row.julian = (el as HTMLInputElement).checked;
    } else if (key && (FIELD_KEYS as readonly string[]).includes(key)) {
      row[key as FieldKey] = (el as HTMLInputElement).value;
      if (key === "offset") {
        const label = el
          .closest("[data-row]")
          ?.querySelector('[data-role="easter-label"]');
        if (label) label.textContent = easterLabel(row.offset);
      }
    }
    recompute();
  }

  function setPolicy(el: HTMLSelectElement, i: number): void {
    const row = state.rows[i];
    const details = el.closest<HTMLElement>(".gmt-holiday-policy");
    if (!row || !details) return;
    const values: Record<number, string> = {};
    for (const s of details.querySelectorAll<HTMLSelectElement>("select")) {
      values[Number(s.dataset["weekday"])] = s.value;
    }
    row.policy = policyTextFromSelects(values);
    const summary = details.querySelector(".gmt-holiday-policy-summary");
    if (summary) {
      summary.textContent = policySummary(parsePolicyText(row.policy) ?? {});
    }
    recompute();
  }

  function onField(e: Event): void {
    const el = e.target as HTMLElement;
    const role = el.dataset?.["role"];
    const i = rowIndex(el);
    if (role === "preset") {
      const preset = BUILDER_PRESETS.find(
        (p) => p.id === (el as HTMLSelectElement).value,
      );
      if (!preset) return;
      state = presetState(preset);
      syncControls();
      renderRows();
    } else if (role === "zone") {
      state.zone = (el as HTMLSelectElement).value;
      recompute();
    } else if (role === "year") {
      state.year = (el as HTMLInputElement).value;
      recompute();
    } else if (role === "weekend") {
      state.weekend = normaliseWeekend(
        weekendEls.filter((c) => c.checked).map((c) => Number(c.value)),
      );
      recompute();
    } else if (i >= 0 && el.dataset?.["weekday"] !== undefined) {
      setPolicy(el as HTMLSelectElement, i);
    } else if (i >= 0 && el.dataset?.["field"] === "kind") {
      if (e.type !== "change") return;
      const row = state.rows[i];
      const kind = (el as HTMLSelectElement).value as RuleKind;
      if (!row || !RULE_KINDS.includes(kind) || kind === row.kind) return;
      state.rows[i] = { ...blankRow(kind), name: row.name };
      renderRows({ row: i, sel: '[data-field="kind"]' });
    } else if (i >= 0 && el.dataset?.["field"] !== undefined) {
      setField(el, i);
    }
  }

  function move(i: number, by: -1 | 1, sel: string): void {
    const j = i + by;
    if (i < 0 || j < 0 || j >= state.rows.length) return;
    const [row] = state.rows.splice(i, 1);
    state.rows.splice(j, 0, row!);
    // Focus follows the row to the same button; at an end that button is
    // disabled, so it falls to the other direction.
    renderRows({ row: j, sel });
  }

  function stepYear(by: number): void {
    const next = Math.min(
      YEAR_MAX,
      Math.max(YEAR_MIN, (yearOf(state) ?? lastYear) + by),
    );
    state.year = String(next);
    yearEl.value = state.year;
    recompute();
  }

  root.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!button || !root.contains(button) || button.disabled) return;
    const i = rowIndex(button);
    switch (button.dataset["action"]) {
      case "up":
        move(i, -1, '[data-action="up"], [data-action="down"]');
        break;
      case "down":
        move(i, 1, '[data-action="down"], [data-action="up"]');
        break;
      case "remove":
        if (i < 0) break;
        state.rows.splice(i, 1);
        renderRows(
          state.rows.length === 0
            ? "add"
            : { row: i, sel: '[data-action="remove"]' },
        );
        break;
      case "add":
        if (state.rows.length >= MAX_RULES) break;
        state.rows.push(blankRow());
        renderRows({ row: state.rows.length - 1, sel: '[data-field="name"]' });
        break;
      case "year-down":
        stepYear(-1);
        break;
      case "year-up":
        stepYear(1);
        break;
    }
  });
  root.addEventListener("input", onField);
  root.addEventListener("change", onField);
  wireCopyButtons(root);

  const disposeWidth = onWidthChange(rulesEl, () => {
    if (narrow() !== folded) applyFold();
  });

  function apply(next: BuilderState): void {
    state = next;
    syncControls();
    renderRows();
  }

  // The template seeds the first paint; read what it drew back as state.
  apply(presetState(BUILDER_PRESETS[0]!));

  return {
    readState: () => state,
    apply,
    release: disposeWidth,
  };
}

export const mountHolidayRuleBuilder: MountFn<HolidayRuleBuilderArgs> = async (
  root,
  args,
  signal,
) => {
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

// Re-exported for the tests and for slice 5's chat tool.
export { monthName };
export { formatPolicyText };
