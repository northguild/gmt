/**
 * Pure helpers the three holiday tools share: the Holiday Rule Builder, the
 * Observance Comparator and Moving Feasts.
 *
 * - `attributeRules`: per rule, each unshifted date and its observed date, plus
 *   the full calendar, all read from the library.
 * - `marksFromAttribution`, `monthGridHtml`, `weekRowsHtml`, `legendHtml`: the
 *   month grid and its marks.
 * - `policyEditorHtml`: seven native selects, one per weekday.
 *
 * No DOM. Every function that reads the library takes a `HolidayLib`
 * (`holiday-lib.ts`) as its first argument, loaded by the mount from the real
 * package, so the tests inject the real library by module path.
 *
 * A widget draws the library's results and computes none of them. The
 * polyfill is imported for drawing only: which column a date sits in, the
 * length of a month, the weekday a chip names, and so which weekday's entry of
 * a policy an occurrence reads. Choosing the year of a returned string compares
 * its year field, which is drawing too. No shift, no Easter and no closure is
 * worked out here.
 *
 * GMT tracks no law, and the UI names no body: no string here names a country,
 * a statute or an operator.
 */

import { Temporal } from "@js-temporal/polyfill";
import type {
  BusinessCalendar,
  BusinessCalendarSpec,
  HolidayRule,
  IsoWeekday,
  ObservancePolicy,
} from "@northguild/gmt";
import type { HolidayLib } from "./holiday-lib";
import { escapeAttr, escapeHtml } from "./widget-ui";

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

const ISO_WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Short English name of an ISO weekday, `"Mon"` to `"Sun"`. */
export function weekdayShort(weekday: number): string {
  return WEEKDAY_SHORT[weekday - 1] ?? "";
}

/** English name of an ISO month, `"January"` to `"December"`. */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

/** What `attributeRules` needs of a calendar spec: the years are its own. */
export type AttributionSpec = Pick<
  BusinessCalendarSpec,
  "timeZone" | "weekend" | "rules"
>;

/** One occurrence of a rule: where it falls, and where it is observed. */
export interface RulePair {
  /** The occurrence's own date. */
  unshifted: string;
  /** Where the rule's policy observes it. The same date when nothing shifts
   *  it, and `""` when the library could not place it (NO SIGNAL). */
  observed: string;
  /** The policy walks this occurrence to the next working day, so its
   *  `observedDate` call read a calendar (`walksOn`). */
  walks: boolean;
}

export interface RuleAttribution {
  /** `isValidHolidayRule`'s answer for this rule. */
  valid: boolean;
  /** Every occurrence with its unshifted or its observed date in the year,
   *  ascending by unshifted date. */
  pairs: RulePair[];
}

export interface Attribution {
  /** The whole calendar for the year. `null` when the span or a shift failed. */
  full: BusinessCalendar | null;
  rows: RuleAttribution[];
}

/** The year field of an ISO date string the library returned. */
function yearOf(date: string): number {
  return Number.parseInt(date, 10);
}

/** A rule without its policy: the occurrence itself, before any shift. */
function withoutObserved(rule: HolidayRule): HolidayRule {
  if (rule.kind !== "fixed" && rule.kind !== "calendarFixed") return rule;
  const { observed: _observed, ...plain } = rule;
  return plain;
}

/** A rule's policy, or `undefined` when it has none. */
function policyOf(rule: HolidayRule): ObservancePolicy | undefined {
  return "observed" in rule ? rule.observed : undefined;
}

/** Whether a policy walks a date to the next working day: the entry for the
 *  date's weekday is `"nextWorkingDay"`. */
export function walksOn(policy: ObservancePolicy, date: string): boolean {
  return (
    typeof policy === "object" &&
    policy !== null &&
    policy[weekdayOfDate(date)] === "nextWorkingDay"
  );
}

/** A policy without its `"nextWorkingDay"` entries: the shifts that read no
 *  calendar. A value that is not an object is left for the library to judge. */
export function withoutWalks(policy: ObservancePolicy): ObservancePolicy {
  if (typeof policy !== "object" || policy === null) return policy;
  return Object.fromEntries(
    Object.entries(policy).filter(([, shift]) => shift !== "nextWorkingDay"),
  );
}

