import { isIntlOptionValue } from "./typedOptions";

/**
 * The own enumerable options as `[name, value]` pairs, read through property descriptors so a
 * getter is never run, or `null` when one is an accessor or a number `JSON` cannot key (not
 * finite). A value of a type the option is not declared with (a boxed string, an object, a
 * string for `hour12`, a string for a digit count) throws `TypeError`, which each caller turns
 * into its sentinel: `Intl` would convert it. An `undefined` value is skipped, as `Intl` reads it
 * as absent.
 *
 * @param options the options object to read
 * @returns the pairs, or `null` when the options cannot be keyed safely
 *
 * @example plainOptionEntries({ year: "numeric", day: undefined }) // [["year", "numeric"]]
 * @example plainOptionEntries({ get year() { return "numeric"; } }) // null
 * @example plainOptionEntries({ hour12: "yes" }) // throws TypeError
 */
export function plainOptionEntries(
  options: object,
): [string, unknown][] | null {
  const entries: [string, unknown][] = [];
  for (const name of Object.keys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (descriptor === undefined || !("value" in descriptor)) {
      return null;
    }
    const value: unknown = descriptor.value;
    if (value === undefined) {
      continue;
    }
    if (!isIntlOptionValue(name, value)) {
      throw new TypeError(`option ${name} has the wrong type`);
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return null;
    }
    entries.push([name, value]);
  }
  return entries;
}
