/**
 * The value of an option that was read once, or its default when the option is absent.
 *
 * - ECMA-402 `GetOption` (the Temporal specification defines the same operation) reads the
 *   property with one `Get` and returns the default only when that value is `undefined`. Pass
 *   the property read as the argument, so the option is read exactly once: a getter cannot
 *   answer one value to the check and another to the use.
 * - `null` is a value, not an omission, so it is returned as it is for the caller to validate.
 *
 * @param value the option as read from the caller's object, `undefined` when absent
 * @param fallback the documented default
 * @returns `fallback` when `value` is `undefined`, otherwise `value`
 *
 * @example optionOrDefault(undefined, "compatible") // "compatible"
 * @example optionOrDefault("later", "compatible") // "later"
 * @example optionOrDefault(null, true) // null (a value for the caller to validate)
 */
export function optionOrDefault<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}
