import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalCountUtc } from "./intervalCountUtc";

describe("intervalCountUtc", () => {
  it.each`
    start                       | end                         | unit        | expected
    ${"2024-01-01T00:00:00Z"}   | ${"2024-01-03T00:00:00Z"}   | ${"day"}    | ${2}
    ${"2024-01-01T23:59:00Z"}   | ${"2024-01-02T00:01:00Z"}   | ${"day"}    | ${2}
    ${"2024-01-01T10:30:00Z"}   | ${"2024-01-01T12:00:00Z"}   | ${"hour"}   | ${2}
    ${"2024-01-15T00:00:00Z"}   | ${"2024-03-10T00:00:00Z"}   | ${"month"}  | ${3}
    ${"2024-01-04T00:00:00Z"}   | ${"2024-01-15T00:00:00Z"}   | ${"week"}   | ${2}
    ${"2024-12-31T23:00:00Z"}   | ${"2025-01-01T01:00:00Z"}   | ${"year"}   | ${2}
    ${"2024-02-29T23:59:59Z"}   | ${"2024-03-01T00:00:01Z"}   | ${"day"}    | ${2}
    ${"2024-01-01T00:00:00.5Z"} | ${"2024-01-01T00:00:01.5Z"} | ${"second"} | ${2}
  `(
    "returns $expected $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUtc(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                     | end                       | unit        | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-03T00:00:00Z"} | ${"days"}   | ${2}
    ${"2024-01-01T10:30:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"hours"}  | ${2}
    ${"2024-01-15T00:00:00Z"} | ${"2024-03-10T00:00:00Z"} | ${"months"} | ${3}
  `(
    "returns $expected for $start..$end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUtc(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                     | end                       | unit      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"day"}  | ${0}
    ${"2024-01-01T05:00:00Z"} | ${"2024-01-01T05:00:00Z"} | ${"day"}  | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"hour"} | ${0}
    ${"2024-01-01T05:30:00Z"} | ${"2024-01-01T05:30:00Z"} | ${"hour"} | ${1}
  `(
    "returns $expected for zero-length $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUtc(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                     | end                       | unit
    ${"invalid"}              | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${""}                     | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${"2024-01-01T00:00:00"}  | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${"2024-13-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${"invalid"}              | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${""}                     | ${"day"}
    ${"2024-12-31T23:59:60Z"} | ${"2025-01-01T01:30:00Z"} | ${"hour"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${"hour"}
    ${"2024-01-02T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${"invalid"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${""}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${"quarter"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountUtc(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start                     | end                       | unit
    ${null}                   | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${undefined}              | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${123}                    | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${true}                   | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${[]}                     | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${{}}                     | ${"2024-01-02T00:00:00Z"} | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${null}                   | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${undefined}              | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${123}                    | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${true}                   | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${[]}                     | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${{}}                     | ${"day"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${null}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${undefined}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${123}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${[]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${{}}
  `(
    "returns null for non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountUtc(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalCountUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "day"),
    ).toBeNull();
  });
});
