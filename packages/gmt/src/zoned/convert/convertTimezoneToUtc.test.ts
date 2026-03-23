import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { convertTimezoneToUtc } from "./convertTimezoneToUtc";

describe("convertTimezoneToUtc", () => {
  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${"2024-02-29T00:00:00Z"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(convertTimezoneToUtc(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertTimezoneToUtc(invalidValue as never)).toBe("");
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${"2024-02-29T00:00:00Z"}
  `(
    "converts all battle-test timezones representing 2024-02-29T00:00:00Z to UTC $expected",
    ({ value, expected }) => {
      expect(convertTimezoneToUtc(value)).toBe(expected);
    },
  );

  for (const { timeZone, value, utc } of sameInstantBattleCases) {
    it(`converts battle-test timezone ${timeZone} to shared UTC instant`, () => {
      expect(convertTimezoneToUtc(value)).toBe(utc);
    });
  }
});
