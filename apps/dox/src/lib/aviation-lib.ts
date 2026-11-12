/**
 * Loads the real gmt functions the aviation tools call, at module granularity, and hands
 * them back as an `AviationLib`.
 *
 * The SSIM readers live in `aviation/parse`, `aviation/format` and `aviation/validate`; the
 * locale pattern parser in `plain/parse`; the locale month names in `plain/locale`; and
 * `isValidDate` in `plain/validate`. The Report Time Resolver (AV-98) adds the METAR and NOTAM
 * readers (`aviation/parse`, `aviation/validate`) and the calls that draw its strip:
 * `utc/calculate`, `utc/compare`, `utc/format`, `instant/convert`, `span/calculate`,
 * `precision/validate` and `duration/format`. Each name is picked from its module and nothing
 * else is read.
 *
 * A heavy module: only a tool's mount imports it. A module that fails to load, or a name it
 * no longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type { NotamValidity } from "@northguild/gmt/types";
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The hundred-year window a two-digit year is read in, as the library takes it. */
export interface YearWindowOptions {
  yearWindow?: number | "rolling";
}

/** The functions the aviation tools call, as the library declares them. */
export interface AviationLib {
  // aviation/parse
  parseSsimDate(value: string, options: YearWindowOptions): string;
  parseMetarTime(value: string, referenceInstant: string): string;
  parseNotamValidity(
    value: string,
    options: YearWindowOptions,
  ): NotamValidity | null;
  // aviation/format
  formatSsimDate(value: string, options: YearWindowOptions): string;
  // aviation/validate
  isValidSsimDate(value: string, options: YearWindowOptions): boolean;
  isValidMetarTime(value: string, referenceInstant: string): boolean;
  isValidNotamValidity(value: string, options: YearWindowOptions): boolean;
  // plain/parse
  parseDateWithPattern(
    value: string,
    pattern: string,
    locale?: string | string[],
    options?: YearWindowOptions,
  ): string;
  // plain/locale
  getLocaleMonthNames(
    locale: string | string[],
    style?: "long" | "short" | "narrow",
  ): string[];
  // plain/validate
  isValidDate(value: string): boolean;
  // utc/calculate
  addUtc(
    value: string,
    units: Partial<Record<UtcAddUnit, number>>,
    options?: { overflow?: "constrain" | "reject" },
  ): string;
  startOfUtc(value: string, unit: "month"): string;
  /** A single unit answers a number, or `null` for invalid input. */
  diffUtc(value1: string, value2: string, unit: "minutes"): number | null;
  diffUtcAsDuration(value1: string, value2: string, unit: "days"): string;
  // utc/compare
  isBeforeUtc(value1: string, value2: string): boolean;
  areUtcEqual(value1: string, value2: string): boolean;
  // utc/format
  formatUtc(
    value: string,
    locale?: string | string[],
    options?: Record<string, unknown>,
  ): string;
  // instant/convert
  toOffsetInstant(
    value: string,
    timeZone?: string,
  ): { instant: string; offset: string; timeZone?: string } | null;
  fromOffsetInstant(value: { instant: string; offset: string }): string;
  // span/calculate
  spanNs(start: string, end: string): bigint | null;
  // precision/validate
  isValidInstant(value: string): boolean;
  // duration/format
  formatDuration(
    value: string,
    locale?: string | string[],
    options?: { style?: "long" | "short" | "narrow" },
  ): string;
}

/** The units the Report Time Resolver adds to an instant. */
type UtcAddUnit = "months" | "days" | "minutes";

export async function loadAviationLib(): Promise<AviationLib> {
  try {
    const [
      aviationParse,
      aviationFormat,
      aviationValidate,
      parse,
      locale,
      validate,
      utcCalculate,
      utcCompare,
      utcFormat,
      instantConvert,
      spanCalculate,
      precisionValidate,
      durationFormat,
    ] = await Promise.all([
      GMT_MODULES["aviation/parse"](),
      GMT_MODULES["aviation/format"](),
      GMT_MODULES["aviation/validate"](),
      GMT_MODULES["plain/parse"](),
      GMT_MODULES["plain/locale"](),
      GMT_MODULES["plain/validate"](),
      GMT_MODULES["utc/calculate"](),
      GMT_MODULES["utc/compare"](),
      GMT_MODULES["utc/format"](),
      GMT_MODULES["instant/convert"](),
      GMT_MODULES["span/calculate"](),
      GMT_MODULES["precision/validate"](),
      GMT_MODULES["duration/format"](),
    ]);
    return {
      ...pickFunctions(aviationParse, [
        "parseSsimDate",
        "parseMetarTime",
        "parseNotamValidity",
      ]),
      ...pickFunctions(aviationFormat, ["formatSsimDate"]),
      ...pickFunctions(aviationValidate, [
        "isValidSsimDate",
        "isValidMetarTime",
        "isValidNotamValidity",
      ]),
      ...pickFunctions(parse, ["parseDateWithPattern"]),
      ...pickFunctions(locale, ["getLocaleMonthNames"]),
      ...pickFunctions(validate, ["isValidDate"]),
      ...pickFunctions(utcCalculate, [
        "addUtc",
        "startOfUtc",
        "diffUtc",
        "diffUtcAsDuration",
      ]),
      ...pickFunctions(utcCompare, ["isBeforeUtc", "areUtcEqual"]),
      ...pickFunctions(utcFormat, ["formatUtc"]),
      ...pickFunctions(instantConvert, [
        "toOffsetInstant",
        "fromOffsetInstant",
      ]),
      ...pickFunctions(spanCalculate, ["spanNs"]),
      ...pickFunctions(precisionValidate, ["isValidInstant"]),
      ...pickFunctions(durationFormat, ["formatDuration"]),
    } as unknown as AviationLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
