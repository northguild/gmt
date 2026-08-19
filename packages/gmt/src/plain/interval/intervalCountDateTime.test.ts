import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalCountDateTime } from "./intervalCountDateTime";

describe("intervalCountDateTime", () => {
  it.each`
    start                      | end                        | unit        | expected
    ${"2024-01-01T23:59:00"}   | ${"2024-01-02T00:01:00"}   | ${"day"}    | ${2}
    ${"2024-01-01T00:00:00"}   | ${"2024-01-03T00:00:00"}   | ${"day"}    | ${2}
    ${"2024-01-01T10:30:00"}   | ${"2024-01-01T12:00:00"}   | ${"hour"}   | ${2}
    ${"2024-01-01T10:00:00"}   | ${"2024-01-01T12:00:00"}   | ${"hour"}   | ${2}
    ${"2024-01-01T10:30:00"}   | ${"2024-01-01T10:45:00"}   | ${"hour"}   | ${1}
    ${"2024-01-15T08:00:00"}   | ${"2024-03-10T08:00:00"}   | ${"month"}  | ${3}
    ${"2024-01-04T00:00:00"}   | ${"2024-01-15T00:00:00"}   | ${"week"}   | ${2}
    ${"2024-12-31T23:00:00"}   | ${"2025-01-01T01:00:00"}   | ${"year"}   | ${2}
    ${"2024-01-01T00:00:00"}   | ${"2024-01-01T00:01:00"}   | ${"minute"} | ${1}
    ${"2024-01-01T00:00:00.5"} | ${"2024-01-01T00:00:01.5"} | ${"second"} | ${2}
  `(
    "returns $expected $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDateTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                              | end                                | unit             | expected
    ${"2024-01-01T00:00:00.0005"}      | ${"2024-01-01T00:00:00.0015"}      | ${"millisecond"} | ${2}
    ${"2024-01-01T00:00:00.0000005"}   | ${"2024-01-01T00:00:00.0000015"}   | ${"microsecond"} | ${2}
    ${"2024-01-01T00:00:00.000000001"} | ${"2024-01-01T00:00:00.000000003"} | ${"nanosecond"}  | ${2}
    ${"2024-01-01T00:00:00"}           | ${"2025-01-01T00:00:00"}           | ${"nanosecond"}  | ${31622400000000000}
  `(
    "returns $expected sub-second $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDateTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                    | end                      | unit        | expected
    ${"2024-01-01T23:59:00"} | ${"2024-01-02T00:01:00"} | ${"days"}   | ${2}
    ${"2024-01-01T10:30:00"} | ${"2024-01-01T12:00:00"} | ${"hours"}  | ${2}
    ${"2024-01-15T08:00:00"} | ${"2024-03-10T08:00:00"} | ${"months"} | ${3}
    ${"2024-12-31T23:00:00"} | ${"2025-01-01T01:00:00"} | ${"years"}  | ${2}
  `(
    "returns $expected for $start..$end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDateTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                    | end                      | unit       | expected
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"day"}   | ${0}
    ${"2024-01-01T05:00:00"} | ${"2024-01-01T05:00:00"} | ${"day"}   | ${1}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"hour"}  | ${0}
    ${"2024-01-01T05:30:00"} | ${"2024-01-01T05:30:00"} | ${"hour"}  | ${1}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"month"} | ${0}
    ${"2024-01-15T08:00:00"} | ${"2024-01-15T08:00:00"} | ${"month"} | ${1}
  `(
    "returns $expected for zero-length $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDateTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                    | end                      | unit      | expected
    ${"2024-02-29T23:59:59"} | ${"2024-03-01T00:00:01"} | ${"day"}  | ${2}
    ${"2024-02-28T12:00:00"} | ${"2024-02-29T12:00:00"} | ${"day"}  | ${2}
    ${"2024-12-31T23:59:59"} | ${"2025-01-01T00:00:00"} | ${"year"} | ${1}
  `(
    "returns $expected for boundary case $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDateTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                    | end                      | unit
    ${"invalid"}             | ${"2024-01-02T00:00:00"} | ${"day"}
    ${""}                    | ${"2024-01-02T00:00:00"} | ${"day"}
    ${"2024-13-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"day"}
    ${"2024-01-01"}          | ${"2024-01-02T00:00:00"} | ${"day"}
    ${"2024-01-01T00:00:00"} | ${"invalid"}             | ${"day"}
    ${"2024-01-01T00:00:00"} | ${""}                    | ${"day"}
    ${"2024-02-30T00:00:00"} | ${"2024-03-01T00:00:00"} | ${"day"}
    ${"2024-01-02T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"day"}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"invalid"}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${""}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"quarter"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountDateTime(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start                    | end                      | unit
    ${null}                  | ${"2024-01-02T00:00:00"} | ${"day"}
    ${undefined}             | ${"2024-01-02T00:00:00"} | ${"day"}
    ${123}                   | ${"2024-01-02T00:00:00"} | ${"day"}
    ${true}                  | ${"2024-01-02T00:00:00"} | ${"day"}
    ${[]}                    | ${"2024-01-02T00:00:00"} | ${"day"}
    ${{}}                    | ${"2024-01-02T00:00:00"} | ${"day"}
    ${"2024-01-01T00:00:00"} | ${null}                  | ${"day"}
    ${"2024-01-01T00:00:00"} | ${undefined}             | ${"day"}
    ${"2024-01-01T00:00:00"} | ${123}                   | ${"day"}
    ${"2024-01-01T00:00:00"} | ${true}                  | ${"day"}
    ${"2024-01-01T00:00:00"} | ${[]}                    | ${"day"}
    ${"2024-01-01T00:00:00"} | ${{}}                    | ${"day"}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${null}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${undefined}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${123}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${true}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${[]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${{}}
  `(
    "returns null for non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountDateTime(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalCountDateTime(
        "2024-01-01T00:00:00",
        "2024-01-02T00:00:00",
        "day",
      ),
    ).toBeNull();
  });
});
