import { minUtc } from "./minUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("minUtc", () => {
  // Canonical inputs
  const earlyInput = "2024-01-01T08:00:00Z";
  const midInput = "2024-02-15T15:30:00Z";
  const lateInput = "2024-03-10T12:00:00Z";
  const boundaryInput = "2023-12-31T23:59:59Z";

  it.each`
    utcDateTimes                         | expected
    ${[earlyInput, midInput, lateInput]} | ${"2024-01-01T08:00:00Z"}
    ${[boundaryInput, earlyInput]}       | ${"2023-12-31T23:59:59Z"}
  `(
    "returns $expected for utcDateTimes $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(minUtc(utcDateTimes)).toBe(expected);
    },
  );

  it.each`
    utcDateTimes   | expected
    ${[]}          | ${null}
    ${["invalid"]} | ${null}
  `(
    "returns $expected for edge case $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(minUtc(utcDateTimes)).toBe(expected);
    },
  );

  it("returns earliest valid value when mixed with invalid values", () => {
    expect(minUtc(["invalid", lateInput, "also invalid"])).toBe(
      "2024-03-10T12:00:00Z",
    );
  });

  it("returns null when Temporal.Instant.from throws on all valid candidates", () => {
    mockTemporalInstantFromThrow();
    // After filtering, valid array has items but from() throws for each
    expect(minUtc([earlyInput, midInput])).toBeNull();
  });
});
