/**
 * Loads the real gmt functions the rail tools call, at module granularity, and hands them
 * back as a `RailLib`.
 *
 * The GTFS time reader and writer live in `rail/parse`, `rail/format` and `rail/validate`.
 * `isValidTime` comes from `plain/validate`: the GTFS Time Reader puts the same text through a
 * clock-time check to show what folding a stop time into one day does. Each name is picked from
 * its module and nothing else is read.
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
