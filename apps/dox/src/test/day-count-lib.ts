/**
 * The real gmt functions the day-count widgets' unit tests inject as a `DayCountLib`, loaded by
 * module path so a test never needs the mount's dynamic imports.
 */
import { hasSecond60 } from "@northguild/gmt/plain/validate";
import { isValidInstant } from "@northguild/gmt/precision/validate";
import { spanNs } from "@northguild/gmt/span/calculate";
import { leapSecondsBetween } from "@northguild/gmt/timescale/calculate";
import {
  fromJ2000Seconds,
  fromJulianDate,
  fromJulianDateParts,
  fromModifiedJulianDate,
  toJ2000Seconds,
  toJulianDate,
  toJulianDateParts,
  toModifiedJulianDate,
  toTAI,
} from "@northguild/gmt/timescale/convert";
import { addUtc, startOfUtc } from "@northguild/gmt/utc/calculate";
import type { DayCountLib } from "~/lib/timescale-lib";

export const lib = {
  toJulianDateParts,
  fromJulianDateParts,
  toJulianDate,
  fromJulianDate,
  toModifiedJulianDate,
  fromModifiedJulianDate,
  toJ2000Seconds,
  fromJ2000Seconds,
  toTAI,
  spanNs,
  startOfUtc,
  addUtc,
  leapSecondsBetween,
  isValidInstant,
  hasSecond60,
} as unknown as DayCountLib;
