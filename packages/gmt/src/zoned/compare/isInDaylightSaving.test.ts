import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { isInDaylightSaving } from "./isInDaylightSaving";

describe("isInDaylightSaving", () => {
  it.each`
    value                                            | expected
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${true}
    ${"2024-01-15T12:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-01-15T12:00:00+11:00[Australia/Sydney]"} | ${true}
    ${"2024-07-15T12:00:00+10:00[Australia/Sydney]"} | ${false}
    ${"2024-07-15T12:00:00+09:00[Asia/Tokyo]"}       | ${false}
    ${"2024-01-15T12:00:00+09:00[Asia/Tokyo]"}       | ${false}
    ${"2024-05-15T12:00:00+05:45[Asia/Kathmandu]"}   | ${false}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}          | ${false}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(isInDaylightSaving(value)).toBe(expected);
  });

  it.each`
    timeZone             | before                                          | beforeExpected | after                                           | afterExpected
    ${"America/Chicago"} | ${"2024-03-10T01:59:00-06:00[America/Chicago]"} | ${false}       | ${"2024-03-10T03:00:00-05:00[America/Chicago]"} | ${true}
    ${"America/Chicago"} | ${"2024-11-03T01:00:00-05:00[America/Chicago]"} | ${true}        | ${"2024-11-03T01:00:00-06:00[America/Chicago]"} | ${false}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:59:00+01:00[Europe/Berlin]"}   | ${false}       | ${"2024-03-31T03:00:00+02:00[Europe/Berlin]"}   | ${true}
    ${"Europe/Berlin"}   | ${"2024-10-27T02:59:00+02:00[Europe/Berlin]"}   | ${true}        | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}   | ${false}
  `(
    "resolves both sides of $timeZone's DST transition",
    ({ before, beforeExpected, after, afterExpected }) => {
      expect(isInDaylightSaving(before)).toBe(beforeExpected);
      expect(isInDaylightSaving(after)).toBe(afterExpected);
    },
  );

  it("returns true for a southern-hemisphere DST span crossing the new year", () => {
    expect(
      isInDaylightSaving("2024-12-31T23:00:00+11:00[Australia/Sydney]"),
    ).toBe(true);
    expect(
      isInDaylightSaving("2024-01-01T01:00:00+11:00[Australia/Sydney]"),
    ).toBe(true);
  });

  // Expected values below are read off each zone's own list of offset changes
  // (`getTimeZoneTransition` in a plain `@js-temporal/polyfill` script), by the
  // rule in the JSDoc: daylight time runs from a forward change to the backward
  // change of the same size that undoes it, less than 365 days later.

  // Europe/Istanbul: +02→+03 2015-03-29, +03→+02 2015-11-08, +02→+03 2016-03-27,
  // and no change since: the 2016 advance was never undone.
  it.each`
    value                                           | expected | why
    ${"2015-07-01T12:00:00+03:00[Europe/Istanbul]"} | ${true}  | ${"advance undone 2015-11-08"}
    ${"2015-12-01T12:00:00+02:00[Europe/Istanbul]"} | ${false} | ${"after the set-back"}
    ${"2016-03-26T12:00:00+02:00[Europe/Istanbul]"} | ${false} | ${"day before the last advance"}
    ${"2016-03-27T04:00:00+03:00[Europe/Istanbul]"} | ${false} | ${"first instant of the advance never undone"}
    ${"2016-07-01T12:00:00+03:00[Europe/Istanbul]"} | ${false} | ${"advance never undone"}
    ${"2016-12-01T12:00:00+03:00[Europe/Istanbul]"} | ${false} | ${"advance never undone"}
    ${"2017-07-01T12:00:00+03:00[Europe/Istanbul]"} | ${false} | ${"advance never undone"}
    ${"2020-07-01T12:00:00+03:00[Europe/Istanbul]"} | ${false} | ${"advance never undone"}
  `(
    "returns $expected for $value where an advance became permanent ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // Europe/Moscow: +03→+04 2010-03-28, +04→+03 2010-10-31, +03→+04 2011-03-27,
  // +04→+03 2014-10-26 (3.6 years later: a change of standard time, not a season).
  it.each`
    value                                         | expected | why
    ${"2010-07-01T12:00:00+04:00[Europe/Moscow]"} | ${true}  | ${"advance undone 2010-10-31"}
    ${"2010-12-01T12:00:00+03:00[Europe/Moscow]"} | ${false} | ${"after the set-back"}
    ${"2011-07-01T12:00:00+04:00[Europe/Moscow]"} | ${false} | ${"advance held 3.6 years"}
    ${"2012-12-01T12:00:00+04:00[Europe/Moscow]"} | ${false} | ${"advance held 3.6 years"}
    ${"2014-07-01T12:00:00+04:00[Europe/Moscow]"} | ${false} | ${"advance held 3.6 years"}
    ${"2014-12-01T12:00:00+03:00[Europe/Moscow]"} | ${false} | ${"after the 2014 set-back"}
  `(
    "returns $expected for $value where daylight time became standard time ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // America/Sao_Paulo: -03→-02 2018-11-04, -02→-03 2019-02-17, none since.
  // Asia/Tehran: +03:30→+04:30 2022-03-22, +04:30→+03:30 2022-09-21, none since (tz 2022b or
  // later, which records that Iran stopped; older data continues the rule).
  it.each`
    value                                             | expected | why
    ${"2018-07-01T12:00:00-03:00[America/Sao_Paulo]"} | ${false} | ${"winter"}
    ${"2018-12-01T12:00:00-02:00[America/Sao_Paulo]"} | ${true}  | ${"advance undone 2019-02-17"}
    ${"2019-01-15T12:00:00-02:00[America/Sao_Paulo]"} | ${true}  | ${"advance undone 2019-02-17"}
    ${"2019-07-01T12:00:00-03:00[America/Sao_Paulo]"} | ${false} | ${"no change follows"}
    ${"2019-12-01T12:00:00-03:00[America/Sao_Paulo]"} | ${false} | ${"no change follows"}
    ${"2022-07-01T12:00:00+04:30[Asia/Tehran]"}       | ${true}  | ${"advance undone 2022-09-21"}
    ${"2022-12-01T12:00:00+03:30[Asia/Tehran]"}       | ${false} | ${"no change follows"}
    ${"2023-07-01T12:00:00+03:30[Asia/Tehran]"}       | ${false} | ${"no change follows"}
  `(
    "returns $expected for $value where daylight time was abolished ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // Asia/Pyongyang: +09→+08:30 2015-08-15, +08:30→+09 2018-05-05.
  // America/Caracas: -04:30→-04 1965, -04→-04:30 2007-12-09, -04:30→-04 2016-05-01.
  // Asia/Colombo: +05:30→+06:30 1996-05-25, +06:30→+06 1996-10-26 (half the size
  // of the advance, so it does not undo it), +06→+05:30 2006-04-15.
  it.each`
    value                                           | expected | why
    ${"2015-07-01T12:00:00+09:00[Asia/Pyongyang]"}  | ${false} | ${"before the move back"}
    ${"2015-12-01T12:00:00+08:30[Asia/Pyongyang]"}  | ${false} | ${"clocks were put back"}
    ${"2018-01-15T12:00:00+08:30[Asia/Pyongyang]"}  | ${false} | ${"clocks were put back"}
    ${"2018-07-01T12:00:00+09:00[Asia/Pyongyang]"}  | ${false} | ${"advance never undone"}
    ${"2018-12-01T12:00:00+09:00[Asia/Pyongyang]"}  | ${false} | ${"advance never undone"}
    ${"2007-07-01T12:00:00-04:00[America/Caracas]"} | ${false} | ${"advance held 42 years"}
    ${"2007-12-15T12:00:00-04:30[America/Caracas]"} | ${false} | ${"clocks were put back"}
    ${"2016-01-15T12:00:00-04:30[America/Caracas]"} | ${false} | ${"clocks were put back"}
    ${"2016-07-01T12:00:00-04:00[America/Caracas]"} | ${false} | ${"advance never undone"}
    ${"1996-07-01T12:00:00+06:30[Asia/Colombo]"}    | ${false} | ${"set-back of another size"}
    ${"1996-12-01T12:00:00+06:00[Asia/Colombo]"}    | ${false} | ${"set-back of another size"}
  `(
    "returns $expected for $value where standard time moved ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // Both sides of each 2024 change, one nanosecond apart in exact time.
  // Australia/Sydney: +11→+10 2024-04-07 03:00, +10→+11 2024-10-06 02:00.
  // Australia/Lord_Howe (30-minute save): +11→+10:30 2024-04-07 02:00,
  // +10:30→+11 2024-10-06 02:00.
  // America/New_York: -05→-04 2024-03-10 02:00, -04→-05 2024-11-03 02:00.
  it.each`
    before                                                        | beforeExpected | after                                               | afterExpected
    ${"2024-03-10T01:59:59.999999999-05:00[America/New_York]"}    | ${false}       | ${"2024-03-10T03:00:00-04:00[America/New_York]"}    | ${true}
    ${"2024-11-03T01:59:59.999999999-04:00[America/New_York]"}    | ${true}        | ${"2024-11-03T01:00:00-05:00[America/New_York]"}    | ${false}
    ${"2024-04-07T02:59:59.999999999+11:00[Australia/Sydney]"}    | ${true}        | ${"2024-04-07T02:00:00+10:00[Australia/Sydney]"}    | ${false}
    ${"2024-10-06T01:59:59.999999999+10:00[Australia/Sydney]"}    | ${false}       | ${"2024-10-06T03:00:00+11:00[Australia/Sydney]"}    | ${true}
    ${"2024-04-07T01:59:59.999999999+11:00[Australia/Lord_Howe]"} | ${true}        | ${"2024-04-07T01:30:00+10:30[Australia/Lord_Howe]"} | ${false}
    ${"2024-10-06T01:59:59.999999999+10:30[Australia/Lord_Howe]"} | ${false}       | ${"2024-10-06T02:30:00+11:00[Australia/Lord_Howe]"} | ${true}
  `(
    "returns $beforeExpected at $before and $afterExpected at $after",
    ({ before, beforeExpected, after, afterExpected }) => {
      expect(isInDaylightSaving(before)).toBe(beforeExpected);
      expect(isInDaylightSaving(after)).toBe(afterExpected);
    },
  );

  // The rule reads the higher of two alternating offsets as daylight time. That
  // is the tz database's rearguard form. Its main form marks these zones the
  // other way round (a negative save): Dublin's winter and Casablanca's Ramadan
  // weeks are its daylight time.
  // Europe/Dublin: +00→+01 2019-03-31, +01→+00 2019-10-27.
  // Africa/Casablanca: +00→+01 2019-06-09, +01→+00 2020-04-19, +00→+01 2020-05-31,
  // +01→+00 2021-04-11.
  it.each`
    value                                             | expected | why
    ${"2019-01-15T12:00:00+00:00[Europe/Dublin]"}     | ${false} | ${"the lower offset"}
    ${"2019-07-15T12:00:00+01:00[Europe/Dublin]"}     | ${true}  | ${"advance undone 2019-10-27"}
    ${"2019-12-15T12:00:00+00:00[Europe/Dublin]"}     | ${false} | ${"the lower offset"}
    ${"2019-12-01T12:00:00+01:00[Africa/Casablanca]"} | ${true}  | ${"advance undone 2020-04-19"}
    ${"2020-05-01T12:00:00+00:00[Africa/Casablanca]"} | ${false} | ${"the lower offset"}
    ${"2020-07-15T12:00:00+01:00[Africa/Casablanca]"} | ${true}  | ${"advance undone 2021-04-11"}
  `(
    "returns $expected for $value in a zone tzdb gives a negative save ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // What the rule reads as daylight time although the tz database does not.
  // America/Metlakatla: -09→-08 2018-03-11 (daylight time), then standard time
  // moved to -08 on 2018-11-04 with no clock change, and back: -08→-09
  // 2019-01-20. The offsets show one advance undone 315 days later.
  it.each`
    value                                              | expected | why
    ${"2018-02-01T12:00:00-09:00[America/Metlakatla]"} | ${false} | ${"before the advance"}
    ${"2018-07-01T12:00:00-08:00[America/Metlakatla]"} | ${true}  | ${"advance undone 2019-01-20"}
    ${"2018-12-01T12:00:00-08:00[America/Metlakatla]"} | ${true}  | ${"advance undone 2019-01-20; the tz database says standard"}
    ${"2019-02-01T12:00:00-09:00[America/Metlakatla]"} | ${false} | ${"after the set-back"}
  `(
    "returns $expected for $value where standard time moved inside a daylight period ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // Africa/Casablanca 2013, four changes: +00→+01 04-28, +01→+00 07-07,
  // +00→+01 08-10, +01→+00 10-27.
  // Europe/London 1947, four changes: +00→+01 03-16, +01→+02 04-13,
  // +02→+01 08-10, +01→+00 11-02. Each set-back undoes the nearest advance.
  // Pacific/Apia 2011: -11→-10 09-24, -10→+14 12-30 (the date line), +14→+13
  // 2012-04-01. The one-hour set-back undoes the one-hour advance.
  it.each`
    value                                             | expected | why
    ${"2013-01-15T12:00:00+00:00[Africa/Casablanca]"} | ${false} | ${"before the first advance"}
    ${"2013-06-01T12:00:00+01:00[Africa/Casablanca]"} | ${true}  | ${"advance undone 07-07"}
    ${"2013-07-20T12:00:00+00:00[Africa/Casablanca]"} | ${false} | ${"between the two periods"}
    ${"2013-09-01T12:00:00+01:00[Africa/Casablanca]"} | ${true}  | ${"advance undone 10-27"}
    ${"2013-12-01T12:00:00+00:00[Africa/Casablanca]"} | ${false} | ${"after the last set-back"}
    ${"1947-02-01T12:00:00+00:00[Europe/London]"}     | ${false} | ${"before the first advance"}
    ${"1947-04-01T12:00:00+01:00[Europe/London]"}     | ${true}  | ${"first advance undone 11-02"}
    ${"1947-06-01T12:00:00+02:00[Europe/London]"}     | ${true}  | ${"second advance undone 08-10"}
    ${"1947-09-01T12:00:00+01:00[Europe/London]"}     | ${true}  | ${"first advance undone 11-02"}
    ${"1947-12-01T12:00:00+00:00[Europe/London]"}     | ${false} | ${"after the last set-back"}
    ${"2011-07-01T12:00:00-11:00[Pacific/Apia]"}      | ${false} | ${"before the advance"}
    ${"2011-10-15T12:00:00-10:00[Pacific/Apia]"}      | ${true}  | ${"advance undone 2012-04-01"}
    ${"2012-01-15T12:00:00+14:00[Pacific/Apia]"}      | ${true}  | ${"advance undone 2012-04-01"}
    ${"2012-07-01T12:00:00+13:00[Pacific/Apia]"}      | ${false} | ${"after the set-back"}
  `(
    "returns $expected for $value in a year with more than two changes ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // Asia/Tokyo observed daylight time 1948 to 1951 and never since:
  // +09→+10 1950-05-07, +10→+09 1950-09-10.
  it.each`
    value                                           | expected
    ${"1950-01-15T12:00:00+09:00[Asia/Tokyo]"}      | ${false}
    ${"1950-07-01T12:00:00+10:00[Asia/Tokyo]"}      | ${true}
    ${"1950-12-01T12:00:00+09:00[Asia/Tokyo]"}      | ${false}
    ${"1960-07-01T12:00:00+09:00[Asia/Tokyo]"}      | ${false}
    ${"2024-07-01T12:00:00+05:30[Asia/Kolkata]"}    | ${false}
    ${"2024-07-01T12:00:00-07:00[America/Phoenix]"} | ${false}
    ${"2024-07-01T12:00:00+05:00[+05:00]"}          | ${false}
  `(
    "returns $expected for $value by the zone's own history",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // The first and last instants Temporal can represent. A zone's first offset
  // has no change before it. America/New_York's last change in range is the
  // advance of +275760-03-09; the set-back that would undo it is past the last
  // instant, so the period has no end to read.
  it.each`
    value                                               | expected | why
    ${"-271821-04-20T00:00:00+00:00[UTC]"}              | ${false} | ${"UTC never changes"}
    ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${false} | ${"UTC never changes"}
    ${"-271821-04-19T19:03:58-04:56[America/New_York]"} | ${false} | ${"no change before the first instant"}
    ${"+275760-09-12T20:00:00-04:00[America/New_York]"} | ${false} | ${"the set-back is past the last instant"}
    ${"+275759-07-01T12:00:00-04:00[America/New_York]"} | ${true}  | ${"advance undone +275759-11-04"}
    ${"+275760-01-15T12:00:00-05:00[America/New_York]"} | ${false} | ${"winter"}
    ${"+275760-01-15T12:00:00+11:00[Australia/Sydney]"} | ${true}  | ${"advance undone +275760-04-06"}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${false} | ${"winter"}
  `(
    "returns $expected for $value at the range limit ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
  );

  // Two clock changes less than 14 days apart. Histories from Node 26's native Temporal and
  // `zdump -v` (tz 2026c); the closest pair in the tz database is 601,200 s apart.
  // America/Boa_Vista: -04→-03 2000-10-08T04:00Z, -03→-04 2000-10-15T03:00Z.
  // America/Noronha: -02→-01 2000-10-08T02:00Z, -01→-02 2000-10-15T01:00Z.
  // America/Recife: -03→-02 2000-10-08T03:00Z, -02→-03 2000-10-15T02:00Z.
  // America/Fortaleza, America/Maceio: -03→-02 2000-10-08T03:00Z, -02→-03 2000-10-22T02:00Z.
  // Europe/Tirane: +01→+02 1943-03-29T01:00Z, +02→+01 1943-04-10T01:00Z.
  // Europe/Vienna: +01→+02 1945-04-02T01:00Z, +02→+01 1945-04-12T01:00Z.
  // Africa/Tunis: +01→+02 1943-03-29T01:00Z, +02→+01 1943-04-17T00:00Z, +01→+02
  //   1943-04-25T01:00Z, +02→+01 1943-10-04T00:00Z.
  // America/Argentina/Tucuman: -03→-04 2004-06-01T03:00Z, -04→-03 2004-06-13T04:00Z (clocks
  //   put back, then forward: no daylight time).
  it.each`
    value                                                       | expected | why
    ${"2000-10-01T12:00:00-04:00[America/Boa_Vista]"}           | ${false} | ${"before the advance"}
    ${"2000-10-08T01:00:00-03:00[America/Boa_Vista]"}           | ${true}  | ${"first instant, undone 7 days on"}
    ${"2000-10-10T12:00:00-03:00[America/Boa_Vista]"}           | ${true}  | ${"undone 2000-10-15"}
    ${"2000-10-14T23:59:59.999999999-03:00[America/Boa_Vista]"} | ${true}  | ${"last nanosecond"}
    ${"2000-10-14T23:00:00-04:00[America/Boa_Vista]"}           | ${false} | ${"the set-back"}
    ${"2000-10-20T12:00:00-04:00[America/Boa_Vista]"}           | ${false} | ${"after the set-back"}
    ${"2000-10-01T12:00:00-02:00[America/Noronha]"}             | ${false} | ${"before the advance"}
    ${"2000-10-10T12:00:00-01:00[America/Noronha]"}             | ${true}  | ${"undone 2000-10-15"}
    ${"2000-10-20T12:00:00-02:00[America/Noronha]"}             | ${false} | ${"after the set-back"}
    ${"2000-10-01T12:00:00-03:00[America/Recife]"}              | ${false} | ${"before the advance"}
    ${"2000-10-10T12:00:00-02:00[America/Recife]"}              | ${true}  | ${"undone 2000-10-15"}
    ${"2000-10-20T12:00:00-03:00[America/Recife]"}              | ${false} | ${"after the set-back"}
    ${"2000-10-01T12:00:00-03:00[America/Fortaleza]"}           | ${false} | ${"before the advance"}
    ${"2000-10-15T12:00:00-02:00[America/Fortaleza]"}           | ${true}  | ${"undone 2000-10-22"}
    ${"2000-10-25T12:00:00-03:00[America/Fortaleza]"}           | ${false} | ${"after the set-back"}
    ${"2000-10-01T12:00:00-03:00[America/Maceio]"}              | ${false} | ${"before the advance"}
    ${"2000-10-15T12:00:00-02:00[America/Maceio]"}              | ${true}  | ${"undone 2000-10-22"}
    ${"2000-10-25T12:00:00-03:00[America/Maceio]"}              | ${false} | ${"after the set-back"}
    ${"1943-03-20T12:00:00+01:00[Europe/Tirane]"}               | ${false} | ${"before the advance"}
    ${"1943-04-05T12:00:00+02:00[Europe/Tirane]"}               | ${true}  | ${"undone 1943-04-10"}
    ${"1943-04-15T12:00:00+01:00[Europe/Tirane]"}               | ${false} | ${"after the set-back"}
    ${"1945-03-20T12:00:00+01:00[Europe/Vienna]"}               | ${false} | ${"before the advance"}
    ${"1945-04-05T12:00:00+02:00[Europe/Vienna]"}               | ${true}  | ${"undone 1945-04-12"}
    ${"1945-04-20T12:00:00+01:00[Europe/Vienna]"}               | ${false} | ${"after the set-back"}
    ${"1943-04-10T12:00:00+02:00[Africa/Tunis]"}                | ${true}  | ${"undone 1943-04-17"}
    ${"1943-04-20T12:00:00+01:00[Africa/Tunis]"}                | ${false} | ${"the eight days between two periods"}
    ${"1943-05-01T12:00:00+02:00[Africa/Tunis]"}                | ${true}  | ${"undone 1943-10-04"}
    ${"2004-05-20T12:00:00-03:00[America/Argentina/Tucuman]"}   | ${false} | ${"before the set-back"}
    ${"2004-06-05T12:00:00-04:00[America/Argentina/Tucuman]"}   | ${false} | ${"clocks put back, then forward"}
    ${"2004-06-20T12:00:00-03:00[America/Argentina/Tucuman]"}   | ${false} | ${"the advance is never undone"}
  `(
    "returns $expected for $value around a period shorter than 14 days ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
    10_000,
  );

  // Three offsets inside 14 days, where the polyfill's own search never returns.
  // Europe/Riga: +01→+02 1944-04-03T01:00Z, +02→+01 1944-10-02T01:00Z, +01→+03
  //   1944-10-12T23:00Z, and no change for decades after.
  // Europe/Simferopol: +01→+02 1943-03-29T01:00Z, +02→+01 1943-10-04T01:00Z, +01→+02
  //   1944-04-03T01:00Z, +02→+03 1944-04-12T22:00Z.
  it.each`
    value                                             | expected | why
    ${"1944-04-15T14:00:00+02:00[Europe/Riga]"}       | ${true}  | ${"advance undone 1944-10-02"}
    ${"1944-09-25T12:00:00+02:00[Europe/Riga]"}       | ${true}  | ${"advance undone 1944-10-02"}
    ${"1944-10-05T12:00:00+01:00[Europe/Riga]"}       | ${false} | ${"after the set-back"}
    ${"1944-10-20T12:00:00+03:00[Europe/Riga]"}       | ${false} | ${"a two-hour advance never undone"}
    ${"1943-07-15T12:00:00+02:00[Europe/Simferopol]"} | ${true}  | ${"advance undone 1943-10-04"}
    ${"1943-10-15T13:00:00+01:00[Europe/Simferopol]"} | ${false} | ${"after the set-back"}
    ${"1944-04-05T12:00:00+02:00[Europe/Simferopol]"} | ${false} | ${"advance never undone"}
    ${"1944-04-20T12:00:00+03:00[Europe/Simferopol]"} | ${false} | ${"advance never undone"}
  `(
    "returns $expected for $value beside three offsets in 14 days ($why)",
    ({ value, expected }) => {
      expect(isInDaylightSaving(value)).toBe(expected);
    },
    10_000,
  );

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns false for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(isInDaylightSaving(invalidValue as never)).toBe(false);
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`never throws for battle-test timeZone ${timeZone}`, () => {
      const value = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 7,
        day: 15,
        hour: 12,
        minute: 0,
        second: 0,
        timeZone,
      }).toString();

      expect(() => isInDaylightSaving(value)).not.toThrow();
    });
  }

  it("returns false for a zone that never observes DST", () => {
    for (const value of [
      "2024-01-15T00:00:00+09:00[Asia/Tokyo]",
      "2024-07-15T00:00:00+09:00[Asia/Tokyo]",
      "2024-01-15T00:00:00+05:45[Asia/Kathmandu]",
      "2024-07-15T00:00:00+05:45[Asia/Kathmandu]",
    ]) {
      expect(isInDaylightSaving(value)).toBe(false);
    }
  });

  it("returns false on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      isInDaylightSaving("2024-07-15T12:00:00-04:00[America/New_York]"),
    ).toBe(false);
  });
});
