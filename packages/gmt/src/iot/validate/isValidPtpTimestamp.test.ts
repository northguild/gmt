import {
  INVALID_PTP_RECORDS,
  VALID_PTP_RECORDS,
} from "../../test/ptpTimestampRows";
import type { PtpTimestamp } from "../../types/ptp";
import { ptpToUtc } from "../convert/ptpToUtc";
import { isValidPtpTimestamp } from "./isValidPtpTimestamp";

// Every expected value comes from the field widths (RFC 8877 section 4.3: 80 - 32 = 48 bits of
// seconds, nanoseconds 0 to 10^9 - 1), never from the code under test.
describe("isValidPtpTimestamp", () => {
  it.each(VALID_PTP_RECORDS)(
    "returns true for the valid record '$name' ($reason)",
    ({ value }) => {
      expect(isValidPtpTimestamp(value)).toBe(true);
    },
  );

  it.each(INVALID_PTP_RECORDS)(
    "returns false for the invalid record '$name' ($reason)",
    ({ value }) => {
      expect(isValidPtpTimestamp(value)).toBe(false);
    },
  );

  it.each`
    value                                                   | expected | label
    ${{ seconds: 2n ** 48n, nanoseconds: 0 }}               | ${false} | ${"2^48 seconds"}
    ${{ seconds: -1n, nanoseconds: 0 }}                     | ${false} | ${"negative seconds"}
    ${{ seconds: 0n, nanoseconds: 1_000_000_000 }}          | ${false} | ${"10^9 nanoseconds"}
    ${{ seconds: 1.5, nanoseconds: 0 }}                     | ${false} | ${"fractional seconds"}
    ${{ seconds: 0n }}                                      | ${false} | ${"missing nanoseconds"}
    ${null}                                                 | ${false} | ${"null"}
    ${"2024-01-01T00:00:00Z"}                               | ${false} | ${"a string"}
    ${{ seconds: 1_704_067_237n, nanoseconds: 0 }}          | ${true}  | ${"2024 bigint seconds"}
    ${{ seconds: 1_704_067_237, nanoseconds: 999_999_999 }} | ${true}  | ${"2024 number seconds"}
  `(
    "returns $expected for the issue's verification row ($label)",
    ({ value, expected }) => {
      expect(isValidPtpTimestamp(value)).toBe(expected);
    },
  );

  it.each`
    value            | label
    ${1_704_067_237} | ${"a number"}
    ${true}          | ${"a boolean"}
    ${Symbol("ptp")} | ${"a symbol"}
    ${() => 0}       | ${"a function"}
  `("returns false for a non-record primitive ($label)", ({ value }) => {
    expect(isValidPtpTimestamp(value)).toBe(false);
  });

  describe.each`
    offset
    ${37}
    ${0}
    ${-32768}
    ${32767}
  `("agreement with ptpToUtc at offset $offset", ({ offset }) => {
    it.each(INVALID_PTP_RECORDS)(
      "ptpToUtc returns '' for the invalid record '$name'",
      ({ value }) => {
        expect(isValidPtpTimestamp(value)).toBe(false);
        expect(ptpToUtc(value as never, offset)).toBe("");
      },
    );
  });

  it("is true for { seconds: 0n, nanoseconds: 0 } although ptpToUtc at offset 37 is '' (the result would be before 1970)", () => {
    const record = { seconds: 0n, nanoseconds: 0 };

    expect(isValidPtpTimestamp(record)).toBe(true);
    expect(ptpToUtc(record, 37)).toBe("");
  });

  // 1704067237 s - 37 s = 1704067200 s = 2024-01-01T00:00:00Z (TAI is 37 s ahead of UTC); each
  // row's seconds are 1704067200 plus its offset.
  it.each`
    offset    | seconds
    ${37}     | ${1_704_067_237n}
    ${0}      | ${1_704_067_200n}
    ${-32768} | ${1_704_034_432n}
  `(
    "a valid record converts when the result is in range (seconds $seconds, offset $offset)",
    ({ offset, seconds }) => {
      const record = { seconds, nanoseconds: 0 };

      expect(isValidPtpTimestamp(record)).toBe(true);
      expect(ptpToUtc(record, offset)).toBe("2024-01-01T00:00:00Z");
    },
  );

  it("narrows unknown to a PTP timestamp record", () => {
    const x: unknown = { seconds: 1n, nanoseconds: 2 };

    if (isValidPtpTimestamp(x)) {
      expectTypeOf(x.nanoseconds).toBeNumber();
      expectTypeOf(x.seconds).toEqualTypeOf<bigint | number>();
      expectTypeOf(x).toExtend<
        PtpTimestamp | { seconds: number; nanoseconds: number }
      >();
    }
    expect(isValidPtpTimestamp(x)).toBe(true);
  });
});
