import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { toProtoDuration } from "./toProtoDuration";

describe("toProtoDuration", () => {
  it.each`
    iso                             | seconds           | nanos         | reason
    ${"-PT1.5S"}                    | ${-1n}            | ${-500000000} | ${"nanos take the sign of seconds"}
    ${"PT1H30M1.5S"}                | ${5401n}          | ${500000000}  | ${"3600 + 1800 + 1 s, 0.5 s"}
    ${"PT0.5S"}                     | ${0n}             | ${500000000}  | ${"half a second"}
    ${"-PT0.5S"}                    | ${0n}             | ${-500000000} | ${"negative half a second"}
    ${"P1D"}                        | ${86400n}         | ${0}          | ${"a day is exactly 24 h"}
    ${"P1DT1S"}                     | ${86401n}         | ${0}          | ${"day plus second"}
    ${"PT0S"}                       | ${0n}             | ${0}          | ${"zero"}
    ${"-PT0S"}                      | ${0n}             | ${0}          | ${"negative zero is zero"}
    ${"PT0.000000001S"}             | ${0n}             | ${1}          | ${"one nanosecond"}
    ${"-PT0.000000001S"}            | ${0n}             | ${-1}         | ${"minus one nanosecond"}
    ${"PT315576000000.000000001S"}  | ${315576000000n}  | ${1}          | ${"proto bounds seconds and nanos separately"}
    ${"-PT315576000000.000000001S"} | ${-315576000000n} | ${-1}         | ${"proto bounds seconds and nanos separately"}
    ${"PT315576000000S"}            | ${315576000000n}  | ${0}          | ${"maximum"}
    ${"-PT315576000000S"}           | ${-315576000000n} | ${0}          | ${"minimum"}
    ${"PT87660000H"}                | ${315576000000n}  | ${0}          | ${"87660000 h x 3600 = 315576000000 s"}
    ${"P3652500D"}                  | ${315576000000n}  | ${0}          | ${"3652500 days x 86400 = 315576000000 s, the maximum"}
    ${"-P1D"}                       | ${-86400n}        | ${0}          | ${"negative day"}
    ${"P1DT0.5S"}                   | ${86400n}         | ${500000000}  | ${"day plus half a second"}
    ${"PT1.000000001S"}             | ${1n}             | ${1}          | ${"one second and a nanosecond"}
    ${"-PT1.000000001S"}            | ${-1n}            | ${-1}         | ${"negative: nanos take seconds' sign"}
    ${"PT0.999999999S"}             | ${0n}             | ${999999999}  | ${"largest nanos"}
    ${"PT0.001S"}                   | ${0n}             | ${1000000}    | ${"one millisecond"}
  `(
    "returns $seconds s + $nanos ns for $iso ($reason)",
    ({ iso, seconds, nanos }) => {
      expect(toProtoDuration(iso)).toStrictEqual({ seconds, nanos });
    },
  );

  it.each`
    iso                   | reason
    ${"P1W"}              | ${"week has no fixed length"}
    ${"P1M"}              | ${"month has no fixed length"}
    ${"P1Y"}              | ${"year has no fixed length"}
    ${"P3652501D"}        | ${"3652501 days is 315576086400 s, past the maximum"}
    ${"PT315576000001S"}  | ${"one second past the maximum"}
    ${"-PT315576000001S"} | ${"one second past the minimum"}
    ${"PT0.0000000001S"}  | ${"sub-nanosecond: ten fractional digits"}
    ${"P1DT1M1W"}         | ${"out-of-order designators"}
    ${"invalid"}          | ${"not a duration"}
    ${""}                 | ${"empty"}
  `("returns null for $iso ($reason)", ({ iso }) => {
    expect(toProtoDuration(iso)).toBeNull();
  });

  it.each`
    value             | reason
    ${42}             | ${"number"}
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
    ${{}}             | ${"object"}
    ${1n}             | ${"bigint"}
    ${[]}             | ${"array"}
    ${hostileProxy()} | ${"proxy that throws on every trap"}
    ${revokedProxy()} | ${"revoked proxy"}
    ${Symbol("x")}    | ${"symbol"}
  `("returns null for non-string $reason", ({ value }) => {
    expect(toProtoDuration(value)).toBeNull();
  });
});
