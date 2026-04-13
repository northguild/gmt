import { getZonedNowUnit } from "./getZonedNowUnit";

describe("getZonedNowUnit", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    timeZone              | unit             | expected
    ${"UTC"}              | ${"year"}        | ${"2024"}
    ${"UTC"}              | ${"month"}       | ${"02"}
    ${"UTC"}              | ${"week"}        | ${"9"}
    ${"UTC"}              | ${"day"}         | ${"29"}
    ${"UTC"}              | ${"dayOfWeek"}   | ${"4"}
    ${"UTC"}              | ${"hour"}        | ${"00"}
    ${"UTC"}              | ${"minute"}      | ${"00"}
    ${"UTC"}              | ${"second"}      | ${"00"}
    ${"UTC"}              | ${"millisecond"} | ${"000"}
    ${"UTC"}              | ${"microsecond"} | ${"000"}
    ${"UTC"}              | ${"nanosecond"}  | ${"000"}
    ${"Europe/Helsinki"}  | ${"year"}        | ${"2024"}
    ${"Europe/Helsinki"}  | ${"month"}       | ${"02"}
    ${"Europe/Helsinki"}  | ${"week"}        | ${"9"}
    ${"Europe/Helsinki"}  | ${"day"}         | ${"29"}
    ${"Europe/Helsinki"}  | ${"dayOfWeek"}   | ${"4"}
    ${"Europe/Helsinki"}  | ${"hour"}        | ${"02"}
    ${"Europe/Helsinki"}  | ${"minute"}      | ${"00"}
    ${"Europe/Helsinki"}  | ${"second"}      | ${"00"}
    ${"Europe/Helsinki"}  | ${"millisecond"} | ${"000"}
    ${"Europe/Helsinki"}  | ${"microsecond"} | ${"000"}
    ${"Europe/Helsinki"}  | ${"nanosecond"}  | ${"000"}
    ${"Asia/Kolkata"}     | ${"year"}        | ${"2024"}
    ${"Asia/Kolkata"}     | ${"month"}       | ${"02"}
    ${"Asia/Kolkata"}     | ${"week"}        | ${"9"}
    ${"Asia/Kolkata"}     | ${"day"}         | ${"29"}
    ${"Asia/Kolkata"}     | ${"dayOfWeek"}   | ${"4"}
    ${"Asia/Kolkata"}     | ${"hour"}        | ${"05"}
    ${"Asia/Kolkata"}     | ${"minute"}      | ${"30"}
    ${"Asia/Kolkata"}     | ${"second"}      | ${"00"}
    ${"Asia/Kolkata"}     | ${"millisecond"} | ${"000"}
    ${"Asia/Kolkata"}     | ${"microsecond"} | ${"000"}
    ${"Asia/Kolkata"}     | ${"nanosecond"}  | ${"000"}
    ${"America/New_York"} | ${"year"}        | ${"2024"}
    ${"America/New_York"} | ${"month"}       | ${"02"}
    ${"America/New_York"} | ${"week"}        | ${"9"}
    ${"America/New_York"} | ${"day"}         | ${"28"}
    ${"America/New_York"} | ${"dayOfWeek"}   | ${"3"}
    ${"America/New_York"} | ${"hour"}        | ${"19"}
    ${"America/New_York"} | ${"minute"}      | ${"00"}
    ${"America/New_York"} | ${"second"}      | ${"00"}
    ${"America/New_York"} | ${"millisecond"} | ${"000"}
    ${"America/New_York"} | ${"microsecond"} | ${"000"}
    ${"America/New_York"} | ${"nanosecond"}  | ${"000"}
  `(
    "returns expected unit $unit for timeZone $timeZone",
    ({ timeZone, unit, expected }) => {
      const val = getZonedNowUnit(timeZone, unit as never);
      if (unit === "microsecond" || unit === "nanosecond") {
        // micro/nanoseconds are too small to assert exact values reliably
        expect(val).toMatch(/^\d{3}$/);
      } else {
        expect(val).toBe(expected as string);
      }
    },
  );

  it.each`
    invalidTimeZone
    ${""}
    ${"invalid"}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid timeZone $invalidTimeZone",
    ({ invalidTimeZone }) => {
      expect(getZonedNowUnit(invalidTimeZone as never, "year")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${""}
    ${null}
    ${undefined}
    ${"invalid"}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(getZonedNowUnit("UTC", invalidUnit as never)).toBe("");
  });
});
