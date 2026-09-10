import { toNanoseconds } from "../../precision/convert/toNanoseconds";
import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { spanNs } from "./spanNs";

describe("spanNs", () => {
  it.each`
    start                                            | end                                 | expected
    ${"2024-03-10T12:00:00Z"}                        | ${"2024-03-10T12:00:00Z"}           | ${0n}
    ${"2024-03-10T12:00:00Z"}                        | ${"2024-03-10T12:00:01Z"}           | ${1000000000n}
    ${"2024-03-10T12:00:01Z"}                        | ${"2024-03-10T12:00:00Z"}           | ${-1000000000n}
    ${"2024-03-10T12:00:00.123456789Z"}              | ${"2024-03-10T12:00:00.123456790Z"} | ${1n}
    ${"2024-03-10T12:00:00.123456790Z"}              | ${"2024-03-10T12:00:00.123456789Z"} | ${-1n}
    ${"1969-12-31T23:59:59Z"}                        | ${"1970-01-01T00:00:00Z"}           | ${1000000000n}
    ${"1970-01-01T00:00:00Z"}                        | ${"1969-12-31T23:59:59Z"}           | ${-1000000000n}
    ${"2024-03-10T12:00:00-05:00"}                   | ${"2024-03-10T12:00:00Z"}           | ${-18000000000000n}
    ${"2024-03-10T07:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00Z"}           | ${0n}
  `(
    "returns $expected nanoseconds from $start to $end",
    ({ start, end, expected }) => {
      expect(spanNs(start, end)).toBe(expected);
    },
  );

  it("returns the full representable-instant range, far beyond an epoch nanosecond value", () => {
    const span = spanNs("-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z");

    expect(span).toBe(17280000000000000000000n);
    // A span is a duration, not an instant: it can exceed MAX_EPOCH_NANOSECONDS.
    expect(span).toBeGreaterThan(8640000000000000000000n);
  });

  it.each`
    start                               | end
    ${"2024-03-10T12:00:00Z"}           | ${"2024-09-01T08:17:03.000000001Z"}
    ${"1969-12-31T23:59:59.999999999Z"} | ${"2024-02-29T00:00:00Z"}
    ${"+275760-09-13T00:00:00Z"}        | ${"-271821-04-20T00:00:00Z"}
  `(
    "equals toNanoseconds($end) minus toNanoseconds($start)",
    ({ start, end }) => {
      expect(spanNs(start, end)).toBe(
        toNanoseconds(end) - toNanoseconds(start),
      );
    },
  );

  it.each`
    start                     | end
    ${"2024-03-10T12:00:00Z"} | ${"2024-09-01T08:17:03Z"}
    ${"2024-09-01T08:17:03Z"} | ${"2024-03-10T12:00:00Z"}
  `("negates when $start and $end are swapped", ({ start, end }) => {
    expect(spanNs(end, start)).toBe(-(spanNs(start, end) as bigint));
  });

  it.each(sameInstantBattleCases)(
    "returns 0n between 2024-02-29T00:00:00Z and the same instant in $timeZone",
    ({ value }) => {
      expect(spanNs("2024-02-29T00:00:00Z", value)).toBe(0n);
      expect(spanNs(value, "2024-02-29T00:00:00Z")).toBe(0n);
    },
  );

  it.each`
    start                                       | end                                         | reason
    ${"invalid"}                                | ${"2024-03-10T12:00:00Z"}                   | ${"unparseable start"}
    ${"2024-03-10T12:00:00Z"}                   | ${"invalid"}                                | ${"unparseable end"}
    ${"2024-03-10"}                             | ${"2024-03-11"}                             | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                    | ${"2024-03-11T12:00:00"}                    | ${"no offset designator"}
    ${"2024-03-10T12:00:00[America/New_York]"}  | ${"2024-03-11T12:00:00[America/New_York]"}  | ${"bracketed zone but no offset designator"}
    ${"2016-12-31T23:59:60Z"}                   | ${"2017-01-01T00:00:00Z"}                   | ${"leap second start"}
    ${"2016-12-31 23:59:60Z"}                   | ${"2017-01-01T00:00:00Z"}                   | ${"leap second, space separator"}
    ${"20161231T235960Z"}                       | ${"2017-01-01T00:00:00Z"}                   | ${"leap second, basic format"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"2024-03-11T12:00:00-04:00"}              | ${"calendar annotation on start"}
    ${"2024-03-10T12:00:00Z"}                   | ${"2024-03-11T12:00:00-05:00[u-ca=hebrew]"} | ${"calendar annotation on end"}
    ${"+275760-09-13T00:00:00.001Z"}            | ${"2024-03-10T12:00:00Z"}                   | ${"start past the representable range"}
    ${"2024-03-10T12:00:00Z"}                   | ${"-271821-04-19T23:59:59Z"}                | ${"end before the representable range"}
    ${""}                                       | ${"2024-03-10T12:00:00Z"}                   | ${"empty string"}
  `("returns null when the pair is invalid ($reason)", ({ start, end }) => {
    expect(spanNs(start, end)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(
      spanNs(value as unknown as string, "2024-03-10T12:00:00Z"),
    ).toBeNull();
    expect(
      spanNs("2024-03-10T12:00:00Z", value as unknown as string),
    ).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(spanNs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z")).toBeNull();
  });
});
