import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseYearFromUtc } from "./parseYearFromUtc";

describe("parseYearFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"2024"}
    ${"2024-01-01T00:00:00Z"} | ${"2024"}
    ${"1970-01-01T00:00:00Z"} | ${"1970"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseYearFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
    ${"not-valid"}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseYearFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseYearFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });

  // The value is read on the wall clock of `timeZone` (default UTC), as `parseTimeFromUtc` does.
  // Expected fields from Temporal.Instant#toZonedDateTimeISO and native Intl.DateTimeFormat:
  // 2024-03-17T02:30:45.123456789Z is Saturday 2024-03-16T22:30:45.123456789-04:00 in New York and
  // Sunday 08:00:45.123456789+05:30 in Kolkata; 2025-01-01T02:00:00Z is 2024-12-31T21:00-05:00 in New York.
  it.each`
    value                     | timeZone              | expected
    ${"2025-01-01T02:00:00Z"} | ${"UTC"}              | ${"2025"}
    ${"2025-01-01T02:00:00Z"} | ${"America/New_York"} | ${"2024"}
    ${"2025-01-01T02:00:00Z"} | ${undefined}          | ${"2025"}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseYearFromUtc(value, { timeZone })).toBe(expected);
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
      parseYearFromUtc("2024-03-17T02:30:45.123456789Z", { timeZone }),
    ).toBe("");
  });
});
