/**
 * The real gmt functions the GTFS Service Day Clock tests inject as a `ServiceDayLib`, loaded
 * by module path so a test never needs the loader's dynamic imports.
 */
import { gtfsToInstant } from "@northguild/gmt/rail/convert";
import { formatGtfsTime } from "@northguild/gmt/rail/format";
import { parseGtfsTime } from "@northguild/gmt/rail/parse";
import { isValidGtfsTime } from "@northguild/gmt/rail/validate";
import { isValidTime } from "@northguild/gmt/plain/validate";
import { parseYearFromDate } from "@northguild/gmt/plain/parse";
import { classifyLocal, resolveLocal } from "@northguild/gmt/instant/convert";
import {
  addUtc,
  diffUtc,
  isBetweenUtc,
  maxUtc,
  minUtc,
  subtractUtc,
} from "@northguild/gmt/utc/calculate";
import {
  convertUtcToPlainDate,
  convertUtcToZoned,
} from "@northguild/gmt/utc/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import type { ServiceDayLib } from "~/lib/rail-lib";

export const serviceDayLib = {
  parseGtfsTime,
  formatGtfsTime,
  isValidGtfsTime,
  isValidTime,
  gtfsToInstant,
  resolveLocal,
  classifyLocal,
  addUtc,
  subtractUtc,
  diffUtc,
  minUtc,
  maxUtc,
  isBetweenUtc,
  convertUtcToZoned,
  convertUtcToPlainDate,
  getDstTransitions,
  parseYearFromDate,
} as unknown as ServiceDayLib;
