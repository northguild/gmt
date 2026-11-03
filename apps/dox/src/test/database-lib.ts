/**
 * The real gmt functions the Database Timestamp Reader's tests inject as a `DatabaseLib`, loaded
 * by module path so a test never needs the loader's dynamic imports.
 */
import { toOffsetInstant, resolveLocal } from "@northguild/gmt/instant/convert";
import { parseSqlOffsetDateTime } from "@northguild/gmt/instant/parse";
import { addDate } from "@northguild/gmt/plain/calculate";
import { parseSqlDateTime } from "@northguild/gmt/plain/parse";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import {
  fromArrowTimestamp,
  fromNanoseconds,
  fromPgMicroseconds,
} from "@northguild/gmt/precision/convert";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { convertUtcToPlainTime } from "@northguild/gmt/utc/convert";
import { isValidUtc } from "@northguild/gmt/utc/validate";
import { durationFromUnits } from "@northguild/gmt/duration/calculate";
import { parseDuration } from "@northguild/gmt/duration/parse";
import { parseRfc3339 } from "@northguild/gmt/zoned/parse";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import type { DatabaseLib } from "~/lib/database-lib";

export const databaseLib = {
  parseSqlDateTime,
  parseSqlOffsetDateTime,
  fromPgMicroseconds,
  parseDuration,
  convertUnixToUtc,
  resolveLocal,
  durationFromUnits,
  fromArrowTimestamp,
  addDate,
  fromNanoseconds,
  convertUtcToPlainTime,
  isValidUtc,
  isValidDateTime,
  toOffsetInstant,
  parseRfc3339,
  isValidTimeZone,
} as unknown as DatabaseLib;
