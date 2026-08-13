import { sortUtc } from "./sortUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("sortUtc", () => {
  // Canonical inputs
  const earlyInput = "2024-01-01T08:00:00Z";
  const midInput = "2024-02-15T15:30:00Z";
  const lateInput = "2024-03-10T12:00:00Z";

  it.each`
    utcDateTimes                         | order     | expected
    ${[lateInput, earlyInput, midInput]} | ${"asc"}  | ${["2024-01-01T08:00:00Z", "2024-02-15T15:30:00Z", "2024-03-10T12:00:00Z"]}
    ${[earlyInput, midInput, lateInput]} | ${"desc"} | ${["2024-03-10T12:00:00Z", "2024-02-15T15:30:00Z", "2024-01-01T08:00:00Z"]}
  `(
    "returns $expected for $order order with utcDateTimes $utcDateTimes",
    ({ utcDateTimes, order, expected }) => {
      expect(sortUtc(utcDateTimes, order)).toEqual(expected);
    },
  );

  it.each`
    utcDateTimes   | expected
    ${[]}          | ${[]}
    ${["invalid"]} | ${[]}
  `(
    "returns $expected for edge case $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(sortUtc(utcDateTimes)).toEqual(expected);
    },
  );

  it("filters invalid values and sorts remaining valid values in ascending order", () => {
    expect(sortUtc(["invalid", lateInput, "also invalid", earlyInput])).toEqual(
      ["2024-01-01T08:00:00Z", "2024-03-10T12:00:00Z"],
    );
  });

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(sortUtc([earlyInput, midInput])).toEqual([]);
  });
});
