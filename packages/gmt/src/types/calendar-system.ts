/**
 * A calendar GMT's calendar functions support, named by its canonical calendar id: the CLDR
 * `common/bcp47/calendar.xml` type that Temporal's `CanonicalizeCalendar` returns, and that
 * RFC 9557's `[u-ca=<id>]` annotation carries.
 *
 * The set is `"iso8601"` plus the rows of the Intl Era and Month Code proposal's
 * `table-calendar-types` that GMT supports; `"chinese"` and `"dangi"` are not supported.
 */
export type CalendarSystem =
  | "iso8601"
  | "gregory"
  | "hebrew"
  | "islamic-civil"
  | "islamic-tbla"
  | "islamic-umalqura"
  | "japanese"
  | "buddhist"
  | "roc"
  | "persian"
  | "indian"
  | "ethiopic"
  | "ethioaa"
  | "coptic";
