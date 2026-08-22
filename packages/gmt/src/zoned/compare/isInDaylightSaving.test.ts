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
