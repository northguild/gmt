/**
 * The real gmt functions the GTFS Trip Board tests inject as a `TripBoardLib`, loaded by module
 * path so a test never needs the loader's dynamic imports.
 */
import { diffDateTime } from "@northguild/gmt/plain/calculate";
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import type { TripBoardLib } from "~/lib/rail-lib";
import { serviceDayLib } from "./service-day-lib";

export const tripBoardLib = {
  ...serviceDayLib,
  convertUtcToPlainDateTime,
  diffDateTime,
} as unknown as TripBoardLib;
