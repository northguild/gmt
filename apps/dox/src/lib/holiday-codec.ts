/**
 * Text codecs the three holiday tools share: an observance policy as a short
 * line of tokens, and a holiday rule as one `;`-separated line.
 *
 * These turn a library value into text and back, so a rule can sit in a
 * permalink, a chat seed or a text field. They are not library rules: neither
 * decides whether a policy or a rule means anything. `parsePolicyText` and
 * `parseRuleLine` return `null` only for text they cannot read; a reader sees
 * the field's error then. A shift onto its own weekday, a month 13 or a date
 * that does not exist all parse, and the library judges them (`observedDate`
 * gives `""`, `isValidHolidayRule` gives `false`), which is what the widget
 * draws.
 *
 * No gmt import (types only) and no DOM.
 */
import type {
  CalendarSystem,
  HolidayRule,
  IsoWeekday,
  ObservancePolicy,
  WeekdayOrdinal,
} from "@northguild/gmt";

/** The Builder's row limit, and the cap on chat and permalink seeds. It keeps
 *  12 rows readable and the `rules` permalink key under its cap. */
export const MAX_RULES = 12;

const WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

// ---------------------------------------------------------------------------
// Policy text
// ---------------------------------------------------------------------------

const POLICY_TOKEN = /^([1-7])(?:<([1-7])|>([1-7])|(w))$/;

/**
 * Policy text to a policy: space-separated tokens, `6<5` for
 * `{ 6: { previous: 5 } }`, `7>1` for `{ 7: { next: 1 } }` and `7w` for
 * `{ 7: "nextWorkingDay" }`. `""` is `{}`. `null` for any token it cannot
 * read, and for a weekday named twice.
 */
export function parsePolicyText(text: string): ObservancePolicy | null {
  const policy: ObservancePolicy = {};
  const trimmed = text.trim();
  if (trimmed === "") return policy;
  for (const token of trimmed.split(/\s+/)) {
    const match = POLICY_TOKEN.exec(token);
    if (match === null) return null;
    const weekday = Number(match[1]) as IsoWeekday;
    if (policy[weekday] !== undefined) return null;
    if (match[2] !== undefined) {
      policy[weekday] = { previous: Number(match[2]) as IsoWeekday };
    } else if (match[3] !== undefined) {
      policy[weekday] = { next: Number(match[3]) as IsoWeekday };
    } else {
      policy[weekday] = "nextWorkingDay";
    }
  }
  return policy;
}

/** A policy as text, tokens in ascending weekday order. `{}` is `""`. A shift
 *  of a shape the type does not allow is left out. */
export function formatPolicyText(policy: ObservancePolicy): string {
  const tokens: string[] = [];
  for (const weekday of WEEKDAYS) {
    const shift = policy[weekday];
    if (shift === undefined) continue;
    if (shift === "nextWorkingDay") {
      tokens.push(`${weekday}w`);
    } else if (typeof shift === "object" && shift !== null) {
      if ("previous" in shift) tokens.push(`${weekday}<${shift.previous}`);
      else if ("next" in shift) tokens.push(`${weekday}>${shift.next}`);
    }
  }
  return tokens.join(" ");
}

// ---------------------------------------------------------------------------
// Rule lines
// ---------------------------------------------------------------------------

/** A name as the line carries it: no `;`, newline or comma (those are the
 *  line's and the date list's separators), and no outer space. */
export function cleanRuleName(name: string): string {
  return name.replace(/[;,\r\n]/g, "").trim();
}

const INTEGER = /^-?\d+$/;
const MONTH_DAY = /^(\d{1,2})-(\d{1,2})$/;
const ORDINALS: readonly string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "-1",
  "-2",
  "-3",
  "-4",
  "-5",
  "last",
];

function integer(text: string): number | null {
  return INTEGER.test(text) ? Number(text) : null;
}

