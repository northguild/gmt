import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromProtoDuration } from "./fromProtoDuration";
import { toProtoDuration } from "./toProtoDuration";

describe("fromProtoDuration", () => {
  it("accepts a typed record whose seconds is a number", () => {
    const record: { seconds: number; nanos: number } = {
      seconds: 5401,
      nanos: 0,
    };

    expect(fromProtoDuration(record)).toBe("PT1H30M1S");
  });

  it.each`
    seconds           | nanos         | expected                         | reason
    ${-1n}            | ${-500000000} | ${"-PT1.5S"}                     | ${"both negative"}
    ${5401n}          | ${500000000}  | ${"PT1H30M1.5S"}                 | ${"3600 + 1800 + 1 s"}
    ${5401}           | ${500000000}  | ${"PT1H30M1.5S"}                 | ${"number seconds"}
    ${86400n}         | ${0}          | ${"PT24H"}                       | ${"hours are the largest unit, no day"}
    ${0n}             | ${0}          | ${"PT0S"}                        | ${"zero"}
    ${0n}             | ${-1}         | ${"-PT0.000000001S"}             | ${"minus one nanosecond"}
    ${0n}             | ${1}          | ${"PT0.000000001S"}              | ${"one nanosecond"}
    ${0n}             | ${999999999}  | ${"PT0.999999999S"}              | ${"largest nanos"}
    ${1n}             | ${0}          | ${"PT1S"}                        | ${"one second"}
    ${60n}            | ${1}          | ${"PT1M0.000000001S"}            | ${"minute and a nanosecond"}
    ${315576000000n}  | ${999999999}  | ${"PT87660000H0.999999999S"}     | ${"max seconds with max nanos is valid (Durations.MAX_VALUE)"}
    ${-315576000000n} | ${-999999999} | ${"-PT87660000H0.999999999S"}    | ${"min seconds with min nanos is valid"}
    ${-3600n}         | ${0}          | ${"-PT1H"}                       | ${"minus one hour"}
    ${0n}             | ${-999999999} | ${"-PT0.999999999S"}             | ${"smallest nanos"}
    ${315576000000}   | ${0}          | ${"PT87660000H"}                 | ${"number seconds at the maximum"}
    ${-315576000000}  | ${-999999999} | ${"-PT87660000H0.999999999S"}    | ${"number seconds at the minimum with min nanos"}
    ${315575999999n}  | ${999999999}  | ${"PT87659999H59M59.999999999S"} | ${"one second below the maximum, max nanos"}
    ${315576000000n}  | ${0}          | ${"PT87660000H"}                 | ${"maximum"}
    ${-315576000000n} | ${0}          | ${"-PT87660000H"}                | ${"minimum"}
    ${-5401}          | ${-500000000} | ${"-PT1H30M1.5S"}                | ${"negative number seconds"}
    ${90000n}         | ${0}          | ${"PT25H"}                       | ${"25 h stays hours, never a day"}
    ${3661n}          | ${0}          | ${"PT1H1M1S"}                    | ${"hours, minutes, seconds"}
    ${0n}             | ${1500000}    | ${"PT0.0015S"}                   | ${"milliseconds and microseconds"}
    ${59n}            | ${999999999}  | ${"PT59.999999999S"}             | ${"just under a minute"}
    ${-60n}           | ${-1}         | ${"-PT1M0.000000001S"}           | ${"negative minute and a nanosecond"}
    ${5401}           | ${0}          | ${"PT1H30M1S"}                   | ${"number seconds, zero nanos"}
  `(
    "returns $expected for $seconds s + $nanos ns ($reason)",
    ({ seconds, nanos, expected }) => {
      expect(fromProtoDuration({ seconds, nanos })).toBe(expected);
    },
  );

  it.each`
    seconds                     | nanos                       | reason
    ${1n}                       | ${-1}                       | ${"sign rule: positive seconds, negative nanos"}
    ${-1n}                      | ${1}                        | ${"sign rule: negative seconds, positive nanos"}
    ${0n}                       | ${1000000000}               | ${"nanos past 999999999"}
    ${0n}                       | ${-1000000000}              | ${"nanos below -999999999"}
    ${0n}                       | ${0.5}                      | ${"fractional nanos"}
    ${0n}                       | ${Number.NaN}               | ${"NaN nanos"}
    ${0n}                       | ${Number.POSITIVE_INFINITY} | ${"Infinity nanos"}
    ${0n}                       | ${"0"}                      | ${"string nanos"}
    ${0.5}                      | ${0}                        | ${"fractional number seconds"}
    ${Number.NaN}               | ${0}                        | ${"NaN seconds"}
    ${Number.POSITIVE_INFINITY} | ${0}                        | ${"Infinity seconds"}
    ${-(2 ** 53)}               | ${0}                        | ${"unsafe negative number seconds"}
    ${Number.MAX_SAFE_INTEGER}  | ${0}                        | ${"safe number far above the maximum"}
    ${315576000001}             | ${0}                        | ${"number seconds above the maximum"}
    ${2n ** 70n}                | ${0}                        | ${"bigint far beyond int64"}
    ${-315576000000n}           | ${1}                        | ${"sign rule at the minimum seconds"}
    ${315576000000n}            | ${-1}                       | ${"sign rule at the maximum seconds"}
    ${315576000000n}            | ${-999999999}               | ${"sign rule: maximum seconds with minimum nanos"}
    ${-315576000000n}           | ${999999999}                | ${"sign rule: minimum seconds with maximum nanos"}
    ${5401}                     | ${-500000000}               | ${"sign rule with number seconds"}
    ${315576000000n}            | ${1000000000}               | ${"maximum seconds, nanos one past 999999999"}
    ${-315576000000n}           | ${-1000000000}              | ${"minimum seconds, nanos one below -999999999"}
    ${315576000001n}            | ${999999999}                | ${"seconds one past the maximum, max nanos"}
    ${-315576000001n}           | ${-999999999}               | ${"seconds one below the minimum, min nanos"}
    ${-315576000001}            | ${0}                        | ${"number seconds one below the minimum"}
    ${0n}                       | ${1n}                       | ${"bigint nanos"}
    ${315576000001n}            | ${0}                        | ${"above the maximum"}
    ${-315576000001n}           | ${0}                        | ${"below the minimum"}
    ${2 ** 53}                  | ${0}                        | ${"unsafe number seconds"}
    ${"1"}                      | ${0}                        | ${"string seconds"}
    ${undefined}                | ${0}                        | ${"missing seconds"}
    ${0n}                       | ${undefined}                | ${"missing nanos"}
  `('returns "" for $seconds s + $nanos ns ($reason)', ({ seconds, nanos }) => {
    expect(fromProtoDuration({ seconds, nanos })).toBe("");
  });

  it.each`
    value              | reason
    ${null}            | ${"null"}
    ${undefined}       | ${"undefined"}
    ${"PT1S"}          | ${"string"}
    ${42}              | ${"number"}
    ${{ seconds: 1n }} | ${"missing nanos"}
    ${{}}              | ${"empty object"}
    ${true}            | ${"boolean"}
    ${1n}              | ${"bigint"}
    ${[]}              | ${"array"}
    ${{ nanos: 0 }}    | ${"missing seconds member"}
  `('returns "" for $reason', ({ value }) => {
    expect(fromProtoDuration(value)).toBe("");
  });

  it.each`
    value             | reason
    ${hostileProxy()} | ${"proxy that throws on every trap"}
    ${revokedProxy()} | ${"revoked proxy"}
    ${{
  get seconds() {
    throw new Error("hostile getter");
  },
  nanos: 0,
}} | ${"throwing seconds getter"}
    ${{
  seconds: 0n,
  get nanos() {
    throw new Error("hostile getter");
  },
}} | ${"throwing nanos getter"}
  `('returns "" without throwing for $reason', ({ value }) => {
    expect(fromProtoDuration(value)).toBe("");
  });

  it.each`
    seconds           | nanos
    ${-1n}            | ${-500000000}
    ${5401n}          | ${500000000}
    ${0n}             | ${-1}
    ${0n}             | ${0}
    ${315576000000n}  | ${0}
    ${-315576000000n} | ${0}
    ${315576000000n}  | ${999999999}
    ${-315576000000n} | ${-999999999}
    ${86400n}         | ${0}
  `(
    "round-trips $seconds s + $nanos ns through toProtoDuration",
    ({ seconds, nanos }) => {
      expect(
        toProtoDuration(fromProtoDuration({ seconds, nanos })),
      ).toStrictEqual({
        seconds,
        nanos,
      });
    },
  );

  it.each`
    iso
    ${"-PT1.5S"}
    ${"PT1H30M1.5S"}
    ${"PT0S"}
    ${"-PT0.000000001S"}
    ${"PT315576000000.000000001S"}
  `("round-trips $iso through toProtoDuration (canonical form)", ({ iso }) => {
    const proto = toProtoDuration(iso)!;
    expect(toProtoDuration(fromProtoDuration(proto))).toStrictEqual(proto);
  });
});
