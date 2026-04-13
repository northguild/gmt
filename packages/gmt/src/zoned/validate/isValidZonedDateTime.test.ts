import {
  localNoonBattleCases,
  sameInstantBattleCases,
  unixEpochBattleCases,
  validOnlyBattleTestTimeZones,
} from "../../test";
import { isValidZonedDateTime } from ".";

describe("isValidZonedDateTime", () => {
  it.each`
    value
    ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T00:00:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T00:00:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T00:00:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T00:00:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T00:00:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T00:00:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T00:00:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T00:00:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T00:00:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T00:00:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T00:00:00-05:00[America/New_York]"}
    ${"2024-02-29T00:00:00-06:00[America/Chicago]"}
    ${"2024-02-29T00:00:00-07:00[America/Phoenix]"}
  `(
    "returns true for valid zoned datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidZonedDateTime(value)).toBe(true);
    },
  );

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

  // ** historical offsets have changed, so some datetimes that would have been valid in the past are now invalid. This test ensures we recognize this reality and don't accidentally accept invalid historical datetimes. **
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
    ${"1970-01-01T00:00:00-11:00[Pacific/Apia]"}        | ${true}
    ${"1970-07-01T00:00:00-11:00[Pacific/Apia]"}        | ${true}
    ${"2024-02-29T00:00:00+13:00[Pacific/Apia]"}        | ${true}
    ${"2024-07-01T00:00:00+13:00[Pacific/Apia]"}        | ${true}
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

  // invalid historical offsets
  it.each`
    value
    ${"1970-01-01T05:45:00+05:45[Asia/Kathmandu]"}
    ${"1970-01-01T00:00:00+11:00[Australia/Lord_Howe]"} | ${true}
    ${"1970-07-01T00:00:00+10:30[Australia/Lord_Howe]"} | ${true}
    ${"1970-01-01T00:00:00+13:45[Pacific/Chatham]"}     | ${true}
    ${"1970-01-01T00:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"1970-07-01T00:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"1970-01-01T00:00:00+13:00[Pacific/Apia]"}        | ${true}
    ${"1970-07-01T00:00:00+13:00[Pacific/Apia]"}        | ${true}
    ${"1970-01-01T00:00:00+00:00[Europe/Lisbon]"}       | ${true}
    ${"1970-01-01T00:00:00+00:00[Europe/Dublin]"}       | ${true}
    ${"1970-07-01T00:00:00+02:00[Europe/Berlin]"}       | ${true}
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
});