/** The `observed` of a line's last field: left out for a blank policy. */
function observedField(
  text: string | undefined,
): { observed?: ObservancePolicy } | null {
  if (text === undefined || text.trim() === "") return {};
  const policy = parsePolicyText(text);
  return policy === null ? null : { observed: policy };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * One rule line to a rule: `name;kind;fields…[;policy]`.
 *
 * - `name;f;MM-DD[;policy]` is `fixed`;
 * - `name;c;calendar;monthCode;day[;policy]` is `calendarFixed`;
 * - `name;n;month;weekday;ordinal` is `nthWeekday` (`ordinal` is `1`..`5`,
 *   `-1`..`-5` or `last`);
 * - `name;e;offset[;j]` is `easterRelative` (`j` means the Julian computus);
 * - `name;d;date,date,…` is `dates`.
 *
 * A blank policy is left out of the rule, never filled in. `null` for a line
 * it cannot read. Validity is the library's to decide.
 */
export function parseRuleLine(line: string): HolidayRule | null {
  const parts = line.split(";").map((part) => part.trim());
  const name = parts[0];
  const kind = parts[1];
  if (name === undefined || kind === undefined) return null;
  const rest = parts.slice(2);
  switch (kind) {
    case "f": {
      if (rest.length < 1 || rest.length > 2) return null;
      const md = MONTH_DAY.exec(rest[0]!);
      const observed = observedField(rest[1]);
      if (md === null || observed === null) return null;
      return {
        name,
        kind: "fixed",
        month: Number(md[1]),
        day: Number(md[2]),
        ...observed,
      };
    }
    case "c": {
      if (rest.length < 3 || rest.length > 4) return null;
      const day = integer(rest[2]!);
      const observed = observedField(rest[3]);
      if (rest[0] === "" || rest[1] === "" || day === null || observed === null)
        return null;
      return {
        name,
        kind: "calendarFixed",
        calendar: rest[0] as CalendarSystem,
        monthCode: rest[1]!,
        day,
        ...observed,
      };
    }
    case "n": {
      if (rest.length !== 3) return null;
      const month = integer(rest[0]!);
      const weekday = rest[1]!;
      const ordinal = rest[2]!;
      if (month === null || !/^[1-7]$/.test(weekday)) return null;
      if (!ORDINALS.includes(ordinal)) return null;
      return {
        name,
        kind: "nthWeekday",
        month,
        weekday: Number(weekday) as IsoWeekday,
        n: (ordinal === "last" ? "last" : Number(ordinal)) as WeekdayOrdinal,
      };
    }
    case "e": {
      if (rest.length < 1 || rest.length > 2) return null;
      const offsetDays = integer(rest[0]!);
      if (offsetDays === null) return null;
      if (rest.length === 1)
        return { name, kind: "easterRelative", offsetDays };
      if (rest[1] !== "j") return null;
      return { name, kind: "easterRelative", offsetDays, computus: "julian" };
    }
    case "d": {
      if (rest.length !== 1) return null;
      const dates = rest[0]!
        .split(",")
        .map((date) => date.trim())
        .filter((date) => date !== "");
      return { name, kind: "dates", dates };
    }
    default:
      return null;
  }
}

/** A rule as one line. The inverse of `parseRuleLine` for any rule the editor
 *  makes: `parseRuleLine(formatRuleLine(rule))` equals the rule, except that an
 *  empty policy and a gregorian `computus` come back left out. */
export function formatRuleLine(rule: HolidayRule): string {
  const name = cleanRuleName(rule.name);
  const policy = (observed: ObservancePolicy | undefined): string[] => {
    const text = observed === undefined ? "" : formatPolicyText(observed);
    return text === "" ? [] : [text];
  };
  switch (rule.kind) {
    case "fixed":
      return [
        name,
        "f",
        `${pad2(rule.month)}-${pad2(rule.day)}`,
        ...policy(rule.observed),
      ].join(";");
    case "calendarFixed":
      return [
        name,
        "c",
        rule.calendar,
        rule.monthCode,
        String(rule.day),
        ...policy(rule.observed),
      ].join(";");
    case "nthWeekday":
      return [
        name,
        "n",
        String(rule.month),
        String(rule.weekday),
        String(rule.n),
      ].join(";");
    case "easterRelative":
      return [
        name,
        "e",
        String(rule.offsetDays),
        ...(rule.computus === "julian" ? ["j"] : []),
      ].join(";");
    case "dates":
      return [name, "d", rule.dates.join(",")].join(";");
  }
}

/** Rule lines to rules, one slot per non-empty line (`null` where a line
 *  cannot be read), cut at `MAX_RULES`. */
export function parseRuleLines(text: string): (HolidayRule | null)[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, MAX_RULES)
    .map(parseRuleLine);
}

/** Rules as lines, cut at `MAX_RULES`. */
export function formatRuleLines(rules: readonly HolidayRule[]): string {
  return rules.slice(0, MAX_RULES).map(formatRuleLine).join("\n");
}