/**
 * Per rule, each occurrence's unshifted date and its observed date, plus the
 * full calendar. `buildBusinessCalendar` returns the closed dates but not which
 * rule closed each one, or where it moved from. This gets both from
 * `observedDate`, in the library's two passes, and never shifts a date itself:
 *
 * 1. Every occurrence that does not walk to the next working day is placed
 *    with the policy's other entries, which read no calendar.
 * 2. Rule by rule, in list order, the occurrences that walk are placed on one
 *    calendar per rule: the weekend, every date placed in step 1, and the walks
 *    of the rules before it.
 *
 * Two years before and one after are read as well, as the library reads them:
 * with `6<5`, 1 Jan 2028 falls on a Saturday and is observed on `2027-12-31`,
 * which belongs to 2027's grid, and a walk from a late-December date sees the
 * closings of the next January. Twelve rules (`MAX_RULES`) can chain their
 * walks across two year ends.
 *
 * `full` is the only authority on which days are closed. Marks come from it
 * (`marksFromAttribution`), never from `rows`.
 */
export function attributeRules(
  lib: HolidayLib,
  spec: AttributionSpec,
  year: number,
): Attribution {
  const { timeZone, weekend, rules } = spec;
  const full = lib.buildBusinessCalendar({
    timeZone,
    weekend,
    rules,
    years: { from: year, to: year },
  });
  const placed: string[] = [];
  const allPairs = rules.map((rule): RulePair[] => {
    const policy = policyOf(rule);
    const plain = withoutObserved(rule);
    const pairs: RulePair[] = [];
    for (let y = year - 2; y <= year + 1; y++) {
      for (const unshifted of lib.holidayDates(plain, y)) {
        const walks = policy !== undefined && walksOn(policy, unshifted);
        const observed =
          policy === undefined
            ? unshifted
            : walks
              ? ""
              : lib.observedDate(unshifted, withoutWalks(policy));
        if (!walks && observed !== "") placed.push(observed);
        pairs.push({ unshifted, observed, walks });
      }
    }
    return pairs;
  });
  rules.forEach((rule, i) => {
    const policy = policyOf(rule);
    const walking = allPairs[i]!.filter((pair) => pair.walks);
    if (policy === undefined || walking.length === 0) return;
    const calendar: BusinessCalendar = {
      timeZone,
      weekend,
      holidays: [...placed],
    };
    for (const pair of walking) {
      pair.observed = lib.observedDate(pair.unshifted, policy, calendar);
      if (pair.observed !== "") placed.push(pair.observed);
    }
  });
  const rows = rules.map((rule, i): RuleAttribution => ({
    valid: lib.isValidHolidayRule(rule),
    pairs: allPairs[i]!.filter(
      ({ unshifted, observed }) =>
        yearOf(unshifted) === year || yearOf(observed) === year,
    ),
  }));
  return { full, rows };
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

/** One of the site's four series colours. */
export type SeriesNumber = 1 | 2 | 3 | 4;

/** The five things a cell can say. Each has a word in the legend and a
 *  pattern, never a colour alone. */
export type MarkKind =
  | "closed"
  | "weekend"
  | "moved-from"
  | "moved-to"
  | "pick";

export const MARK_KINDS: readonly MarkKind[] = [
  "closed",
  "weekend",
  "moved-from",
  "moved-to",
  "pick",
];

export const MARK_WORDS: Record<MarkKind, string> = {
  closed: "Closed",
  weekend: "Weekend",
  "moved-from": "Moved from (not closed)",
  "moved-to": "Moved to",
  pick: "Picked",
};

/** What a grid draws on one date. A date with no entry is a bare cell. */
export interface CellMark {
  /** The full calendar closes this date. */
  closed?: boolean;
  /** A holiday was here and moved: a ghost. Drawn only on a cell that is not
   *  closed. */
  movedFrom?: boolean;
  /** A holiday moved here, from this ISO weekday. */
  movedTo?: IsoWeekday;
  /** Moving Feasts: this date is a pick, in this series. */
  pick?: SeriesNumber;
  /** The 1-based numbers of the rules that put a holiday here, ascending. */
  rules?: readonly number[];
  /** Moving Feasts: short chip labels a date carries (an offset, an ordinal).
   *  They are drawn as given and read nowhere else. */
  chips?: readonly string[];
  /** Moving Feasts: what the date is, in words, for the hidden list. */
  words?: readonly string[];
}

function isoDay(date: Temporal.PlainDate): string {
  return date.toString();
}

function weekdayOfDate(date: string): IsoWeekday {
  return Temporal.PlainDate.from(date).dayOfWeek as IsoWeekday;
}

/**
 * The marks of one year's grid.
 *
 * - **closed** comes from the library: a date is closed when `isBusinessDay`
 *   says it is not, on the full calendar with its weekend taken away, so a
 *   closed holiday that falls on a weekend is still a holiday.
 * - **moved-to** and **moved-from** come from the rows' pairs, the only thing
 *   the rows are used for. A ghost is left off a date another rule closes.
 * - **rules** are the rule numbers of the pairs that land on a date.
 *
 * A `null` full calendar gives no closed cells; the caller draws NO SIGNAL.
 */
export function marksFromAttribution(
  lib: HolidayLib,
  attribution: Attribution,
  year: number,
): Record<string, CellMark> {
  const marks: Record<string, CellMark> = {};
  const get = (date: string): CellMark => (marks[date] ??= {});
  const { full } = attribution;
  if (full !== null) {
    const open: BusinessCalendar = { ...full, weekend: [] };
    const last = Temporal.PlainDate.from({ year, month: 12, day: 31 });
    for (
      let day = Temporal.PlainDate.from({ year, month: 1, day: 1 });
      Temporal.PlainDate.compare(day, last) <= 0;
      day = day.add({ days: 1 })
    ) {
      const date = isoDay(day);
      if (!lib.isBusinessDay(date, open)) get(date).closed = true;
    }
  }
  attribution.rows.forEach((row, i) => {
    const number = i + 1;
    for (const { unshifted, observed } of row.pairs) {
      const target = observed === "" ? unshifted : observed;
      const rules = new Set(get(target).rules ?? []);
      rules.add(number);
      get(target).rules = [...rules].sort((a, b) => a - b);
      if (observed !== "" && observed !== unshifted) {
        get(observed).movedTo = weekdayOfDate(unshifted);
        get(unshifted).movedFrom = true;
      }
    }
  });
  for (const mark of Object.values(marks)) {
    if (mark.closed === true) delete mark.movedFrom;
  }
  return marks;
}

/** The kinds a cell shows, in legend order. */
export function cellKinds(
  mark: CellMark | undefined,
  isWeekend: boolean,
): MarkKind[] {
  const kinds: MarkKind[] = [];
  if (mark?.closed === true) kinds.push("closed");
  if (isWeekend) kinds.push("weekend");
  if (mark?.movedFrom === true) kinds.push("moved-from");
  if (mark?.movedTo !== undefined) kinds.push("moved-to");
  if (mark?.pick !== undefined) kinds.push("pick");
  return kinds;
}

/** Whether a mark says anything at all (a weekend alone does not). */
export function isMarked(mark: CellMark | undefined): boolean {
  return (
    mark !== undefined &&
    (mark.closed === true ||
      mark.movedFrom === true ||
      mark.movedTo !== undefined ||
      mark.pick !== undefined ||
      (mark.words?.length ?? 0) > 0)
  );
}

// ---------------------------------------------------------------------------
// Cells, month grid, week rows
// ---------------------------------------------------------------------------

/** The sentence a marked date reads out: for the list a grid carries. */
export function markSentence(
  date: string,
  mark: CellMark,
  isWeekend: boolean,
): string {
  const parts: string[] = [];
  if (mark.closed === true) parts.push("closed");
  if (isWeekend) parts.push("weekend");
  if (mark.movedFrom === true) parts.push("a holiday moved from here");
  if (mark.movedTo !== undefined) {
    parts.push(`a holiday moved here from ${WEEKDAY_LONG[mark.movedTo - 1]}`);
  }
  if (mark.pick !== undefined) parts.push(`series ${mark.pick} pick`);
  if (mark.rules !== undefined && mark.rules.length > 0) {
    parts.push(`rule ${mark.rules.join(", ")}`);
  }
  for (const word of mark.words ?? []) parts.push(word);
  const d = Temporal.PlainDate.from(date);
  return `${WEEKDAY_LONG[d.dayOfWeek - 1]} ${d.day} ${MONTH_NAMES[d.month - 1]} ${d.year}: ${parts.join("; ")}`;
}

interface CellOptions {
  marks: Readonly<Record<string, CellMark | undefined>>;
  weekend: readonly number[];
  today?: string;
  /** Write the month beside the day number ("15 Jun"), for a week strip. */
  withMonth?: boolean;
  /** The cell lies outside the range a week strip was asked for. */
  outside?: boolean;
}

function cellHtml(date: Temporal.PlainDate, o: CellOptions): string {
  const key = isoDay(date);
  const mark = o.marks[key];
  const isWeekend = o.weekend.includes(date.dayOfWeek);
  const kinds = cellKinds(mark, isWeekend);
  const label = o.withMonth
    ? `${date.day} ${MONTH_SHORT[date.month - 1]}`
    : String(date.day);
  const chips = [
    ...(mark?.rules ?? []).map(
      (n) =>
        `<span class="gmt-holiday-chip gmt-holiday-chip--rule">${n}</span>`,
    ),
    ...(mark?.chips ?? []).map(
      (text) =>
        `<span class="gmt-holiday-chip gmt-holiday-chip--tag">${escapeHtml(text)}</span>`,
    ),
    mark?.movedTo === undefined
      ? ""
      : `<span class="gmt-holiday-chip gmt-holiday-chip--from">↩ ${weekdayShort(mark.movedTo)}</span>`,
  ].join("");
  return (
    `<div class="gmt-holiday-cell" data-date="${key}"` +
    ` data-kinds="${kinds.join(" ")}"` +
    (isWeekend ? " data-weekend" : "") +
    (o.today === key ? " data-today" : "") +
    (o.outside ? " data-outside" : "") +
    (mark?.pick === undefined ? "" : ` data-series="${mark.pick}"`) +
    `>` +
    `<span class="gmt-holiday-day">${escapeHtml(label)}</span>` +
    (chips === "" ? "" : `<span class="gmt-holiday-chips">${chips}</span>`) +
    `</div>`
  );
}

const BLANK_CELL = `<div class="gmt-holiday-cell" data-blank></div>`;

function weekdayHeaderHtml(): string {
  return (
    `<div class="gmt-holiday-weekdays">` +
    WEEKDAY_SHORT.map(
      (name) =>
        `<span class="gmt-holiday-wd"><span class="gmt-holiday-wd-long">${name}</span>` +
        `<span class="gmt-holiday-wd-short">${name[0]}</span></span>`,
    ).join("") +
    `</div>`
  );
}

/** The visually hidden list of every marked date, one sentence each. */
function hiddenListHtml(
  dates: readonly string[],
  o: Pick<CellOptions, "marks" | "weekend">,
): string {
  const items = dates.flatMap((date) => {
    const mark = o.marks[date];
    if (!isMarked(mark)) return [];
    const isWeekend = o.weekend.includes(
      Temporal.PlainDate.from(date).dayOfWeek,
    );
    return [`<li>${escapeHtml(markSentence(date, mark!, isWeekend))}</li>`];
  });
  return (
    `<ul class="gmt-holiday-visually-hidden" data-role="holiday-marks">` +
    items.join("") +
    `</ul>`
  );
}

export interface MonthGridOptions {
  year: number;
  /** The months to draw, inclusive: 1 to 12 for the Builder, a short run or a
   *  single month for Moving Feasts. */
  months: { from: number; to: number };
  marks: Readonly<Record<string, CellMark | undefined>>;
  /** ISO weekdays that are closed every week. */
  weekend: readonly number[];
  /** A date to ring as today. */
  today?: string;
}

/**
 * Months as ISO weeks, Monday first, with six week rows in every month so a
 * month never changes height. Each day sits where `PlainDate#dayOfWeek` puts
 * it.
 *
 * The grid is `role="img"` with an `aria-label`, and a visually hidden list
 * after it names every marked date and what it is. A month with no marks
 * carries `data-empty` and a line reading "No holidays in <month>", which the
 * sheet shows under the rows in the one-column layout. Every month reserves
 * that line and keeps its six rows, so no month changes height with the marks.
 */
export function monthGridHtml(o: MonthGridOptions): string {
  const from = Math.max(1, Math.min(12, o.months.from));
  const to = Math.max(from, Math.min(12, o.months.to));
  const dates: string[] = [];
  const months: string[] = [];
  for (let month = from; month <= to; month++) {
    const first = Temporal.PlainDate.from({ year: o.year, month, day: 1 });
    const lead = first.dayOfWeek - 1;
    const monthDates: string[] = [];
    const weeks: string[] = [];
    for (let week = 0; week < 6; week++) {
      const cells: string[] = [];
      for (let col = 0; col < 7; col++) {
        const dayNumber = week * 7 + col - lead + 1;
        if (dayNumber < 1 || dayNumber > first.daysInMonth) {
          cells.push(BLANK_CELL);
        } else {
          const date = first.with({ day: dayNumber });
          monthDates.push(isoDay(date));
          cells.push(cellHtml(date, o));
        }
      }
      weeks.push(`<div class="gmt-holiday-week">${cells.join("")}</div>`);
    }
    dates.push(...monthDates);
    const empty = !monthDates.some((date) => isMarked(o.marks[date]));
    months.push(
      `<section class="gmt-holiday-month" data-month="${month}"` +
        (empty ? ' data-empty="true"' : "") +
        `>` +
        `<h4 class="gmt-holiday-month-name">${monthName(month)}</h4>` +
        weekdayHeaderHtml() +
        weeks.join("") +
        `<p class="gmt-holiday-month-empty">No holidays in ${monthName(month)}</p>` +
        `</section>`,
    );
  }
  const span =
    from === to
      ? `${monthName(from)} ${o.year}`
      : `${monthName(from)} to ${monthName(to)} ${o.year}`;
  const weekendWords = weekdayList(o.weekend);
  return (
    `<div class="gmt-holiday-grid" data-gate="grid" data-year="${o.year}">` +
    `<div class="gmt-holiday-months" role="img"` +
    ` aria-label="${escapeAttr(`Calendar, ${span}. Weekend: ${weekendWords}. The marked dates follow in the list.`)}">` +
    months.join("") +
    `</div>` +
    hiddenListHtml(dates, o) +
    `</div>`
  );
}

export function weekdayList(weekend: readonly number[]): string {
  const names = [...weekend]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LONG[d - 1])
    .filter((name): name is string => name !== undefined);
  return names.length === 0 ? "none" : names.join(", ");
}

