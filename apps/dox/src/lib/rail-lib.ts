/**
 * Loads the real gmt functions the rail tools call, at module granularity, and hands them
 * back as a `RailLib`.
 *
 * The GTFS time reader and writer live in `rail/parse`, `rail/format` and `rail/validate`.
 * `isValidTime` comes from `plain/validate`: the GTFS Time Reader puts the same text through a
 * clock-time check to show what folding a stop time into one day does. Each name is picked from
 * its module and nothing else is read.
 *
 * `loadServiceDayLib` is the GTFS Service Day Clock's: `RailLib` plus `gtfsToInstant` from
 * `rail/convert` and the calls that draw its midnight anchor, its gap and its day rail
 * (`resolveLocal`, `classifyLocal`, the UTC arithmetic, `convertUtcToZoned`, `getDstTransitions`).
 * `loadRailLib` stays as it is, so the Time Reader loads nothing it does not call.
 *
 * A heavy module: only a tool's mount imports it. A module that fails to load, or a name it
 * no longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type { GtfsTime } from "@northguild/gmt/types";
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The functions the rail tools call, as the library declares them. */
export interface RailLib {
  // rail/parse
  parseGtfsTime(value: string): GtfsTime | null;
  // rail/format
  formatGtfsTime(value: GtfsTime): string;
  // rail/validate
  isValidGtfsTime(value: string): boolean;
  // plain/validate
  isValidTime(value: string): boolean;
}

export async function loadRailLib(): Promise<RailLib> {
  try {
    const [railParse, railFormat, railValidate, plainValidate] =
      await Promise.all([
        GMT_MODULES["rail/parse"](),
        GMT_MODULES["rail/format"](),
        GMT_MODULES["rail/validate"](),
        GMT_MODULES["plain/validate"](),
      ]);
    return {
      ...pickFunctions(railParse, ["parseGtfsTime"]),
      ...pickFunctions(railFormat, ["formatGtfsTime"]),
      ...pickFunctions(railValidate, ["isValidGtfsTime"]),
      ...pickFunctions(plainValidate, ["isValidTime"]),
    } as unknown as RailLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

/** The duration units the UTC arithmetic takes that the tool uses. */
export type UtcUnits = Partial<Record<"days" | "hours" | "seconds", number>>;

/** What the GTFS Service Day Clock calls, as the library declares it. */
export interface ServiceDayLib extends RailLib {
  // rail/convert
  gtfsToInstant(
    serviceDate: string,
    gtfsTime: string,
    timeZone: string,
  ): string;
  // instant/convert
  resolveLocal(localDateTime: string, timeZone: string): string;
  classifyLocal(
    localDateTime: string,
    timeZone: string,
  ): "unique" | "ambiguous" | "nonexistent" | null;
  // utc/calculate
  addUtc(value: string, units: UtcUnits): string;
  subtractUtc(value: string, units: UtcUnits): string;
  diffUtc(value1: string, value2: string, unit: "minutes"): number | null;
  minUtc(values: string[]): string | null;
  maxUtc(values: string[]): string | null;
  isBetweenUtc(value: string, start: string, end: string): boolean;
  // utc/convert
  convertUtcToZoned(value: string, timeZone: string): string;
  convertUtcToPlainDate(value: string): string;
  // zoned/get
  getDstTransitions(
    timeZone: string,
    year: number,
  ): { instant: string; offsetBefore: string; offsetAfter: string }[];
  // plain/parse
  parseYearFromDate(value: string): string;
}

export async function loadServiceDayLib(): Promise<ServiceDayLib> {
  try {
    const [
      rail,
      railConvert,
      instantConvert,
      utcCalculate,
      utcConvert,
      zonedGet,
      plainParse,
    ] = await Promise.all([
      loadRailLib(),
      GMT_MODULES["rail/convert"](),
      GMT_MODULES["instant/convert"](),
      GMT_MODULES["utc/calculate"](),
      GMT_MODULES["utc/convert"](),
      GMT_MODULES["zoned/get"](),
      GMT_MODULES["plain/parse"](),
    ]);
    return {
      ...rail,
      ...pickFunctions(railConvert, ["gtfsToInstant"]),
      ...pickFunctions(instantConvert, ["resolveLocal", "classifyLocal"]),
      ...pickFunctions(utcCalculate, [
        "addUtc",
        "subtractUtc",
        "diffUtc",
        "minUtc",
        "maxUtc",
        "isBetweenUtc",
      ]),
      ...pickFunctions(utcConvert, [
        "convertUtcToZoned",
        "convertUtcToPlainDate",
      ]),
      ...pickFunctions(zonedGet, ["getDstTransitions"]),
      ...pickFunctions(plainParse, ["parseYearFromDate"]),
    } as unknown as ServiceDayLib;
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
}
