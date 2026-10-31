/**
 * Pure helpers the three holiday tools share: the Holiday Rule Builder, the
 * Observance Comparator and Moving Feasts.
 *
 * - `attributeRules`: per rule, each unshifted date and its observed date, plus
 *   the full calendar, all read from the library.
 * - `marksFromAttribution`, `cellKinds`, `markSentence`: the marks on the
 *   month grid.
 * - `policyTextFromSelects`, `policySummary`: the policy a row of weekday
 *   selects spells.
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

interface RuleAttribution {
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
function walksOn(policy: ObservancePolicy, date: string): boolean {
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
  return { full, rows: attributeRows(lib, spec, year) };
}

/**
 * The `rows` of `attributeRules` alone, for a caller that never reads `full` (it is the
 * costliest call, and building a calendar for it is wasted work when only the pairs are drawn).
 */
export function attributeRows(
  lib: HolidayLib,
  spec: AttributionSpec,
  year: number,
): RuleAttribution[] {
  const { timeZone, weekend, rules } = spec;
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
  return rules.map((rule, i): RuleAttribution => ({
    valid: lib.isValidHolidayRule(rule),
    pairs: allPairs[i]!.filter(
      ({ unshifted, observed }) =>
        yearOf(unshifted) === year || yearOf(observed) === year,
    ),
  }));
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

export function weekdayList(weekend: readonly number[]): string {
  const names = [...weekend]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LONG[d - 1])
    .filter((name): name is string => name !== undefined);
  return names.length === 0 ? "none" : names.join(", ");
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
type PolicySelectValue = string;

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
