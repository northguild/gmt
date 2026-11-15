import type { Overflow } from "../types";

/**
 * Resolve an optional overflow value to its default ("constrain") when unset.
 *
 * - Only an *omitted* member takes the default. Temporal's GetOption reads any other value,
 *   `null` included, through ToString, so `{ overflow: null }` is the string "null" and a
 *   RangeError — never "constrain" (Chromium 153: "Value null out of range for
 *   Temporal.PlainDate.prototype.add options property overflow"). Passing it through is what
 *   lets the caller's `catch` return its sentinel.
 *
 * @param overflow optional overflow value
 * @throws TypeError when `overflow` is neither omitted nor a string
 * @example resolveOverflow(undefined) // "constrain"
 * @example resolveOverflow("reject") // "reject"
 * @returns the resolved overflow value
 */
export function resolveOverflow(overflow?: Overflow): Overflow {
  if (overflow !== undefined && typeof overflow !== "string") {
    // The type is a string. GetOption would convert a boxed string or an object; the caller's
    // `catch` returns its sentinel instead.
    throw new TypeError("overflow must be a string");
  }
  return overflow === undefined ? "constrain" : overflow;
}
