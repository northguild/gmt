import type { TimeCycleField } from "../types";

/**
 * Return the inclusive wrap bounds for a `TimeCycleField`. Unlike date fields, time field bounds
 * never depend on the source value — `hour` is always `0–23` (see the `cycleDate`/`cycleTime`/
 * `cycleZoned` module docs for why GMT doesn't offer a 12-hour `hourCycle` variant).
 *
 * @param field the time field being cycled
 * @example timeCycleFieldBounds("hour") // { min: 0, max: 23 }
 * @example timeCycleFieldBounds("minute") // { min: 0, max: 59 }
 * @example timeCycleFieldBounds("millisecond") // { min: 0, max: 999 }
 * @returns `{ min, max }` inclusive bounds
 */
export function timeCycleFieldBounds(field: TimeCycleField): {
  min: number;
  max: number;
} {
  switch (field) {
    case "hour":
      return { min: 0, max: 23 };
    case "minute":
    case "second":
      return { min: 0, max: 59 };
    case "millisecond":
    case "microsecond":
    case "nanosecond":
      return { min: 0, max: 999 };
  }
}
