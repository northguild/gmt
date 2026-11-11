/**
 * The real gmt functions the aviation tests inject as an `AviationLib`, loaded by module
 * path so a test never needs the loader's dynamic imports.
 */
import { formatSsimDate } from "@northguild/gmt/aviation/format";
import { parseSsimDate } from "@northguild/gmt/aviation/parse";
import { isValidSsimDate } from "@northguild/gmt/aviation/validate";
import { getLocaleMonthNames } from "@northguild/gmt/plain/locale";
import { parseDateWithPattern } from "@northguild/gmt/plain/parse";
import { isValidDate } from "@northguild/gmt/plain/validate";
import type { AviationLib } from "~/lib/aviation-lib";

export const aviationLib = {
  parseSsimDate,
  formatSsimDate,
  isValidSsimDate,
  parseDateWithPattern,
  getLocaleMonthNames,
  isValidDate,
} as unknown as AviationLib;
