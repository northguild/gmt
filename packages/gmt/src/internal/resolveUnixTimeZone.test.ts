import { mockSystemTimeZone, battleTestTimeZones } from "../test";
import { resolveUnixTimeZone } from "./resolveUnixTimeZone";

describe("resolveUnixTimeZone", () => {
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: timeZone,
    })),
  )(
    "returns $expected for valid timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(resolveUnixTimeZone(timeZone)).toBe(expected);
    },
  );

  it("returns the system timeZone when input is undefined", () => {
    const restoreTimezone = mockSystemTimeZone("America/New_York");

    const result = resolveUnixTimeZone(undefined);
    expect(result).toBe("America/New_York");

    restoreTimezone();
  });

  it.each`
    timeZone        | reason
    ${""}           | ${"empty string"}
    ${"not-a-zone"} | ${"invalid IANA name"}
    ${"UTC+1"}      | ${"offset-based string"}
  `(
    "returns empty string for invalid timeZone $timeZone ($reason)",
    ({ timeZone }) => {
      expect(resolveUnixTimeZone(timeZone as never)).toBe("");
    },
  );

  it("returns empty string for null", () => {
    const restoreTimezone = mockSystemTimeZone("not-a-timezone");
    expect(resolveUnixTimeZone(null as never)).toBe("");
    restoreTimezone();
  });

  it("returns empty string for undefined when system timeZone is invalid", () => {
    const restoreTimezone = mockSystemTimeZone("not-a-timezone");
    expect(resolveUnixTimeZone(undefined)).toBe("");
    restoreTimezone();
  });
});
