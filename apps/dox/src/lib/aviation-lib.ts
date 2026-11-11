/**
 * Loads the real gmt functions the aviation tools call, at module granularity, and hands
 * them back as an `AviationLib`.
 *
 * The SSIM readers live in `aviation/parse`, `aviation/format` and `aviation/validate`; the
 * locale pattern parser in `plain/parse`; the locale month names in `plain/locale`; and
 * `isValidDate` in `plain/validate`. Each name is picked from its module and nothing else is
 * read.
 *
 * A heavy module: only a tool's mount imports it. A module that fails to load, or a name it
 * no longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
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
  // aviation/format
  formatSsimDate(value: string, options: YearWindowOptions): string;
  // aviation/validate
  isValidSsimDate(value: string, options: YearWindowOptions): boolean;
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
}

export async function loadAviationLib(): Promise<AviationLib> {
  try {
    const [
      aviationParse,
      aviationFormat,
      aviationValidate,
      parse,
      locale,
      validate,
    ] = await Promise.all([
      GMT_MODULES["aviation/parse"](),
      GMT_MODULES["aviation/format"](),
      GMT_MODULES["aviation/validate"](),
      GMT_MODULES["plain/parse"](),
      GMT_MODULES["plain/locale"](),
      GMT_MODULES["plain/validate"](),
    ]);
    return {
      ...pickFunctions(aviationParse, ["parseSsimDate"]),
      ...pickFunctions(aviationFormat, ["formatSsimDate"]),
      ...pickFunctions(aviationValidate, ["isValidSsimDate"]),
      ...pickFunctions(parse, ["parseDateWithPattern"]),
      ...pickFunctions(locale, ["getLocaleMonthNames"]),
      ...pickFunctions(validate, ["isValidDate"]),
    } as unknown as AviationLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
