/**
 * What the finance tools share: the library's finance functions as one typed object, and the
 * order of FIX's five precisions.
 *
 * No DOM and no library import (the library arrives as a `FinanceLib`), so a pure module can
 * take it. FIN-96's SWIFT Value Date Reader adds its own names to `FinanceLib` and to
 * `finance-lib.ts`.
 */
import type { FixPrecision, FixUtcTimestamp } from "@northguild/gmt";

/** The functions the finance tools call, as the library declares them. */
export interface FinanceLib {
  parseFixUtcTimestamp(value: string): FixUtcTimestamp | null;
  /** The boolean overload: the tool prints what the validator returned. */
  isValidFixUtcTimestamp(value: string): boolean;
  formatFixUtcTimestamp(value: string, precision: FixPrecision): string;
}

/**
 * The five precisions, narrowest first. `satisfies` makes a name the library lacks a type
 * error, and `Missing` makes a name this list lacks one too.
 */
export const FIX_PRECISIONS = [
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
  "picosecond",
] as const satisfies readonly FixPrecision[];

type Missing = Exclude<FixPrecision, (typeof FIX_PRECISIONS)[number]>;
const everyPrecisionListed: [Missing] extends [never] ? true : never = true;
void everyPrecisionListed;
