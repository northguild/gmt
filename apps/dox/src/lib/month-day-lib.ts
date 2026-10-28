/**
 * Loads the real gmt functions the Leap-Day Birthday tool calls, at module
 * granularity, and hands them back as a `MonthDayLib`.
 *
 * `isValidMonthDay` and `isValidDate` live in `plain/validate`; the month-day
 * readers in `plain/parse`; `formatMonthDay` in `plain/format`;
 * `compareMonthDays` and `areMonthDaysEqual` in `plain/compare`;
 * `monthDayToDate` in `plain/convert`; `addDate` in `plain/calculate`. Each name
 * is picked from its module and nothing else is read.
 *
 * A heavy module: only the tool's mount imports it. A module that fails to
 * load, or a name it no longer exports, becomes a `WidgetLoadError` rather than
 * a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The functions the tool calls, as the library declares them. */
export interface MonthDayLib {
  // plain/validate
  isValidMonthDay(value: string): boolean;
  isValidDate(value: string): boolean;
  // plain/parse
  parseMonthDay(value: string): string;
  parseMonthDayFromDate(value: string): string;
  parseMonthDayFromDateTime(value: string): string;
  // plain/format
  formatMonthDay(
    value: string,
    locale?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ): string;
  // plain/compare
  compareMonthDays(a: string, b: string): number | null;
  areMonthDaysEqual(a: string, b: string): boolean;
  // plain/convert
  monthDayToDate(monthDay: string, year: number): string;
  // plain/calculate
  addDate(value: string, duration: { days: number }): string;
}

export async function loadMonthDayLib(): Promise<MonthDayLib> {
  try {
    const [validate, parse, format, compare, convert, calculate] =
      await Promise.all([
        GMT_MODULES["plain/validate"](),
        GMT_MODULES["plain/parse"](),
        GMT_MODULES["plain/format"](),
        GMT_MODULES["plain/compare"](),
        GMT_MODULES["plain/convert"](),
        GMT_MODULES["plain/calculate"](),
      ]);
    return {
      ...pickFunctions(validate, ["isValidMonthDay", "isValidDate"]),
      ...pickFunctions(parse, [
        "parseMonthDay",
        "parseMonthDayFromDate",
        "parseMonthDayFromDateTime",
      ]),
      ...pickFunctions(format, ["formatMonthDay"]),
      ...pickFunctions(compare, ["compareMonthDays", "areMonthDaysEqual"]),
      ...pickFunctions(convert, ["monthDayToDate"]),
      ...pickFunctions(calculate, ["addDate"]),
    } as unknown as MonthDayLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
