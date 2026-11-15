import {
  INVALID_PTP_RECORDS,
  VALID_PTP_RECORDS,
} from "../test/ptpTimestampRows";
import {
  isPtpUtcOffset,
  PTP_SECONDS_LIMIT,
  PTP_UTC_OFFSET_MAX,
  PTP_UTC_OFFSET_MIN,
  readPtpTimestamp,
} from "./ptpTimestamp";

describe("readPtpTimestamp", () => {
  it.each(VALID_PTP_RECORDS)(
    "reads the valid record '$name' ($reason)",
    ({ value }) => {
      const result = readPtpTimestamp(value);
      const { seconds, nanoseconds } = value as {
        seconds: bigint | number;
        nanoseconds: number;
      };

      expect(result).not.toBeNull();
      expect(result).not.toBe(value);
      expect(typeof result?.seconds).toBe("bigint");
      expect(result?.seconds).toBe(BigInt(seconds));
      expect(result?.nanoseconds).toBe(Math.abs(nanoseconds));
    },
  );

  it("returns bigint seconds for number seconds, as a fresh object", () => {
    const input = { seconds: 5, nanoseconds: 1 };

    const result = readPtpTimestamp(input);

    expect(result).toStrictEqual({ seconds: 5n, nanoseconds: 1 });
    expect(result).not.toBe(input);
  });

  it.each(INVALID_PTP_RECORDS)(
    "returns null for the invalid record '$name' ($reason)",
    ({ value }) => {
      expect(readPtpTimestamp(value)).toBeNull();
    },
  );

  it.each`
    seconds                 | nanoseconds      | reason
    ${-1}                   | ${0}             | ${"negative number seconds"}
    ${NaN}                  | ${0}             | ${"NaN seconds"}
    ${Infinity}             | ${0}             | ${"Infinity seconds"}
    ${true}                 | ${0}             | ${"boolean seconds"}
    ${null}                 | ${0}             | ${"null seconds"}
    ${0n}                   | ${NaN}           | ${"NaN nanoseconds"}
    ${0n}                   | ${Infinity}      | ${"Infinity nanoseconds"}
    ${0n}                   | ${"0"}           | ${"string nanoseconds"}
    ${0n}                   | ${null}          | ${"null nanoseconds"}
    ${0n}                   | ${undefined}     | ${"undefined nanoseconds"}
    ${281_474_976_710_656n} | ${999_999_999}   | ${"seconds 2^48 with valid nanoseconds"}
    ${0n}                   | ${1_000_000_000} | ${"nanoseconds 10^9 with valid seconds"}
  `(
    "returns null for seconds $seconds and nanoseconds $nanoseconds ($reason)",
    ({ seconds, nanoseconds }) => {
      expect(readPtpTimestamp({ seconds, nanoseconds })).toBeNull();
    },
  );

  it.each`
    seconds                 | nanoseconds    | reason
    ${281_474_976_710_654n} | ${999_999_999} | ${"one below the seconds top"}
    ${0n}                   | ${999_999_999} | ${"top nanoseconds at zero seconds"}
    ${281_474_976_710_655n} | ${0}           | ${"top seconds at zero nanoseconds"}
    ${0}                    | ${1}           | ${"smallest nonzero nanoseconds"}
  `(
    "reads seconds $seconds and nanoseconds $nanoseconds ($reason)",
    ({ seconds, nanoseconds }) => {
      expect(readPtpTimestamp({ seconds, nanoseconds })).toStrictEqual({
        seconds: BigInt(seconds),
        nanoseconds,
      });
    },
  );

  it.each`
    seconds | nanoseconds | reason
    ${-0}   | ${0}        | ${"negative-zero seconds"}
    ${0}    | ${-0}       | ${"negative-zero nanoseconds"}
    ${-0}   | ${-0}       | ${"negative-zero seconds and nanoseconds"}
    ${0n}   | ${-0}       | ${"bigint seconds, negative-zero nanoseconds"}
  `("reads $reason as a plain zero", ({ seconds, nanoseconds }) => {
    const result = readPtpTimestamp({ seconds, nanoseconds });

    expect(result).toStrictEqual({ seconds: 0n, nanoseconds: 0 });
    expect(Object.is(result?.nanoseconds, 0)).toBe(true);
  });

  it("returns null for a nanoseconds getter that throws", () => {
    const record = {
      seconds: 0n,
      get nanoseconds(): number {
        throw new Error("hostile getter");
      },
    };

    expect(readPtpTimestamp(record)).toBeNull();
  });

  it("exposes 2^48 as the seconds limit", () => {
    expect(PTP_SECONDS_LIMIT).toBe(2n ** 48n);
  });
});

describe("isPtpUtcOffset", () => {
  it.each`
    value        | expected | reason
    ${37}        | ${true}  | ${"the 2024 announcement"}
    ${0}         | ${true}  | ${"a legal announcement: what a receiver that ignores the offset applies"}
    ${-0}        | ${true}  | ${"negative zero is zero"}
    ${-32768}    | ${true}  | ${"int16 minimum"}
    ${32767}     | ${true}  | ${"int16 maximum"}
    ${-32769}    | ${false} | ${"below int16"}
    ${32768}     | ${false} | ${"above int16"}
    ${40000}     | ${false} | ${"above int16, large"}
    ${37.5}      | ${false} | ${"a fraction"}
    ${NaN}       | ${false} | ${"NaN"}
    ${Infinity}  | ${false} | ${"Infinity"}
    ${"37"}      | ${false} | ${"a string"}
    ${37n}       | ${false} | ${"a bigint"}
    ${undefined} | ${false} | ${"undefined"}
    ${null}      | ${false} | ${"null"}
    ${-Infinity} | ${false} | ${"-Infinity"}
    ${true}      | ${false} | ${"a boolean"}
    ${32766}     | ${true}  | ${"one below int16 maximum"}
    ${-32767}    | ${true}  | ${"one above int16 minimum"}
    ${1}         | ${true}  | ${"smallest positive"}
    ${-1}        | ${true}  | ${"smallest negative"}
  `("gives $expected for $value ($reason)", ({ value, expected }) => {
    expect(isPtpUtcOffset(value)).toBe(expected);
  });

  it("bounds the offset at the int16 range", () => {
    expect([PTP_UTC_OFFSET_MIN, PTP_UTC_OFFSET_MAX]).toStrictEqual([
      -(2 ** 15),
      2 ** 15 - 1,
    ]);
  });
});
