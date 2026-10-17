/**
 * The real gmt functions the GNSS widgets' unit tests inject as a `GnssLib`,
 * loaded by module path so a test never needs the mount's dynamic imports.
 */
import {
  gnssToUtc,
  gnssWeekToUtc,
  rinexWeekToUtc,
  utcToGnss,
  utcToGnssWeek,
  utcToRinexWeek,
} from "@northguild/gmt/gnss/convert";
import { hasSecond60 } from "@northguild/gmt/plain/validate";
import { isValidInstant } from "@northguild/gmt/precision/validate";
import {
  nextLeapSecond,
  taiMinusUtc,
} from "@northguild/gmt/timescale/calculate";
import { fromTAI, toTAI } from "@northguild/gmt/timescale/convert";
import { isLeapSecond } from "@northguild/gmt/timescale/validate";
import {
  addUtc,
  diffUtcAsDuration,
  startOfUtc,
} from "@northguild/gmt/utc/calculate";
import { areUtcEqual } from "@northguild/gmt/utc/compare";
import { toOffsetInstant } from "@northguild/gmt/instant/convert";
import type { GnssLib } from "~/lib/gnss-lib";

export const lib = {
  gnssWeekToUtc,
  utcToGnssWeek,
  rinexWeekToUtc,
  utcToRinexWeek,
  utcToGnss,
  gnssToUtc,
  toTAI,
  fromTAI,
  taiMinusUtc,
  nextLeapSecond,
  isLeapSecond,
  hasSecond60,
  isValidInstant,
  diffUtcAsDuration,
  addUtc,
  startOfUtc,
  areUtcEqual,
  toOffsetInstant,
} as unknown as GnssLib;
