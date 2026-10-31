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
 * Built on the component kit: `renderHolidayRuleBuilderTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those
 * ids. Every listener is delegated on the widget with the mount's `signal`. The rows are
 * drawn again only when the list changes shape (add, remove, move, a new kind, a preset or
 * a seed); a field edit only recomputes the outputs, so focus and IME composition stay in
 * the field being typed in. A row's controls have ids `${scope}-r${row}-${part}`, and the
 * delegated listeners read the row and the part back from the id.
 */
import { defineElements } from "~/widgets/define";
import {
  button,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  plates,
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import {
  holidayLegend,
  kindItems,
} from "~/widgets/families/holiday/holiday-legend";
import { monthGrid } from "~/widgets/families/holiday/month-grid";
import {
  policyEditor,
  policySelectId,
} from "~/widgets/families/holiday/policy-editor";
import { ruleCard } from "~/widgets/families/holiday/rule-card";
import { yearStepper } from "~/widgets/families/holiday/year-stepper";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/holiday-rule-builder.module.css";
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
  ruleCallExtentJob,
  ruleCallLines,
  weekendNames,
  yearOf,
  type BuilderState,
  type HolidayRuleBuilderArgs,
  type RowResult,
  type RowState,
  type RuleKind,
} from "./holiday-rule-builder";
import {
  attributeRows,
  attributeRules,
  marksFromAttribution,
  monthName,
  policySummary,
  policyTextFromSelects,
  weekdayShort,
  type Attribution,
} from "./holiday-widgets";
import { LEDGER_ZONES } from "./free-time-ledger";
import { onWidthChange } from "./label-fit";
import { compareHandoffHref } from "./observance-comparator";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { setControlValue, setToolLink } from "./widget-ui";

export type { HolidayRuleBuilderArgs } from "./holiday-rule-builder";

/** The container width under which the policy editor folds, in px (30rem). */
export const FOLD_WIDTH = 480;

const WIDGET_NAME = "holiday-rule-builder";

/** How long one slice of the rule-call extent job may run before the page gets a turn. */
const RULE_CALL_SLICE_MS = 4;

const HINT_ORDER =
  "Swap the two rows: the order decides which day each holiday lands on.";
const YEAR_NOTE_NULL = `${NO_SIGNAL_TEXT}: the calendar cannot be built until every rule is valid.`;
const YEAR_RANGE = `the year is not a whole number from ${YEAR_MIN} to ${YEAR_MAX}`;
const YEAR_NOTE_INVALID = `${NO_SIGNAL_TEXT}: ${YEAR_RANGE}.`;
const ROW_NO_YEAR = `${NO_SIGNAL_TEXT}: there is no year to place it in.`;

const RESULT_SIZERS = [
  ...RULE_KINDS.map((k) => `${NO_SIGNAL_TEXT}: ${INVALID_REASON[k]}.`),
  ROW_NO_YEAR,
  "Closes Mon 27 Dec, moved from Sat 25 Dec",
];
const YEAR_NOTE_SIZERS = [YEAR_NOTE_NULL, YEAR_NOTE_INVALID];
const HINT_SIZERS = [HANDOFF_NO_CALENDAR, HANDOFF_TOO_LONG, HANDOFF_NO_YEAR];

const CALENDARS = [
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
] as const;
const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
const ORDINALS = ["1", "2", "3", "4", "5", "last"] as const;
const WEEKEND_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const NAME_MAX = 40;

const ordinalLabel = (value: string): string =>
  value === "last"
    ? "last"
    : Number(value) < 0
      ? `${-Number(value)} from the end`
      : `${value}`;

/** A list of values as select options, with the selected one added when it is not listed. */
function optionsOf(
  values: readonly string[],
  label: (v: string) => string,
  selected: string,
): { value: string; label: string }[] {
  const list = values.includes(selected) ? values : [...values, selected];
  return list.map((value) => ({ value, label: label(value) }));
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const noteOf = (
  id: string,
  label: string,
  text: string,
  state: HeldState,
  sizers: readonly string[],
  gate?: string,
): SafeHtml =>
  heldText({
    id,
    label,
    text,
    state,
    sizers,
    ...(gate === undefined ? {} : { gate }),
  });

const resultNote = (index: number, result: RowResult | null): SafeHtml =>
  heldText({
    label: `Rule ${index + 1} result`,
    text: result === null ? "" : result.text,
    state:
      result === null
        ? "ok"
        : result.state === "sentinel"
          ? "sentinel"
          : result.state === "empty"
            ? "note"
            : "ok",
    sizers: RESULT_SIZERS,
  });

function numberField(id: string, label: string, value: string): SafeHtml {
  return field({
    id,
    label,
    control: ({ id: cid }) =>
      textInput({
        id: cid,
        value,
        inputMode: "numeric",
        autocomplete: "off",
        spellcheck: false,
      }),
  });
}

function kindFields(row: RowState, rowId: string): SafeHtml {
  switch (row.kind) {
    case "fixed":
      return html`${numberField(`${rowId}-month`, "Month", row.month)}${numberField(`${rowId}-day`, "Day", row.day)}`;
    case "calendarFixed":
      return html`${field({
        id: `${rowId}-calendar`,
        label: "Calendar",
        control: ({ id }) =>
          select({
            id,
            value: row.calendar === "" ? "islamic-umalqura" : row.calendar,
            options: optionsOf(
              CALENDARS,
              (v) => v,
              row.calendar === "" ? "islamic-umalqura" : row.calendar,
            ),
          }),
      })}${field({
        id: `${rowId}-monthCode`,
        label: "Month code",
        control: ({ id }) =>
          textInput({
            id,
            value: row.monthCode,
            autocomplete: "off",
            spellcheck: false,
            placeholder: "M01",
          }),
      })}${numberField(`${rowId}-day`, "Day", row.day)}`;
    case "nthWeekday":
      return html`${numberField(`${rowId}-month`, "Month", row.month)}${field({
        id: `${rowId}-weekday`,
        label: "Weekday",
        control: ({ id }) =>
          select({
            id,
            value: row.weekday,
            options: WEEKDAYS.map((d) => ({
              value: d,
              label: weekdayShort(Number(d)),
            })),
          }),
      })}${field({
        id: `${rowId}-ordinal`,
        label: "Which",
        control: ({ id }) =>
          select({
            id,
            value: row.ordinal,
            options: optionsOf(ORDINALS, ordinalLabel, row.ordinal),
          }),
      })}`;
    case "easterRelative":
      return html`${field({
        id: `${rowId}-offset`,
        label: "Days from Easter",
        hint: hint(`${rowId}-offset-hint`, easterLabel(row.offset)),
        control: ({ id, describedBy }) =>
          textInput({
            id,
            value: row.offset,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
            describedBy,
          }),
      })}<span id="${`${rowId}-julian`}">${chips({
        legend: "Computus",
        kind: "checkbox",
        name: `${rowId}-julian-chip`,
        items: [
          { value: "julian", label: "Julian computus", checked: row.julian },
        ],
      })}</span>`;
    case "dates":
      return html`<div class="${styles.wide}">${field({
        id: `${rowId}-dates`,
        label: "Dates, comma separated",
        control: ({ id }) =>
          textInput({
            id,
            value: row.dates,
            autocomplete: "off",
            spellcheck: false,
            placeholder: "2026-03-20, 2026-03-21",
          }),
      })}</div>`;
  }
}

/** One rule row: a full bevelled card, never a coloured left edge. */
function ruleRowHtml(
  row: RowState,
  index: number,
  total: number,
  rowId: string,
  folded: boolean,
): SafeHtml {
  const policy = hasPolicy(row.kind)
    ? html`<div class="${styles.policy}"
        ><span class="${styles.policyLabel}"
          >Observance when it falls on a weekday (blank: none)</span
        >${policyEditor({
          id: `${rowId}-p`,
          policy: parsePolicyText(row.policy) ?? {},
          label: `Rule ${index + 1} observance`,
          folded,
        })}</div
      >`
    : undefined;
  const compare =
    row.kind === "fixed"
      ? toolLinks({
          label: `Rule ${index + 1} comparison`,
          links: [{ text: "Compare policies for this date" }],
        })
      : undefined;
  return ruleCard({
    id: rowId,
    index,
    total,
    kind: row.kind,
    kindOptions: RULE_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] })),
    name: row.name,
    maxName: NAME_MAX,
    fields: kindFields(row, rowId),
    ...(policy === undefined ? {} : { policy }),
    ...(compare === undefined ? {} : { compare }),
    result: resultNote(index, null),
  });
}

function rowsHtml(
  state: BuilderState,
  id: (local: string) => string,
  folded: boolean,
): SafeHtml {
  return html`${state.rows.map((row, i) =>
    ruleRowHtml(row, i, state.rows.length, id(`r${i}`), folded),
  )}`;
}

const ALL_WEEKEND = weekendNames(WEEKEND_DAYS);

function yearPlates(
  year: number | null,
  closed: number | null,
  moved: number | null,
  weekend: readonly number[],
): SafeHtml {
  return plates([
    {
      caption: "Closed days",
      value: closed === null ? null : String(closed),
      lines: [year === null ? "" : `holidays in ${year}`],
      series: 1,
      samples: ["366"],
    },
    {
      caption: "Moved",
      value: moved === null ? null : String(moved),
      lines: ["observed on another day"],
      series: 2,
      samples: ["12"],
    },
    {
      caption: "Weekend",
      value: weekendNames(weekend),
      lines: ["closed every week"],
      quiet: true,
      samples: [ALL_WEEKEND],
    },
  ]);
}

function gridOf(
  year: number,
  weekend: readonly number[],
  marks: Parameters<typeof monthGrid>[0]["marks"],
): SafeHtml {
  return monthGrid({ year, months: { from: 1, to: 12 }, marks, weekend });
}

function presetOptions(): {
  value: string;
  label: string;
  description: string;
}[] {
  return [
    { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
    ...BUILDER_PRESETS.map((p) => ({
      value: p.id,
      label: p.label,
      description: p.description,
    })),
  ];
}

function weekendChips(
  id: (local: string) => string,
  weekend: readonly number[],
): SafeHtml {
  return chips({
    legend: "Weekend",
    kind: "checkbox",
    name: id("weekend-chip"),
    items: WEEKEND_DAYS.map((d) => ({
      value: String(d),
      label: weekdayShort(d),
      checked: weekend.includes(d),
    })),
  });
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The rows, the month grid and the plates
 * are drawn here without the library (weekend cells only); `mount` draws the
 * closed days and every printed result.
 */
export function renderHolidayRuleBuilderTemplate(
  idPrefix: string,
  args: HolidayRuleBuilderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(BUILDER_PRESETS[0]!);
  const presetId = matchPreset(state);
  const year = yearOf(state) ?? BUILDER_PRESETS[0]!.year;

  const rules = section(
    { id: id("rules-section"), heading: "1. Rules", level: 3 },
    html`<div class="${styles.stack}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: presetOptions(),
    })}${fieldGrid(
      html`${field({
        id: id("zone"),
        label: "Zone",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.zone,
            options: optionsOf(LEDGER_ZONES, (v) => v, state.zone),
          }),
      })}${yearStepper({
        id: id("year"),
        label: "Year",
        value: state.year,
        min: YEAR_MIN,
        max: YEAR_MAX,
        prevLabel: "Previous year",
        nextLabel: "Next year",
      })}<div class="${styles.wide}">${weekendChips(id, state.weekend)}</div>`,
    )}${holidayFrame(
      html`${grow(
        html`<ol class="${styles.rules}" id="${id("rules")}" aria-label="Rules" data-gate="drawn">${rowsHtml(state, id, false)}</ol>`,
      )}<div class="${styles.addrow}">${button({
        id: id("add"),
        label: "Add rule",
      })}<span class="${styles.count}" id="${id("count")}"
          >${String(state.rows.length)} of ${String(MAX_RULES)} rules</span
        ></div
        ><p class="${styles.hint}">${HINT_ORDER}</p>`,
      { gate: "frame" },
    )}</div>`,
  );

  const yearSection = section(
    { id: id("year-section"), heading: "2. The year", level: 3 },
    holidayFrame(
      html`<div class="${styles.plates}" aria-hidden="true" id="${id("plates")}">${yearPlates(year, null, 0, state.weekend)}</div
        ><p role="status" aria-label="Year summary" id="${id("year-sentence")}">${srOnly("")}</p
        >${grow(html`<div class="${styles.slot}" id="${id("grid")}">${gridOf(year, state.weekend, {})}</div>`)}${holidayLegend(
          { label: "Marks", items: kindItems() },
        )}<div id="${id("year-note")}">${noteOf(id("year-note-text"), "Year note", "", "ok", YEAR_NOTE_SIZERS, "hold")}</div>`,
      { gate: "frame" },
    ),
  );

  const call = section(
    { id: id("call-section"), heading: "3. The call", level: 3 },
    html`<div class="${styles.stack}">${grow(
      html`<div id="${id("call")}">${codeFrame({
        label: "buildBusinessCalendar call",
        copyLabel: "Copy call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div class="${styles.slot}" id="${id("output")}">${callOutput({
        label: "Calendar returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}<details class="${styles.calls}"
      ><summary>Each rule's own calls</summary
      >${grow(
        html`<div class="${styles.slot}" id="${id("rule-calls")}">${codeFrame({
          label: "Rule calls",
          copyLabel: "Copy rule calls",
          copyText: "",
        })}</div>`,
      )}</details
    >${grow(
      html`<div id="${id("ledger")}">${toolLinks({
        label: "Open this result in another tool",
        links: BUILDER_LINKS.map((l) => ({ text: l.text })),
      })}</div>`,
    )}<div id="${id("hint")}">${noteOf(id("hint-text"), "Hand-off hint", "", "ok", HINT_SIZERS, "hold")}</div></div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Holiday Rule Builder", scope: idPrefix },
    html`${rules}${yearSection}${call}`,
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

const isFieldKey = (key: string): key is FieldKey =>
  (FIELD_KEYS as readonly string[]).includes(key);

/** The call as the reader would write it, one highlighted-free line. */
function callFrame(
  label: string,
  copyLabel: string,
  text: string,
  reserve?: { lines: number; widest: string },
): SafeHtml {
  return codeFrame({
    label,
    copyLabel,
    copyText: text,
    code: html`${text}`,
    ...(reserve === undefined
      ? {}
      : { minLines: reserve.lines, sizer: reserve.widest }),
    ...(label === "buildBusinessCalendar call" ? { gate: "codeframe" } : {}),
  });
}

function outputOf(
  state: "live" | "sentinel" | "empty",
  text: string,
): SafeHtml {
  const lines =
    state === "sentinel"
      ? text.split("\n").map((line) => ({
          text: line,
          lost: line === NO_SIGNAL_TEXT,
        }))
      : text === ""
        ? []
        : text.split("\n").map((line) => ({ text: line, lost: false }));
  return callOutput({ label: "Calendar returned", state, lines });
}

interface Controller {
  readState(): BuilderState;
  apply(state: BuilderState): void;
  release(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: HolidayLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const zoneEl = el<HTMLSelectElement>("zone");
  const yearEl = el<HTMLInputElement>("year");
  const yearPrev = el("year-prev");
  const yearNext = el("year-next");
  const rulesEl = el<HTMLElement>("rules");
  const addEl = el<HTMLButtonElement>("add");
  const weekendEl = widgetEl.querySelector<GmtChips>(
    `gmt-chips:has([name="${CSS.escape(id("weekend-chip"))}"])`,
  )!;
  const ledgerLink = el("ledger").querySelector<HTMLElement>("a");

  let state: BuilderState = presetState(BUILDER_PRESETS[0]!);
  let folded = false;
  let lastYear = yearOf(state) ?? BUILDER_PRESETS[0]!.year;
  /** The lines the rule-call frame holds, kept for the draws that have no year. */
  let ruleCallReserve: ReturnType<typeof ruleCallExtent> = {
    lines: 1,
    widest: "",
  };
  let ruleCallReserveKey = "";
  /** A smaller answer found while the reader is in the widget; it waits for them to leave. */
  let ruleCallPending: typeof ruleCallReserve | null = null;
  let ruleCallText = "";
  let ruleCallJob: ReturnType<typeof setTimeout> | undefined;
  signal.addEventListener("abort", () => clearTimeout(ruleCallJob), {
    once: true,
  });

  const narrow = (): boolean => {
    const width = rulesEl.clientWidth;
    return width > 0 && width < FOLD_WIDTH;
  };

  function applyFold(): void {
    folded = narrow();
    for (const d of rulesEl.querySelectorAll("details")) d.open = !folded;
  }

  function syncControls(): void {
    setControlValue(zoneEl, state.zone);
    yearEl.value = state.year;
    weekendEl.value = state.weekend.map(String);
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(state);
  }

  /** A row's part by its id, or null when the row has no such part. */
  const rowPart = <T extends HTMLElement>(i: number, key: string): T | null =>
    rulesEl.querySelector<T>(`[id="${CSS.escape(id(`r${i}-${key}`))}"]`);

  /** Draws the rows again, then puts focus where `focus` says. */
  function renderRows(
    focus?: { row: number; parts: readonly string[] } | "add",
  ): void {
    folded = narrow();
    setHtml(rulesEl, rowsHtml(state, id, folded));
    addEl.disabled = state.rows.length >= MAX_RULES;
    el("count").textContent = `${state.rows.length} of ${MAX_RULES} rules`;
    if (focus === "add") {
      addEl.focus();
    } else if (focus) {
      const row = Math.min(focus.row, state.rows.length - 1);
      // `parts` lists alternates; the first enabled one takes focus.
      const target = focus.parts
        .map((p) => rowPart<HTMLButtonElement>(row, p))
        .find((c) => c !== null && !c.disabled);
      (target ?? rowPart(row, "name"))?.focus();
    }
    recompute();
  }

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

  function drawResult(i: number, result: RowResult): void {
    const slot = rowPart(i, "result");
    if (slot) setHtml(slot, resultNote(i, result));
  }

  function drawCompare(i: number, year: number | null): void {
    const source = state.rows[i];
    const li = rowPart(i, "name")?.closest("li") ?? null;
    const link = li?.querySelector<HTMLElement>("a") ?? null;
    if (link && source) {
      setToolLink(link, compareHandoffHref(lib, source, state.weekend, year));
    }
  }

  /** An invalid year: every readout of the year goes to NO SIGNAL or empty, so
   *  none goes on showing the last valid year's answer as this one's. The grid
   *  keeps its frame, unmarked, and a row's compare link, which needs no year,
   *  stays. */
  function drawNoYear(): void {
    state.rows.forEach((_row, i) => {
      drawResult(i, { state: "sentinel", text: ROW_NO_YEAR });
      drawCompare(i, null);
    });
    setHtml(el("plates"), yearPlates(null, null, null, state.weekend));
    setHtml(el("grid"), gridOf(lastYear, state.weekend, {}));
    setHtml(
      el("year-note"),
      noteOf(
        id("year-note-text"),
        "Year note",
        YEAR_NOTE_INVALID,
        "sentinel",
        YEAR_NOTE_SIZERS,
        "hold",
      ),
    );
    setHtml(el("year-sentence"), srOnly(`No calendar: ${YEAR_RANGE}.`));
    setHtml(
      el("call"),
      codeFrame({
        label: "buildBusinessCalendar call",
        copyLabel: "Copy call",
        copyText: "",
        gate: "codeframe",
      }),
    );
    setHtml(el("output"), outputOf("sentinel", NO_SIGNAL_TEXT));
    ruleCallText = "";
    setHtml(
      el("rule-calls"),
      callFrame("Rule calls", "Copy rule calls", "", ruleCallReserve),
    );
    setToolLink(ledgerLink, null);
    setHtml(
      el("hint"),
      noteOf(
        id("hint-text"),
        "Hand-off hint",
        HANDOFF_NO_YEAR,
        "note",
        HINT_SIZERS,
        "hold",
      ),
    );
  }

  function drawRows(
    rules: ReturnType<typeof rulesOf>,
    attribution: Attribution,
    year: number,
  ): void {
    state.rows.forEach((_row, i) => {
      const rule = rules[i];
      const row = attribution.rows[i];
      if (!rule || !row) return;
      drawResult(i, rowResult(rule, row.valid, row.pairs, year));
      drawCompare(i, year);
    });
  }

  function drawYear(attribution: Attribution, year: number): void {
    const { full } = attribution;
    const moved = movedCount(
      lib,
      attribution.rows.map((r) => r.pairs),
    );
    setHtml(
      el("plates"),
      yearPlates(
        year,
        full === null ? null : full.holidays.length,
        moved,
        state.weekend,
      ),
    );
    setHtml(
      el("grid"),
      gridOf(year, state.weekend, marksFromAttribution(lib, attribution, year)),
    );
    setHtml(
      el("year-note"),
      noteOf(
        id("year-note-text"),
        "Year note",
        full === null ? YEAR_NOTE_NULL : "",
        full === null ? "sentinel" : "ok",
        YEAR_NOTE_SIZERS,
        "hold",
      ),
    );
    setHtml(
      el("year-sentence"),
      srOnly(
        full === null
          ? `${year}: no calendar, a rule is not valid.`
          : `${year}: ${full.holidays.length} closed ${full.holidays.length === 1 ? "day" : "days"}, ${moved} moved. Weekend: ${weekendNames(state.weekend)}.`,
      ),
    );
  }

  /**
   * Finds how tall and wide the rule calls print in any year, a few milliseconds at a time
   * between keystrokes, and redraws the frame once when the answer is larger than the room
   * it has. It starts again only when the rules, the zone or the weekend change.
   */
  function reserveRuleCalls(
    rules: ReturnType<typeof rulesOf>,
    year: number,
  ): void {
    const key = JSON.stringify([rules, state.zone, state.weekend]);
    if (key === ruleCallReserveKey) return;
    ruleCallReserveKey = key;
    ruleCallPending = null;
    clearTimeout(ruleCallJob);
    const spec = { timeZone: state.zone, weekend: state.weekend, rules };
    const job = ruleCallExtentJob(
      (y) =>
        ruleCallLines(
          rules,
          attributeRows(lib, spec, y).map((r) => r.pairs),
          y,
        ),
      year,
    );
    const slice = (): void => {
      if (signal.aborted) return;
      const done = job.step(RULE_CALL_SLICE_MS);
      const found = job.extent();
      // Until the last year is in, the room only grows; the end is the exact answer.
      const next = done
        ? found
        : {
            lines: Math.max(found.lines, ruleCallReserve.lines),
            widest:
              found.widest.length > ruleCallReserve.widest.length
                ? found.widest
                : ruleCallReserve.widest,
          };
      // A smaller answer would pull the page up under a reader who is dragging or typing, so it
      // waits until they leave the widget.
      if (
        next.lines < ruleCallReserve.lines &&
        widgetEl.contains(document.activeElement)
      ) {
        ruleCallPending = done ? next : null;
      } else {
        ruleCallPending = null;
        const changed =
          next.lines !== ruleCallReserve.lines ||
          next.widest !== ruleCallReserve.widest;
        ruleCallReserve = next;
        if (changed) redrawRuleCalls();
      }
      if (!done) ruleCallJob = setTimeout(slice, 0);
    };
    ruleCallJob = setTimeout(slice, 0);
  }

  widgetEl.addEventListener(
    "focusout",
    (event) => {
      if (
        ruleCallPending === null ||
        widgetEl.contains(event.relatedTarget as Node | null)
      ) {
        return;
      }
      ruleCallReserve = ruleCallPending;
      ruleCallPending = null;
      redrawRuleCalls();
    },
    { signal },
  );

  /** Draws the rule-call frame again with the room it now reserves, unless a reader is in it. */
  function redrawRuleCalls(): void {
    const frame = el("rule-calls");
    if (frame.contains(document.activeElement)) return;
    setHtml(
      frame,
      callFrame("Rule calls", "Copy rule calls", ruleCallText, ruleCallReserve),
    );
  }

  function drawCall(
    rules: ReturnType<typeof rulesOf>,
    attribution: Attribution,
    year: number,
  ): void {
    const { full } = attribution;
    const args = callArgsText(state, year);
    setHtml(
      el("call"),
      codeFrame({
        label: "buildBusinessCalendar call",
        copyLabel: "Copy call",
        copyText: `buildBusinessCalendar(${args})`,
        code: html`buildBusinessCalendar(${args})`,
        gate: "codeframe",
      }),
    );
    if (full === null) {
      setHtml(el("output"), outputOf("sentinel", `null\n${NO_SIGNAL_TEXT}`));
    } else {
      const text =
        `{ weekend: ${literal(full.weekend)},\n` +
        `  holidays: ${literal(full.holidays)},\n` +
        `  timeZone: ${literal(full.timeZone)} }`;
      setHtml(
        el("output"),
        outputOf(full.holidays.length > 0 ? "live" : "empty", text),
      );
    }
    const lines = ruleCallLines(
      rules,
      attribution.rows.map((r) => r.pairs),
      year,
    ).join("\n");
    reserveRuleCalls(rules, year);
    ruleCallText = lines;
    setHtml(
      el("rule-calls"),
      callFrame("Rule calls", "Copy rule calls", lines, ruleCallReserve),
    );
    const handoff = ledgerHandoff(full, state.zone, state.weekend);
    setToolLink(ledgerLink, handoff.href);
    setHtml(
      el("hint"),
      noteOf(
        id("hint-text"),
        "Hand-off hint",
        handoff.href === null ? handoff.hint : "",
        handoff.href === null ? "note" : "ok",
        HINT_SIZERS,
        "hold",
      ),
    );
  }

  // --- state changes -------------------------------------------------------

  const ROW_ID = new RegExp(`^${escapeRegExp(id("r"))}(\\d+)-(.+)$`);

  /** The row and part an event target belongs to, read from the nearest id up the tree. */
  function locate(
    target: EventTarget | null,
  ): { i: number; key: string; node: HTMLElement } | null {
    let node = target instanceof HTMLElement ? target : null;
    while (node && node !== rulesEl) {
      const match = ROW_ID.exec(node.id);
      if (match) return { i: Number(match[1]), key: match[2]!, node };
      node = node.parentElement;
    }
    return null;
  }

  function setField(node: HTMLElement, i: number, key: string): void {
    const row = state.rows[i];
    if (!row) return;
    if (key === "julian") {
      row.julian =
        node.querySelector<HTMLInputElement>("input")?.checked === true;
    } else if (isFieldKey(key)) {
      row[key] = (node as HTMLInputElement).value;
      if (key === "offset") {
        const note = rowPart(i, "offset-hint");
        if (note) note.textContent = easterLabel(row.offset);
      }
    }
    recompute();
  }

  function setPolicy(i: number): void {
    const row = state.rows[i];
    if (!row) return;
    const values: Record<number, string> = {};
    for (const weekday of WEEKEND_DAYS) {
      const s = rowPart<HTMLSelectElement>(i, `p-${weekday}`);
      if (s) values[weekday] = s.value;
    }
    row.policy = policyTextFromSelects(values);
    const summary = rowPart(i, "p")?.querySelector("summary");
    if (summary) {
      summary.textContent = policySummaryOf(row.policy);
    }
    recompute();
  }

  function move(i: number, by: -1 | 1, parts: readonly string[]): void {
    const j = i + by;
    if (i < 0 || j < 0 || j >= state.rows.length) return;
    const [row] = state.rows.splice(i, 1);
    state.rows.splice(j, 0, row!);
    // Focus follows the row to the same button; at an end that button is
    // disabled, so it falls to the other direction.
    renderRows({ row: j, parts });
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

  function onField(e: Event): void {
    const target = e.target;
    if (target === presetEl) {
      if (e.type !== "change") return;
      const chosen = BUILDER_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      state = presetState(chosen);
      syncControls();
      renderRows();
    } else if (target === zoneEl) {
      state.zone = zoneEl.value;
      recompute();
    } else if (target === yearEl) {
      state.year = yearEl.value;
      recompute();
    } else if (target === weekendEl) {
      state.weekend = normaliseWeekend(
        (weekendEl.value as string[]).map(Number),
      );
      recompute();
    } else {
      const found = locate(target);
      if (!found) return;
      const { i, key, node } = found;
      if (key.startsWith("p-")) {
        if (node instanceof HTMLSelectElement) setPolicy(i);
      } else if (key === "kind") {
        if (e.type !== "change") return;
        const row = state.rows[i];
        const kind = (node as HTMLSelectElement).value as RuleKind;
        if (!row || !RULE_KINDS.includes(kind) || kind === row.kind) return;
        state.rows[i] = { ...blankRow(kind), name: row.name };
        renderRows({ row: i, parts: ["kind"] });
      } else if (key === "julian" || isFieldKey(key)) {
        setField(node, i, key);
      }
    }
  }

  widgetEl.addEventListener("input", onField, { signal });
  widgetEl.addEventListener("change", onField, { signal });
  widgetEl.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (target === yearPrev) return stepYear(-1);
      if (target === yearNext) return stepYear(1);
      if (target === addEl) {
        if (state.rows.length >= MAX_RULES) return;
        state.rows.push(blankRow());
        renderRows({ row: state.rows.length - 1, parts: ["name"] });
        return;
      }
      const found = locate(target);
      if (!found || !(found.node instanceof HTMLButtonElement)) return;
      if (found.node.disabled) return;
      const { i, key } = found;
      if (key === "up") move(i, -1, ["up", "down"]);
      else if (key === "down") move(i, 1, ["down", "up"]);
      else if (key === "remove") {
        state.rows.splice(i, 1);
        renderRows(
          state.rows.length === 0 ? "add" : { row: i, parts: ["remove"] },
        );
      }
    },
    { signal },
  );

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

/** A string safe inside a `RegExp`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The folded summary line of a policy text. */
function policySummaryOf(text: string): string {
  return policySummary(parsePolicyText(text) ?? {});
}

export const mountHolidayRuleBuilder: MountFn<HolidayRuleBuilderArgs> = async (
  root,
  args,
  signal,
) => {
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

// The month's name, a policy's text and a policy select's id, for the tests and the chat tool.
export { monthName };
export { formatPolicyText };
export { policySelectId };
