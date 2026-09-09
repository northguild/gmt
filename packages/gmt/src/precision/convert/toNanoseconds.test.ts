import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { sameInstantBattleCases } from "../../test";
import { toNanoseconds } from "./toNanoseconds";

describe("toNanoseconds", () => {
  it.each`
    value                                            | expected
    ${"1970-01-01T00:00:00Z"}                        | ${0n}
    ${"1969-12-31T23:59:59Z"}                        | ${-1000000000n}
    ${"2024-02-29T00:00:00Z"}                        | ${1709164800000000000n}
    ${"2024-03-10T12:00:00.123456789Z"}              | ${1710072000123456789n}
    ${"2024-03-10T12:00:00.123456Z"}                 | ${1710072000123456000n}
    ${"2024-03-10T12:00:00-05:00"}                   | ${1710090000000000000n}
    ${"2024-03-10T12:00:00-05:00[America/New_York]"} | ${1710090000000000000n}
    ${"2024-03-10 12:00:00Z"}                        | ${1710072000000000000n}
    ${"2024-03-10t12:00:00z"}                        | ${1710072000000000000n}
    ${"20240310T120000Z"}                            | ${1710072000000000000n}
    ${"2024-03-10T120000Z"}                          | ${1710072000000000000n}
    ${"2024-03-10T12:00:00.60Z"}                     | ${1710072000600000000n}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(toNanoseconds(value)).toBe(expected);
  });

  it.each`
    value                            | expected
    ${"+275760-09-13T00:00:00Z"}     | ${8640000000000000000000n}
    ${"-271821-04-20T00:00:00Z"}     | ${-8640000000000000000000n}
    ${"+275760-09-13T00:00:00.001Z"} | ${0n}
    ${"-271821-04-19T23:59:59Z"}     | ${0n}
  `(
    "returns $expected at the representable-instant boundary $value",
    ({ value, expected }) => {
      expect(toNanoseconds(value)).toBe(expected);
    },
  );

  it("returns a value beyond Number.MAX_SAFE_INTEGER without loss", () => {
    const nanoseconds = toNanoseconds("2024-03-10T12:00:00.123456789Z");

    expect(nanoseconds).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(nanoseconds).toBe(1710072000123456789n);
    // Round-tripping through Number loses the last two digits (…789 -> …800).
    expect(BigInt(Number(nanoseconds))).not.toBe(nanoseconds);
  });

  it.each(sameInstantBattleCases)(
    "returns the same instant for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(toNanoseconds(value)).toBe(1709164800000000000n);
    },
  );

  it.each`
    value                                            | reason
    ${"2024-03-10"}                                  | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                         | ${"no offset designator"}
    ${"12:00:00Z"}                                   | ${"time-only"}
    ${"2024-13-10T12:00:00Z"}                        | ${"month out of range"}
    ${"2024-02-30T12:00:00Z"}                        | ${"day out of range"}
    ${"2016-12-31T23:59:60Z"}                        | ${"leap second"}
    ${"2016-12-31T23:59:60.500Z"}                    | ${"fractional leap second"}
    ${"2016-12-31t23:59:60Z"}                        | ${"leap second, lowercase t separator"}
    ${"2016-12-31 23:59:60Z"}                        | ${"leap second, space separator"}
    ${"2016-12-31T23:59:60z"}                        | ${"leap second, lowercase z"}
    ${"20161231T235960Z"}                            | ${"leap second, basic format"}
    ${"2016-12-31T235960Z"}                          | ${"leap second, basic-format time"}
    ${"20161231 235960Z"}                            | ${"leap second, basic format and space"}
    ${"2016-12-31t235960z"}                          | ${"leap second, all lowercase"}
    ${"2016-12-31T23:59:60+00:00"}                   | ${"leap second with numeric offset"}
    ${"2016-12-31T23:59:60-05:00[America/New_York]"} | ${"leap second in a zoned string"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"}      | ${"calendar annotation"}
    ${"invalid"}                                     | ${"unparseable"}
    ${""}                                            | ${"empty string"}
  `("returns 0n when $value is invalid ($reason)", ({ value }) => {
    expect(toNanoseconds(value)).toBe(0n);
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
  `("returns 0n when $value is non-string input", ({ value }) => {
    expect(toNanoseconds(value as unknown as string)).toBe(0n);
  });

  it("returns 0n when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(toNanoseconds("2024-03-10T12:00:00Z")).toBe(0n);
  });
});
