import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseDateFromUtc } from "./parseDateFromUtc";

describe("parseDateFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"2024-03-17"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01"}
    ${"2024-12-31T23:59:59Z"} | ${"2024-12-31"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDateFromUtc(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid-date"}
    ${"2024-03-17T14:30:45"}
    ${"2024-03-17T14:30:45+00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseDateFromUtc(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseDateFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });

  // The value is read on the wall clock of `timeZone` (default UTC), as `parseTimeFromUtc` does.
  // Expected fields from Temporal.Instant#toZonedDateTimeISO and native Intl.DateTimeFormat:
  // 2024-03-17T02:30:45.123456789Z is Saturday 2024-03-16T22:30:45.123456789-04:00 in New York and
  // Sunday 08:00:45.123456789+05:30 in Kolkata; 2025-01-01T02:00:00Z is 2024-12-31T21:00-05:00 in New York.
  it.each`
    value                               | timeZone              | expected
    ${"2024-03-17T02:30:45.123456789Z"} | ${"UTC"}              | ${"2024-03-17"}
    ${"2024-03-17T02:30:45.123456789Z"} | ${"America/New_York"} | ${"2024-03-16"}
    ${"2025-01-01T02:00:00Z"}           | ${"America/New_York"} | ${"2024-12-31"}
    ${"2024-03-17T02:30:45.123456789Z"} | ${undefined}          | ${"2024-03-17"}
  `(
    "returns $expected for $value with timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(parseDateFromUtc(value, { timeZone })).toBe(expected);
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
      parseDateFromUtc("2024-03-17T02:30:45.123456789Z", { timeZone }),
    ).toBe("");
  });
});
