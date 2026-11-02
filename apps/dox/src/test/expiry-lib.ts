/**
 * The real gmt functions the Expiry Calculator tests inject as an `ExpiryLib`, loaded by module
 * path so a test never needs the loader's dynamic imports.
 */
import {
  durationFromUnits,
  totalDuration,
  ttlFromNow,
} from "@northguild/gmt/duration/calculate";
import { addUnix } from "@northguild/gmt/unix/calculate";
import { addUtc } from "@northguild/gmt/utc/calculate";
import {
  convertUtcToUnix,
  convertUtcToZoned,
} from "@northguild/gmt/utc/convert";
import { formatHttpDate } from "@northguild/gmt/utc/format";
import { getUtcIn } from "@northguild/gmt/utc/get";
import { isValidUtc } from "@northguild/gmt/utc/validate";
import type { ExpiryLib } from "~/lib/expiry-lib";

export const expiryLib = {
  durationFromUnits,
  totalDuration,
  ttlFromNow,
  addUnix,
  addUtc,
  convertUtcToUnix,
  convertUtcToZoned,
  formatHttpDate,
  getUtcIn,
  isValidUtc,
} as unknown as ExpiryLib;
