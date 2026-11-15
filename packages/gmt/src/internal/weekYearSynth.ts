import { Temporal } from "./temporal";
import {
  digitRuns,
  type RepairedText,
  type WeekYearAnalysis,
} from "./weekYearText";

/*
 * CORE-112 (defect D23): `formatToParts` for a formatter whose parts must never reach the engine.
 *
 * On a V8 without commit 0426b0d1045d, `formatToParts` aborts the process (nodejs/node#67076,
 * SIGTRAP, uncatchable) on a pattern with the week-year field `Y`. The parts are built here from
 * the repaired `format` text: the numeric fields from the digit runs, every text field from the
 * parts of year-free twin formatters (same locale, calendar, numbering system and zone), which
 * hold no `Y`. Deleting this file retires the parts half of the workaround (the D23 canary says
 * when).
 */

/** Option names of the time fields. */
const TIME_KEYS = [
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
  "timeZoneName",
  "timeStyle",
] as const;

const LETTER = /\p{L}|\p{M}/u;
/** Part types a twin supplies by digit run, not by text. */
const NUMERIC_TYPES = new Set([
  "literal",
  "day",
  "hour",
  "minute",
  "second",
  "fractionalSecond",
  "year",
  "relatedYear",
  "yearName",
]);

type Part = Intl.DateTimeFormatPart;
type Candidate = {
  type: string;
  key: string;
  value: string;
  numeric: boolean;
};
type Twin = {
  format: Intl.DateTimeFormat;
  index: number;
  numeric: boolean;
};
type Field = { type: string; keys: string[] };

/** The widths a text field is printed in: the formatter's own, unless a style could print any. */
function widthsOf<K extends "weekday" | "month">(
  options: Intl.DateTimeFormatOptions,
  key: K,
  all: NonNullable<Intl.DateTimeFormatOptions[K]>[],
): NonNullable<Intl.DateTimeFormatOptions[K]>[] {
  const styled =
    options.dateStyle !== undefined || options.timeStyle !== undefined;
  const own = options[key];
  return !styled && own !== undefined ? [own] : all;
}

