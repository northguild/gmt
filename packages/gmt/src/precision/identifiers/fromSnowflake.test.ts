import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromSnowflake } from "./fromSnowflake";

// Caller-written layouts: GMT ships no vendor presets.
const D = { epochMs: 1420070400000, shift: 22 };
const T = { epochMs: 1288834974657, shift: 22, timestampBits: 41 };
const T_WIDE = { epochMs: 1288834974657, shift: 22 };
const TWEET = "1050118621198921728";
const SIGN_BIT = 1n << 63n;

describe("fromSnowflake", () => {
  it.each`
    id                                 | layout                                         | expected                      | reason
    ${175928847299117063n}             | ${D}                                           | ${"2016-04-30T11:18:25.796Z"} | ${"Discord worked example, 41944705796 + epoch"}
    ${"175928847299117063"}            | ${D}                                           | ${"2016-04-30T11:18:25.796Z"} | ${"string form"}
    ${"0"}                             | ${D}                                           | ${"2015-01-01T00:00:00Z"}     | ${"Discord epoch"}
    ${TWEET}                           | ${T}                                           | ${"2018-10-10T20:19:24.211Z"} | ${"Twitter layout"}
    ${"1212092628029698048"}           | ${T}                                           | ${"2019-12-31T19:26:16.771Z"} | ${"Twitter layout, second id"}
    ${TWEET}                           | ${D}                                           | ${"2022-12-07T18:36:29.554Z"} | ${"same id, Discord epoch: a different instant"}
    ${"175928847299117063"}            | ${T}                                           | ${"2012-03-03T13:01:20.453Z"} | ${"wrong-epoch trap: Discord id under Twitter epoch"}
    ${"0"}                             | ${T}                                           | ${"2010-11-04T01:42:54.657Z"} | ${"Twitter epoch"}
    ${2n ** 64n - 1n}                  | ${D}                                           | ${"2154-05-15T07:35:11.103Z"} | ${"largest uint64"}
    ${SIGN_BIT | 1050118621198921728n} | ${T}                                           | ${"2018-10-10T20:19:24.211Z"} | ${"41-bit mask drops bit 63"}
    ${SIGN_BIT | 1050118621198921728n} | ${T_WIDE}                                      | ${"2088-06-16T12:06:59.763Z"} | ${"default width 42 keeps bit 63"}
    ${1704067200000n}                  | ${{ epochMs: 0, shift: 0 }}                    | ${"2024-01-01T00:00:00Z"}     | ${"degenerate layout: plain Unix ms"}
    ${"1"}                             | ${{ ...D, timestampBits: undefined }}          | ${"2015-01-01T00:00:00Z"}     | ${"explicit undefined timestampBits is omitted"}
    ${"18446744073709551615"}          | ${D}                                           | ${"2154-05-15T07:35:11.103Z"} | ${"largest uint64 as a 20-digit string"}
    ${"0000000000000000000"}           | ${D}                                           | ${"2015-01-01T00:00:00Z"}     | ${"leading zeros are digits, not a sign"}
    ${175928847299117063n | 0x3fffffn} | ${D}                                           | ${"2016-04-30T11:18:25.796Z"} | ${"the 22 low bits below shift are ignored"}
    ${"1"}                             | ${{ epochMs: 0, shift: 0, timestampBits: 1 }}  | ${"1970-01-01T00:00:00.001Z"} | ${"shift 0 with a 1-bit field"}
    ${SIGN_BIT}                        | ${{ epochMs: 0, shift: 63 }}                   | ${"1970-01-01T00:00:00.001Z"} | ${"shift 63 upper bound: a 1-bit field holds bit 63"}
    ${SIGN_BIT - 1n}                   | ${{ epochMs: 0, shift: 63 }}                   | ${"1970-01-01T00:00:00Z"}     | ${"shift 63: every bit below 63 is shifted out"}
    ${2n ** 64n - 1n}                  | ${{ epochMs: 1420070400000, shift: 63 }}       | ${"2015-01-01T00:00:00.001Z"} | ${"shift 63 with the largest uint64"}
    ${1n << 22n}                       | ${{ epochMs: 0, shift: 22, timestampBits: 1 }} | ${"1970-01-01T00:00:00.001Z"} | ${"explicit 1-bit field keeps bit 22"}
    ${1n << 23n}                       | ${{ epochMs: 0, shift: 22, timestampBits: 1 }} | ${"1970-01-01T00:00:00Z"}     | ${"explicit 1-bit field masks bit 23"}
    ${TWEET}                           | ${{ ...T, timestampBits: 20 }}                 | ${"2010-11-04T01:48:41.267Z"} | ${"explicit 20-bit field masks the upper 21 timestamp bits"}
    ${1000n}                           | ${{ epochMs: -86400000, shift: 0 }}            | ${"1969-12-31T00:00:01Z"}     | ${"epochMs before 1970, result before 1970"}
    ${0n}                              | ${{ epochMs: -1000, shift: 0 }}                | ${"1969-12-31T23:59:59Z"}     | ${"negative epochMs, zero ticks: negative computed time"}
    ${1000n}                           | ${{ epochMs: -1000, shift: 0 }}                | ${"1970-01-01T00:00:00Z"}     | ${"negative epochMs plus ticks lands on the Unix epoch"}
    ${0n}                              | ${{ epochMs: 8640000000000000, shift: 0 }}     | ${"+275760-09-13T00:00:00Z"}  | ${"latest Temporal instant"}
    ${0n}                              | ${{ epochMs: -8640000000000000, shift: 0 }}    | ${"-271821-04-20T00:00:00Z"}  | ${"earliest Temporal instant"}
    ${8640000000000000n}               | ${{ epochMs: -8640000000000000, shift: 0 }}    | ${"1970-01-01T00:00:00Z"}     | ${"ticks carry the earliest epoch to 1970"}
  `(
    "returns $expected for layout row ($reason)",
    ({ id, layout, expected }) => {
      expect(fromSnowflake(id, layout)).toBe(expected);
    },
  );

  it.each`
    id                              | reason
    ${2n ** 64n}                    | ${"2^64 as bigint"}
    ${-1n}                          | ${"negative bigint"}
    ${"18446744073709551616"}       | ${"2^64 as string"}
    ${"184467440737095516150"}      | ${"21 digits"}
    ${"000000000000000000001"}      | ${"21 digits with leading zeros: the cap is on length"}
    ${"-1"}                         | ${"signed string"}
    ${"+1"}                         | ${"plus sign"}
    ${" 1"}                         | ${"leading space"}
    ${"1\n"}                        | ${"trailing newline"}
    ${"1e3"}                        | ${"exponent"}
    ${"0x10"}                       | ${"hex"}
    ${""}                           | ${"empty"}
    ${Number("175928847299117063")} | ${"number: ids above 2^53 lose digits"}
    ${1}                            | ${"small number is still rejected"}
    ${null}                         | ${"null"}
    ${undefined}                    | ${"undefined"}
    ${{}}                           | ${"object"}
    ${true}                         | ${"boolean"}
  `(
    "returns an empty string for an id that is not a uint64 ($reason)",
    ({ id }) => {
      expect(fromSnowflake(id, D)).toBe("");
    },
  );

  it.each`
    layout                                             | reason
    ${undefined}                                       | ${"undefined"}
    ${null}                                            | ${"null"}
    ${"layout"}                                        | ${"string"}
    ${{ epochMs: 1420070400000 }}                      | ${"shift missing"}
    ${{ ...D, shift: 64 }}                             | ${"shift 64"}
    ${{ ...D, shift: -1 }}                             | ${"negative shift"}
    ${{ ...D, shift: 22.5 }}                           | ${"non-integer shift"}
    ${{ ...D, shift: "22" }}                           | ${"string shift"}
    ${{ ...D, shift: 22n }}                            | ${"bigint shift"}
    ${{ ...T, shift: 22n }}                            | ${"bigint shift with timestampBits"}
    ${{ ...T, shift: Symbol("22") }}                   | ${"symbol shift with timestampBits"}
    ${{ ...T, shift: { valueOf: () => {
      throw new Error("valueOf");
    } } }} | ${"shift whose valueOf throws"}
    ${{ ...D, timestampBits: 43 }}                     | ${"timestampBits above 64 - shift"}
    ${{ ...D, timestampBits: 0 }}                      | ${"timestampBits 0"}
    ${{ ...D, timestampBits: 41.5 }}                   | ${"non-integer timestampBits"}
    ${{ ...D, timestampBits: null }}                   | ${"null timestampBits"}
    ${{ ...D, epochMs: 1.5 }}                          | ${"fractional epochMs"}
    ${{ ...D, epochMs: Number.NaN }}                   | ${"NaN epochMs"}
    ${{ ...D, epochMs: "1420070400000" }}              | ${"string epochMs"}
    ${{ ...D, epochMs: 2 ** 53 }}                      | ${"epochMs beyond safe integers"}
    ${{ ...D, epochMs: Infinity }}                     | ${"infinite epochMs"}
    ${{ ...D, epochMs: undefined }}                    | ${"undefined epochMs"}
    ${{ ...D, shift: Number.NaN }}                     | ${"NaN shift"}
    ${{ ...D, timestampBits: "41" }}                   | ${"string timestampBits"}
    ${{ ...D, timestampBits: Number.NaN }}             | ${"NaN timestampBits"}
    ${{ epochMs: 0, shift: 63, timestampBits: 2 }}     | ${"timestampBits 2 above 64 - 63"}
    ${{ epochMs: 0, shift: 0, timestampBits: 65 }}     | ${"timestampBits 65 above 64"}
    ${{ epochMs: Number.MAX_SAFE_INTEGER, shift: 22 }} | ${"epoch past the instant range"}
  `("returns an empty string for an invalid layout ($reason)", ({ layout }) => {
    expect(fromSnowflake("0", layout)).toBe("");
  });

  it.each`
    id                | epochMs              | reason
    ${1n}             | ${8640000000000000}  | ${"one ms past the latest instant"}
    ${0n}             | ${8640000000000001}  | ${"epochMs alone past the latest instant"}
    ${0n}             | ${-8640000000000001} | ${"one ms before the earliest instant"}
    ${2n ** 64n - 1n} | ${-8640000000000000} | ${"ticks of 2^64 - 1 added to the earliest epoch overshoot the latest instant"}
  `(
    "returns an empty string outside the Temporal instant range ($reason)",
    ({ id, epochMs }) => {
      expect(fromSnowflake(id, { epochMs, shift: 0 })).toBe("");
    },
  );

  it.each`
    layout            | reason
    ${hostileProxy()} | ${"proxy that throws on every trap"}
    ${revokedProxy()} | ${"revoked proxy"}
    ${{ get epochMs() {
    throw new Error("hostile getter");
  }, shift: 22 }} | ${"throwing epochMs getter"}
    ${{ epochMs: 1420070400000, get shift() {
    throw new Error("hostile getter");
  } }} | ${"throwing shift getter"}
    ${{ epochMs: 1420070400000, shift: 22, get timestampBits() {
    throw new Error("hostile getter");
  } }} | ${"throwing timestampBits getter"}
  `('returns "" without throwing for $reason', ({ layout }) => {
    expect(fromSnowflake("1", layout)).toBe("");
  });

  it("reads each layout member exactly once", () => {
    const reads = { epochMs: 0, shift: 0, timestampBits: 0 };
    const layout = {
      get epochMs() {
        reads.epochMs += 1;
        return 1420070400000;
      },
      get shift() {
        reads.shift += 1;
        return 22;
      },
      get timestampBits() {
        reads.timestampBits += 1;
        return 42;
      },
    };

    expect(fromSnowflake("175928847299117063", layout)).toBe(
      "2016-04-30T11:18:25.796Z",
    );
    expect(reads).toStrictEqual({ epochMs: 1, shift: 1, timestampBits: 1 });
  });
});
