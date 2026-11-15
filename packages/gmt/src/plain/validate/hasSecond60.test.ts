import { hasSecond60 } from "./hasSecond60";

// hasSecond60 reads exactly GMT's own kind shapes with the seconds written as 60: plain time,
// plain date-time, UTC / instant, zoned (one zone bracket) and calendar-aware (at most one u-ca).
describe("hasSecond60", () => {
  it.each`
    value                                             | kind
    ${"23:59:60"}                                     | ${"plain time"}
    ${"23:59:60.5"}                                   | ${"plain time with a fraction"}
    ${"23:59:60,5"}                                   | ${"plain time with a comma fraction"}
    ${"2024-12-31T23:59:60"}                          | ${"plain date-time"}
    ${"2024-12-31T23:59:60.123"}                      | ${"plain date-time with a fraction"}
    ${"2024-12-31T23:59:60Z"}                         | ${"UTC"}
    ${"2024-12-31T23:59:60.123Z"}                     | ${"UTC with a fraction"}
    ${"2024-12-31T23:59:60+00:00"}                    | ${"instant with an offset"}
    ${"2024-12-31T23:59:60.123+00:00"}                | ${"instant with an offset and a fraction"}
    ${"2024-12-31T23:59:60+00:00[UTC]"}               | ${"zoned"}
    ${"2024-12-31T23:59:60[UTC]"}                     | ${"zoned without an offset"}
    ${"2024-12-31T23:59:60+00:00[!UTC]"}              | ${"zoned with a critical zone"}
    ${"2024-12-31T23:59:60+00:00[UTC][u-ca=iso8601]"} | ${"calendar zoned"}
    ${"2024-12-31T23:59:60[u-ca=hebrew]"}             | ${"calendar date-time"}
    ${"2024-12-31T23:59:60[u-ca=iso8601]"}            | ${"calendar date-time, iso8601"}
  `("returns true for $value ($kind)", ({ value }) => {
    expect(hasSecond60(value)).toBe(true);
  });

  // Each of these is a spelling Temporal reads and clamps to :59, and none is one of GMT's kinds.
  it.each`
    value                                                          | reason
    ${"2024-12-31t23:59:60Z"}                                      | ${"lower-case t"}
    ${"2024-12-31 23:59:60Z"}                                      | ${"space separator"}
    ${"2024-12-31T235960Z"}                                        | ${"basic time"}
    ${"20241231T235960+00:00[UTC]"}                                | ${"basic date and time"}
    ${"T23:59:60"}                                                 | ${"leading T time"}
    ${"t235960"}                                                   | ${"basic time with a t"}
    ${"235960"}                                                    | ${"basic time alone"}
    ${"23:59:60+01:00"}                                            | ${"time with an offset"}
    ${"23:59:60[u-ca=iso8601]"}                                    | ${"time with an annotation"}
    ${"2024-12-31T23:59:60Z[foo=bar]"}                             | ${"elective annotation"}
    ${"2024-12-31T23:59:60[foo=bar]"}                              | ${"elective annotation, no offset"}
    ${"2024-12-31T23:59:60Z[UTC][foo=bar]"}                        | ${"zone then an elective annotation"}
    ${"2024-12-31T23:59:60+00:00[UTC][u-ca=iso8601][u-ca=hebrew]"} | ${"two calendars"}
    ${"2024-12-31T23:59:60Z[u-ca=iso8601]"}                        | ${"instant with a calendar"}
    ${"2024-12-31T23:59:60Zjunk"}                                  | ${"trailing junk"}
    ${"2024-12-31T23:59:60Z "}                                     | ${"trailing whitespace"}
    ${" 2024-12-31T23:59:60Z"}                                     | ${"leading whitespace"}
    ${"2024-12-31T23:59:60z"}                                      | ${"lower-case z"}
    ${"2024-12-31T23:59:60-0000"}                                  | ${"basic offset"}
    ${"2024-12-31T23:59:60Z\n"}                                    | ${"trailing newline"}
    ${"2016-12-31T23:59:60[ junk ]"}                               | ${"zone annotation with spaces"}
    ${"2016-12-31T23:59:60[a[b]"}                                  | ${"zone annotation with an open bracket"}
    ${"2016-12-31T23:59:60[!!!]"}                                  | ${"zone annotation of only punctuation"}
    ${"2016-12-31T23:59:60[ ]"}                                    | ${"zone annotation of a space"}
    ${"2016-12-31T23:59:60[\n]"}                                   | ${"zone annotation of a newline"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(hasSecond60(value)).toBe(false);
  });

  // The string must be a valid value of its kind with the seconds read as 59: a date, zone or
  // calendar that does not exist is not a GMT kind, whatever its shape.
  it.each`
    value                                                  | reason
    ${"2016-02-30T23:59:60"}                               | ${"no such day"}
    ${"2016-12-31T23:59:60+00:00[Not/AZone]"}              | ${"unknown zone"}
    ${"2016-12-31T23:59:60[u-ca=notacal]"}                 | ${"unknown calendar"}
    ${"2016-12-31T23:59:60+05:00[Europe/London]"}          | ${"offset contradicts the zone, as isValidZonedDateTime reads the :59 string"}
    ${"2015-02-29T23:59:60Z"}                              | ${"no 29 February in 2015"}
    ${"2016-12-31T23:59:60+00:00[Not/AZone][u-ca=hebrew]"} | ${"unknown zone with a calendar"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(hasSecond60(value)).toBe(false);
  });

  // The IERS list is not checked: 2024-12-31 had no leap second and is still true.
  it.each`
    value
    ${"2016-12-31T23:59:60Z"}
    ${"2016-12-31T23:59:60,5Z"}
    ${"2016-12-31T23:59:60.5+00:00[UTC]"}
    ${"2016-12-31T23:59:60[u-ca=hebrew]"}
    ${"2024-12-31T23:59:60Z"}
  `("returns true for the valid value $value", ({ value }) => {
    expect(hasSecond60(value)).toBe(true);
  });

  it.each`
    value
    ${"2024-12-31T23:59:59Z"}
    ${"2024-12-31T23:59:61Z"}
    ${"2024-12-31T23:59:61"}
    ${"23:59:59"}
    ${"23:59"}
    ${"2024-12-31"}
    ${"2024-01-01T00:00:00Z[x=T123460Z]"}
    ${"23:59:59[x=T123460]"}
  `("returns false for non-leap second datetime $value", ({ value }) => {
    expect(hasSecond60(value)).toBe(false);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${60}
  `("returns false for the non-string $value", ({ value }) => {
    expect(hasSecond60(value)).toBe(false);
  });
});
