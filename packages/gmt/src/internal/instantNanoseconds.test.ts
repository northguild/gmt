import { mockTemporalInstantFromThrow } from "../test/mocks";
import { parseInstantNanoseconds } from "./instantNanoseconds";

describe("parseInstantNanoseconds", () => {
  it.each`
    value                                            | expected
    ${"1970-01-01T00:00:00Z"}                        | ${0n}
    ${"1969-12-31T23:59:59Z"}                        | ${-1000000000n}
    ${"2024-03-10T12:00:00.123456789Z"}              | ${1710072000123456789n}
    ${"2024-03-10T12:00:00-05:00"}                   | ${1710090000000000000n}
    ${"2024-03-10T12:00:00-05:00[America/New_York]"} | ${1710090000000000000n}
    ${"2024-03-10 12:00:00Z"}                        | ${1710072000000000000n}
    ${"2024-03-10t12:00:00z"}                        | ${1710072000000000000n}
    ${"20240310T120000Z"}                            | ${1710072000000000000n}
    ${"+275760-09-13T00:00:00Z"}                     | ${8640000000000000000000n}
    ${"-271821-04-20T00:00:00Z"}                     | ${-8640000000000000000000n}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseInstantNanoseconds(value)).toBe(expected);
  });

  it("distinguishes the epoch from a rejected string, which is the point of returning null", () => {
    expect(parseInstantNanoseconds("1970-01-01T00:00:00Z")).toBe(0n);
    expect(parseInstantNanoseconds("invalid")).toBeNull();
  });

  it.each`
    value                                            | reason
    ${"2024-03-10"}                                  | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                         | ${"no offset designator"}
    ${"12:00:00Z"}                                   | ${"time-only"}
    ${"2024-13-10T12:00:00Z"}                        | ${"month out of range"}
    ${"2024-02-30T12:00:00Z"}                        | ${"day out of range"}
    ${"+275760-09-13T00:00:00.001Z"}                 | ${"past the representable range"}
    ${"-271821-04-19T23:59:59Z"}                     | ${"before the representable range"}
    ${"2016-12-31T23:59:60Z"}                        | ${"leap second"}
    ${"2016-12-31T23:59:60.500Z"}                    | ${"fractional leap second"}
    ${"2016-12-31t23:59:60Z"}                        | ${"leap second, lowercase t separator"}
    ${"2016-12-31 23:59:60Z"}                        | ${"leap second, space separator"}
    ${"2016-12-31T23:59:60z"}                        | ${"leap second, lowercase z"}
    ${"20161231T235960Z"}                            | ${"leap second, basic format"}
    ${"2016-12-31T235960Z"}                          | ${"leap second, basic-format time"}
    ${"20161231 235960Z"}                            | ${"leap second, basic format and space"}
    ${"2016-12-31T23:59:60+00:00"}                   | ${"leap second with numeric offset"}
    ${"2016-12-31T23:59:60-05:00[America/New_York]"} | ${"leap second in a zoned string"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"}      | ${"calendar annotation"}
    ${"invalid"}                                     | ${"unparseable"}
    ${""}                                            | ${"empty string"}
  `("returns null when $value is invalid ($reason)", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBeNull();
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
    expect(parseInstantNanoseconds(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(parseInstantNanoseconds("2024-03-10T12:00:00Z")).toBeNull();
  });
});
