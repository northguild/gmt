import {
  floorDivide,
  isValidEpochNanoseconds,
  MAX_INT64,
  MIN_INT64,
  NANOSECONDS_PER_DAY,
  resolveArrowTimestampOptions,
} from "../../internal";
import { isoFieldsOf } from "../../internal/epochDay";
import { Temporal } from "../../internal/temporal";
import { fromNanoseconds } from "./fromNanoseconds";

/**
 * The unit of an Apache Arrow `Timestamp` column: Temporal's unit names, singular or plural,
 * matching Arrow's `TimeUnit` (`SECOND`, `MILLISECOND`, `MICROSECOND`, `NANOSECOND`).
 */
export type ArrowTimeUnit =
  | "second"
  | "seconds"
  | "millisecond"
  | "milliseconds"
  | "microsecond"
  | "microseconds"
  | "nanosecond"
  | "nanoseconds";

/** Describes the Arrow `Timestamp` column a value is read from or written to. */
export interface ArrowTimestampOptions {
  /** The column's `TimeUnit`: how many of which unit the `int64` counts since 1970-01-01. */
  unit: ArrowTimeUnit;
  /**
   * The column's timezone, an Olson name or a `+HH:MM` offset. Set, the column holds UTC
   * instants and the zone only says how to display them; omitted, `undefined` or `""`, the
   * column holds zoneless wall-clock times (Arrow `Schema.fbs`: an empty zone is not UTC).
   *
   * @defaultValue undefined (no timezone)
   */
  timeZone?: string;
}

/** What `fromArrowTimestamp` returns: an instant for a zoned column, a wall time for a zoneless one. */
export type ArrowTimestampValue =
  | {
      /** The instant as an ISO 8601 string in UTC (`Z`). */
      instant: string;
    }
  | {
      /** The wall-clock date-time as an ISO 8601 string with no offset or zone. */
      local: string;
      /** Always `true`: the value is a wall clock time, not a point in time. */
      zoneless: true;
    };

/**
 * Convert an Apache Arrow `Timestamp` `int64` back to an ISO 8601 string.
 *
 * - The column decides the result. With a `timeZone` the value is a UTC instant and the result
 *   is `{ instant }`. With none (omitted, `undefined` or `""`) it is a wall-clock time and the
 *   result is `{ local, zoneless: true }`: Arrow says an empty zone is not UTC, so it never
 *   becomes an instant.
 * - `instant` is UTC (`Z`), not the column's zone, which is display information. For local
 *   display call `fromNanoseconds(ns, timeZone)`.
 * - `value` must be an `int64`; wall times use the same range as instants
 *   (`-271821-04-20T00:00:00` to `+275760-09-13T00:00:00`), so a value beyond it returns `null`.
 * - An unknown `timeZone` is rejected, not ignored.
 * - Exact: nothing is rounded. Returns `null` on invalid input.
 *
 * @param value the `int64` count since 1970-01-01 in the column's unit (bigint)
 * @param options the Arrow column's timestamp type
 * @returns `{ instant }`, `{ local, zoneless: true }`, or `null` on invalid input
 *
 * @example fromArrowTimestamp(0n, { unit: "second" }) // { local: "1970-01-01T00:00:00", zoneless: true }
 * @example fromArrowTimestamp(0n, { unit: "second", timeZone: "UTC" }) // { instant: "1970-01-01T00:00:00Z" }
 * @example fromArrowTimestamp(0n, { unit: "second", timeZone: "Europe/Paris" }) // { instant: "1970-01-01T00:00:00Z" }
 * @example fromArrowTimestamp(0n, { unit: "second", timeZone: "" }) // { local: "1970-01-01T00:00:00", zoneless: true }
 * @example fromArrowTimestamp(1704067200000n, { unit: "milliseconds" }) // { local: "2024-01-01T00:00:00", zoneless: true }
 * @example fromArrowTimestamp(1704067200123456789n, { unit: "nanosecond", timeZone: "America/New_York" }) // { instant: "2024-01-01T00:00:00.123456789Z" }
 * @example fromArrowTimestamp(-1n, { unit: "nanosecond" }) // { local: "1969-12-31T23:59:59.999999999", zoneless: true }
 * @example fromArrowTimestamp(9223372036854775807n, { unit: "nanosecond", timeZone: "UTC" }) // { instant: "2262-04-11T23:47:16.854775807Z" }
 * @example fromArrowTimestamp(8640000000001n, { unit: "second", timeZone: "UTC" }) // null — past the instant range
 * @example fromArrowTimestamp(0, { unit: "second" }) // null — number, not bigint
 * @example fromArrowTimestamp(0n, { unit: "s" }) // null — not an Arrow unit
 */
export function fromArrowTimestamp(
  value: bigint,
  options: ArrowTimestampOptions,
): ArrowTimestampValue | null {
  if (typeof value !== "bigint" || value < MIN_INT64 || value > MAX_INT64) {
    return null;
  }

  const resolved = resolveArrowTimestampOptions(options);

  if (resolved === null) {
    return null;
  }

  const nanoseconds = value * resolved.factor;

  if (!isValidEpochNanoseconds(nanoseconds)) {
    return null;
  }

  if (resolved.zoned) {
    const instant = fromNanoseconds(nanoseconds);

    return instant === "" ? null : { instant };
  }

  // Zoneless: the wall time is the count read "as if" UTC (Schema.fbs), with no zone involved.
  const day = floorDivide(nanoseconds, NANOSECONDS_PER_DAY);
  const rest = nanoseconds - day * NANOSECONDS_PER_DAY;
  const [year, month, dayOfMonth] = isoFieldsOf(Number(day));
  const seconds = rest / 1_000_000_000n;
  const subSecond = Number(rest % 1_000_000_000n);

  try {
    const local = Temporal.PlainDateTime.from(
      {
        year,
        month,
        day: dayOfMonth,
        hour: Number(seconds / 3600n),
        minute: Number((seconds / 60n) % 60n),
        second: Number(seconds % 60n),
        millisecond: Math.floor(subSecond / 1_000_000),
        microsecond: Math.floor(subSecond / 1000) % 1000,
        nanosecond: subSecond % 1000,
      },
      { overflow: "reject" },
    ).toString();

    return { local, zoneless: true };
  } catch {
    return null;
  }
}
