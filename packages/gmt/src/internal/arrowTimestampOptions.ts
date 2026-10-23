import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";
import type { ArrowTimeUnit } from "../precision/convert/fromArrowTimestamp";
import { isObject } from "./isObject";

/** The reading of an `ArrowTimestampOptions` bag. */
export interface ResolvedArrowTimestampOptions {
  /** Nanoseconds in one column unit. */
  factor: bigint;
  /** Whether the column has a timezone, so holds instants rather than wall-clock times. */
  zoned: boolean;
}

// Arrow Schema.fbs `enum TimeUnit`, in nanoseconds per unit.
const factors: Record<ArrowTimeUnit, bigint> = {
  second: 1_000_000_000n,
  seconds: 1_000_000_000n,
  millisecond: 1_000_000n,
  milliseconds: 1_000_000n,
  microsecond: 1_000n,
  microseconds: 1_000n,
  nanosecond: 1n,
  nanoseconds: 1n,
};

/**
 * Read the options both Arrow functions share, or `null` when they are invalid: not an object,
 * an unknown `unit`, a `timeZone` that is neither a string nor Temporal-known. An unknown zone
 * is rejected although the values would still be UTC instants: a typo should not pass silently.
 */
export function resolveArrowTimestampOptions(
  options: unknown,
): ResolvedArrowTimestampOptions | null {
  if (!isObject(options)) {
    return null;
  }

  try {
    const { unit, timeZone } = options as {
      unit?: unknown;
      timeZone?: unknown;
    };

    if (
      typeof unit !== "string" ||
      !Object.prototype.hasOwnProperty.call(factors, unit)
    ) {
      return null;
    }

    const factor = factors[unit as ArrowTimeUnit];

    if (timeZone === undefined || timeZone === "") {
      return { factor, zoned: false };
    }

    if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
      return null;
    }

    return { factor, zoned: true };
  } catch {
    // A hostile Proxy, a revoked Proxy or a throwing getter: invalid, never a throw.
    return null;
  }
}
