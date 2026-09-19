import { Temporal } from "@js-temporal/polyfill";
import { zonedNextTransition } from "./zonedWallClockOperations";

const UNIX_EPOCH_DATE = new Temporal.PlainDate(1970, 1, 1);

/**
 * Transitions walked while collecting local dates, matching `countZonedBuckets`' cap: roughly
 * 5,000 years of twice-yearly daylight saving; a longer walk answers with the sentinel.
 */
const MAX_WALKED_TRANSITIONS = 10_000;

function epochDayOf(zoned: Temporal.ZonedDateTime): number {
  return UNIX_EPOCH_DATE.until(zoned.toPlainDate().withCalendar("iso8601"), {
    largestUnit: "days",
  }).days;
}

/** Size of the union of inclusive integer ranges. */
function unionSize(ranges: Array<[number, number]>): number {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [runStart, runEnd] = sorted[0];

  for (const [from, to] of sorted.slice(1)) {
    if (from > runEnd + 1) {
      total += runEnd - runStart + 1;
      [runStart, runEnd] = [from, to];
    } else if (to > runEnd) {
      runEnd = to;
    }
  }

  return total + runEnd - runStart + 1;
}

/**
 * Count the distinct local (ISO) dates of the instants in the closed span `[start, end]`, in
 * `start`'s time zone. `end` must already be expressed in that zone and not precede `start`.
 *
 * Between two zone transitions the wall clock runs continuously, so every date from a run's
 * first to its last instant is touched. A transition can jump the clock past a whole date
 * (`Pacific/Apia` deleted 2011-12-30), which no instant then has, or back into the previous
 * date (`America/Goose_Bay` at 00:01 on 2010-11-07), which is touched again but counted once.
 *
 * @param start the span start
 * @param end the span end, in `start`'s zone
 * @returns the number of distinct local dates, or null past `MAX_WALKED_TRANSITIONS` transitions
 */
export function countZonedLocalDates(
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): number | null {
  const ranges: Array<[number, number]> = [];
  let runStart = start;

  for (let i = 0; i <= MAX_WALKED_TRANSITIONS; i++) {
    const transition = zonedNextTransition(runStart);
    const isLastRun =
      transition === null ||
      Temporal.ZonedDateTime.compare(transition, end) > 0;
    const runEnd = isLastRun ? end : transition.subtract({ nanoseconds: 1 });

    ranges.push([epochDayOf(runStart), epochDayOf(runEnd)]);

    if (isLastRun) {
      return unionSize(ranges);
    }

    runStart = transition;
  }

  return null;
}
