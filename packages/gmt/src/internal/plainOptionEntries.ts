/** Whether `Intl` can read this option value without running caller code. */
function isPlainOptionValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * The own enumerable options as `[name, value]` pairs, read through property descriptors so a
 * getter is never run, or `null` when one is an accessor or holds a value `Intl` would coerce
 * by running caller code (anything but a string, a finite number or a boolean). An `undefined`
 * value is skipped, as `Intl` reads it as absent.
 *
 * @param options the options object to read
 * @returns the pairs, or `null` when the options cannot be keyed safely
 *
 * @example plainOptionEntries({ year: "numeric", day: undefined }) // [["year", "numeric"]]
 * @example plainOptionEntries({ get year() { return "numeric"; } }) // null
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
    if (!isPlainOptionValue(value)) {
      return null;
    }
    entries.push([name, value]);
  }
  return entries;
}
