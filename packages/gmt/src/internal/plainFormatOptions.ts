// Option resolution for formatting a zoneless Temporal value (PlainDate,
// PlainDateTime, PlainTime, PlainMonthDay) through the runtime's `Intl.DateTimeFormat`, which only
// formats instants. The rules are the Temporal proposal's ECMA-402
// amendments (CreateDateTimeFormat, GetDateTimeFormat with inherit
// ~relevant~, AdjustDateTimeStyleFormat); the formatter is then anchored at
// UTC, which is an implementation detail and must never surface as a field.

type Options = Intl.DateTimeFormatOptions;

// GetDateTimeFormat requiredOptions for ~date~ and ~time~.
const DATE_FIELDS = ["weekday", "year", "month", "day"] as const;
const TIME_FIELDS = [
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
] as const;

// Options that configure the DateTimeFormat object itself rather than the
// selected format record, so they carry over unchanged. `timeZone` is left
// out: a plain value is always formatted at the UTC anchor.
const FORMATTER_OPTIONS = [
  "localeMatcher",
  "calendar",
  "numberingSystem",
  "hour12",
  "hourCycle",
  "formatMatcher",
] as const;

function formatterOptions(options: Options): Options {
  const out: Record<string, unknown> = { timeZone: "UTC" };
  for (const key of FORMATTER_OPTIONS) {
    if (options[key] !== undefined) out[key] = options[key];
  }
  return out as Options;
}

function pickFields(
  options: Options,
  fields: ReadonlyArray<keyof Options>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (options[key] !== undefined) out[key] = options[key];
  }
  return out;
}

/**
 * Map a `timeStyle` to the one a plain value may use.
 *
 * - CLDR's `long` and `full` time formats are the ones carrying a
 *   `timeZoneName`. AdjustDateTimeStyleFormat removes that field and asks the
 *   format matcher for a format with the remaining fields. Which pattern the
 *   best-fit matcher picks is implementation-defined; GMT uses the locale's
 *   own `medium` time format, which has exactly the same fields (hour, minute,
 *   second, day period) and no zone. Checked against ICU 78 for 85
 *   languages, alone and combined with `dateStyle: "full"`.
 *
 * @param timeStyle the caller's `timeStyle`
 * @returns `"medium"` for `"long"`/`"full"`, otherwise the input
 */
export function plainTimeStyle<T extends Options["timeStyle"]>(
  timeStyle: T,
): T | "medium" {
  return timeStyle === "long" || timeStyle === "full" ? "medium" : timeStyle;
}

/**
 * Resolve caller options into runtime `Intl.DateTimeFormat` options that
 * format a PlainDate: date fields only, never a time or zone field.
 *
 * - Returns `null` where Temporal throws a TypeError: `timeStyle` without
 *   `dateStyle` ([[TemporalPlainDateFormat]] is null), or only non-date
 *   fields (GetDateTimeFormat returns null).
 * - Validation of the options themselves (invalid values, styles mixed with
 *   fields) is left to the caller constructing a formatter with `options`.
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @returns runtime options anchored at UTC, or `null` when no format exists
 */
export function plainDateFormatOptions(options: Options): Options | null {
  const base = formatterOptions(options);
  if (options.dateStyle !== undefined || options.timeStyle !== undefined) {
    if (options.dateStyle === undefined) return null;
    return { ...base, dateStyle: options.dateStyle };
  }
  const dateFields = pickFields(options, DATE_FIELDS);
  const anyPresent = [...DATE_FIELDS, ...TIME_FIELDS].some(
    (key) => options[key] !== undefined,
  );
  const era = options.era === undefined ? {} : { era: options.era };
  if (Object.keys(dateFields).length > 0) {
    return { ...base, ...era, ...dateFields };
  }
  if (anyPresent) return null;
  return {
    ...base,
    ...era,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  };
}

