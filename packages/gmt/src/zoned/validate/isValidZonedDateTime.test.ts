import {
  localNoonBattleCases,
  sameInstantBattleCases,
  unixEpochBattleCases,
  validOnlyBattleTestTimeZones,
} from "../../test";
import { isValidZonedDateTime } from ".";

describe("isValidZonedDateTime", () => {
  for (const timeZone of validOnlyBattleTestTimeZones) {
    it(`accepts valid fixture timeZone without explicit offset: ${timeZone}`, () => {
      expect(isValidZonedDateTime(`2024-03-17T14:30:45.123[${timeZone}]`)).toBe(
        true,
      );
    });
  }

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`accepts local-noon fixture zoned datetime in ${timeZone}`, () => {
      expect(isValidZonedDateTime(value)).toBe(true);
    });
  }

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`accepts battle-test zoned datetime in ${timeZone}`, () => {
      expect(isValidZonedDateTime(value)).toBe(true);
    });
  }

  for (const { timeZone, value } of unixEpochBattleCases) {
    it(`accepts historical epoch zoned datetime in ${timeZone}`, () => {
      expect(isValidZonedDateTime(value)).toBe(true);
    });
  }

  it.each`
    historical                                          | validity
    ${"1970-01-01T00:00:00+05:30[Asia/Kathmandu]"}      | ${true}
    ${"1970-07-01T00:00:00+05:30[Asia/Kathmandu]"}      | ${true}
    ${"2024-02-29T00:00:00+05:45[Asia/Kathmandu]"}      | ${true}
    ${"2024-07-01T00:00:00+05:45[Asia/Kathmandu]"}      | ${true}
    ${"1970-01-01T00:00:00+10:00[Australia/Lord_Howe]"} | ${true}
    ${"1970-07-01T00:00:00+10:00[Australia/Lord_Howe]"} | ${true}
    ${"2024-02-29T00:00:00+11:00[Australia/Lord_Howe]"} | ${true}
    ${"2024-07-01T00:00:00+10:30[Australia/Lord_Howe]"} | ${true}
    ${"1970-01-01T00:00:00+12:45[Pacific/Chatham]"}     | ${true}
    ${"1970-07-01T00:00:00+12:45[Pacific/Chatham]"}     | ${true}
    ${"2024-02-29T00:00:00+13:45[Pacific/Chatham]"}     | ${true}
    ${"2024-07-01T00:00:00+12:45[Pacific/Chatham]"}     | ${true}
    ${"1970-01-01T00:00:00+02:00[Europe/Istanbul]"}     | ${true}
    ${"1970-07-01T00:00:00+02:00[Europe/Istanbul]"}     | ${true}
    ${"2024-02-29T00:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"2024-07-01T00:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"1970-01-01T00:00:00+01:00[Europe/Lisbon]"}       | ${true}
    ${"1970-07-01T00:00:00+01:00[Europe/Lisbon]"}       | ${true}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${true}
    ${"2024-07-01T00:00:00+01:00[Europe/Lisbon]"}       | ${true}
    ${"1970-01-01T00:00:00+01:00[Europe/Dublin]"}       | ${true}
    ${"1970-07-01T00:00:00+01:00[Europe/Dublin]"}       | ${true}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${true}
    ${"2024-07-01T00:00:00+01:00[Europe/Dublin]"}       | ${true}
    ${"1970-01-01T00:00:00+01:00[Europe/Berlin]"}       | ${true}
    ${"1970-07-01T00:00:00+01:00[Europe/Berlin]"}       | ${true}
    ${"2024-02-29T00:00:00+01:00[Europe/Berlin]"}       | ${true}
    ${"2024-07-01T00:00:00+02:00[Europe/Berlin]"}       | ${true}
  `(
    "recognizes validity historical offset in $historical as $validity for timeZone offsets have changed",
    ({ historical, validity }) => {
      expect(isValidZonedDateTime(historical)).toBe(validity);
    },
  );

  it.each`
    value
    ${"1970-01-01T05:45:00+05:45[Asia/Kathmandu]"}
    ${"1970-01-01T00:00:00+11:00[Australia/Lord_Howe]"}
    ${"1970-07-01T00:00:00+10:30[Australia/Lord_Howe]"}
    ${"1970-01-01T00:00:00+03:00[Europe/Istanbul]"}
    ${"1970-07-01T00:00:00+03:00[Europe/Istanbul]"}
    ${"1970-01-01T00:00:00+00:00[Europe/Lisbon]"}
    ${"1970-01-01T00:00:00+00:00[Europe/Dublin]"}
    ${"1970-07-01T00:00:00+02:00[Europe/Berlin]"}
  `("returns false for invalid historical offset: $value", ({ value }) => {
    expect(isValidZonedDateTime(value)).toBe(false);
  });

  it.each`
    value
    ${"2024-03-17T14:30:60[America/New_York]"}
    ${"2024-03-17T14:30:60.123[America/New_York]"}
    ${"2024-03-17T14:30:60+05:00[Asia/Kolkata]"}
    ${"2024-03-17T14:30:60-08:00[America/Los_Angeles]"}
    ${"2024-03-17T14:30:60Z[UTC]"}
    ${"2016-12-31t23:59:60+00:00[UTC]"}
    ${"2016-12-31 23:59:60+00:00[UTC]"}
    ${"2016-12-31T235960+00:00[UTC]"}
    ${"20161231T235960Z[UTC]"}
    ${"20161231 235960Z[UTC]"}
  `(
    "returns false for leap second with zoned datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
    },
  );

  it.each`
    value
    ${"2024-03-17T14:30:45.123-04:00"}
    ${"2024-03-17T14:30:45Z"}
    ${"2024-03-17T14:30:60Z[UTC]"}
    ${"2024-03-17T14:30:45.123-04:00[Not/AZone]"}
    ${"not-a-zoned-datetime"}
  `(
    "returns false for invalid zoned datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns false for non-string input: $value", ({ value }) => {
    expect(isValidZonedDateTime(value as never)).toBe(false);
  });

  // zoned/ is ISO-only: a non-ISO calendar annotation is `isValidCalendarZonedDateTime`'s input.
  // Temporal.ZonedDateTime.from reads the first `u-ca` annotation (proposal-temporal
  // `ParseISODateTime`), so `[u-ca=iso8601]` names the ISO calendar and is accepted.
  it.each`
    value
    ${"2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]"}
    ${"2024-02-10T12:00:00+00:00[UTC][u-ca=hebrew]"}
    ${"2024-02-10T12:00:00-05:00[America/New_York][u-ca=islamic-civil]"}
    ${"2024-02-10T12:00:00-05:00[America/New_York][!u-ca=hebrew]"}
    ${"2024-02-10T12:00:00-05:00[!America/New_York][!u-ca=hebrew]"}
  `(
    "returns false for a zoned datetime with a calendar annotation: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(false);
    },
  );

  // Temporal's ISO grammar (RFC 9557 §3.3, `ParseISODateTime`): elective annotations are ignored,
  // the first `u-ca` annotation names the calendar, and an unknown critical annotation, a second
  // time zone annotation, or a key before the time zone annotation is rejected. Native Temporal
  // (Chromium 153) agrees on every row.
  it.each`
    value                                                                        | expected | reason
    ${"2024-03-10T12:30:00-04:00[America/New_York][u-ca=iso8601]"}               | ${true}  | ${"ISO calendar annotation"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][!u-ca=iso8601]"}              | ${true}  | ${"critical ISO calendar annotation"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][u-ca=ISO8601]"}               | ${true}  | ${"calendar id in upper case"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][u-ca=iso8601][u-ca=hebrew]"}  | ${true}  | ${"first calendar annotation is ISO"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][foo=bar]"}                    | ${true}  | ${"elective annotation"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][foo=bar][u-ca=iso8601]"}      | ${true}  | ${"elective annotation before the calendar"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][!foo=bar]"}                   | ${false} | ${"unknown critical annotation"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][u-ca=hebrew][u-ca=iso8601]"}  | ${false} | ${"first calendar annotation is Hebrew"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][!u-ca=iso8601][u-ca=hebrew]"} | ${false} | ${"second u-ca with a critical flag"}
    ${"2024-03-10T12:30:00-04:00[foo=bar][America/New_York]"}                    | ${false} | ${"time zone annotation after a key"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][Asia/Tokyo]"}                 | ${false} | ${"two time zone annotations"}
    ${"2024-03-10T12:30:00-04:00[America/New_York][u-ca=bogus]"}                 | ${false} | ${"unknown calendar"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(isValidZonedDateTime(value)).toBe(expected);
  });
});

describe("isValidZonedDateTime at the range limits", () => {
  // TC39 accepts every in-range instant even when its wall clock runs past +275760-09-13T00:00.
  it.each`
    value                                                         | expected | reason
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}           | ${true}  | ${"Sydney maximum instant"}
    ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}         | ${true}  | ${"Kiritimati maximum instant"}
    ${"+275760-09-13T00:00:00.001+10:00[Australia/Sydney]"}       | ${true}  | ${"first wall clock past 00:00Z of the last day"}
    ${"+275760-09-13T10:00:00.000000001+10:00[Australia/Sydney]"} | ${false} | ${"1ns past the maximum"}
    ${"+275760-09-13T09:00:00+09:00[Australia/Sydney]"}           | ${false} | ${"wrong offset for Sydney"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(isValidZonedDateTime(value)).toBe(expected);
  });
});