/**
 * The same cells as a strip of whole ISO weeks: from the Monday of `from`'s
 * week to the Sunday of `to`'s. A day outside `from .. to` is drawn dimmed
 * (`data-outside`), so the strip always starts and ends on a week. The day
 * label carries its month ("15 Jun").
 */
export function weekRowsHtml(
  from: string,
  to: string,
  marks: Readonly<Record<string, CellMark | undefined>>,
  weekend: readonly number[] = [],
  today?: string,
): string {
  const start = Temporal.PlainDate.from(from);
  const end = Temporal.PlainDate.from(to);
  const first = start.subtract({ days: start.dayOfWeek - 1 });
  const last = end.add({ days: 7 - end.dayOfWeek });
  const dates: string[] = [];
  const weeks: string[] = [];
  for (
    let monday = first;
    Temporal.PlainDate.compare(monday, last) <= 0;
    monday = monday.add({ days: 7 })
  ) {
    const cells: string[] = [];
    for (let col = 0; col < 7; col++) {
      const day = monday.add({ days: col });
      dates.push(isoDay(day));
      cells.push(
        cellHtml(day, {
          marks,
          weekend,
          today,
          withMonth: true,
          outside:
            Temporal.PlainDate.compare(day, start) < 0 ||
            Temporal.PlainDate.compare(day, end) > 0,
        }),
      );
    }
    weeks.push(`<div class="gmt-holiday-week">${cells.join("")}</div>`);
  }
  return (
    `<div class="gmt-holiday-strip">` +
    weekdayHeaderHtml() +
    `<div class="gmt-holiday-months" role="img"` +
    ` aria-label="${escapeAttr(`Weeks from ${isoDay(first)} to ${isoDay(last)}. Weekend: ${weekdayList(weekend)}. The marked dates follow in the list.`)}">` +
    weeks.join("") +
    `</div>` +
    hiddenListHtml(dates, { marks, weekend }) +
    `</div>`
  );
}

