// The set of calendar systems GMT's calendar-conversion functions support. Extended by
// later Story Group E stories (era-based solar, Ethiopic families) as they land — do not
// pre-declare identifiers for calendars not yet implemented.
export type CalendarSystem =
  | "gregorian"
  | "hebrew"
  | "islamic-civil"
  | "islamic-tabular"
  | "islamic-umalqura";
