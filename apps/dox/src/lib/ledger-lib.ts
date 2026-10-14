/**
 * Loads the real gmt functions the B/L Date Stamp and the Demurrage Clock need,
 * at module granularity, and hands them back as a `BlDateLib` or a `DemurrageLib`.
 *
 * Each loader is one `Promise.all` over `GMT_MODULES` keys. A failed import
 * rejects, and the mount turns it into a `WidgetLoadError`, so a widget never
 * shows controls that look live and do nothing. The Journey Split's and the
 * EPCIS Event Reader's loaders live beside the libraries they extend
 * (`transport-lib.ts`, `edi-lib.ts`), so no other tool loads a module it does
 * not use.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, inside its own `try`.
 */
import { GMT_MODULES } from "./gmt-modules";

/** An interval as `demurrageClock` returns it: the caller's own strings. */
export interface ClockInterval {
  start: string;
  end: string;
}

/** The members of `bolTimestamp`'s three helpers. The site types them loosely:
 *  a value the library does not read is the library's sentinel to return. */
export interface BlDateLib {
  bolTimestamp(
    value: string,
    event: string,
    options?: { timeZone: string },
  ): string;
  isAfterDate(a: string, b: string): boolean;
  areDatesEqual(a: string, b: string): boolean;
  isValidDate(value: string): boolean;
}

export interface DemurrageLib {
  demurrageClock(
    events: { type: string; at: string }[],
    scope: string,
    options: { direction: string; startEvent?: string },
  ): ClockInterval | null;
  toOffsetInstant(
    value: string,
    zone?: string,
  ): { instant: string; offset: string; timeZone?: string } | null;
  diffUtcAsDuration(a: string, b: string, unit: string): string;
  isValidInstant(value: string): boolean;
}

/** `bolTimestamp`, the two date comparisons and the date check. */
export async function loadBlDateLib(): Promise<BlDateLib> {
  const [format, compare, validate] = await Promise.all([
    GMT_MODULES["intermodal/format"](),
    GMT_MODULES["plain/compare"](),
    GMT_MODULES["plain/validate"](),
  ]);
  return {
    bolTimestamp: format["bolTimestamp"] as BlDateLib["bolTimestamp"],
    isAfterDate: compare["isAfterDate"] as BlDateLib["isAfterDate"],
    areDatesEqual: compare["areDatesEqual"] as BlDateLib["areDatesEqual"],
    isValidDate: validate["isValidDate"] as BlDateLib["isValidDate"],
  };
}

/** `demurrageClock`, the two calls that put its strings on one clock, and the instant check. */
export async function loadDemurrageLib(): Promise<DemurrageLib> {
  const [calculate, convert, utcCalculate, validate] = await Promise.all([
    GMT_MODULES["intermodal/calculate"](),
    GMT_MODULES["instant/convert"](),
    GMT_MODULES["utc/calculate"](),
    GMT_MODULES["precision/validate"](),
  ]);
  return {
    demurrageClock: calculate[
      "demurrageClock"
    ] as DemurrageLib["demurrageClock"],
    toOffsetInstant: convert[
      "toOffsetInstant"
    ] as DemurrageLib["toOffsetInstant"],
    diffUtcAsDuration: utcCalculate[
      "diffUtcAsDuration"
    ] as DemurrageLib["diffUtcAsDuration"],
    isValidInstant: validate[
      "isValidInstant"
    ] as DemurrageLib["isValidInstant"],
  };
}
