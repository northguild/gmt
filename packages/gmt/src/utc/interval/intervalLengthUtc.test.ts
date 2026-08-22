import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalLengthUtc } from "./intervalLengthUtc";

describe("intervalLengthUtc", () => {
  it.each`
    start                     | end                       | unit        | expected
    ${"2024-01-01T23:59:00Z"} | ${"2024-01-02T00:01:00Z"} | ${"day"}    | ${2 / 1440}
    ${"2024-01-01T23:59:00Z"} | ${"2024-01-02T00:01:00Z"} | ${"minute"} | ${2}
    ${"2024-01-01T10:30:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"hour"}   | ${1.5}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-08T00:00:00Z"} | ${"week"}   | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-03-05T00:00:00Z"} | ${"month"}  | ${2.129032258064516}
    ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"year"}   | ${1}
    ${"2024-02-29T00:00:00Z"} | ${"2024-03-01T00:00:00Z"} | ${"day"}    | ${1}
  `(
    "returns $expected $unit for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthUtc(start, end, unit)).toBeCloseTo(expected, 10);
    },
  );

  it("returns 0 for a zero-length interval", () => {
    expect(
      intervalLengthUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "day"),
    ).toBe(0);
  });

  it.each`
    start                     | end                       | unit
    ${"invalid"}              | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${"2024-01-02T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${"invalid"}
    ${"2024-12-31T23:59:60Z"} | ${"2024-01-02T00:00:00Z"} | ${"day"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthUtc(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start   | end                       | unit
    ${123}  | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${null} | ${"2024-01-02T00:00:00Z"} | ${"day"}
  `("returns null for wrong-type start $start", ({ start, end, unit }) => {
    expect(intervalLengthUtc(start as never, end, unit)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalLengthUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "day"),
    ).toBeNull();
  });
});
