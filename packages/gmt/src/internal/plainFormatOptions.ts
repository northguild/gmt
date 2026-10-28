// Option resolution for formatting a zoneless Temporal value (PlainDate,
// PlainDateTime, PlainTime, PlainMonthDay) through the runtime's `Intl.DateTimeFormat`, which only
// formats instants. The rules are the Temporal proposal's ECMA-402
// amendments (CreateDateTimeFormat, GetDateTimeFormat with inherit
// ~relevant~, AdjustDateTimeStyleFormat); the formatter is then anchored at
// UTC, which is an implementation detail and must never surface as a field.

import { cachedFormatter } from "./formatterCache";

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

// Noon UTC on 2026-01-05 and 2026-09-05: a four-digit year, a one-digit month and day, and a
// second month for a locale whose January has the same name at two widths.
const STYLE_PROBE_INSTANTS = [1_767_614_400_000, 1_788_609_600_000] as const;

const ALL_DIGITS = /^\d+$/;

/**
 * Read the widths a locale's `dateStyle` date pattern gives `fields` (ECMA-402
 * AdjustDateTimeStyleFormat).
 *
 * - AdjustDateTimeStyleFormat copies each allowed field's width from the locale's `dateStyle`
 *   pattern, then runs the format matcher. `resolvedOptions()` reports no fields beside a
 *   `dateStyle`, so the widths are read from `formatToParts` on two Gregorian instants.
 * - A number is `"2-digit"` when it is written with two digits (month 1, day 5, year 2026),
 *   otherwise `"numeric"`. A name is the first of `"long"`, `"short"` and `"narrow"` that a
 *   year-month-day pattern writes the same on both instants, so both names are in the format
 *   context (fa `ژانویهٔ`, not the stand-alone `ژانویه`). A name no width matches is `"long"`;
 *   none of 101 locales in Node 24, Chromium 153 or WebKit 26.6 has one.
 * - The probes use Latin digits (`numberingSystem: "latn"`), so a number is told from a name
 *   with `\d`.
 * - Only PlainDate patterns, the style and year-month-day, are formatted to parts:
 *   `formatDateToParts` formats the same ones.
 * - A field the style's pattern does not show is left out.
 *
 * @param locale the caller's locale, already checked
 * @param options the caller's options, for `localeMatcher`
 * @param dateStyle the caller's `dateStyle`
 * @param fields the fields to read, in AdjustDateTimeStyleFormat's order
 * @returns each shown field's width
 * @example dateStyleWidths("de-DE", {}, "medium", ["month", "day"]) // { month: "2-digit", day: "2-digit" }
 * @example dateStyleWidths("en-US", {}, "short", ["era", "year", "month"]) // { year: "2-digit", month: "numeric" }
 */
function dateStyleWidths(
  locale: string | string[] | undefined,
  options: Options,
  dateStyle: NonNullable<Options["dateStyle"]>,
  fields: ReadonlyArray<"era" | "year" | "month" | "day">,
): Options {
  const probe = {
    ...(options.localeMatcher === undefined
      ? {}
      : { localeMatcher: options.localeMatcher }),
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: "UTC",
  };
  const partsAt = (extra: Options): Intl.DateTimeFormatPart[][] => {
    const formatter = cachedFormatter("DateTimeFormat", locale, {
      ...probe,
      ...extra,
    });
    return STYLE_PROBE_INSTANTS.map((at) => formatter.formatToParts(at));
  };
  const styled = partsAt({ dateStyle });
  const widths: Record<string, string> = {};
  for (const field of fields) {
    const shown = styled.map(
      (parts) => parts.find((part) => part.type === field)?.value,
    );
    const first = shown[0];
    if (first === undefined) continue;
    if (ALL_DIGITS.test(first)) {
      widths[field] = first.length === 2 ? "2-digit" : "numeric";
      continue;
    }
    const width = (["long", "short", "narrow"] as const).find((candidate) =>
      partsAt({
        year: "numeric",
        month: "numeric",
        day: "numeric",
        [field]: candidate,
      }).every(
        (parts, index) =>
          parts.find((part) => part.type === field)?.value === shown[index],
      ),
    );
    widths[field] = width ?? "long";
  }
  return widths as Options;
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
 * - **`dateStyle`** (AdjustDateTimeStyleFormat, « [[Month]], [[Day]] »). The month and day widths
 *   are the locale's own `dateStyle` pattern's, read by {@link dateStyleWidths}: de-DE `medium`
 *   is `25.12.`, ja-JP `long` `12/25` and en-US `medium` `Dec 25`, as native
 *   `PlainMonthDay#toLocaleString` prints them. Polyfill 0.5.1 maps the style to fixed widths
 *   instead (`25. Dez.`, `12月25日`).
 * - **Fields** (GetDateTimeFormat, required and defaults ~month-day~, inherit ~relevant~): only
 *   `month` and `day` are copied. `era`, `year`, `weekday`, time fields and `timeZoneName` are
 *   dropped. With neither `month` nor `day`, a `weekday`, `year`, `dayPeriod`, `hour`, `minute`,
 *   `second` or `fractionalSecondDigits` gives `null` (anyPresent); otherwise month and day default
 *   to `"numeric"`.
 * - Never passes `year`, so no pattern that prints a year is formatted.
 * - Returns `null` for a `timeStyle` (a month-day has no time format).
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @param locale the caller's locale, already checked; read only for a `dateStyle`
 * @returns runtime options anchored at UTC, or `null` when no format exists
 */
export function plainMonthDayFormatOptions(
  options: Options,
  locale: string | string[] | undefined,
): Options | null {
  const base = { ...formatterOptions(options), calendar: "gregory" };
  if (options.timeStyle !== undefined) return null;
  if (options.dateStyle !== undefined) {
    const widths = dateStyleWidths(locale, options, options.dateStyle, [
      "month",
      "day",
    ]);
    return Object.keys(widths).length > 0
      ? { ...base, ...widths }
      : { ...base, month: "numeric", day: "numeric" };
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
 * - **`dateStyle`** (AdjustDateTimeStyleFormat, « [[Era]], [[Year]], [[Month]] »). The widths
 *   are the locale's own `dateStyle` pattern's, read by {@link dateStyleWidths}: de-DE `medium`
 *   is `10/2026`, zh-CN `full` `2026/10` and en-US `short` `10/26`, as native
 *   `PlainYearMonth#toLocaleString` prints them. Polyfill 0.5.1's `yearMonthAmend` maps the style
 *   to fixed widths instead (`Okt. 2026`, `2026年10月`).
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
 * @param locale the caller's locale, already checked; read only for a `dateStyle`
 * @returns runtime options anchored at UTC, or `null` when no format exists
 */
export function plainYearMonthFormatOptions(
  options: Options,
  locale: string | string[] | undefined,
): Options | null {
  const base = { ...formatterOptions(options), calendar: "gregory" };
  if (options.timeStyle !== undefined) return null;
  if (options.dateStyle !== undefined) {
    const widths = dateStyleWidths(locale, options, options.dateStyle, [
      "era",
      "year",
      "month",
    ]);
    return widths.year !== undefined || widths.month !== undefined
      ? { ...base, ...widths }
      : { ...base, year: "numeric", month: "numeric" };
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
