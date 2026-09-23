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
 *   `"modifiedPreceding"`, `"endOfMonth"` and `"none"`. The first three are the conventions
 *   [ISDA 2006 Definitions §4.12(a)](https://www.isda.org/a/smMDE/Blackline-2000-v-2006-ISDA-Definitions.pdf)
 *   defines in (i)–(iii); `"modifiedPreceding"` is FpML's `BusinessDayConventionEnum`
 *   `MODPRECEDING`, which §4.12(a) does not define; `"none"` is Strata's `NO_ADJUST`; and
 *   `"endOfMonth"` is GMT's own. The camelCase spelling
 *   is GMT's — no standard fixes the identifiers, only the behaviour.
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
