import type { Overflow } from "../types";

/**
 * Resolve an optional overflow value to its default ("constrain") when unset.
 *
 * @param overflow optional overflow value
 * @example resolveOverflow(undefined) // "constrain"
 * @example resolveOverflow("reject") // "reject"
 * @returns the resolved overflow value
 */
export function resolveOverflow(overflow?: Overflow): Overflow {
  return overflow ?? "constrain";
}
