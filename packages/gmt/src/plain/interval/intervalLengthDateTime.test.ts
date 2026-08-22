import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalLengthDateTime } from "./intervalLengthDateTime";

describe("intervalLengthDateTime", () => {
  it.each`
    start                    | end                      | unit        | expected
    ${"2024-01-01T23:59:00"} | ${"2024-01-02T00:01:00"} | ${"day"}    | ${2 / 1440}
    ${"2024-01-01T23:59:00"} | ${"2024-01-02T00:01:00"} | ${"minute"} | ${2}
    ${"2024-01-01T10:30:00"} | ${"2024-01-01T12:00:00"} | ${"hour"}   | ${1.5}
    ${"2024-01-01T00:00:00"} | ${"2024-01-08T00:00:00"} | ${"week"}   | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-03-01T00:00:00"} | ${"day"}    | ${1}
  `(
    "returns $expected $unit for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthDateTime(start, end, unit)).toBeCloseTo(
        expected,
        10,
      );
    },
  );

  it("returns 0 for a zero-length interval", () => {
    expect(
      intervalLengthDateTime(
        "2024-01-01T05:00:00",
        "2024-01-01T05:00:00",
        "day",
      ),
    ).toBe(0);
  });

  it("distinguishes from intervalCountDateTime on the 23:59->00:01 case", () => {
    // intervalCountDateTime reports 2 day boundaries crossed; intervalLengthDateTime reports
    // the true ~0.0014-day elapsed duration.
    const length = intervalLengthDateTime(
      "2024-01-01T23:59:00",
      "2024-01-02T00:01:00",
      "day",
    );
    expect(length).toBeCloseTo(0.001388888888888889, 12);
  });

  it.each`
    start                    | end                      | unit
    ${"invalid"}             | ${"2024-01-02T00:00:00"} | ${"day"}
    ${"2024-01-01T00:00:00"} | ${"invalid"}             | ${"day"}
    ${"2024-01-02T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"day"}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"invalid"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthDateTime(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start   | end                      | unit
    ${123}  | ${"2024-01-02T00:00:00"} | ${"day"}
    ${null} | ${"2024-01-02T00:00:00"} | ${"day"}
  `("returns null for wrong-type start $start", ({ start, end, unit }) => {
    expect(intervalLengthDateTime(start as never, end, unit)).toBeNull();
  });

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalLengthDateTime(
        "2024-01-01T00:00:00",
        "2024-01-02T00:00:00",
        "day",
      ),
    ).toBeNull();
  });
});
