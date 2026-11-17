/**
 * The real gmt functions the ledger family's unit tests inject, loaded by
 * module path so a test never needs a mount's dynamic imports. Each export is
 * typed as the `…Lib` its tool's loader returns.
 */
import { resolveLocal, toOffsetInstant } from "@northguild/gmt/instant/convert";
import {
  billingTimeline,
  chargeableDays,
  demurrageClock,
  freeTimeExpiry,
  multimodalETA,
} from "@northguild/gmt/intermodal/calculate";
import { isValidBusinessCalendar } from "@northguild/gmt/calendar/validate";
import { bolTimestamp } from "@northguild/gmt/intermodal/format";
import { areDatesEqual, isAfterDate } from "@northguild/gmt/plain/compare";
import { isValidDate, isValidDateTime } from "@northguild/gmt/plain/validate";
import { isValidInstant } from "@northguild/gmt/precision/validate";
import {
  crossingTime,
  dwellTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { diffUtcAsDuration } from "@northguild/gmt/utc/calculate";
import {
  isValidTimeZone,
  isValidZonedDateTime,
} from "@northguild/gmt/zoned/validate";
import type {
  BillingLib,
  BlDateLib,
  DemurrageLib,
  DwellLib,
  FreeTimeLib,
} from "~/lib/ledger-lib";
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

export const billingLib = {
  billingTimeline,
  isValidDate,
} as unknown as BillingLib;

export const dwellLib = {
  dwellTime,
  isValidInstant,
  isValidTimeZone,
  isValidZonedDateTime,
} as unknown as DwellLib;

export const freeTimeLib = {
  freeTimeExpiry,
  chargeableDays,
  isValidInstant,
  isValidTimeZone,
  isValidBusinessCalendar,
} as unknown as FreeTimeLib;
