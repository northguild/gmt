/**
 * The real gmt functions the holiday tools' unit tests inject as a
 * `HolidayLib`, loaded by module path so a test never needs the loader's
 * dynamic imports.
 */
import {
  buildBusinessCalendar,
  easterSunday,
  holidayDates,
  nthWeekdayOfMonth,
  observedDate,
} from "@northguild/gmt/calendar/rules";
import { isValidHolidayRule } from "@northguild/gmt/calendar/validate";
import { diffDate } from "@northguild/gmt/plain/calculate";
import { areDatesEqual, isBusinessDay } from "@northguild/gmt/plain/compare";
import type { FeastsLib } from "~/lib/feasts-lib";
import type { HolidayLib } from "~/lib/holiday-lib";

export const lib = {
  nthWeekdayOfMonth,
  easterSunday,
  observedDate,
  holidayDates,
  buildBusinessCalendar,
  isValidHolidayRule,
  isBusinessDay,
  areDatesEqual,
} as unknown as HolidayLib;

/** The same, plus `diffDate`, for the Moving Feasts tests. */
export const feastsLib = {
  ...lib,
  diffDate,
} as unknown as FeastsLib;
