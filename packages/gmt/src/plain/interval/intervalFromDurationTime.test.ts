import { intervalFromDurationTime } from "./intervalFromDurationTime";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";

describe("intervalFromDurationTime", () => {
  it.each`
    value         | duration   | anchor     | expected
    ${"12:00:00"} | ${"PT1H"}  | ${"start"} | ${{ start: "12:00:00", end: "13:00:00" }}
    ${"13:00:00"} | ${"PT1H"}  | ${"end"}   | ${{ start: "12:00:00", end: "13:00:00" }}
    ${"12:00:00"} | ${"PT30M"} | ${"start"} | ${{ start: "12:00:00", end: "12:30:00" }}
    ${"12:00:00"} | ${"PT0S"}  | ${"start"} | ${{ start: "12:00:00", end: "12:00:00" }}
    ${"12:00:00"} | ${"PT0S"}  | ${"end"}   | ${{ start: "12:00:00", end: "12:00:00" }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  // The options argument (only `overflow`) was removed in 1.16.0: Temporal `PlainTime#add` and
  // `#subtract` take no options. Passing one is a type error, and a JavaScript caller's stray
  // argument changes nothing.
  it("treats the removed options argument as a type error and ignores it at runtime", () => {
    expect(
      // @ts-expect-error -- the `overflow` options argument was removed in 1.16.0
      intervalFromDurationTime("12:00:00", "PT1H", "start", {
        overflow: "reject",
      }),
    ).toEqual({ start: "12:00:00", end: "13:00:00" });
  });

  it.each`
    value         | duration | anchor
    ${"12:00:00"} | ${"P1D"} | ${"start"}
    ${"12:00:00"} | ${"P1M"} | ${"start"}
    ${"12:00:00"} | ${"P1Y"} | ${"start"}
    ${"12:00:00"} | ${"P1W"} | ${"start"}
    ${"12:00:00"} | ${"P1D"} | ${"end"}
  `(
    "returns null when duration $duration has a calendar-unit component (no relativeTo for PlainTime)",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value         | duration  | anchor
    ${"23:00:00"} | ${"PT2H"} | ${"start"}
    ${"01:00:00"} | ${"PT2H"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor wraps past midnight from $value (inverted span)",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value                   | duration                   | anchor     | expected
    ${"00:00:00"}           | ${"PT23H59M59.999999999S"} | ${"start"} | ${{ start: "00:00:00", end: "23:59:59.999999999" }}
    ${"23:59:59.999999999"} | ${"PT23H59M59.999999999S"} | ${"end"}   | ${{ start: "00:00:00", end: "23:59:59.999999999" }}
    ${"00:00:00"}           | ${"PT86399.999999999S"}    | ${"start"} | ${{ start: "00:00:00", end: "23:59:59.999999999" }}
    ${"12:00:00"}           | ${"PT0.000000001S"}        | ${"end"}   | ${{ start: "11:59:59.999999999", end: "12:00:00" }}
  `(
    "returns $expected for $value with $duration anchored at $anchor (last representable nanosecond of the day, no wrap)",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  // A span of 24 h or more always reaches the next (or previous) day, so PlainTime cannot hold
  // it — even when the wrapped clock time lands later in the day (Temporal PlainTime.add wraps
  // modulo 24 h).
  it.each`
    value         | duration               | anchor
    ${"10:00:00"} | ${"PT24H"}             | ${"start"}
    ${"00:00:00"} | ${"PT24H"}             | ${"start"}
    ${"00:00:00"} | ${"PT25H"}             | ${"start"}
    ${"10:00:00"} | ${"PT48H30M"}          | ${"end"}
    ${"23:59:59"} | ${"PT24H"}             | ${"end"}
    ${"00:00:00"} | ${"PT1440M"}           | ${"start"}
    ${"00:00:00"} | ${"PT86400S"}          | ${"start"}
    ${"00:00:00"} | ${"PT86400000000000S"} | ${"start"}
    ${"23:00:00"} | ${"PT1H"}              | ${"start"}
    ${"00:00:00"} | ${"PT0.000000001S"}    | ${"end"}
  `(
    "returns null when $duration anchored at $anchor from $value leaves the day",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value         | duration    | anchor
    ${"12:30:00"} | ${"-PT1H"}  | ${"start"}
    ${"12:30:00"} | ${"-PT1H"}  | ${"end"}
    ${"12:00:00"} | ${"-PT23H"} | ${"start"}
    ${"12:00:00"} | ${"-PT23H"} | ${"end"}
    ${"00:00:00"} | ${"-PT24H"} | ${"start"}
  `(
    "returns null when negative duration $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value         | duration  | anchor
    ${"invalid"}  | ${"PT1H"} | ${"start"}
    ${"25:00:00"} | ${"PT1H"} | ${"start"}
    ${123}        | ${"PT1H"} | ${"start"}
    ${null}       | ${"PT1H"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationTime(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value         | duration       | anchor
    ${"12:00:00"} | ${"not-a-dur"} | ${"start"}
    ${"12:00:00"} | ${""}          | ${"start"}
    ${"12:00:00"} | ${123}         | ${"start"}
    ${"12:00:00"} | ${null}        | ${"start"}
  `(
    "returns null for invalid duration $duration",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationTime(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value         | duration  | anchor
    ${"12:00:00"} | ${"PT1H"} | ${"middle"}
    ${"12:00:00"} | ${"PT1H"} | ${""}
    ${"12:00:00"} | ${"PT1H"} | ${null}
    ${"12:00:00"} | ${"PT1H"} | ${undefined}
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
