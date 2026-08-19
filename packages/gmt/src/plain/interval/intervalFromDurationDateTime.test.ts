import { intervalFromDurationDateTime } from "./intervalFromDurationDateTime";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";

describe("intervalFromDurationDateTime", () => {
  it.each`
    value                      | duration    | anchor      | expected
    ${"2024-01-01T00:00:00"}   | ${"P1DT2H"} | ${"start"}  | ${{ start: "2024-01-01T00:00:00", end: "2024-01-02T02:00:00" }}
    ${"2024-01-02T02:00:00"}   | ${"P1DT2H"} | ${"end"}    | ${{ start: "2024-01-01T00:00:00", end: "2024-01-02T02:00:00" }}
    ${"2024-01-01T12:00:00"}   | ${"PT30M"}  | ${"start"}  | ${{ start: "2024-01-01T12:00:00", end: "2024-01-01T12:30:00" }}
    ${"2024-01-01T00:00:00"}   | ${"P0D"}    | ${"start"}  | ${{ start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }}
    ${"2024-01-01T00:00:00"}   | ${"PT0S"}   | ${"end"}    | ${{ start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationDateTime(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value                      | duration | anchor     | options                      | expected
    ${"2024-01-31T12:00:00"}   | ${"P1M"} | ${"start"} | ${undefined}                 | ${{ start: "2024-01-31T12:00:00", end: "2024-02-29T12:00:00" }}
    ${"2024-01-31T12:00:00"}   | ${"P1M"} | ${"start"} | ${{ overflow: "constrain" }} | ${{ start: "2024-01-31T12:00:00", end: "2024-02-29T12:00:00" }}
    ${"2024-01-31T12:00:00"}   | ${"P1M"} | ${"start"} | ${{ overflow: "reject" }}    | ${null}
    ${"2024-01-01T00:00:00"}   | ${"P1D"} | ${"start"} | ${{ overflow: "reject" }}    | ${{ start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" }}
  `(
    "returns $expected for $value + $duration anchored at $anchor with options $options",
    ({ value, duration, anchor, options, expected }) => {
      expect(
        intervalFromDurationDateTime(value, duration, anchor, options),
      ).toEqual(expected);
    },
  );

  it.each`
    value                      | duration   | anchor
    ${"2024-01-05T00:00:00"}   | ${"-P10D"} | ${"start"}
    ${"2024-01-05T00:00:00"}   | ${"-P10D"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationDateTime(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value                      | duration | anchor
    ${"invalid"}               | ${"P1D"} | ${"start"}
    ${"2024-01-01"}            | ${"P1D"} | ${"start"}
    ${123}                     | ${"P1D"} | ${"start"}
    ${null}                    | ${"P1D"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationDateTime(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value                      | duration       | anchor
    ${"2024-01-01T00:00:00"}   | ${"not-a-dur"} | ${"start"}
    ${"2024-01-01T00:00:00"}   | ${""}          | ${"start"}
    ${"2024-01-01T00:00:00"}   | ${123}         | ${"start"}
    ${"2024-01-01T00:00:00"}   | ${null}        | ${"start"}
  `(
    "returns null for invalid duration $duration",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationDateTime(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value                      | duration | anchor
    ${"2024-01-01T00:00:00"}   | ${"P1D"} | ${"middle"}
    ${"2024-01-01T00:00:00"}   | ${"P1D"} | ${""}
    ${"2024-01-01T00:00:00"}   | ${"P1D"} | ${null}
    ${"2024-01-01T00:00:00"}   | ${"P1D"} | ${undefined}
  `(
    "returns null for invalid anchor $anchor",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationDateTime(value, duration, anchor as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalFromDurationDateTime("2024-01-01T00:00:00", "P1D", "start"),
    ).toBeNull();
  });
});
