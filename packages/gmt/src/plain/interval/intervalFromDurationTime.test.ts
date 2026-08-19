import { intervalFromDurationTime } from "./intervalFromDurationTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("intervalFromDurationTime", () => {
  it.each`
    value          | duration    | anchor      | expected
    ${"12:00:00"}  | ${"PT1H"}   | ${"start"}  | ${{ start: "12:00:00", end: "13:00:00" }}
    ${"13:00:00"}  | ${"PT1H"}   | ${"end"}    | ${{ start: "12:00:00", end: "13:00:00" }}
    ${"12:00:00"}  | ${"PT30M"}  | ${"start"}  | ${{ start: "12:00:00", end: "12:30:00" }}
    ${"12:00:00"}  | ${"PT0S"}   | ${"start"}  | ${{ start: "12:00:00", end: "12:00:00" }}
    ${"12:00:00"}  | ${"PT0S"}   | ${"end"}    | ${{ start: "12:00:00", end: "12:00:00" }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value          | duration | anchor     | options
    ${"12:00:00"}  | ${"PT1H"} | ${"start"} | ${undefined}
    ${"12:00:00"}  | ${"PT1H"} | ${"start"} | ${{ overflow: "constrain" }}
    ${"12:00:00"}  | ${"PT1H"} | ${"start"} | ${{ overflow: "reject" }}
  `(
    "overflow $options has no observable effect for $value + $duration",
    ({ value, duration, anchor, options }) => {
      expect(intervalFromDurationTime(value, duration, anchor, options)).toEqual(
        { start: "12:00:00", end: "13:00:00" },
      );
    },
  );

  it.each`
    value          | duration | anchor
    ${"12:00:00"}  | ${"P1D"} | ${"start"}
    ${"12:00:00"}  | ${"P1M"} | ${"start"}
    ${"12:00:00"}  | ${"P1Y"} | ${"start"}
    ${"12:00:00"}  | ${"P1W"} | ${"start"}
    ${"12:00:00"}  | ${"P1D"} | ${"end"}
  `(
    "returns null when duration $duration has a calendar-unit component (no relativeTo for PlainTime)",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value          | duration  | anchor
    ${"23:00:00"}  | ${"PT2H"} | ${"start"}
    ${"01:00:00"}  | ${"PT2H"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor wraps past midnight from $value (inverted span)",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value          | duration  | anchor
    ${"12:30:00"}  | ${"-PT1H"} | ${"start"}
    ${"12:30:00"}  | ${"-PT1H"} | ${"end"}
  `(
    "returns null when negative duration $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value          | duration  | anchor
    ${"invalid"}   | ${"PT1H"} | ${"start"}
    ${"25:00:00"}  | ${"PT1H"} | ${"start"}
    ${123}         | ${"PT1H"} | ${"start"}
    ${null}        | ${"PT1H"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationTime(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value          | duration       | anchor
    ${"12:00:00"}  | ${"not-a-dur"} | ${"start"}
    ${"12:00:00"}  | ${""}          | ${"start"}
    ${"12:00:00"}  | ${123}         | ${"start"}
    ${"12:00:00"}  | ${null}        | ${"start"}
  `(
    "returns null for invalid duration $duration",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationTime(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value          | duration  | anchor
    ${"12:00:00"}  | ${"PT1H"} | ${"middle"}
    ${"12:00:00"}  | ${"PT1H"} | ${""}
    ${"12:00:00"}  | ${"PT1H"} | ${null}
    ${"12:00:00"}  | ${"PT1H"} | ${undefined}
  `(
    "returns null for invalid anchor $anchor",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationTime(value, duration, anchor as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalFromDurationTime("12:00:00", "PT1H", "start")).toBeNull();
  });
});
