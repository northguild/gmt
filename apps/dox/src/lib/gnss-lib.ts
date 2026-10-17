/**
 * Loads the real gmt functions the three GNSS tools need (the GNSS Week
 * Decoder, the Satellite Clock Converter and the GNSS Rollover Checker), at
 * module granularity, and hands them back as a `GnssLib` (`gnss-widgets.ts`).
 *
 * The week and scale converters live in `gnss/convert`; `taiMinusUtc` and
 * `nextLeapSecond` in `timescale/calculate`; `toTAI` and `fromTAI` in
 * `timescale/convert`; `isLeapSecond` in `timescale/validate`; `hasSecond60` in
 * `plain/validate`; `isValidInstant` in `precision/validate`;
 * `diffUtcAsDuration`, `addUtc` and `startOfUtc` in `utc/calculate`;
 * `areUtcEqual` in `utc/compare`; `toOffsetInstant` in `instant/convert`. Each name is picked from its module and
 * nothing else is read.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";
import type {
  GnssSystem,
  GnssWeekCounter,
  RinexWeekSystem,
} from "./gnss-names";

/** How a receiver counts passes of a wrapping week counter: an integer era
 *  from 0, the era nearest the device's clock, or the first pass at or after
 *  a stated UTC instant. */
export type RolloverEra = number | "rolling" | { notBefore: string };

/** A week, time of week and era on one broadcast counter. */
export interface GnssWeek {
  week: number;
  timeOfWeekSeconds: number;
  era: number;
}

/** A RINEX navigation-file week: continuous, so it has no era. */
export interface RinexWeek {
  week: number;
  timeOfWeekSeconds: number;
}

/** The functions the three GNSS tools call, as the library declares them. */
export interface GnssLib {
  gnssWeekToUtc(
    counter: GnssWeekCounter,
    week: number,
    timeOfWeekSeconds: number,
    rolloverEra: RolloverEra,
  ): string;
  utcToGnssWeek(counter: GnssWeekCounter, utcString: string): GnssWeek | null;
  rinexWeekToUtc(
    system: RinexWeekSystem,
    week: number,
    timeOfWeekSeconds: number,
  ): string;
  utcToRinexWeek(system: RinexWeekSystem, utcString: string): RinexWeek | null;
  utcToGnss(system: GnssSystem, utcString: string): string;
  gnssToUtc(system: GnssSystem, value: string): string;
  toTAI(isoString: string): string;
  fromTAI(taiString: string): string;
  taiMinusUtc(isoString: string): number | null;
  nextLeapSecond(isoString: string): string;
  isLeapSecond(isoString: string): boolean;
  hasSecond60(value: string): boolean;
  isValidInstant(value: string): boolean;
  diffUtcAsDuration(start: string, end: string, unit: string): string;
  addUtc(value: string, units: Record<string, number>): string;
  startOfUtc(value: string, unit: string): string;
  areUtcEqual(first: string, second: string): boolean;
  toOffsetInstant(value: string): { instant: string; offset: string } | null;
}

const CONVERT_NAMES = [
  "gnssWeekToUtc",
  "utcToGnssWeek",
  "rinexWeekToUtc",
  "utcToRinexWeek",
  "utcToGnss",
  "gnssToUtc",
] as const;

const TIMESCALE_CALCULATE_NAMES = ["taiMinusUtc", "nextLeapSecond"] as const;
const TIMESCALE_CONVERT_NAMES = ["toTAI", "fromTAI"] as const;
const TIMESCALE_VALIDATE_NAMES = ["isLeapSecond"] as const;
const PLAIN_VALIDATE_NAMES = ["hasSecond60"] as const;
const PRECISION_VALIDATE_NAMES = ["isValidInstant"] as const;
const UTC_CALCULATE_NAMES = [
  "diffUtcAsDuration",
  "addUtc",
  "startOfUtc",
] as const;
const UTC_COMPARE_NAMES = ["areUtcEqual"] as const;
const INSTANT_CONVERT_NAMES = ["toOffsetInstant"] as const;

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

export async function loadGnssLib(): Promise<GnssLib> {
  try {
    const [
      convert,
      timescaleCalculate,
      timescaleConvert,
      timescaleValidate,
      plainValidate,
      precisionValidate,
      utcCalculate,
      utcCompare,
      instantConvert,
    ] = await Promise.all([
      GMT_MODULES["gnss/convert"](),
      GMT_MODULES["timescale/calculate"](),
      GMT_MODULES["timescale/convert"](),
      GMT_MODULES["timescale/validate"](),
      GMT_MODULES["plain/validate"](),
      GMT_MODULES["precision/validate"](),
      GMT_MODULES["utc/calculate"](),
      GMT_MODULES["utc/compare"](),
      GMT_MODULES["instant/convert"](),
    ]);
    return {
      ...pick(convert, CONVERT_NAMES),
      ...pick(timescaleCalculate, TIMESCALE_CALCULATE_NAMES),
      ...pick(timescaleConvert, TIMESCALE_CONVERT_NAMES),
      ...pick(timescaleValidate, TIMESCALE_VALIDATE_NAMES),
      ...pick(plainValidate, PLAIN_VALIDATE_NAMES),
      ...pick(precisionValidate, PRECISION_VALIDATE_NAMES),
      ...pick(utcCalculate, UTC_CALCULATE_NAMES),
      ...pick(utcCompare, UTC_COMPARE_NAMES),
      ...pick(instantConvert, INSTANT_CONVERT_NAMES),
    } as unknown as GnssLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
