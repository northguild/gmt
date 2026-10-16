/**
 * Loads the real gmt functions the two leap-second tools need (the Leap Second
 * Timeline and Elapsed vs. Clock Difference), at module granularity, and hands
 * them back as a `TimescaleLib` (`timescale-widgets.ts`).
 *
 * `taiMinusUtc`, `leapSecondsBetween` and `nextLeapSecond` live in
 * `timescale/calculate`; `toTAI` and `fromTAI` in `timescale/convert`;
 * `isLeapSecond` in `timescale/validate`; `spanNs` in `span/calculate`;
 * `addUtc` and `startOfUtc` in `utc/calculate`; `hasSecond60` in
 * `plain/validate`; `isValidInstant` in `precision/validate`. Each name is
 * picked from its module and nothing else is read.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** The functions the two leap-second tools call, as the library declares them. */
export interface TimescaleLib {
  taiMinusUtc(isoString: string): number | null;
  leapSecondsBetween(start: string, end: string): number | null;
  nextLeapSecond(isoString: string): string;
  toTAI(isoString: string): string;
  fromTAI(taiString: string): string;
  isLeapSecond(isoString: string): boolean;
  spanNs(start: string, end: string): bigint | null;
  addUtc(value: string, units: Record<string, number>): string;
  startOfUtc(value: string, unit: string): string;
  hasSecond60(value: string): boolean;
  isValidInstant(value: string): boolean;
}

const CALCULATE_NAMES = [
  "taiMinusUtc",
  "leapSecondsBetween",
  "nextLeapSecond",
] as const;
const CONVERT_NAMES = ["toTAI", "fromTAI"] as const;
const VALIDATE_NAMES = ["isLeapSecond"] as const;
const SPAN_NAMES = ["spanNs"] as const;
const UTC_CALCULATE_NAMES = ["addUtc", "startOfUtc"] as const;
const PLAIN_VALIDATE_NAMES = ["hasSecond60"] as const;
const PRECISION_VALIDATE_NAMES = ["isValidInstant"] as const;

/** Reads each name from a module, and fails loudly on a name it lacks. */
function pick(module: Record<string, unknown>, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => {
      if (typeof module[name] !== "function") {
        throw new Error(`The library module has no ${name}.`);
      }
      return [name, module[name]];
    }),
  );
}

export async function loadTimescaleLib(): Promise<TimescaleLib> {
  try {
    const [
      calculate,
      convert,
      validate,
      spanCalculate,
      utcCalculate,
      plainValidate,
      precisionValidate,
    ] = await Promise.all([
      GMT_MODULES["timescale/calculate"](),
      GMT_MODULES["timescale/convert"](),
      GMT_MODULES["timescale/validate"](),
      GMT_MODULES["span/calculate"](),
      GMT_MODULES["utc/calculate"](),
      GMT_MODULES["plain/validate"](),
      GMT_MODULES["precision/validate"](),
    ]);
    return {
      ...pick(calculate, CALCULATE_NAMES),
      ...pick(convert, CONVERT_NAMES),
      ...pick(validate, VALIDATE_NAMES),
      ...pick(spanCalculate, SPAN_NAMES),
      ...pick(utcCalculate, UTC_CALCULATE_NAMES),
      ...pick(plainValidate, PLAIN_VALIDATE_NAMES),
      ...pick(precisionValidate, PRECISION_VALIDATE_NAMES),
    } as unknown as TimescaleLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
