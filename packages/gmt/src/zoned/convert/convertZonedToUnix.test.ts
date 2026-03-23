import {
  battleTestLeapYearUnix,
  sameInstantBattleCases,
  unixEpochBattleCases,
} from "../test/timezoneFixtures";
import { convertZonedToUnix } from "./convertZonedToUnix";

describe("convertZonedToUnix", () => {
  it("defaults to milliseconds when unit is not provided", () => {
    expect(convertZonedToUnix("1970-01-01T00:00:00+00:00[UTC]")).toBe(0);
  });

  it("supports milliseconds and seconds units", () => {
    expect(
      convertZonedToUnix("1970-01-01T00:00:00+00:00[UTC]", "milliseconds"),
    ).toBe(0);
    expect(
      convertZonedToUnix("1970-01-01T00:00:00+00:00[UTC]", "seconds"),
    ).toBe(0);
  });

  it.each`
    value
    ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${"1970-01-01T00:00:00+00:00[GMT]"}
    ${"1970-01-01T00:00:00+00:00[Etc/GMT]"}
    ${"1970-01-01T01:00:00+01:00[Europe/Lisbon]"}
    ${"1970-01-01T01:00:00+01:00[Europe/Dublin]"}
    ${"1970-01-01T01:00:00+01:00[Europe/Berlin]"}
    ${"1970-01-01T02:00:00+02:00[Europe/Helsinki]"}
    ${"1970-01-01T02:00:00+02:00[Europe/Istanbul]"}
    ${"1970-01-01T05:30:00+05:30[Asia/Kolkata]"}
    ${"1970-01-01T05:30:00+05:30[Asia/Kathmandu]"}
    ${"1970-01-01T08:00:00+08:00[Asia/Shanghai]"}
    ${"1970-01-01T10:00:00+10:00[Australia/Lord_Howe]"}
    ${"1970-01-01T12:45:00+12:45[Pacific/Chatham]"}
    ${"1969-12-31T13:00:00-11:00[Pacific/Apia]"}
    ${"1969-12-31T13:00:00-11:00[Pacific/Niue]"}
    ${"1969-12-31T19:00:00-05:00[America/New_York]"}
    ${"1969-12-31T18:00:00-06:00[America/Chicago]"}
    ${"1969-12-31T17:00:00-07:00[America/Phoenix]"}
  `("returns 0 for $value", ({ value }) => {
    expect(convertZonedToUnix(value)).toBe(0);
  });

  it.each`
    value
    ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}
  `("returns leap-year unix for $value", ({ value }) => {
    expect(convertZonedToUnix(value)).toBe(battleTestLeapYearUnix);
  });

  it.each`
    invalidValue
    ${"not-a-zoned-datetime"}
    ${"2024-02-29T09:00:00+00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns null for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertZonedToUnix(invalidValue as never)).toBeNull();
    },
  );

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      convertZonedToUnix(
        "2024-02-29T09:00:00+00:00[UTC]",
        invalidUnit as never,
      ),
    ).toBeNull();
  });

  for (const {
    timeZone,
    value,
    unixMilliseconds,
    unixSeconds,
  } of sameInstantBattleCases) {
    it(`returns consistent unix values for battle-test timezone ${timeZone}`, () => {
      expect(convertZonedToUnix(value, "milliseconds")).toBe(unixMilliseconds);
      expect(convertZonedToUnix(value, "seconds")).toBe(unixSeconds);
    });
  }

  for (const {
    timeZone,
    value,
    unixMilliseconds,
    unixSeconds,
  } of unixEpochBattleCases) {
    it(`returns historical unix values for battle-test timezone ${timeZone}`, () => {
      expect(convertZonedToUnix(value, "milliseconds")).toBe(unixMilliseconds);
      expect(convertZonedToUnix(value, "seconds")).toBe(unixSeconds);
    });
  }
});
