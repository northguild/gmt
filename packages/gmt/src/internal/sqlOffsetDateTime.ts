import { sqlOffsetDateTime } from "../regex/sql-offset-date-time";
import { parseInstantNanoseconds } from "./instantNanoseconds";

/**
 * The shared core of `parseSqlOffsetDateTime` and `isValidSqlOffsetDateTime`: read a SQL
 * `TIMESTAMP WITH TIME ZONE` literal and return it as ISO 8601 extended form with the offset
 * kept, or `""` when it is not one. Never throws.
 *
 * The regex is the grammar (SQL-92 §5.3, with PostgreSQL's hour-only and seconds offsets and
 * SQL Server's space before the offset). The output follows TC39 Temporal: the fraction drops
 * trailing zeros (`FormatFractionalSeconds`, precision `"auto"`) and offset seconds are written
 * only when non-zero (`FormatUTCOffsetNanoseconds`). A zero offset written with a minus sign is
 * written `+00:00`, as `parseRfc3339` does and as TC39 Temporal `FormatUTCOffsetNanoseconds`
 * step 1 requires (a non-negative offset is written with `+`). The calendar date and the
 * instant range are proved by `parseInstantNanoseconds`, the one instant reader.
 *
 * @param value - The text to read.
 * @returns `YYYY-MM-DDTHH:MM:SS[.f]±HH:MM[:SS]`, or `""` for any other value.
 * @example readSqlOffsetDateTime("2024-03-15 14:30:00-08")                // "2024-03-15T14:30:00-08:00"
 * @example readSqlOffsetDateTime("2007-05-08 12:35:29.1234567 +12:15")    // "2007-05-08T12:35:29.1234567+12:15"
 * @example readSqlOffsetDateTime("2024-03-15 14:30:00-00")                // "2024-03-15T14:30:00+00:00"
 * @example readSqlOffsetDateTime("2024-02-30 12:00:00+00")                // ""
 * @example readSqlOffsetDateTime(null)                                    // ""
 */
export function readSqlOffsetDateTime(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const match = sqlOffsetDateTime.exec(value);
  if (match === null) {
    return "";
  }
  const [
    ,
    date,
    time,
    fractionDigits,
    sign,
    hours,
    minutes = "00",
    seconds = "00",
  ] = match;
  const isZeroOffset = hours === "00" && minutes === "00" && seconds === "00";
  const offset = `${isZeroOffset ? "+" : sign}${hours}:${minutes}${seconds === "00" ? "" : `:${seconds}`}`;
  const fraction = (fractionDigits ?? "").replace(/0+$/, "");
  const joined = `${date}T${time}${fraction === "" ? "" : `.${fraction}`}${offset}`;
  try {
    return parseInstantNanoseconds(joined) === null ? "" : joined;
  } catch {
    return "";
  }
}
