import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromNanoseconds } from "./fromNanoseconds";
import { toNanoseconds } from "./toNanoseconds";

describe("fromNanoseconds", () => {
  it.each`
    nanoseconds                 | expected
    ${0n}                       | ${"1970-01-01T00:00:00Z"}
    ${-1000000000n}             | ${"1969-12-31T23:59:59Z"}
    ${1709164800000000000n}     | ${"2024-02-29T00:00:00Z"}
    ${1710072000123456789n}     | ${"2024-03-10T12:00:00.123456789Z"}
    ${-1500n}                   | ${"1969-12-31T23:59:59.9999985Z"}
    ${8640000000000000000000n}  | ${"+275760-09-13T00:00:00Z"}
    ${-8640000000000000000000n} | ${"-271821-04-20T00:00:00Z"}
  `(
    "returns $expected for $nanoseconds with no time zone",
    ({ nanoseconds, expected }) => {
      expect(fromNanoseconds(nanoseconds)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns the zoned string $value for 1709164800000000000n in $timeZone",
    ({ timeZone, value }) => {
      expect(fromNanoseconds(1709164800000000000n, timeZone)).toBe(value);
    },
  );

  it.each`
    timeZone             | expected
    ${"Asia/Kolkata"}    | ${"2024-03-10T17:30:00.123456789+05:30[Asia/Kolkata]"}
    ${"Pacific/Chatham"} | ${"2024-03-11T01:45:00.123456789+13:45[Pacific/Chatham]"}
    ${"Pacific/Apia"}    | ${"2024-03-11T01:00:00.123456789+13:00[Pacific/Apia]"}
    ${"Pacific/Niue"}    | ${"2024-03-10T01:00:00.123456789-11:00[Pacific/Niue]"}
  `("preserves nanosecond precision in $timeZone", ({ timeZone, expected }) => {
    expect(fromNanoseconds(1710072000123456789n, timeZone)).toBe(expected);
  });

  it.each`
    value
    ${"1970-01-01T00:00:00Z"}
    ${"1969-12-31T23:59:59Z"}
    ${"2024-03-10T12:00:00.123456789Z"}
    ${"+275760-09-13T00:00:00Z"}
    ${"-271821-04-20T00:00:00Z"}
  `("round-trips $value through toNanoseconds", ({ value }) => {
    expect(fromNanoseconds(toNanoseconds(value))).toBe(value);
  });

  it.each`
    nanoseconds                 | reason
    ${8640000000000000000001n}  | ${"one nanosecond past the maximum instant"}
    ${-8640000000000000000001n} | ${"one nanosecond before the minimum instant"}
    ${10n ** 30n}               | ${"far beyond the representable range"}
  `('returns "" for $nanoseconds ($reason)', ({ nanoseconds }) => {
    expect(fromNanoseconds(nanoseconds)).toBe("");
  });

  it.each`
    nanoseconds
    ${0}
    ${1710072000123}
    ${"1710072000123456789"}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $nanoseconds is non-bigint input', ({ nanoseconds }) => {
    expect(fromNanoseconds(nanoseconds as unknown as bigint)).toBe("");
  });

  it.each`
    timeZone             | reason
    ${"Not/AZone"}       | ${"unknown identifier"}
    ${"America/Newyork"} | ${"misspelled identifier"}
    ${""}                | ${"empty string"}
    ${undefined}         | ${"explicitly passed undefined"}
    ${null}              | ${"null"}
    ${123}               | ${"non-string"}
  `(
    'returns "" when timeZone $timeZone is invalid ($reason)',
    ({ timeZone }) => {
      expect(fromNanoseconds(0n, timeZone as unknown as string)).toBe("");
    },
  );

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(fromNanoseconds(0n)).toBe("");
  });
});
