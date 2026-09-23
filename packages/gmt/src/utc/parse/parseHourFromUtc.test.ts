import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseHourFromUtc } from "./parseHourFromUtc";

describe("parseHourFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"14"}
    ${"2024-03-17T00:00:00Z"} | ${"00"}
    ${"2024-03-17T23:59:59Z"} | ${"23"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseHourFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseHourFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseHourFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });

  // The value is read on the wall clock of `timeZone` (default UTC), as `parseTimeFromUtc` does.
  // Expected fields from Temporal.Instant#toZonedDateTimeISO and native Intl.DateTimeFormat:
  // 2024-03-17T02:30:45.123456789Z is Saturday 2024-03-16T22:30:45.123456789-04:00 in New York and
  // Sunday 08:00:45.123456789+05:30 in Kolkata; 2025-01-01T02:00:00Z is 2024-12-31T21:00-05:00 in New York.
  it.each`
    value                               | timeZone              | expected
    ${"2024-03-17T02:30:45.123456789Z"} | ${"UTC"}              | ${"02"}
    ${"2024-03-17T02:30:45.123456789Z"} | ${"America/New_York"} | ${"22"}
    ${"2024-03-17T02:30:45.123456789Z"} | ${"Asia/Kolkata"}     | ${"08"}
    ${"2024-03-17T02:30:45.123456789Z"} | ${undefined}          | ${"02"}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseHourFromUtc(value, { timeZone })).toBe(expected);
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
      parseHourFromUtc("2024-03-17T02:30:45.123456789Z", { timeZone }),
    ).toBe("");
  });
});
