import { intervalFromDurationUtc } from "./intervalFromDurationUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("intervalFromDurationUtc", () => {
  it.each`
    value                     | duration   | anchor     | expected
    ${"2024-01-01T00:00:00Z"} | ${"P1D"}   | ${"start"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }}
    ${"2024-01-02T00:00:00Z"} | ${"P1D"}   | ${"end"}   | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }}
    ${"2024-01-01T12:00:00Z"} | ${"PT30M"} | ${"start"} | ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:30:00Z" }}
    ${"2024-01-01T00:00:00Z"} | ${"P0D"}   | ${"start"} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }}
    ${"2024-01-01T00:00:00Z"} | ${"PT0S"}  | ${"end"}   | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationUtc(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value                     | duration | anchor     | options                      | expected
    ${"2024-01-31T00:00:00Z"} | ${"P1M"} | ${"start"} | ${undefined}                 | ${{ start: "2024-01-31T00:00:00Z", end: "2024-02-29T00:00:00Z" }}
    ${"2024-01-31T00:00:00Z"} | ${"P1M"} | ${"start"} | ${{ overflow: "constrain" }} | ${{ start: "2024-01-31T00:00:00Z", end: "2024-02-29T00:00:00Z" }}
    ${"2024-01-31T00:00:00Z"} | ${"P1M"} | ${"start"} | ${{ overflow: "reject" }}    | ${null}
    ${"2024-01-01T00:00:00Z"} | ${"P1D"} | ${"start"} | ${{ overflow: "reject" }}    | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }}
  `(
    "returns $expected for $value + $duration anchored at $anchor with options $options",
    ({ value, duration, anchor, options, expected }) => {
      expect(intervalFromDurationUtc(value, duration, anchor, options)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value                     | duration   | anchor
    ${"2024-01-05T00:00:00Z"} | ${"-P10D"} | ${"start"}
    ${"2024-01-05T00:00:00Z"} | ${"-P10D"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationUtc(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value                     | duration | anchor
    ${"invalid"}              | ${"P1D"} | ${"start"}
    ${"2024-01-01"}           | ${"P1D"} | ${"start"}
    ${"2024-12-31T23:59:60Z"} | ${"P1D"} | ${"start"}
    ${123}                    | ${"P1D"} | ${"start"}
    ${null}                   | ${"P1D"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationUtc(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value                     | duration       | anchor     | label
    ${"2024-01-01T00:00:00Z"} | ${"not-a-dur"} | ${"start"} | ${"'not-a-dur'"}
    ${"2024-01-01T00:00:00Z"} | ${""}          | ${"start"} | ${"''"}
    ${"2024-01-01T00:00:00Z"} | ${123}         | ${"start"} | ${"123"}
    ${"2024-01-01T00:00:00Z"} | ${null}        | ${"start"} | ${"null"}
  `(
    "returns null for invalid duration $label",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationUtc(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value                     | duration | anchor       | label
    ${"2024-01-01T00:00:00Z"} | ${"P1D"} | ${"middle"}  | ${"'middle'"}
    ${"2024-01-01T00:00:00Z"} | ${"P1D"} | ${""}        | ${"''"}
    ${"2024-01-01T00:00:00Z"} | ${"P1D"} | ${null}      | ${"null"}
    ${"2024-01-01T00:00:00Z"} | ${"P1D"} | ${undefined} | ${"undefined"}
  `("returns null for invalid anchor $label", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationUtc(value, duration, anchor as never),
    ).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalFromDurationUtc("2024-01-01T00:00:00Z", "P1D", "start"),
    ).toBeNull();
  });
});
