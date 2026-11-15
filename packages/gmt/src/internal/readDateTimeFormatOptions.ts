import { isIntlOptionValue } from "./typedOptions";

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
 * An option's value, which must already have the type `Intl.DateTimeFormat` declares for it:
 * `boolean` for `hour12`, `number` for `fractionalSecondDigits`, `string` for every other option.
 * ECMA-402 GetOption would convert any other value (ToString, ToNumber, ToBoolean), but a
 * function accepts exactly the declared types, so anything else throws `TypeError` and the caller
 * returns its sentinel. `timeZone` is returned as it was read: each caller has its own rule for
 * a zone, and one that hands it to `Intl.DateTimeFormat` does so once.
 */
function typedOption(
  name: (typeof DATE_TIME_FORMAT_OPTIONS)[number],
  value: unknown,
): unknown {
  if (name !== "timeZone" && !isIntlOptionValue(name, value)) {
    throw new TypeError(`option ${name} has the wrong type`);
  }
  return value;
}

/**
 * Read a caller's `Intl.DateTimeFormat` options once, into a plain object of primitives.
 *
 * - A formatter that inspects the options before it hands them to `Intl.DateTimeFormat` would
 *   otherwise read each one several times, and a getter could answer one value to the check and
 *   another to the formatter. ECMA-402 CreateDateTimeFormat reads each option with one `Get`
 *   (GetOption); this does the same, in the same order, and everything after works on the copy.
 * - Each value is checked once, right after its `Get`, and never converted: a string option must be a string, `fractionalSecondDigits` a number and `hour12` a boolean; any
 *   other value throws `TypeError` and nothing is converted. The range and the allowed values are
 *   still checked by `Intl.DateTimeFormat`. `timeZone` alone is copied unchecked, for the
 *   caller's own zone rule.
 * - The object is coerced as ECMA-402 CoerceOptionsToObject coerces it: `undefined` is no options,
 *   `null` throws TypeError, and a string or a number has none of these properties. Inherited
 *   properties are read, as `Get` reads them.
 * - Only the options `Intl.DateTimeFormat` reads are copied, and only those that are not
 *   `undefined`. Any other key was never read by the formatter, so dropping it changes nothing.
 *
 * @param options the caller's options argument
 * @returns a plain object holding each option that was set; throws TypeError for `null`, or for
 *   a value of the wrong type, for the caller's sentinel
 *
 * @example readDateTimeFormatOptions({ dateStyle: "long", extra: 1 }) // { dateStyle: "long" }
 * @example readDateTimeFormatOptions({ month: { toString: () => "long" } }) // throws TypeError
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
      read[name] = typedOption(name, value);
    }
  }
  return read;
}
