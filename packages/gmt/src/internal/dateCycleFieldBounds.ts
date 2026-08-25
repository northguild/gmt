import type { DateCycleField } from "../types";

/**
 * Return the inclusive wrap bounds for a `DateCycleField`, or `null` for `year` (unbounded — see
 * `cycleFieldValue`'s doc).
 *
 * - `month` bounds use `source.monthsInYear` and `day` bounds use `source.daysInMonth` rather than
 *   hardcoded `12`/`31` — both work identically on `Temporal.PlainDate`, `PlainDateTime`, and
 *   `ZonedDateTime`, all of which expose these calendar-derived properties. `day`'s bounds are
 *   always the **current** month's `daysInMonth`, never the target month's — cycling `day` never
 *   changes `month`.
 *
 * @param field the date field being cycled
 * @param source an object exposing `monthsInYear` and `daysInMonth` (any Temporal date-bearing type)
 * @example dateCycleFieldBounds("year", { monthsInYear: 12, daysInMonth: 31 }) // null
 * @example dateCycleFieldBounds("month", { monthsInYear: 12, daysInMonth: 31 }) // { min: 1, max: 12 }
 * @example dateCycleFieldBounds("day", { monthsInYear: 12, daysInMonth: 29 }) // { min: 1, max: 29 }
 * @returns `{ min, max }` inclusive bounds, or `null` when the field is unbounded
 */
export function dateCycleFieldBounds(
  field: DateCycleField,
  source: { monthsInYear: number; daysInMonth: number },
): { min: number; max: number } | null {
  switch (field) {
    case "year":
      return null;
    case "month":
      return { min: 1, max: source.monthsInYear };
    case "day":
      return { min: 1, max: source.daysInMonth };
  }
}
