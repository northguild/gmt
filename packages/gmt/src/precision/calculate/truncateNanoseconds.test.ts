import { fromNanoseconds } from "../convert/fromNanoseconds";
import { truncateNanoseconds } from "./truncateNanoseconds";

describe("truncateNanoseconds", () => {
  it.each`
    nanoseconds                 | expected
    ${1710072000123456789n}     | ${1710072000123456000n}
    ${1710072000123456000n}     | ${1710072000123456000n}
    ${1000n}                    | ${1000n}
    ${999n}                     | ${0n}
    ${0n}                       | ${0n}
    ${-1n}                      | ${-1000n}
    ${-1000n}                   | ${-1000n}
    ${-1500n}                   | ${-2000n}
    ${-999999999n}              | ${-1000000000n}
    ${-1710072000123456789n}    | ${-1710072000123457000n}
    ${8640000000000000000000n}  | ${8640000000000000000000n}
    ${-8640000000000000000000n} | ${-8640000000000000000000n}
  `(
    'returns $expected for $nanoseconds truncated to "us"',
    ({ nanoseconds, expected }) => {
      expect(truncateNanoseconds(nanoseconds, "us")).toBe(expected);
    },
  );

  it.each`
    nanoseconds                 | expected
    ${1710072000123456789n}     | ${1710072000123000000n}
    ${1710072000123000000n}     | ${1710072000123000000n}
    ${1000n}                    | ${0n}
    ${0n}                       | ${0n}
    ${-1n}                      | ${-1000000n}
    ${-1000n}                   | ${-1000000n}
    ${-1500n}                   | ${-1000000n}
    ${-999999999n}              | ${-1000000000n}
    ${-1710072000123456789n}    | ${-1710072000124000000n}
    ${8640000000000000000000n}  | ${8640000000000000000000n}
    ${-8640000000000000000000n} | ${-8640000000000000000000n}
  `(
    'returns $expected for $nanoseconds truncated to "ms"',
    ({ nanoseconds, expected }) => {
      expect(truncateNanoseconds(nanoseconds, "ms")).toBe(expected);
    },
  );

  it.each`
    nanoseconds              | unit    | expected
    ${1710072000123456789n}  | ${"us"} | ${true}
    ${-1710072000123456789n} | ${"us"} | ${true}
    ${1710072000123456789n}  | ${"ms"} | ${true}
    ${-1710072000123456789n} | ${"ms"} | ${true}
  `(
    "floors $nanoseconds toward negative infinity for $unit",
    ({ nanoseconds, unit }) => {
      expect(truncateNanoseconds(nanoseconds, unit)).toBeLessThanOrEqual(
        nanoseconds,
      );
    },
  );

  it("is idempotent", () => {
    const once = truncateNanoseconds(-1710072000123456789n, "us");

    expect(truncateNanoseconds(once, "us")).toBe(once);
  });

  it("produces a value a microsecond store can round-trip", () => {
    const truncated = truncateNanoseconds(1710072000123456789n, "us");

    expect(fromNanoseconds(truncated)).toBe("2024-03-10T12:00:00.123456Z");
  });

  it.each`
    unit         | reason
    ${"ns"}      | ${"nanoseconds are the input precision, not a target"}
    ${"s"}       | ${"unsupported unit"}
    ${"US"}      | ${"wrong case"}
    ${""}        | ${"empty string"}
    ${undefined} | ${"undefined"}
    ${null}      | ${"null"}
    ${1000}      | ${"non-string"}
  `("returns 0n when unit $unit is invalid ($reason)", ({ unit }) => {
    expect(
      truncateNanoseconds(1710072000123456789n, unit as unknown as "ms" | "us"),
    ).toBe(0n);
  });

  it.each`
    nanoseconds                 | reason
    ${8640000000000000000001n}  | ${"past the maximum instant"}
    ${-8640000000000000000001n} | ${"before the minimum instant"}
    ${1710072000123}            | ${"number, not bigint"}
    ${"1710072000123456789"}    | ${"string"}
    ${null}                     | ${"null"}
    ${undefined}                | ${"undefined"}
    ${true}                     | ${"boolean"}
    ${[]}                       | ${"array"}
    ${{}}                       | ${"object"}
  `(
    "returns 0n when nanoseconds $nanoseconds is invalid ($reason)",
    ({ nanoseconds }) => {
      expect(truncateNanoseconds(nanoseconds as unknown as bigint, "us")).toBe(
        0n,
      );
    },
  );
});
