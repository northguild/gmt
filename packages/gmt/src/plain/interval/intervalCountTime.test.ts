import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalCountTime } from "./intervalCountTime";

describe("intervalCountTime", () => {
  it.each`
    start         | end           | unit        | expected
    ${"12:00:00"} | ${"14:00:00"} | ${"hour"}   | ${2}
    ${"12:30:00"} | ${"13:00:00"} | ${"hour"}   | ${1}
    ${"12:30:00"} | ${"13:30:00"} | ${"hour"}   | ${2}
    ${"00:00:00"} | ${"23:59:59"} | ${"hour"}   | ${24}
    ${"12:00:00"} | ${"12:02:00"} | ${"minute"} | ${2}
    ${"23:59:00"} | ${"23:59:59"} | ${"minute"} | ${1}
  `(
    "returns $expected $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start                   | end                     | unit             | expected
    ${"12:00:00.5"}         | ${"12:00:01.5"}         | ${"second"}      | ${2}
    ${"12:00:00"}           | ${"12:00:00.5"}         | ${"second"}      | ${1}
    ${"12:00:00.0005"}      | ${"12:00:00.0015"}      | ${"millisecond"} | ${2}
    ${"12:00:00.0000005"}   | ${"12:00:00.0000015"}   | ${"microsecond"} | ${2}
    ${"12:00:00.000000001"} | ${"12:00:00.000000003"} | ${"nanosecond"}  | ${2}
  `(
    "returns $expected sub-second $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start           | end             | unit         | expected
    ${"12:00:00"}   | ${"14:00:00"}   | ${"hours"}   | ${2}
    ${"12:00:00"}   | ${"12:02:00"}   | ${"minutes"} | ${2}
    ${"12:00:00.5"} | ${"12:00:01.5"} | ${"seconds"} | ${2}
  `(
    "returns $expected for $start..$end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start         | end           | unit        | expected
    ${"12:00:00"} | ${"12:00:00"} | ${"hour"}   | ${0}
    ${"12:30:00"} | ${"12:30:00"} | ${"hour"}   | ${1}
    ${"12:00:00"} | ${"12:00:00"} | ${"minute"} | ${0}
    ${"12:00:30"} | ${"12:00:30"} | ${"minute"} | ${1}
  `(
    "returns $expected for zero-length $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountTime(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start         | end           | unit
    ${"invalid"}  | ${"14:00:00"} | ${"hour"}
    ${""}         | ${"14:00:00"} | ${"hour"}
    ${"25:00:00"} | ${"14:00:00"} | ${"hour"}
    ${"12:00:00"} | ${"invalid"}  | ${"hour"}
    ${"12:00:00"} | ${""}         | ${"hour"}
    ${"12:00:00"} | ${"12:60:00"} | ${"hour"}
    ${"14:00:00"} | ${"12:00:00"} | ${"hour"}
    ${"12:00:00"} | ${"14:00:00"} | ${"invalid"}
    ${"12:00:00"} | ${"14:00:00"} | ${""}
    ${"12:00:00"} | ${"14:00:00"} | ${"day"}
    ${"12:00:00"} | ${"14:00:00"} | ${"days"}
    ${"12:00:00"} | ${"14:00:00"} | ${"week"}
    ${"12:00:00"} | ${"14:00:00"} | ${"month"}
    ${"12:00:00"} | ${"14:00:00"} | ${"year"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountTime(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start         | end           | unit
    ${null}       | ${"14:00:00"} | ${"hour"}
    ${undefined}  | ${"14:00:00"} | ${"hour"}
    ${123}        | ${"14:00:00"} | ${"hour"}
    ${true}       | ${"14:00:00"} | ${"hour"}
    ${[]}         | ${"14:00:00"} | ${"hour"}
    ${{}}         | ${"14:00:00"} | ${"hour"}
    ${"12:00:00"} | ${null}       | ${"hour"}
    ${"12:00:00"} | ${undefined}  | ${"hour"}
    ${"12:00:00"} | ${123}        | ${"hour"}
    ${"12:00:00"} | ${true}       | ${"hour"}
    ${"12:00:00"} | ${[]}         | ${"hour"}
    ${"12:00:00"} | ${{}}         | ${"hour"}
    ${"12:00:00"} | ${"14:00:00"} | ${null}
    ${"12:00:00"} | ${"14:00:00"} | ${undefined}
    ${"12:00:00"} | ${"14:00:00"} | ${123}
    ${"12:00:00"} | ${"14:00:00"} | ${true}
    ${"12:00:00"} | ${"14:00:00"} | ${[]}
    ${"12:00:00"} | ${"14:00:00"} | ${{}}
  `(
    "returns null for non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountTime(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalCountTime("12:00:00", "14:00:00", "hour")).toBeNull();
  });
  // E5 (issue #78) audit negative: PlainTime has no calendar concept, so a calendar-annotated
  // PlainDate string is simply not a valid PlainTime string here -- unaffected by E5, same as
  // GMT's existing precedent (intervalOverlappingDaysDate/DateTime has no Time sibling for
  // the same reason).
  it("returns null for a calendar-annotated PlainDate string (PlainTime has no calendar)", () => {
    expect(intervalCountTime("5784-06-15[u-ca=hebrew]", "14:00:00", "hour")).toBeNull();
  });
});
