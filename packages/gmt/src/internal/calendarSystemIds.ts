import type { CalendarSystem } from "../types";

// Maps GMT's public CalendarSystem identifiers to the Temporal/Intl calendar identifiers
// they wrap. "gregorian" maps to "iso8601" (Temporal's default, era-free calendar) rather
// than "gregory" (which carries BCE/CE eras) since GMT's existing unannotated ISO strings
// are already iso8601-calendared — this keeps "gregorian" round-trips a no-op.
export const temporalCalendarIds: Record<CalendarSystem, string> = {
  gregorian: "iso8601",
  hebrew: "hebrew",
};

export function isCalendarSystem(value: string): value is CalendarSystem {
  return value in temporalCalendarIds;
}
