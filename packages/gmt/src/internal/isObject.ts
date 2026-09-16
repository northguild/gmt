/**
 * Type guard for a non-null object (arrays included), the shape an options bag or a props
 * object must have before it is destructured. A default parameter covers only `undefined`, so a
 * `null` or primitive argument reaches the destructure and throws `TypeError` without this check.
 *
 * @param value candidate
 * @example isObject({ smallestUnit: "day" }) // true
 * @example isObject(null) // false
 * @example isObject("day") // false
 * @returns whether `value` is a non-null object
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
