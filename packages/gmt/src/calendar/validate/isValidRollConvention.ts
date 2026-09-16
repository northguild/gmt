import type { RollConvention } from "../../types";

const ROLL_CONVENTIONS: readonly RollConvention[] = [
  "following",
  "modifiedFollowing",
  "preceding",
  "modifiedPreceding",
  "endOfMonth",
  "none",
];

/**
 * Return true when `convention` is a `RollConvention` that `rollDate` implements.
 *
 * - Valid conventions are `"following"`, `"modifiedFollowing"`, `"preceding"`,
 *   `"modifiedPreceding"`, `"endOfMonth"` and `"none"`.
 * - Matching is exact: case, spacing and abbreviations are not normalised.
 * - Accepts any input type and returns false for non-string values.
 * - `rollDate` returns `""` for a convention it does not recognise — the same sentinel it
 *   returns for a bad date or calendar. Check the convention here to tell a misconfigured
 *   contract term apart from bad data.
 *
 * @param convention candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidRollConvention("modifiedFollowing") // true
 * @example isValidRollConvention("endOfMonth") // true
 * @example isValidRollConvention("none") // true
 * @example isValidRollConvention("Following") // false (case is exact)
 * @example isValidRollConvention("nearest") // false (not implemented)
 * @example isValidRollConvention(null) // false
 */
export function isValidRollConvention(
  convention: unknown,
): convention is RollConvention {
  return (
    typeof convention === "string" &&
    ROLL_CONVENTIONS.includes(convention as RollConvention)
  );
}
