/**
 * The real gmt functions the leap-second widgets' unit tests inject as a
 * `TimescaleLib`, loaded by module path so a test never needs the mount's
 * dynamic imports.
 */
import { hasSecond60 } from "@northguild/gmt/plain/validate";
import { isValidInstant } from "@northguild/gmt/precision/validate";
import { spanNs } from "@northguild/gmt/span/calculate";
import {
  leapSecondsBetween,
  nextLeapSecond,
  taiMinusUtc,
} from "@northguild/gmt/timescale/calculate";
import { fromTAI, toTAI } from "@northguild/gmt/timescale/convert";
import { isLeapSecond } from "@northguild/gmt/timescale/validate";
import { addUtc, startOfUtc } from "@northguild/gmt/utc/calculate";
import type { TimescaleLib } from "~/lib/timescale-lib";

export const lib = {
  taiMinusUtc,
  leapSecondsBetween,
  nextLeapSecond,
  toTAI,
  fromTAI,
  isLeapSecond,
  spanNs,
  addUtc,
  startOfUtc,
  hasSecond60,
  isValidInstant,
} as unknown as TimescaleLib;