/**
 * Resolve caller options into runtime `Intl.DateTimeFormat` options that
 * format a PlainTime: time fields only, never a date, era or zone field.
 *
 * - Returns `null` where Temporal throws a TypeError: a `dateStyle`
 *   (CreateDateTimeFormat with required ~time~), or only non-time fields
 *   (GetDateTimeFormat returns null).
 * - `era` and `timeZoneName` are not inherited (GetDateTimeFormat ~relevant~),
 *   so with no time field hour, minute and second default to `"numeric"`.
 * - A `long`/`full` `timeStyle` is mapped through {@link plainTimeStyle}.
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @returns runtime options anchored at UTC, or `null` when no format exists
 */
export function plainTimeFormatOptions(options: Options): Options | null {
  const base = formatterOptions(options);
  if (options.dateStyle !== undefined) return null;
  if (options.timeStyle !== undefined) {
    return { ...base, timeStyle: plainTimeStyle(options.timeStyle) };
  }
  const timeFields = pickFields(options, TIME_FIELDS);
  if (Object.keys(timeFields).length > 0) {
    return { ...base, ...timeFields };
  }
  if (DATE_FIELDS.some((key) => options[key] !== undefined)) return null;
  return { ...base, hour: "numeric", minute: "numeric", second: "numeric" };
}

/**
 * Resolve caller options into runtime `Intl.DateTimeFormat` options that
 * format a PlainDateTime: date and time fields, never a zone field.
 *
 * - `timeZoneName` is not inherited (GetDateTimeFormat ~relevant~), and a
 *   `long`/`full` `timeStyle` is mapped through {@link plainTimeStyle}.
 * - With no date or time field and no style, year, month, day, hour, minute
 *   and second default to `"numeric"` (defaults ~all~).
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @returns runtime options anchored at UTC
 */
export function plainDateTimeFormatOptions(options: Options): Options {
  const base = formatterOptions(options);
  if (options.dateStyle !== undefined || options.timeStyle !== undefined) {
    return {
      ...base,
      ...(options.dateStyle === undefined
        ? {}
        : { dateStyle: options.dateStyle }),
      ...(options.timeStyle === undefined
        ? {}
        : { timeStyle: plainTimeStyle(options.timeStyle) }),
    };
  }
  const fields = pickFields(options, [...DATE_FIELDS, ...TIME_FIELDS]);
  const era = options.era === undefined ? {} : { era: options.era };
  if (Object.keys(fields).length > 0) {
    return { ...base, ...era, ...fields };
  }
  return {
    ...base,
    ...era,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };
}

/**
 * Resolve caller options into runtime `Intl.DateTimeFormat` options that
 * format a PlainMonthDay: month and day only, always through the Gregorian calendar.
 *
 * - **Calendar (GMT rule).** `calendar` is always `"gregory"`. An ISO month-day and a Gregorian
 *   one name the same month and day, and ICU formats `calendar: "iso8601"` without the locale's
 *   month-day pattern (Node prints `" 25"` for `{ month: "long", day: "numeric" }`, browsers
 *   `Dezember 25` for de-DE). HandleDateTimeTemporalMonthDay throws
 *   a RangeError for any calendar mismatch, so `PlainMonthDay#toLocaleString` with a locale's
 *   default calendar throws and this does not.
 * - **`dateStyle` (GMT rule).** `full` and `long` become `{ month: "long", day: "numeric" }`,
 *   `medium` becomes `{ month: "short", day: "numeric" }` and `short` becomes
 *   `{ month: "numeric", day: "numeric" }`: polyfill 0.5.1's mapping. This departs from ECMA-402,
 *   whose AdjustDateTimeStyleFormat copies the month and day widths from the locale's dateStyle
 *   pattern. Native engines follow it, so there `toLocaleString` prints, for example, `25.12.` for
 *   de-DE `medium` and `12/25` for zh-CN `long`. GMT prints the same in every engine.
 * - **Fields** (GetDateTimeFormat, required and defaults ~month-day~, inherit ~relevant~): only
 *   `month` and `day` are copied. `era`, `year`, `weekday`, time fields and `timeZoneName` are
 *   dropped. With neither `month` nor `day`, a `weekday`, `year`, `dayPeriod`, `hour`, `minute`,
 *   `second` or `fractionalSecondDigits` gives `null` (anyPresent); otherwise month and day default
 *   to `"numeric"`.
 * - Never passes `year`, so no pattern that prints a year is formatted.
 * - Returns `null` for a `timeStyle` (a month-day has no time format).
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @returns runtime options anchored at UTC, or `null` when no format exists
 */
