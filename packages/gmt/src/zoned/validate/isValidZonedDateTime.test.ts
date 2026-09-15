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

  // E5 (issue #78), decision of record D2: zoned/ previously accepted a [u-ca=...] calendar
  // annotation by accident (nothing gated it) and did genuinely calendar-aware but
  // undocumented, untested arithmetic (verified directly against @js-temporal/polyfill during
  // E5 research: addZoned on this exact value returned "2024-03-11..." instead of the ISO
  // answer "2024-03-10..."). Calendar-system awareness is confined to plain/ PlainDate (D1);
  // zoned/ now rejects the annotation outright rather than continuing to accept it silently.
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
