/**
 * What the CCSDS tools share: the library's CCSDS ASCII time code functions as one typed
 * object, and the order of the fractional-digit choices.
 *
 * No DOM and no library import (the library arrives as a `CcsdsLib`), so a pure module can
 * take it.
 */
import type { FractionalDigit } from "@northguild/gmt";

/** The functions the CCSDS tools call, as the library declares them. */
export interface CcsdsLib {
  parseCcsdsAsciiA(value: string): string;
  parseCcsdsAsciiB(value: string): string;
  formatCcsdsAsciiA(
    isoString: string,
    fractionalSecondDigits?: FractionalDigit,
  ): string;
  formatCcsdsAsciiB(
    isoString: string,
    fractionalSecondDigits?: FractionalDigit,
  ): string;
  /** Month names: the Day Ruler's lane labels ("short") and the Decoder's DDD caption ("long"). */
  getLocaleMonthNames(locale: string, style: "short" | "long"): string[];
}

/**
 * The digit choices, in chip order. `satisfies` makes a value the library lacks a type error,
 * and `Missing` makes a value this list lacks one too.
 */
export const CCSDS_DIGITS = [
  "auto",
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
] as const satisfies readonly FractionalDigit[];

type Missing = Exclude<FractionalDigit, (typeof CCSDS_DIGITS)[number]>;
const everyDigitListed: [Missing] extends [never] ? true : never = true;
void everyDigitListed;
