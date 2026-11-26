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
import { GMT_MODULES } from "./gmt-modules";
import { pickTyped } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The library modules the rail tools read, typed by the library itself. */
type RailParse = typeof import("@northguild/gmt/rail/parse");
type RailFormat = typeof import("@northguild/gmt/rail/format");
type RailValidate = typeof import("@northguild/gmt/rail/validate");
type PlainValidate = typeof import("@northguild/gmt/plain/validate");
type RailConvert = typeof import("@northguild/gmt/rail/convert");
type InstantConvert = typeof import("@northguild/gmt/instant/convert");
type UtcCalculate = typeof import("@northguild/gmt/utc/calculate");
type UtcConvert = typeof import("@northguild/gmt/utc/convert");
type ZonedGet = typeof import("@northguild/gmt/zoned/get");
type PlainParse = typeof import("@northguild/gmt/plain/parse");
type PlainCalculate = typeof import("@northguild/gmt/plain/calculate");

/** The functions the rail tools call, as the library declares them. */
export type RailLib = Pick<RailParse, "parseGtfsTime"> &
  Pick<RailFormat, "formatGtfsTime"> &
  Pick<RailValidate, "isValidGtfsTime"> &
  Pick<PlainValidate, "isValidTime">;

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
      ...pickTyped<RailParse, "parseGtfsTime">(railParse, ["parseGtfsTime"]),
      ...pickTyped<RailFormat, "formatGtfsTime">(railFormat, [
        "formatGtfsTime",
      ]),
      ...pickTyped<RailValidate, "isValidGtfsTime">(railValidate, [
        "isValidGtfsTime",
      ]),
      ...pickTyped<PlainValidate, "isValidTime">(plainValidate, [
        "isValidTime",
      ]),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

/** What the GTFS Service Day Clock calls, as the library declares it. */
export type ServiceDayLib = RailLib &
  Pick<RailConvert, "gtfsToInstant"> &
  Pick<InstantConvert, "resolveLocal" | "classifyLocal"> &
  Pick<
    UtcCalculate,
    "addUtc" | "subtractUtc" | "diffUtc" | "minUtc" | "maxUtc" | "isBetweenUtc"
  > &
  Pick<UtcConvert, "convertUtcToZoned" | "convertUtcToPlainDate"> &
  Pick<ZonedGet, "getDstTransitions"> &
  Pick<PlainParse, "parseYearFromDate">;

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
      ...pickTyped<RailConvert, "gtfsToInstant">(railConvert, [
        "gtfsToInstant",
      ]),
      ...pickTyped<InstantConvert, "resolveLocal" | "classifyLocal">(
        instantConvert,
        ["resolveLocal", "classifyLocal"],
      ),
      ...pickTyped<
        UtcCalculate,
        | "addUtc"
        | "subtractUtc"
        | "diffUtc"
        | "minUtc"
        | "maxUtc"
        | "isBetweenUtc"
      >(utcCalculate, [
        "addUtc",
        "subtractUtc",
        "diffUtc",
        "minUtc",
        "maxUtc",
        "isBetweenUtc",
      ]),
      ...pickTyped<UtcConvert, "convertUtcToZoned" | "convertUtcToPlainDate">(
        utcConvert,
        ["convertUtcToZoned", "convertUtcToPlainDate"],
      ),
      ...pickTyped<ZonedGet, "getDstTransitions">(zonedGet, [
        "getDstTransitions",
      ]),
      ...pickTyped<PlainParse, "parseYearFromDate">(plainParse, [
        "parseYearFromDate",
      ]),
    };
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
}

/** What the GTFS Trip Board calls: the Service Day Clock's, plus the clock-side difference. */
export type TripBoardLib = ServiceDayLib &
  Pick<UtcConvert, "convertUtcToPlainDateTime"> &
  Pick<PlainCalculate, "diffDateTime">;

export async function loadTripBoardLib(): Promise<TripBoardLib> {
  try {
    const [serviceDay, utcConvert, plainCalculate] = await Promise.all([
      loadServiceDayLib(),
      GMT_MODULES["utc/convert"](),
      GMT_MODULES["plain/calculate"](),
    ]);
    return {
      ...serviceDay,
      ...pickTyped<UtcConvert, "convertUtcToPlainDateTime">(utcConvert, [
        "convertUtcToPlainDateTime",
      ]),
      ...pickTyped<PlainCalculate, "diffDateTime">(plainCalculate, [
        "diffDateTime",
      ]),
    };
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
}
