/**
 * What the finance tools share: the library's finance functions as one typed object, and the
 * order of FIX's five precisions. Both finance tools are built on it: the FIX Timestamp Reader
 * (FIN-95) uses the FIX names, and the SWIFT Value Date Reader (FIN-96) the SWIFT names and
 * `isValidDate`.
 *
 * No DOM and no library import (the library arrives as a `FinanceLib`), so a pure module can
 * take it.
 */
import type { FixPrecision, FixUtcTimestamp } from "@northguild/gmt";

/** The functions the finance tools call, as the library declares them. */
export interface FinanceLib {
  parseFixUtcTimestamp(value: string): FixUtcTimestamp | null;
  /** The boolean overload: the tool prints what the validator returned. */
  isValidFixUtcTimestamp(value: string): boolean;
  formatFixUtcTimestamp(value: string, precision: FixPrecision): string;
  /** The ISO date of a SWIFT `YYMMDD` value date, or `""`. */
  parseSwiftDate(value: string): string;
  /** The `YYMMDD` of an ISO date, or `""`. */
  formatSwiftDate(value: string): string;
  isValidSwiftDate(value: string): boolean;
  /**
   * The ISO calendar-date check from `plain/validate`. The reader's write box takes what it
   * takes, and asks it to tell a date-time from a date outside SWIFT's range.
   */
  isValidDate(value: string): boolean;
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
