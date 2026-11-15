/*
 * CORE-112: the field values ECMA-402 PartitionDateTimeRangePattern compares, read from
 * the engine's own calendar data. A range collapses to the start's single format only when the
 * two local times hold equal values in every Table 6 row the algorithm checks; the printed texts
 * are never compared (two different dates can print alike: a two-digit year, a narrow month).
 * Shared by D25 (`yearPrintingRange.ts`) and D29 (`rangeFields.ts`); imports nothing from either.
 */

/** At most this many cached readers; past it the map clears (a cost of one rebuild each). */
const MAX_READERS = 256;

/** The resolved options the readers need. */
export type FieldContext = Pick<
  Intl.ResolvedDateTimeFormatOptions,
  "calendar" | "timeZone" | "locale" | "hourCycle"
>;

const calendarFields = new Map<string, Intl.DateTimeFormat>();
const periodReaders = new Map<string, Intl.DateTimeFormat>();

/** Forget the cached readers (the engine's `Intl.DateTimeFormat` was replaced). */
export function forgetFieldReaders(): void {
  calendarFields.clear();
  periodReaders.clear();
}

/**
 * The date and time fields of an instant in a calendar and zone, read from the engine's own
 * calendar data: `era`, `year` (or `relatedYear`), `month`, `day`, `hour` (0 to 23), `minute`,
 * `second`.
 *
 * @example localFieldsOf({ calendar: "gregory", timeZone: "UTC", locale: "en", hourCycle: undefined }, 0)["year"] // "1970"
 */