/** The legend: a swatch in the pattern of each kind and its word. */
export function legendHtml(kinds: readonly MarkKind[] = MARK_KINDS): string {
  return (
    `<ul class="gmt-holiday-legend">` +
    kinds
      .map(
        (kind) =>
          `<li data-kind="${kind}"><span class="gmt-holiday-swatch" data-kind="${kind}"` +
          ` aria-hidden="true"></span>${escapeHtml(MARK_WORDS[kind])}</li>`,
      )
      .join("") +
    `</ul>`
  );
}

// ---------------------------------------------------------------------------
// Policy editor
// ---------------------------------------------------------------------------

/**
 * The value of a policy select: `""` for no shift, `"<5"` for the Friday
 * before, `">1"` for the Monday after, `"w"` for the next working day. A
 * policy's token is the weekday followed by this value, so the editor reads to
 * policy text and back through the codec.
 */
export type PolicySelectValue = string;

/** A weekday's select value for a policy. */
export function selectValueOf(
  policy: ObservancePolicy,
  weekday: IsoWeekday,
): PolicySelectValue {
  const shift = policy[weekday];
  if (shift === undefined) return "";
  if (shift === "nextWorkingDay") return "w";
  if (typeof shift === "object" && shift !== null) {
    if ("previous" in shift) return `<${shift.previous}`;
    if ("next" in shift) return `>${shift.next}`;
  }
  return "";
}

