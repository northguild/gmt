/**
 * The real gmt functions the rail tests inject as a `RailLib`, loaded by module path so a test
 * never needs the loader's dynamic imports.
 */
import { formatGtfsTime } from "@northguild/gmt/rail/format";
import { parseGtfsTime } from "@northguild/gmt/rail/parse";
import { isValidGtfsTime } from "@northguild/gmt/rail/validate";
import { isValidTime } from "@northguild/gmt/plain/validate";
import type { RailLib } from "~/lib/rail-lib";

export const railLib = {
  parseGtfsTime,
  formatGtfsTime,
  isValidGtfsTime,
  isValidTime,
} as unknown as RailLib;
