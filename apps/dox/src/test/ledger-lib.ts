/**
 * The real gmt functions the ledger family's unit tests inject, loaded by
 * module path so a test never needs a mount's dynamic imports. Each export is
 * typed as the `…Lib` its tool's loader returns.
 */
import { resolveLocal, toOffsetInstant } from "@northguild/gmt/instant/convert";
import {
  demurrageClock,
  multimodalETA,
} from "@northguild/gmt/intermodal/calculate";
import { bolTimestamp } from "@northguild/gmt/intermodal/format";
import { areDatesEqual, isAfterDate } from "@northguild/gmt/plain/compare";
import { isValidDate, isValidDateTime } from "@northguild/gmt/plain/validate";
import { isValidInstant } from "@northguild/gmt/precision/validate";
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { diffUtcAsDuration } from "@northguild/gmt/utc/calculate";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import type { BlDateLib, DemurrageLib } from "~/lib/ledger-lib";
import type { JourneyLib } from "~/lib/transport-lib";

export const blDateLib = {
  bolTimestamp,
  isAfterDate,
  areDatesEqual,
  isValidDate,
} as unknown as BlDateLib;

export const demurrageLib = {
  demurrageClock,
  toOffsetInstant,
  diffUtcAsDuration,
  isValidInstant,
} as unknown as DemurrageLib;

export const journeyLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
  multimodalETA,
  diffUtcAsDuration,
} as unknown as JourneyLib;