export function localFieldsOf(
  resolved: FieldContext,
  ms: number,
): Record<string, string> {
  const key = `${resolved.calendar}|${resolved.timeZone}`;
  let reader = calendarFields.get(key);
  if (reader === undefined) {
    reader = new Intl.DateTimeFormat("en", {
      calendar: resolved.calendar,
      timeZone: resolved.timeZone,
      numberingSystem: "latn",
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    if (calendarFields.size >= MAX_READERS) {
      calendarFields.clear();
    }
    calendarFields.set(key, reader);
  }
  const fields: Record<string, string> = {};
  for (const part of reader.formatToParts(ms)) {
    fields[part.type] = (fields[part.type] ?? "") + part.value;
  }
  return fields;
}

/**
 * The flexible day period the formatter prints for an instant, in its own width, or `""` when its
 * pattern prints none (so no two instants differ in it). The period is a property of the time as
 * the pattern prints it: with minutes, 12:00 is `noon` and 12:25 `in the afternoon`, while an
 * hour-only pattern says `noon` for the whole hour. So the reader carries the caller's own time
 * fields, and no date field (a week-year pattern could make a date field unsafe to read: D23).
 *
 * @example dayPeriodOf({ hour: "numeric", minute: "numeric", dayPeriod: "long" }, { calendar: "gregory", timeZone: "UTC", locale: "en", hourCycle: "h12" }, Date.UTC(2024, 6, 10, 12, 0)) // "noon"
 */
export function dayPeriodOf(
  options: Intl.DateTimeFormatOptions,
  resolved: FieldContext,
  ms: number,
): string {
  if (options.dayPeriod === undefined) {
    return "";
  }
  const key = `${resolved.locale}|${resolved.calendar}|${resolved.timeZone}|${resolved.hourCycle}|${options.dayPeriod}|${options.hour}|${options.minute}|${options.second}|${options.fractionalSecondDigits}`;
  let reader = periodReaders.get(key);
  if (reader === undefined) {
    const twin: Intl.DateTimeFormatOptions = {
      calendar: resolved.calendar,
      timeZone: resolved.timeZone,
      hour: options.hour,
      minute: options.minute,
      second: options.second,
      fractionalSecondDigits: options.fractionalSecondDigits,
      dayPeriod: options.dayPeriod,
    };
    if (resolved.hourCycle !== undefined) {
      twin.hourCycle = resolved.hourCycle;
    }
    reader = new Intl.DateTimeFormat(resolved.locale, twin);
    if (periodReaders.size >= MAX_READERS) {
      periodReaders.clear();
    }
    periodReaders.set(key, reader);
  }
  return (
    reader.formatToParts(ms).find((part) => part.type === "dayPeriod")?.value ??
    ""
  );
}

/** The Table 6 rows, in table order, each with the field its pattern must print to have a range pattern. */
interface Row {
  /** The row name. */
  readonly name: string;
  /** Whether the formatter's pattern prints this row's field (so a range pattern may exist). */
  readonly printed: boolean;
  /** The row's value for an instant. */
  readonly value: (ms: number) => string;
}

/** The Table 6 rows of a formatter, in table order (ECMA-402 11.5.8). */
function rowsOf(
  options: Intl.DateTimeFormatOptions,
  resolved: FieldContext,
  era: boolean,
): readonly Row[] {
  const dateStyle = options.dateStyle !== undefined;
  const timeStyle = options.timeStyle !== undefined;
  const hour = options.hour !== undefined || timeStyle;
  const minute =
    options.minute !== undefined || options.second !== undefined || timeStyle;
  const second =
    options.second !== undefined ||
    options.fractionalSecondDigits !== undefined ||
    (timeStyle && options.timeStyle !== "short");
  const fsd = options.fractionalSecondDigits;
  const field =
    (...types: string[]) =>
    (ms: number): string => {
      const fields = localFieldsOf(resolved, ms);
      return types.map((type) => fields[type] ?? "").join("|");
    };
  return [
    { name: "era", printed: era, value: field("era") },
    {
      name: "year",
      printed: options.year !== undefined || dateStyle,
      value: field("year", "relatedYear", "yearName"),
    },
    {
      name: "month",
      printed: options.month !== undefined || dateStyle,
      value: field("month"),
    },
    {
      name: "day",
      printed: options.day !== undefined || dateStyle,
      value: field("day"),
    },
    {
      name: "ampm",
      printed: hour,
      value: (ms) => String(Number(localFieldsOf(resolved, ms)["hour"]) < 12),
    },
    {
      name: "dayperiod",
      printed: hour || options.dayPeriod !== undefined,
      value: (ms) => dayPeriodOf(options, resolved, ms),
    },
    { name: "hour", printed: hour, value: field("hour") },
    { name: "minute", printed: minute, value: field("minute") },
    { name: "second", printed: second, value: field("second") },
    {
      name: "fractionalsecond",
      printed: fsd !== undefined,
      // floor(millisecond × 10^(digits − 3)), the spec's value for the row.
      value: (ms) =>
        String(
          Math.floor((((ms % 1000) + 1000) % 1000) * 10 ** ((fsd ?? 3) - 3)),
        ),
    },
  ];
}

/**
 * Whether two instants hold equal field values in every Table 6 row ECMA-402
 * PartitionDateTimeRangePattern checks, so the range is the start's single format. A row is
 * checked while no range pattern is selected, and from the first row the pattern prints until the
 * first later row it does not print (`checkMoreFields`): a month-only pattern ignores the day, a
 * pattern with minutes ignores the seconds. Printed text is never compared.
 *
 * @param options the formatter's options
 * @param resolved its resolved calendar, zone, locale and hour cycle
 * @param startMs the start in epoch milliseconds
 * @param endMs the end in epoch milliseconds
 * @param era whether the pattern prints an era (default: the `era` option is set)
 * @returns `true` when the range collapses to the start's single format
 *
 * @example rangeFieldsEqual({ year: "2-digit" }, { calendar: "gregory", timeZone: "UTC", locale: "en", hourCycle: undefined }, Date.UTC(1924, 0, 1), Date.UTC(2024, 0, 1)) // false
 */
export function rangeFieldsEqual(
  options: Intl.DateTimeFormatOptions,
  resolved: FieldContext,
  startMs: number,
  endMs: number,
  era: boolean = options.era !== undefined,
): boolean {
  let selected = false;
  for (const row of rowsOf(options, resolved, era)) {
    if (selected && !row.printed) {
      return true;
    }
    selected = row.printed;
    if (row.value(startMs) !== row.value(endMs)) {
      return false;
    }
  }
  return true;
}
