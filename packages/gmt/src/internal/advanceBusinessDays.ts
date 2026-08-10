import type { Temporal } from "@js-temporal/polyfill";

function getStep(date: Temporal.PlainDate, direction: 1 | -1) {
  return direction === 1 ? date.add({ days: 1 }) : date.subtract({ days: 1 });
}

export function advanceBusinessDays(
  start: Temporal.PlainDate,
  direction: 1 | -1,
  target: number,
): Temporal.PlainDate {
  const advance = (
    date: Temporal.PlainDate,
    remaining: number,
  ): Temporal.PlainDate => {
    if (remaining === 0) return date;
    const next = getStep(date, direction);
    if (next.dayOfWeek >= 1 && next.dayOfWeek <= 5) {
      return advance(next, remaining - 1);
    }
    return advance(next, remaining);
  };

  return advance(start, target);
}
