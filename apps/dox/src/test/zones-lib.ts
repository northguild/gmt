/**
 * The real gmt functions the zone widgets' unit tests inject, loaded by module path so a test
 * never needs a mount's dynamic imports. Each export is typed as the `…Lib` its loader returns.
 */
import {
  convertPlainDateTimeToZoned,
  convertZonedToZoned,
} from "@northguild/gmt/zoned/convert";
import {
  formatRelativeZoned,
  formatZonedToParts,
} from "@northguild/gmt/zoned/format";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import {
  intervalDifferenceZoned,
  intervalIntersectionZoned,
  intervalUnionZoned,
  intervalXorZoned,
} from "@northguild/gmt/zoned/interval";
import {
  isValidZonedDateTime,
  isValidZonedRange,
} from "@northguild/gmt/zoned/validate";
import * as regexes from "@northguild/gmt/regex";
import type { ConverterLib } from "~/lib/converter-bench";
import type { DstLib } from "~/lib/dst-inspector";
import type { IntervalLib } from "~/lib/interval-visualizer";

export const converterLib = {
  convertZonedToZoned,
  formatZonedToParts,
  formatRelativeZoned,
  regexes: { ...regexes },
} as unknown as ConverterLib;

export const dstLib = {
  getDstTransitions,
  convertPlainDateTimeToZoned,
} as unknown as DstLib;

export const intervalLib = {
  fns: {
    intersection: intervalIntersectionZoned,
    union: intervalUnionZoned,
    difference: intervalDifferenceZoned,
    xor: intervalXorZoned,
  },
  isValidZonedDateTime,
  isValidZonedRange,
} as unknown as IntervalLib;
