/**
 * The real gmt functions the aviation tests inject as an `AviationLib`, loaded by module
 * path so a test never needs the loader's dynamic imports.
 */
import { formatSsimDate } from "@northguild/gmt/aviation/format";
import {
  parseMetarTime,
  parseNotamValidity,
  parseSsimDate,
} from "@northguild/gmt/aviation/parse";
import {
  isValidMetarTime,
  isValidNotamValidity,
  isValidSsimDate,
} from "@northguild/gmt/aviation/validate";
import { formatDuration } from "@northguild/gmt/duration/format";
import {
  fromOffsetInstant,
  toOffsetInstant,
} from "@northguild/gmt/instant/convert";
import { getLocaleMonthNames } from "@northguild/gmt/plain/locale";
import { parseDateWithPattern } from "@northguild/gmt/plain/parse";
import { isValidDate } from "@northguild/gmt/plain/validate";
import { isValidInstant } from "@northguild/gmt/precision/validate";
import { spanNs } from "@northguild/gmt/span/calculate";
import {
  addUtc,
  diffUtc,
  diffUtcAsDuration,
  startOfUtc,
} from "@northguild/gmt/utc/calculate";
import { areUtcEqual, isBeforeUtc } from "@northguild/gmt/utc/compare";
import { formatUtc } from "@northguild/gmt/utc/format";
import type { AviationLib } from "~/lib/aviation-lib";

export const aviationLib = {
  parseSsimDate,
  formatSsimDate,
  isValidSsimDate,
  parseDateWithPattern,
  getLocaleMonthNames,
  isValidDate,
  parseMetarTime,
  parseNotamValidity,
  isValidMetarTime,
  isValidNotamValidity,
  addUtc,
  startOfUtc,
  diffUtc,
  diffUtcAsDuration,
  isBeforeUtc,
  areUtcEqual,
  formatUtc,
  toOffsetInstant,
  fromOffsetInstant,
  spanNs,
  isValidInstant,
  formatDuration,
} as unknown as AviationLib;
