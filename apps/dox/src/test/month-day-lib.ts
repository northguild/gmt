/**
 * The real gmt functions the Leap-Day Birthday tests inject as a
 * `MonthDayLib`, loaded by module path so a test never needs the loader's
 * dynamic imports.
 */
import { addDate } from "@northguild/gmt/plain/calculate";
import {
  areMonthDaysEqual,
  compareMonthDays,
} from "@northguild/gmt/plain/compare";
import { monthDayToDate } from "@northguild/gmt/plain/convert";
import { formatMonthDay } from "@northguild/gmt/plain/format";
import {
  parseMonthDay,
  parseMonthDayFromDate,
  parseMonthDayFromDateTime,
} from "@northguild/gmt/plain/parse";
import { isValidDate, isValidMonthDay } from "@northguild/gmt/plain/validate";
import type { MonthDayLib } from "~/lib/month-day-lib";

export const monthDayLib = {
  isValidMonthDay,
  isValidDate,
  parseMonthDay,
  parseMonthDayFromDate,
  parseMonthDayFromDateTime,
  formatMonthDay,
  compareMonthDays,
  areMonthDaysEqual,
  monthDayToDate,
  addDate,
} as unknown as MonthDayLib;