// The strict-shape rule (see coding-standards), applied to zoned strings: the part before the first `[` must be GMT's strict
// ISO 8601 extended date-time (`date T time[.fraction]`), then nothing, `Z`, or an extended
// `±HH:MM[:SS[.fraction]]` offset (RFC 3339 §5.6 `time-numoffset`). Temporal's grammar also reads
// basic format, a space or lower-case `t` separator, a lower-case `z`, an hour-only offset or
// time, and a date without a time — polyfill 0.5.1 resolves every rejected row below to
// 2024-10-03 in New York — and GMT rejects them.
describe("isValidZonedDateTime requires GMT's strict extended shape", () => {
  it.each`
    value                                               | expected | reason
    ${"20241003T143000-0400[America/New_York]"}         | ${false} | ${"basic format throughout"}
    ${"20241003T1430[America/New_York]"}                | ${false} | ${"basic format, no offset"}
    ${"2024-10-03T143000-04:00[America/New_York]"}      | ${false} | ${"basic time"}
    ${"2024-10-03T14:30:00-0400[America/New_York]"}     | ${false} | ${"basic offset"}
    ${"2024-10-03 14:30:00-04:00[America/New_York]"}    | ${false} | ${"space separator"}
    ${"2024-10-03t14:30:00-04:00[America/New_York]"}    | ${false} | ${"lower-case t separator"}
    ${"2024-10-03T18:30:00z[America/New_York]"}         | ${false} | ${"lower-case z designator"}
    ${"2024-10-03T14:30:00-04[America/New_York]"}       | ${false} | ${"hour-only offset"}
    ${"2024-10-03T14[America/New_York]"}                | ${false} | ${"hour-only time"}
    ${"2024-10-03[America/New_York]"}                   | ${false} | ${"date without a time"}
    ${"2024-10-03T14:30-04:00[America/New_York]"}       | ${true}  | ${"reduced precision: no seconds"}
    ${"2024-10-03T14:30:00,5-04:00[America/New_York]"}  | ${true}  | ${"comma decimal sign"}
    ${"2024-10-03T14:30:00-04:00:00[America/New_York]"} | ${true}  | ${"offset with seconds"}
    ${"2024-10-03T18:30:00Z[America/New_York]"}         | ${true}  | ${"Z designator"}
    ${"2024-10-03T14:30:00[America/New_York]"}          | ${true}  | ${"no offset"}
    ${"+002024-10-03T14:30:00-04:00[America/New_York]"} | ${true}  | ${"six-digit year"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(isValidZonedDateTime(value)).toBe(expected);
  });
});
