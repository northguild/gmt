import type { CalendarSystem } from "../types";

// Maps GMT's public CalendarSystem identifiers to the Temporal/Intl calendar identifiers
// they wrap. "gregorian" maps to "iso8601" (Temporal's default, era-free calendar) rather
// than "gregory" (which carries BCE/CE eras) since GMT's existing unannotated ISO strings
// are already iso8601-calendared — this keeps "gregorian" round-trips a no-op.
//
// "islamic-tabular" maps to Temporal's "islamic-tbla" id (its name for the same
// arithmetic/astronomical-epoch tabular calendar). "islamic-umalqura" resolves through
// Temporal's built-in Umm al-Qura implementation rather than a table GMT ports itself —
// per E1's "no ported leap-year tables or arithmetic" precedent, the polyfill already
// carries the correct tabulated/algorithmic data, so a GMT-owned copy would only add a
// second, divergence-prone source of truth.
export const temporalCalendarIds: Record<CalendarSystem, string> = {
  gregorian: "iso8601",
  hebrew: "hebrew",
  "islamic-civil": "islamic-civil",
  "islamic-tabular": "islamic-tbla",
  "islamic-umalqura": "islamic-umalqura",
};

export function isCalendarSystem(value: string): value is CalendarSystem {
  return value in temporalCalendarIds;
}

// Reverse of temporalCalendarIds — needed because some GMT calendar identifiers (e.g.
// "islamic-tabular") don't match Temporal's own id for the same calendar ("islamic-tbla"),
// so a PlainDate's `calendarId` can't be used directly as GMT's string annotation.
const gmtCalendarSystemIds: Record<string, CalendarSystem> = Object.fromEntries(
  Object.entries(temporalCalendarIds).map(([gmtId, temporalId]) => [
    temporalId,
    gmtId as CalendarSystem,
  ]),
);

export function calendarSystemIdFromTemporal(
  temporalId: string,
): CalendarSystem {
  const gmtId = gmtCalendarSystemIds[temporalId];
  if (!gmtId) {
    throw new Error(`Unsupported Temporal calendar id: ${temporalId}`);
  }
  return gmtId;
}