/** Policy text for seven select values, in ascending weekday order. */
export function policyTextFromSelects(
  values: Partial<Record<IsoWeekday, PolicySelectValue>>,
): string {
  return ISO_WEEKDAYS.flatMap((weekday) => {
    const value = values[weekday];
    return value === undefined || value === "" ? [] : [`${weekday}${value}`];
  }).join(" ");
}

/** The folded line: "Sat → Fri, Sun → Mon", or "No shift". */
export function policySummary(policy: ObservancePolicy): string {
  const parts = ISO_WEEKDAYS.flatMap((weekday) => {
    const value = selectValueOf(policy, weekday);
    if (value === "") return [];
    const target =
      value === "w" ? "next working day" : weekdayShort(Number(value.slice(1)));
    return [`${weekdayShort(weekday)} → ${target}`];
  });
  return parts.length === 0 ? "No shift" : parts.join(", ");
}

function optionHtml(value: string, label: string, selected: boolean): string {
  return `<option value="${escapeAttr(value)}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function optionLabel(value: PolicySelectValue): string {
  if (value === "") return "no shift";
  if (value === "w") return "next working day";
  return `${value[0] === "<" ? "previous" : "next"} ${weekdayShort(Number(value.slice(1)))}`;
}

export interface PolicyEditorOptions {
  /** Makes each select's id unique on the page. */
  idPrefix: string;
  policy: ObservancePolicy;
  /** Draw the details closed, under 30rem. */
  folded?: boolean;
}

/**
 * Seven native `<select>`s, one per ISO weekday. Each offers no shift, the
 * previous and the next of every other weekday, and the next working day; the
 * weekday's own day is left out of its previous and next options. A policy a
 * select cannot offer (a shift onto its own weekday, read from a link) keeps
 * its option, so the editor never shows "no shift" for a policy that has one;
 * the library judges it.
 *
 * The controls sit in a native `<details>` whose summary is the folded line.
 */
export function policyEditorHtml(o: PolicyEditorOptions): string {
  const selects = ISO_WEEKDAYS.map((weekday) => {
    const current = selectValueOf(o.policy, weekday);
    const offered: string[] = [""];
    for (const other of ISO_WEEKDAYS) {
      if (other !== weekday) offered.push(`<${other}`);
    }
    for (const other of ISO_WEEKDAYS) {
      if (other !== weekday) offered.push(`>${other}`);
    }
    offered.push("w");
    if (!offered.includes(current)) offered.push(current);
    const id = `${o.idPrefix}-${weekday}`;
    return (
      `<label class="gmt-label gmt-holiday-policy-day" for="${escapeAttr(id)}">` +
      `<span class="gmt-label-text">${weekdayShort(weekday)}</span>` +
      `<select class="gmt-select" id="${escapeAttr(id)}" data-weekday="${weekday}">` +
      offered
        .map((value) =>
          optionHtml(value, optionLabel(value), value === current),
        )
        .join("") +
      `</select></label>`
    );
  });
  return (
    `<details class="gmt-holiday-policy"${o.folded === true ? "" : " open"}>` +
    `<summary class="gmt-holiday-policy-summary">${escapeHtml(policySummary(o.policy))}</summary>` +
    `<div class="gmt-holiday-policy-grid">${selects.join("")}</div>` +
    `</details>`
  );
}