export function plainMonthDayFormatOptions(options: Options): Options | null {
  const base = { ...formatterOptions(options), calendar: "gregory" };
  if (options.timeStyle !== undefined) return null;
  if (options.dateStyle !== undefined) {
    switch (options.dateStyle) {
      case "full":
      case "long":
        return { ...base, month: "long", day: "numeric" };
      case "medium":
        return { ...base, month: "short", day: "numeric" };
      default:
        return { ...base, month: "numeric", day: "numeric" };
    }
  }
  const fields = pickFields(options, ["month", "day"]);
  if (Object.keys(fields).length > 0) return { ...base, ...fields };
  if (
    [...DATE_FIELDS, ...TIME_FIELDS].some((key) => options[key] !== undefined)
  ) {
    return null;
  }
  return { ...base, month: "numeric", day: "numeric" };
}

/**
 * Resolve caller options into runtime `Intl.DateTimeFormat` options that
 * format a PlainYearMonth: year, month and era only, always through the Gregorian calendar.
 *
 * - **Calendar (GMT rule).** `calendar` is always `"gregory"`. ICU given `calendar: "iso8601"` and
 *   `{ year: "numeric", month: "long" }` prints `"1970 "` on Node 24 with no month name, and
 *   HandleDateTimeTemporalYearMonth throws a RangeError for any calendar mismatch, so
 *   `PlainYearMonth#toLocaleString` with the locale's default calendar throws and this does not.
 * - **`dateStyle` (GMT rule).** `full` and `long` become `{ year: "numeric", month: "long" }`,
 *   `medium` becomes `{ year: "numeric", month: "short" }` and `short` becomes
 *   `{ year: "2-digit", month: "numeric" }`: polyfill 0.5.1's `yearMonthAmend` mapping. This
 *   departs from ECMA-402, whose AdjustDateTimeStyleFormat (« "era", "year", "month" ») copies the
 *   widths from the locale's date pattern. Native engines follow it, so there `toLocaleString`
 *   prints, for example, `10/2026` for en-GB `short` and `2026/10` for zh-CN `long`. GMT prints the
 *   same in every engine.
 * - **Fields** (GetDateTimeFormat, required and defaults ~year-month~, inherit ~relevant~): `year`,
 *   `month` and `era` are copied (`era` qualifies the year). `day`, `weekday`, `dayPeriod`, time
 *   fields and `timeZoneName` are dropped. With neither `year` nor `month`, a `weekday`, `day`,
 *   `dayPeriod`, `hour`, `minute`, `second` or `fractionalSecondDigits` gives `null`
 *   (anyPresent); otherwise year and month default to `"numeric"`, keeping a copied `era`.
 * - **V8 `Y` crash.** The result passes `year`, so it must only be given to `format`, never to
 *   `formatToParts` or `formatRangeToParts`, where V8 before 15.5 traps.
 * - Returns `null` for a `timeStyle` (a year-month has no time format).
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @returns runtime options anchored at UTC, or `null` when no format exists
 */
export function plainYearMonthFormatOptions(options: Options): Options | null {
  const base = { ...formatterOptions(options), calendar: "gregory" };
  if (options.timeStyle !== undefined) return null;
  if (options.dateStyle !== undefined) {
    switch (options.dateStyle) {
      case "full":
      case "long":
        return { ...base, year: "numeric", month: "long" };
      case "medium":
        return { ...base, year: "numeric", month: "short" };
      default:
        return { ...base, year: "2-digit", month: "numeric" };
    }
  }
  const era = options.era === undefined ? {} : { era: options.era };
  const fields = pickFields(options, ["year", "month"]);
  if (Object.keys(fields).length > 0) return { ...base, ...era, ...fields };
  if (
    ["weekday", "day", ...TIME_FIELDS].some(
      (key) => options[key as keyof Options] !== undefined,
    )
  ) {
    return null;
  }
  return { ...base, ...era, year: "numeric", month: "numeric" };
}
