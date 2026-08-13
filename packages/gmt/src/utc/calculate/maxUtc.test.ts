import { maxUtc } from "./maxUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("maxUtc", () => {
  // Canonical inputs
  const earlyInput = "2024-01-01T08:00:00Z";
  const midInput = "2024-02-15T15:30:00Z";
  const lateInput = "2024-03-10T12:00:00Z";
  const boundaryInput = "2023-12-31T23:59:59Z";

  it.each`
    utcDateTimes                         | expected
    ${[earlyInput, midInput, lateInput]} | ${"2024-03-10T12:00:00Z"}
    ${[boundaryInput, earlyInput]}       | ${"2024-01-01T08:00:00Z"}
  `(
    "returns $expected for utcDateTimes $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(maxUtc(utcDateTimes)).toBe(expected);
    },
  );

  it.each`
    utcDateTimes   | expected
    ${[]}          | ${null}
    ${["invalid"]} | ${null}
  `(
    "returns $expected for edge case $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(maxUtc(utcDateTimes)).toBe(expected);
    },
  );

  it("returns latest valid value when mixed with invalid values", () => {
    expect(maxUtc(["invalid", lateInput, "also invalid"])).toBe(
      "2024-03-10T12:00:00Z",
    );
  });

  it("returns null when Temporal.Instant.from throws on all valid candidates", () => {
    mockTemporalInstantFromThrow();
    expect(maxUtc([earlyInput, midInput])).toBeNull();
  });
});
