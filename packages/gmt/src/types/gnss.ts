/**
 * A satellite navigation system's time scale, by its RINEX 4.02 time-system identifier: GPS time,
 * Galileo time, BeiDou time, QZSS time, GLONASS time (in UTC hours, as RINEX and BIPM report it),
 * NavIC time.
 */
export type GnssSystem = "GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN";

/**
 * A satellite week counter, named by system and, where a system broadcasts two, by navigation
 * message: GPS and QZSS LNAV count modulo 1024, their CNAV modulo 8192, Galileo modulo 4096,
 * BeiDou modulo 8192, NavIC LNAV (L5/S) modulo 1024 and L1NV modulo 8192. GLONASS has no week
 * counter. A RINEX navigation-file week is not one of these: see `RinexWeekSystem`.
 */
export type GnssWeekCounter =
  | "GPS-LNAV"
  | "GPS-CNAV"
  | "GAL"
  | "BDT"
  | "QZS-LNAV"
  | "QZS-CNAV"
  | "IRN-LNAV"
  | "IRN-L1NV";

/**
 * Which pass of a wrapping week counter a week number belongs to. An integer from 0 is the era
 * itself (era 0 starts at the system's epoch). `"rolling"` picks the era that puts the week within
 * half a counter period of today, for live receiver output; it reads the clock, so the same stored
 * value can give a different answer in a later year.
 */
export type RolloverEra = number | "rolling";

/** A week and time of week on one satellite week counter. */
export interface GnssWeek {
  /** The week number as the counter shows it, from 0 to the counter's modulus − 1. */
  week: number;
  /** Seconds since the start of the week, from 0 up to but not including 604 800. */
  timeOfWeekSeconds: number;
  /** How many times the counter has wrapped since the system's epoch. */
  era: number;
}

/** The systems whose RINEX navigation records carry a week number. GLONASS records do not. */
export type RinexWeekSystem = "GPS" | "GAL" | "BDT" | "QZS" | "IRN";

/** A week and time of week as a RINEX navigation record counts them: continuous, so no era. */
export interface RinexWeek {
  /** The continuous week number, counted from the record's epoch without wrapping. */
  week: number;
  /** Seconds since the start of the week, from 0 up to but not including 604 800. */
  timeOfWeekSeconds: number;
}
