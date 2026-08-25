import { intervalFromDurationDate } from "./intervalFromDurationDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalFromDurationDate", () => {
  it.each`
    value           | duration  | anchor     | expected
    ${"2024-01-01"} | ${"P1M"}  | ${"start"} | ${{ start: "2024-01-01", end: "2024-02-01" }}
    ${"2024-02-01"} | ${"P1M"}  | ${"end"}   | ${{ start: "2024-01-01", end: "2024-02-01" }}
    ${"2024-01-01"} | ${"P1D"}  | ${"start"} | ${{ start: "2024-01-01", end: "2024-01-02" }}
    ${"2024-01-02"} | ${"P1D"}  | ${"end"}   | ${{ start: "2024-01-01", end: "2024-01-02" }}
    ${"2024-01-01"} | ${"P1Y"}  | ${"start"} | ${{ start: "2024-01-01", end: "2025-01-01" }}
    ${"2024-01-01"} | ${"P0D"}  | ${"start"} | ${{ start: "2024-01-01", end: "2024-01-01" }}
    ${"2024-01-01"} | ${"PT0S"} | ${"end"}   | ${{ start: "2024-01-01", end: "2024-01-01" }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationDate(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value           | duration | anchor     | options                      | expected
    ${"2024-01-31"} | ${"P1M"} | ${"start"} | ${undefined}                 | ${{ start: "2024-01-31", end: "2024-02-29" }}
    ${"2024-01-31"} | ${"P1M"} | ${"start"} | ${{ overflow: "constrain" }} | ${{ start: "2024-01-31", end: "2024-02-29" }}
    ${"2024-01-31"} | ${"P1M"} | ${"start"} | ${{ overflow: "reject" }}    | ${null}
    ${"2024-01-01"} | ${"P1D"} | ${"start"} | ${{ overflow: "reject" }}    | ${{ start: "2024-01-01", end: "2024-01-02" }}
  `(
    "returns $expected for $value + $duration anchored at $anchor with options $options",
    ({ value, duration, anchor, options, expected }) => {
      expect(
        intervalFromDurationDate(value, duration, anchor, options),
      ).toEqual(expected);
    },
  );

  it.each`
    value           | duration   | anchor
    ${"2024-01-05"} | ${"-P10D"} | ${"start"}
    ${"2024-01-05"} | ${"-P10D"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationDate(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value           | duration | anchor
    ${"invalid"}    | ${"P1D"} | ${"start"}
    ${"2024-13-01"} | ${"P1D"} | ${"start"}
    ${123}          | ${"P1D"} | ${"start"}
    ${null}         | ${"P1D"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationDate(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value           | duration       | anchor
    ${"2024-01-01"} | ${"not-a-dur"} | ${"start"}
    ${"2024-01-01"} | ${""}          | ${"start"}
    ${"2024-01-01"} | ${123}         | ${"start"}
    ${"2024-01-01"} | ${null}        | ${"start"}
  `(
    "returns null for invalid duration $duration",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationDate(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value           | duration | anchor
    ${"2024-01-01"} | ${"P1D"} | ${"middle"}
    ${"2024-01-01"} | ${"P1D"} | ${""}
    ${"2024-01-01"} | ${"P1D"} | ${null}
    ${"2024-01-01"} | ${"P1D"} | ${undefined}
  `(
    "returns null for invalid anchor $anchor",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationDate(value, duration, anchor as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(intervalFromDurationDate("2024-01-01", "P1D", "start")).toBeNull();
  });
  // E5 (issue #78): accepts a GMT calendar-annotated PlainDate string; the computed endpoint
  // is resolved in value's own calendar and both endpoints are re-formatted in it, re-derived
  // from the actual result rather than copied from value's tag (D7). Golden verified directly
  // against @js-temporal/polyfill.
  it("constructs the span in value's calendar (Hebrew Adar I + 1 month -> Adar)", () => {
    expect(
      intervalFromDurationDate("5784-06-15[u-ca=hebrew]", "P1M", "start"),
    ).toEqual({
      start: "5784-06-15[u-ca=hebrew]",
      end: "5784-07-15[u-ca=hebrew]",
    });
  });
});
