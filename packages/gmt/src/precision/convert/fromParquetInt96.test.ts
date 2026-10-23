import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromParquetInt96 } from "./fromParquetInt96";
import { toParquetInt96 } from "./toParquetInt96";

const DAY_MINUS_1 = 86_399_999_999_999n;
// 2440588 = 0x253d8c, little-endian 8c 3d 25 00 (hand-built, parquet-format INT96 layout)
const EPOCH_DAY_BYTES = [0x8c, 0x3d, 0x25, 0x00];

describe("fromParquetInt96", () => {
  it.each`
    julianDay    | nanosOfDay             | expected                            | reason
    ${2440588}   | ${0n}                  | ${"1970-01-01T00:00:00Z"}           | ${"JDN of the Unix epoch"}
    ${2440588}   | ${1n}                  | ${"1970-01-01T00:00:00.000000001Z"} | ${"one nanosecond"}
    ${2440587}   | ${DAY_MINUS_1}         | ${"1969-12-31T23:59:59.999999999Z"} | ${"last nanosecond before the epoch"}
    ${2460380}   | ${45_296_789_000_000n} | ${"2024-03-10T12:34:56.789Z"}       | ${"12:34:56.789 on 2024-03-10"}
    ${0}         | ${0n}                  | ${"-004713-11-24T00:00:00Z"}        | ${"JDN 0"}
    ${-97559412} | ${0n}                  | ${"-271821-04-20T00:00:00Z"}        | ${"first Temporal instant"}
    ${102440588} | ${0n}                  | ${"+275760-09-13T00:00:00Z"}        | ${"last Temporal instant"}
  `(
    "returns $expected for day $julianDay + $nanosOfDay ns ($reason)",
    ({ julianDay, nanosOfDay, expected }) => {
      expect(fromParquetInt96({ julianDay, nanosOfDay })).toBe(expected);
    },
  );

  it.each`
    julianDay                   | nanosOfDay             | reason
    ${102440588}                | ${1n}                  | ${"past the instant range"}
    ${-97559413}                | ${DAY_MINUS_1}         | ${"before the instant range"}
    ${2440588}                  | ${86_400_000_000_000n} | ${"a full day of nanos: GMT rule"}
    ${2440588}                  | ${-1n}                 | ${"negative nanos"}
    ${2440588}                  | ${0}                   | ${"nanos as number"}
    ${2440588}                  | ${"0"}                 | ${"nanos as string"}
    ${2440588.5}                | ${0n}                  | ${"fractional day"}
    ${2 ** 31}                  | ${0n}                  | ${"day above int32"}
    ${-(2 ** 31) - 1}           | ${0n}                  | ${"day below int32"}
    ${2 ** 31 - 1}              | ${0n}                  | ${"int32 maximum, past the instant range"}
    ${-(2 ** 31)}               | ${0n}                  | ${"int32 minimum, before the instant range"}
    ${Number.POSITIVE_INFINITY} | ${0n}                  | ${"infinite day"}
    ${"2440588"}                | ${0n}                  | ${"day as string"}
    ${Number.NaN}               | ${0n}                  | ${"NaN day"}
    ${undefined}                | ${0n}                  | ${"missing day"}
  `(
    'returns "" for day $julianDay, nanos $nanosOfDay ($reason)',
    ({ julianDay, nanosOfDay }) => {
      expect(fromParquetInt96({ julianDay, nanosOfDay })).toBe("");
    },
  );

  it.each`
    bytes                                               | expected                            | reason
    ${[0, 0, 0, 0, 0, 0, 0, 0, ...EPOCH_DAY_BYTES]}     | ${"1970-01-01T00:00:00Z"}           | ${"epoch"}
    ${[1, 0, 0, 0, 0, 0, 0, 0, ...EPOCH_DAY_BYTES]}     | ${"1970-01-01T00:00:00.000000001Z"} | ${"nanos 1, little-endian"}
    ${[0, 1, 0, 0, 0, 0, 0, 0, ...EPOCH_DAY_BYTES]}     | ${"1970-01-01T00:00:00.000000256Z"} | ${"nanos 256, byte order"}
    ${[0, 0, 0, 0, 0, 0, 0, 0, 0x8b, 0x3d, 0x25, 0x00]} | ${"1969-12-31T00:00:00Z"}           | ${"day 2440587"}
  `("reads bytes $bytes as $expected ($reason)", ({ bytes, expected }) => {
    expect(fromParquetInt96(new Uint8Array(bytes))).toBe(expected);
  });

  it("reads a negative day from the signed int32 (JDN -97559412)", () => {
    const bytes = new Uint8Array(12);
    new DataView(bytes.buffer).setInt32(8, -97_559_412, true);

    expect(fromParquetInt96(bytes)).toBe("-271821-04-20T00:00:00Z");
  });

  it.each`
    day          | nanosOfDay             | expected
    ${2440588}   | ${DAY_MINUS_1}         | ${"1970-01-01T23:59:59.999999999Z"}
    ${2460380}   | ${45_296_789_000_000n} | ${"2024-03-10T12:34:56.789Z"}
    ${-97559412} | ${0n}                  | ${"-271821-04-20T00:00:00Z"}
    ${102440588} | ${0n}                  | ${"+275760-09-13T00:00:00Z"}
  `(
    "reads bytes written with writeBigInt64LE/writeInt32LE for day $day + $nanosOfDay ns",
    ({ day, nanosOfDay, expected }) => {
      const bytes = Buffer.alloc(12);
      bytes.writeBigInt64LE(nanosOfDay, 0);
      bytes.writeInt32LE(day, 8);

      expect(fromParquetInt96(bytes)).toBe(expected);
    },
  );

  it.each`
    nanosOfDay                    | day            | reason
    ${9_223_372_036_854_775_807n} | ${2440588}     | ${"nanos int64 maximum"}
    ${0n}                         | ${2 ** 31 - 1} | ${"day int32 maximum, past the instant range"}
    ${0n}                         | ${-(2 ** 31)}  | ${"day int32 minimum, before the instant range"}
    ${0n}                         | ${102440589}   | ${"day one past the last instant"}
  `('returns "" for bytes with $reason', ({ nanosOfDay, day }) => {
    const bytes = Buffer.alloc(12);
    bytes.writeBigInt64LE(nanosOfDay, 0);
    bytes.writeInt32LE(day, 8);

    expect(fromParquetInt96(bytes)).toBe("");
  });

  it("honours byteOffset of a view into a larger buffer", () => {
    const buffer = new Uint8Array(16).fill(0xff);
    buffer.set([0, 0, 0, 0, 0, 0, 0, 0, ...EPOCH_DAY_BYTES], 4);

    expect(fromParquetInt96(new Uint8Array(buffer.buffer, 4, 12))).toBe(
      "1970-01-01T00:00:00Z",
    );
  });

  it("reads a Node Buffer", () => {
    expect(
      fromParquetInt96(
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, ...EPOCH_DAY_BYTES]),
      ),
    ).toBe("1970-01-01T00:00:00Z");
  });

  it.each`
    bytes                                                                                   | reason
    ${new Uint8Array(11)}                                                                   | ${"11 bytes"}
    ${new Uint8Array(13)}                                                                   | ${"13 bytes"}
    ${new Uint8Array(0)}                                                                    | ${"empty"}
    ${new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, ...EPOCH_DAY_BYTES])}         | ${"nanos -1 as int64"}
    ${new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0x80, ...EPOCH_DAY_BYTES])}                      | ${"nanos int64 minimum"}
    ${new Uint8Array([0x00, 0x00, 0x4f, 0x91, 0x94, 0x4e, 0x00, 0x00, ...EPOCH_DAY_BYTES])} | ${"nanos 86_400_000_000_000, a full day"}
  `('returns "" for bytes ($reason)', ({ bytes }) => {
    expect(fromParquetInt96(bytes)).toBe("");
  });

  it.each`
    value                  | reason
    ${new Int32Array(3)}   | ${"Int32Array of 12 bytes is not a Uint8Array"}
    ${new ArrayBuffer(12)} | ${"bare ArrayBuffer"}
    ${null}                | ${"null"}
    ${undefined}           | ${"undefined"}
    ${"x"}                 | ${"string"}
    ${42}                  | ${"number"}
    ${{}}                  | ${"empty object"}
  `('returns "" for $reason', ({ value }) => {
    expect(fromParquetInt96(value)).toBe("");
  });

  it.each`
    value             | reason
    ${hostileProxy()} | ${"proxy that throws on every trap"}
    ${revokedProxy()} | ${"revoked proxy (getPrototypeOf trap)"}
    ${{
  get julianDay() {
    throw new Error("hostile getter");
  },
  nanosOfDay: 0n,
}} | ${"throwing julianDay getter"}
    ${{
  julianDay: 2440588,
  get nanosOfDay() {
    throw new Error("hostile getter");
  },
}} | ${"throwing nanosOfDay getter"}
  `('returns "" without throwing for $reason', ({ value }) => {
    expect(fromParquetInt96(value)).toBe("");
  });

  it.each`
    iso
    ${"1970-01-01T00:00:00Z"}
    ${"1969-12-31T23:59:59.999999999Z"}
    ${"2024-03-10T12:34:56.789Z"}
    ${"-271821-04-20T00:00:00Z"}
    ${"+275760-09-13T00:00:00Z"}
  `("round-trips $iso through toParquetInt96", ({ iso }) => {
    expect(fromParquetInt96(toParquetInt96(iso)!)).toBe(iso);
  });
});