/** Twins for the weekday, month and era fields, in every width the options can print. */
function textTwinOptions(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions[] {
  const out: Intl.DateTimeFormatOptions[] = [];
  for (const weekday of widthsOf(options, "weekday", ["long", "short"])) {
    out.push({ weekday }, { weekday, month: "long", day: "numeric" });
  }
  for (const month of widthsOf(options, "month", ["long", "short"])) {
    if (month !== "numeric" && month !== "2-digit") {
      out.push({ month }, { month, day: "numeric" });
    }
  }
  for (const era of options.era === undefined
    ? (["long", "short", "narrow"] as const)
    : [options.era]) {
    out.push({ era, month: "numeric", day: "numeric" });
  }
  for (const width of ["long", "short"] as const) {
    if (!out.some((o) => o.month === width && o.day !== undefined)) {
      out.push({ month: width, day: "numeric" });
    }
    if (!out.some((o) => o.weekday === width && o.month === undefined)) {
      out.push({ weekday: width });
    }
  }
  out.push(
    { month: "numeric", day: "numeric" },
    { month: "2-digit", day: "2-digit" },
  );
  return out;
}

/** The twin for the time fields of a formatter, or `null` when it prints none. */
function timeTwinOptions(
  options: Intl.DateTimeFormatOptions,
  hourCycle: string | undefined,
): Intl.DateTimeFormatOptions | null {
  if (!TIME_KEYS.some((key) => options[key] !== undefined)) {
    return null;
  }
  const time: Intl.DateTimeFormatOptions = {};
  for (const key of TIME_KEYS) {
    if (options[key] !== undefined && key !== "timeStyle") {
      Object.assign(time, { [key]: options[key] });
    }
  }
  if (options.timeStyle !== undefined) {
    time.hour = "numeric";
    time.minute = "numeric";
    if (options.timeStyle === "long" || options.timeStyle === "full") {
      time.timeZoneName = options.timeStyle === "full" ? "long" : "short";
    }
  }
  if (hourCycle !== undefined) {
    time.hourCycle = hourCycle as Intl.DateTimeFormatOptions["hourCycle"];
  }
  return time;
}

/** The twin options for a formatter: its text fields, in every width its options can print. */
function twinOptions(
  options: Intl.DateTimeFormatOptions,
  hourCycle: string | undefined,
): Intl.DateTimeFormatOptions[] {
  const time = timeTwinOptions(options, hourCycle);
  return time === null
    ? textTwinOptions(options)
    : [...textTwinOptions(options), time];
}

/**
 * The twins of a formatter that print no year. A twin that prints a year could hold `Y`, so it is
 * never asked for parts.
 */
function buildTwins(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): Twin[] {
  const twins: Twin[] = [];
  const common = {
    calendar: resolved.calendar,
    numberingSystem: resolved.numberingSystem,
    timeZone: resolved.timeZone,
  };
  for (const [index, own] of twinOptions(
    options,
    resolved.hourCycle,
  ).entries()) {
    try {
      const format = new Intl.DateTimeFormat(resolved.locale, {
        ...common,
        ...own,
      });
      if (format.resolvedOptions().year === undefined) {
        twins.push({
          format,
          index,
          numeric:
            (own.month === "numeric" || own.month === "2-digit") &&
            own.era === undefined,
        });
      }
    } catch {
      // A width this locale or calendar rejects supplies no candidates.
    }
  }
  return twins;
}

/** Every text and numeric value the twins print at `ms`, longest first. */
function candidatesFrom(twins: readonly Twin[], ms: number): Candidate[] {
  const out: Candidate[] = [];
  for (const { format, index, numeric } of twins) {
    for (const part of format.formatToParts(ms)) {
      if (part.type === "literal" || part.value.trim() === "") {
        continue;
      }
      const isNumber =
        numeric && (part.type === "month" || part.type === "day");
      if (isNumber || !NUMERIC_TYPES.has(part.type)) {
        out.push({
          type: part.type,
          key: `${index}:${part.type}`,
          value: part.value,
          numeric: isNumber,
        });
      }
    }
  }
  return out.sort((a, b) => b.value.length - a.value.length);
}

/**
 * Whether `value` at `at` in `span` starts and ends on a field boundary: one or two characters may
 * not begin or end inside a run of letters (the `d` of `de`).
 */
function fits(span: string, at: number, value: string): boolean {
  if (!span.startsWith(value, at)) {
    return false;
  }
  if (value.length > 2) {
    return true;
  }
  const last = value.at(-1) ?? "";
  const first = value[0] ?? "";
  return !(
    (LETTER.test(last) && LETTER.test(span[at + value.length] ?? "")) ||
    (LETTER.test(first) && LETTER.test(span[at - 1] ?? ""))
  );
}

/**
 * The template of a span: the text fields in order, found greedily from the candidates. `null`
 * when two field types claim the same longest text at one place: a type chosen on a tie would be
 * a guess, so a date where the names differ decides it (CORE-112 tie-break).
 */
function segment(
  spans: readonly string[],
  candidates: readonly Candidate[],
): Field[][] | null {
  const plan: Field[][] = [];
  for (const span of spans) {
    const fields: Field[] = [];
    for (let at = 0; at < span.length;) {
      const hits = candidates.filter((c) => fits(span, at, c.value));
      const longest = hits[0]?.value.length;
      if (longest === undefined) {
        at++;
        continue;
      }
      const best = hits.filter((c) => c.value.length === longest);
      if (new Set(best.map((c) => c.type)).size > 1) {
        return null;
      }
      fields.push({
        type: best[0]?.type ?? "literal",
        keys: best.map((c) => c.key),
      });
      at += longest;
    }
    plan.push(fields);
  }
  return plan;
}

/** The text cut at the numeric runs, and the numeric parts between. */
interface Spans {
  readonly spans: string[];
  readonly numbers: Part[];
}

/**
 * The extent of a numeric run widened to a twin's wider value for it (`1` printed as `01`), or
 * `null` when no twin value covers it.
 */
function widenRun(
  text: string,
  run: { start: number; end: number; text: string },
  label: string,
  candidates: readonly Candidate[],
  position: number,
): { start: number; end: number } | null {
  for (const c of candidates) {
    if (!c.numeric || c.type !== label || c.value === run.text) {
      continue;
    }
    const inside = c.value.indexOf(run.text);
    const from = run.start - inside;
    if (
      inside >= 0 &&
      from >= position &&
      text.slice(from, from + c.value.length) === c.value
    ) {
      return { start: from, end: from + c.value.length };
    }
  }
  return null;
}

/** The repaired text cut at its numeric runs, and the numeric parts between. */
function spansOf(
  analysis: WeekYearAnalysis,
  repaired: RepairedText,
  candidates: readonly Candidate[],
): Spans | null {
  const runs = digitRuns(repaired.text, analysis.digits);
  if (runs.length !== analysis.count) {
    return null;
  }
  const spans: string[] = [];
  const numbers: Part[] = [];
  let position = 0;
  for (const [index, run] of runs.entries()) {
    const label = analysis.labels[index];
    if (label === undefined || label === "literal" || label === "text") {
      continue;
    }
    const year = analysis.yearRuns.indexOf(index);
    const edit = year < 0 ? undefined : repaired.edits[year];
    const extent =
      edit ?? widenRun(repaired.text, run, label, candidates, position) ?? run;
    spans.push(repaired.text.slice(position, extent.start));
    numbers.push({
      type: label as Part["type"],
      value: repaired.text.slice(extent.start, extent.end),
    });
    position = extent.end;
  }
  spans.push(repaired.text.slice(position));
  return { spans, numbers };
}

/** The first dates the template is tried on: a month, a day and a time each. */
const TEMPLATE_DATES = [
  [1, 15, "10:20:30.456"],
  [1, 15, "22:20:30.456"],
  [3, 9, "22:20:30.456"],
  [5, 20, "03:20:30.456"],
  [8, 3, "15:20:30.456"],
] as const;

/** The time value of a template date in the formatter's calendar and zone. */
function templateMs(
  analysis: WeekYearAnalysis,
  anchor: number,
  [month, day, time]: (typeof TEMPLATE_DATES)[number],
): number {
  return Temporal.PlainDate.from({
    calendar: analysis.calendar,
    year: anchor,
    month,
    day,
  } as Temporal.PlainDateLike).toZonedDateTime({
    timeZone: analysis.timeZone,
    plainTime: time,
  }).epochMilliseconds;
}

/**
 * Finds a field's value in a span at or after `position`: the earliest hit, the longer on a tie.
 * `null` when none of its keys finds one.
 */
function placeField(
  span: string,
  position: number,
  field: Field,
  values: ReadonlyMap<string, string>,
): { at: number; found: string } | null {
  let best: { at: number; found: string } | null = null;
  for (const key of field.keys) {
    const value = values.get(key);
    if (value === undefined) {
      continue;
    }
    for (
      let i = span.indexOf(value, position);
      i >= 0;
      i = span.indexOf(value, i + 1)
    ) {
      if (fits(span, i, value)) {
        if (
          best === null ||
          i < best.at ||
          (i === best.at && value.length > best.found.length)
        ) {
          best = { at: i, found: value };
        }
        break;
      }
    }
  }
  return best;
}

/** One span's parts: its template fields, the literals between, and the numeric part after. */
function partsOfSpan(
  span: string,
  fields: readonly Field[],
  values: ReadonlyMap<string, string>,
  number: Part | undefined,
): Part[] | null {
  const parts: Part[] = [];
  let position = 0;
  for (const field of fields) {
    const hit = placeField(span, position, field, values);
    if (hit === null) {
      return null;
    }
    if (hit.at > position) {
      parts.push({ type: "literal", value: span.slice(position, hit.at) });
    }
    parts.push({ type: field.type as Part["type"], value: hit.found });
    position = hit.at + hit.found.length;
  }
  if (position < span.length) {
    parts.push({ type: "literal", value: span.slice(position) });
  }
  if (number !== undefined) {
    parts.push(number);
  }
  return parts;
}

/** Adjacent literals joined into one. */
function mergeLiterals(parts: readonly Part[]): Part[] {
  const merged: Part[] = [];
  for (const part of parts) {
    const last = merged.at(-1);
    if (last?.type === "literal" && part.type === "literal") {
      last.value += part.value;
    } else {
      merged.push({ ...part });
    }
  }
  return merged;
}

/**
 * Parts of one flagged formatter, from its repaired `format` text and its twins.
 *
 * @param options the options the formatter was built with
 * @param resolved its resolved options
 * @param analysis what was read from its text
 * @param repair the formatter's repaired text at a time value, or `null`
 * @returns a function from a time value to its parts, or `null` where no answer is known
 */
export function createPartsSynth(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
  analysis: WeekYearAnalysis,
  repair: (ms: number) => RepairedText | null,
): (ms: number) => Part[] | null {
  let twins: Twin[] | undefined;
  let plan: Field[][] | null | undefined;

  const candidatesAt = (ms: number): Candidate[] => {
    twins ??= buildTwins(options, resolved);
    return candidatesFrom(twins, ms);
  };

  const spansAt = (ms: number, candidates: Candidate[]): Spans | null => {
    const repaired = repair(ms);
    return repaired === null ? null : spansOf(analysis, repaired, candidates);
  };

  const templateOf = (): Field[][] | null => {
    if (plan !== undefined) {
      return plan;
    }
    plan = null;
    const anchor = Temporal.PlainDate.from("2024-07-01").withCalendar(
      analysis.calendar,
    ).year;
    for (const date of TEMPLATE_DATES) {
      const ms = templateMs(analysis, anchor, date);
      const candidates = candidatesAt(ms);
      const spans = spansAt(ms, candidates);
      if (spans === null) {
        continue;
      }
      plan = segment(
        spans.spans,
        candidates.filter((c) => !c.numeric),
      );
      if (plan !== null) {
        break;
      }
    }
    return plan;
  };

  return (ms) => {
    const template = templateOf();
    if (template === null) {
      return null;
    }
    const candidates = candidatesAt(ms);
    const spans = spansAt(ms, candidates);
    if (spans === null) {
      return null;
    }
    const values = new Map(candidates.map((c) => [c.key, c.value]));
    const parts: Part[] = [];
    for (const [n, span] of spans.spans.entries()) {
      const next = partsOfSpan(
        span,
        template[n] ?? [],
        values,
        spans.numbers[n],
      );
      if (next === null) {
        return null;
      }
      parts.push(...next);
    }
    return mergeLiterals(parts);
  };
}
