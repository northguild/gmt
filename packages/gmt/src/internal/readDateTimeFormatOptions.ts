/**
 * The options ECMA-402 CreateDateTimeFormat reads, in the order it reads them: the formatter's own
 * settings, then `timeZone`, then each date-time component, then `formatMatcher` and the styles.
 */
const DATE_TIME_FORMAT_OPTIONS = [
  "localeMatcher",
  "calendar",
  "numberingSystem",
  "hour12",
  "hourCycle",
  "timeZone",
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "timeZoneName",
  "formatMatcher",
  "dateStyle",
  "timeStyle",
] as const;

/**
 * Convert an option's value as ECMA-402 GetOption converts it for that option's type: ToBoolean
 * for `hour12`, ToNumber for `fractionalSecondDigits` (GetNumberOption), ToString for every other
 * option. `timeZone` is the exception and is returned as it was read: each caller has its own
 * rule for a zone, and one that hands it to `Intl.DateTimeFormat` does so once.
 *
 * The template literal and the unary plus are ToString and ToNumber exactly, so a symbol (and a
 * bigint for a number) throws TypeError as it does inside `Intl.DateTimeFormat`.
 */
function convertOption(
  name: (typeof DATE_TIME_FORMAT_OPTIONS)[number],
  value: unknown,
): unknown {
  switch (name) {
    case "timeZone":
      return value;
    case "hour12":
      return Boolean(value);
    case "fractionalSecondDigits":
      return +(value as number);
    default:
      return `${value as string}`;
  }
}

/**
 * Read a caller's `Intl.DateTimeFormat` options once, into a plain object of primitives.
 *
 * - A formatter that inspects the options before it hands them to `Intl.DateTimeFormat` would
 *   otherwise read each one several times, and a getter could answer one value to the check and
 *   another to the formatter. ECMA-402 CreateDateTimeFormat reads each option with one `Get`
 *   (GetOption); this does the same, in the same order, and everything after works on the copy.
 * - Each value is converted once as well, right after its `Get`, as GetOption converts it:
 *   ToString for a string option, ToNumber for `fractionalSecondDigits`, ToBoolean for `hour12`.
 *   An option given as an object would otherwise be asked for its value by every
 *   `Intl.DateTimeFormat` built from the copy, and could answer each one differently. The range
 *   and the allowed values are still checked by `Intl.DateTimeFormat`. `timeZone` alone is copied
 *   unconverted, for the caller's own zone rule.
 * - The object is coerced as ECMA-402 CoerceOptionsToObject coerces it: `undefined` is no options,
 *   `null` throws TypeError, and a string or a number has none of these properties. Inherited
 *   properties are read, as `Get` reads them.
 * - Only the options `Intl.DateTimeFormat` reads are copied, and only those that are not
 *   `undefined`. Any other key was never read by the formatter, so dropping it changes nothing.
 *
 * @param options the caller's options argument
 * @returns a plain object holding each option that was set, converted to its primitive; throws
 *   TypeError for `null`, or for a value that cannot be converted, for the caller's sentinel
 *
 * @example readDateTimeFormatOptions({ dateStyle: "long", extra: 1 }) // { dateStyle: "long" }
 * @example readDateTimeFormatOptions({ month: { toString: () => "long" } }) // { month: "long" }
 * @example readDateTimeFormatOptions(undefined) // {}
 * @example readDateTimeFormatOptions("x") // {} (a string has no date-time options)
 * @example readDateTimeFormatOptions(null) // throws TypeError
 */
export function readDateTimeFormatOptions(
  options: unknown,
): Intl.DateTimeFormatOptions {
  if (options === null) {
    throw new TypeError("options must be an object or undefined");
  }
  const read: Record<string, unknown> = {};
  if (options === undefined) {
    return read;
  }
  const source = Object(options) as Record<string, unknown>;
  for (const name of DATE_TIME_FORMAT_OPTIONS) {
    const value = source[name];
    if (value !== undefined) {
      read[name] = convertOption(name, value);
    }
  }
  return read;
}
