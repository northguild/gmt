import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseDayOfWeekFromUtc } from "./parseDayOfWeekFromUtc";

describe("parseDayOfWeekFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${7}
    ${"2024-03-18T00:00:00Z"} | ${1}
    ${"2024-03-16T00:00:00Z"} | ${6}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayOfWeekFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseDayOfWeekFromUtc(value)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseDayOfWeekFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBeNull();
  });

  // The value is read on the wall clock of `timeZone` (default UTC), as `parseTimeFromUtc` does.
  // Expected fields from Temporal.Instant#toZonedDateTimeISO and native Intl.DateTimeFormat:
  // 2024-03-17T02:30:45.123456789Z is Saturday 2024-03-16T22:30:45.123456789-04:00 in New York and
  // Sunday 08:00:45.123456789+05:30 in Kolkata; 2025-01-01T02:00:00Z is 2024-12-31T21:00-05:00 in New York.
  it.each`
    value                               | timeZone              | expected
    ${"2024-03-17T02:30:45.123456789Z"} | ${"UTC"}              | ${7}
    ${"2024-03-17T02:30:45.123456789Z"} | ${"America/New_York"} | ${6}
    ${"2024-03-17T02:30:45.123456789Z"} | ${undefined}          | ${7}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseDayOfWeekFromUtc(value, { timeZone })).toBe(expected);
    },
  );

  // An unknown IANA zone is invalid input; an explicit undefined is the omitted option (UTC).
  it.each`
    timeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
  `("returns the sentinel for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(
      parseDayOfWeekFromUtc("2024-03-17T02:30:45.123456789Z", { timeZone }),
    ).toBeNull();
  });
});
