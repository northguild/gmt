/**
 * Loads the real gmt functions the three timescale tools need (the Leap Second
 * Timeline, Elapsed vs. Clock Difference and the Terrestrial Time Stack), at
 * module granularity, and hands them back as a `TimescaleLib`
 * (`timescale-widgets.ts`).
 *
 * `taiMinusUtc`, `tcgMinusTt`, `leapSecondsBetween` and `nextLeapSecond` live in
 * `timescale/calculate`; `toTAI`, `fromTAI`, `toTT`, `fromTT`, `toTCG` and
 * `fromTCG` in `timescale/convert`; `isLeapSecond` in `timescale/validate`;
 * `spanNs` in `span/calculate`; `addUtc`, `startOfUtc` and `diffUtcAsDuration`
 * in `utc/calculate`; `hasSecond60` in `plain/validate`; `isValidInstant` in
 * `precision/validate`. Each name is picked from its module and nothing else is
 * read.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The functions the two leap-second tools call, as the library declares them. */
export interface TimescaleLib {
  taiMinusUtc(isoString: string): number | null;
  tcgMinusTt(isoString: string): number | null;
  leapSecondsBetween(start: string, end: string): number | null;
  nextLeapSecond(isoString: string): string;
  toTAI(isoString: string): string;
  fromTAI(taiString: string): string;
  toTT(isoString: string): string;
  fromTT(ttString: string): string;
  toTCG(isoString: string): string;
  fromTCG(tcgString: string): string;
  isLeapSecond(isoString: string): boolean;
  spanNs(start: string, end: string): bigint | null;
  addUtc(value: string, units: Record<string, number>): string;
  startOfUtc(value: string, unit: string): string;
  diffUtcAsDuration(start: string, end: string, unit: string): string;
  hasSecond60(value: string): boolean;
  isValidInstant(value: string): boolean;
}

const CALCULATE_NAMES = [
  "taiMinusUtc",
  "tcgMinusTt",
  "leapSecondsBetween",
  "nextLeapSecond",
] as const;
const CONVERT_NAMES = [
  "toTAI",
  "fromTAI",
  "toTT",
  "fromTT",
  "toTCG",
  "fromTCG",
] as const;
const VALIDATE_NAMES = ["isLeapSecond"] as const;
const SPAN_NAMES = ["spanNs"] as const;
const UTC_CALCULATE_NAMES = [
  "addUtc",
  "startOfUtc",
  "diffUtcAsDuration",
] as const;
const PLAIN_VALIDATE_NAMES = ["hasSecond60"] as const;
const PRECISION_VALIDATE_NAMES = ["isValidInstant"] as const;

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
      ...pickFunctions(calculate, CALCULATE_NAMES),
      ...pickFunctions(convert, CONVERT_NAMES),
      ...pickFunctions(validate, VALIDATE_NAMES),
      ...pickFunctions(spanCalculate, SPAN_NAMES),
      ...pickFunctions(utcCalculate, UTC_CALCULATE_NAMES),
      ...pickFunctions(plainValidate, PLAIN_VALIDATE_NAMES),
      ...pickFunctions(precisionValidate, PRECISION_VALIDATE_NAMES),
    } as unknown as TimescaleLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}

/**
 * The functions the Julian Day Counter and the Double Precision Meter call, as the library
 * declares them. A separate loader from `TimescaleLib`: the three older tools stay as they are.
 * `scale` is always passed, so no call leans on a default.
 */
export interface DayCountLib {
  toJulianDateParts(
    isoString: string,
    scale: string,
  ): { jd1: number; jd2: number } | null;
  fromJulianDateParts(
    parts: { jd1: number; jd2: number },
    scale: string,
  ): string;
  toJulianDate(isoString: string, scale: string): number | null;
  fromJulianDate(jd: number, scale: string): string;
  toModifiedJulianDate(isoString: string, scale: string): number | null;
  fromModifiedJulianDate(mjd: number, scale: string): string;
  toJ2000Seconds(isoString: string, scale: string): number | null;
  fromJ2000Seconds(seconds: number, scale: string): string;
  toTAI(isoString: string): string;
  spanNs(start: string, end: string): bigint | null;
  startOfUtc(value: string, unit: string): string;
  addUtc(value: string, units: Record<string, number>): string;
  leapSecondsBetween(start: string, end: string): number | null;
  isValidInstant(value: string): boolean;
  hasSecond60(value: string): boolean;
}

const DAY_COUNT_CONVERT_NAMES = [
  "toJulianDateParts",
  "fromJulianDateParts",
  "toJulianDate",
  "fromJulianDate",
  "toModifiedJulianDate",
  "fromModifiedJulianDate",
  "toJ2000Seconds",
  "fromJ2000Seconds",
  "toTAI",
] as const;
const DAY_COUNT_CALCULATE_NAMES = ["leapSecondsBetween"] as const;

/**
 * Loads the day-count functions at module granularity. A rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError`, as in `loadTimescaleLib`.
 */
export async function loadDayCountLib(): Promise<DayCountLib> {
  try {
    const [
      convert,
      calculate,
      spanCalculate,
      utcCalculate,
      plainValidate,
      precisionValidate,
    ] = await Promise.all([
      GMT_MODULES["timescale/convert"](),
      GMT_MODULES["timescale/calculate"](),
      GMT_MODULES["span/calculate"](),
      GMT_MODULES["utc/calculate"](),
      GMT_MODULES["plain/validate"](),
      GMT_MODULES["precision/validate"](),
    ]);
    return {
      ...pickFunctions(convert, DAY_COUNT_CONVERT_NAMES),
      ...pickFunctions(calculate, DAY_COUNT_CALCULATE_NAMES),
      ...pickFunctions(spanCalculate, SPAN_NAMES),
      ...pickFunctions(utcCalculate, ["startOfUtc", "addUtc"]),
      ...pickFunctions(plainValidate, PLAIN_VALIDATE_NAMES),
      ...pickFunctions(precisionValidate, PRECISION_VALIDATE_NAMES),
    } as unknown as DayCountLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
