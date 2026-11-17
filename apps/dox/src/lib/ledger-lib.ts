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
 *
 * The Billing Deadlines, Dwell Ledger and Free Time Ledger loaders also turn a
 * failed import into a `WidgetLoadError` themselves, because the mount and the
 * page's WebMCP tool both call them and neither needs to wrap the cause.
 */
import type {
  BillingDeadlines,
  DatesArg,
  WindowsArg,
} from "./billing-deadlines";
import type { DwellResult } from "./dwell-ledger";
import type {
  ChargesResult,
  ChargeTermsArg,
  FreeTimeResult,
  TermsArg,
} from "./free-time-ledger";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

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

/** What `billingTimeline` and the date check the page makes before it need. */
export interface BillingLib {
  billingTimeline(
    dates: DatesArg,
    windows: WindowsArg,
  ): BillingDeadlines | null;
  isValidDate(value: string): boolean;
}

/** `billingTimeline` and the date check. */
export async function loadBillingLib(): Promise<BillingLib> {
  try {
    const [intermodal, plainValidate] = await Promise.all([
      GMT_MODULES["intermodal/calculate"](),
      GMT_MODULES["plain/validate"](),
    ]);
    return {
      billingTimeline: intermodal[
        "billingTimeline"
      ] as BillingLib["billingTimeline"],
      isValidDate: plainValidate["isValidDate"] as BillingLib["isValidDate"],
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

export interface DwellLib {
  dwellTime(entry: string, exit: string, zone?: string): DwellResult | null;
  isValidInstant(value: string): boolean;
  isValidTimeZone(value: string): boolean;
  isValidZonedDateTime(value: string): boolean;
}

/** `dwellTime` and the three checks that say why it refused. */
export async function loadDwellLib(): Promise<DwellLib> {
  try {
    const [transport, precision, zoned] = await Promise.all([
      GMT_MODULES["transport/calculate"](),
      GMT_MODULES["precision/validate"](),
      GMT_MODULES["zoned/validate"](),
    ]);
    return {
      dwellTime: transport["dwellTime"] as DwellLib["dwellTime"],
      isValidInstant: precision["isValidInstant"] as DwellLib["isValidInstant"],
      isValidTimeZone: zoned["isValidTimeZone"] as DwellLib["isValidTimeZone"],
      isValidZonedDateTime: zoned[
        "isValidZonedDateTime"
      ] as DwellLib["isValidZonedDateTime"],
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

export interface FreeTimeLib {
  freeTimeExpiry(
    clockStart: string,
    freeDays: number,
    options: TermsArg,
  ): FreeTimeResult | null;
  chargeableDays(
    clockStart: string,
    clockEnd: string,
    freeDays: number,
    options: ChargeTermsArg & { tiers?: number[] },
  ): ChargesResult | null;
  isValidInstant(value: string): boolean;
  isValidTimeZone(value: string): boolean;
  isValidBusinessCalendar(value: unknown): boolean;
}

/** `freeTimeExpiry`, `chargeableDays` and the three checks that say why they refused. */
export async function loadFreeTimeLib(): Promise<FreeTimeLib> {
  try {
    const [intermodal, precision, zoned, calendar] = await Promise.all([
      GMT_MODULES["intermodal/calculate"](),
      GMT_MODULES["precision/validate"](),
      GMT_MODULES["zoned/validate"](),
      GMT_MODULES["calendar/validate"](),
    ]);
    return {
      freeTimeExpiry: intermodal[
        "freeTimeExpiry"
      ] as FreeTimeLib["freeTimeExpiry"],
      chargeableDays: intermodal[
        "chargeableDays"
      ] as FreeTimeLib["chargeableDays"],
      isValidInstant: precision[
        "isValidInstant"
      ] as FreeTimeLib["isValidInstant"],
      isValidTimeZone: zoned[
        "isValidTimeZone"
      ] as FreeTimeLib["isValidTimeZone"],
      isValidBusinessCalendar: calendar[
        "isValidBusinessCalendar"
      ] as FreeTimeLib["isValidBusinessCalendar"],
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
