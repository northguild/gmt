import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromProtoTimestamp } from "./fromProtoTimestamp";
import { toProtoTimestamp } from "./toProtoTimestamp";

describe("fromProtoTimestamp", () => {
  it("accepts a typed record whose seconds is a number", () => {
    const record: { seconds: number; nanos: number } = {
      seconds: 1710074096,
      nanos: 0,
    };

    expect(fromProtoTimestamp(record)).toBe("2024-03-10T12:34:56Z");
  });

  it.each`
    seconds          | nanos        | expected                            | reason
    ${0n}            | ${0}         | ${"1970-01-01T00:00:00Z"}           | ${"epoch"}
    ${-1n}           | ${500000000} | ${"1969-12-31T23:59:59.5Z"}         | ${"nanos count forward from -1 s"}
    ${-1n}           | ${999999999} | ${"1969-12-31T23:59:59.999999999Z"} | ${"one nanosecond before the epoch"}
    ${1710074096n}   | ${789000000} | ${"2024-03-10T12:34:56.789Z"}       | ${"bigint seconds"}
    ${1710074096}    | ${789000000} | ${"2024-03-10T12:34:56.789Z"}       | ${"number seconds"}
    ${-62135596800n} | ${0}         | ${"0001-01-01T00:00:00Z"}           | ${"proto minimum"}
    ${253402300799n} | ${999999999} | ${"9999-12-31T23:59:59.999999999Z"} | ${"proto maximum"}
    ${-62135596800}  | ${0}         | ${"0001-01-01T00:00:00Z"}           | ${"number seconds at the minimum"}
    ${-1}            | ${500000000} | ${"1969-12-31T23:59:59.5Z"}         | ${"negative number seconds, nanos forward"}
    ${1710074096n}   | ${123456789} | ${"2024-03-10T12:34:56.123456789Z"} | ${"nine fractional digits"}
  `(
    "returns $expected for $seconds s + $nanos ns ($reason)",
    ({ seconds, nanos, expected }) => {
      expect(fromProtoTimestamp({ seconds, nanos })).toBe(expected);
    },
  );

  it.each`
    seconds                     | nanos                       | reason
    ${-62135596801n}            | ${0}                        | ${"below the proto minimum"}
    ${253402300800n}            | ${0}                        | ${"above the proto maximum"}
    ${0n}                       | ${-1}                       | ${"negative nanos; write -1 s + 999999999"}
    ${0n}                       | ${1000000000}               | ${"nanos past 999999999"}
    ${0n}                       | ${0.5}                      | ${"fractional nanos"}
    ${0n}                       | ${1n}                       | ${"bigint nanos"}
    ${0n}                       | ${"0"}                      | ${"string nanos"}
    ${0n}                       | ${Number.NaN}               | ${"NaN nanos"}
    ${0n}                       | ${Number.POSITIVE_INFINITY} | ${"Infinity nanos"}
    ${253402300800}             | ${0}                        | ${"number seconds above the maximum"}
    ${-62135596801}             | ${0}                        | ${"number seconds below the minimum"}
    ${Number.MAX_SAFE_INTEGER}  | ${0}                        | ${"safe number far above the maximum"}
    ${-(2 ** 53)}               | ${0}                        | ${"unsafe negative number seconds"}
    ${Number.POSITIVE_INFINITY} | ${0}                        | ${"Infinity seconds"}
    ${Number.NEGATIVE_INFINITY} | ${0}                        | ${"-Infinity seconds"}
    ${2n ** 70n}                | ${0}                        | ${"bigint far beyond int64"}
    ${2 ** 53}                  | ${0}                        | ${"unsafe number seconds"}
    ${0.5}                      | ${0}                        | ${"fractional seconds"}
    ${"0"}                      | ${0}                        | ${"string seconds"}
    ${Number.NaN}               | ${0}                        | ${"NaN seconds"}
    ${undefined}                | ${0}                        | ${"missing seconds"}
    ${0n}                       | ${undefined}                | ${"missing nanos"}
  `('returns "" for $seconds s + $nanos ns ($reason)', ({ seconds, nanos }) => {
    expect(fromProtoTimestamp({ seconds, nanos })).toBe("");
  });

  it.each`
    value              | reason
    ${null}            | ${"null"}
    ${undefined}       | ${"undefined"}
    ${"x"}             | ${"string"}
    ${42}              | ${"number"}
    ${{}}              | ${"empty object"}
    ${true}            | ${"boolean"}
    ${1n}              | ${"bigint"}
    ${[]}              | ${"array"}
    ${{ seconds: 0n }} | ${"missing nanos member"}
    ${{ nanos: 0 }}    | ${"missing seconds member"}
  `('returns "" for $reason', ({ value }) => {
    expect(fromProtoTimestamp(value)).toBe("");
  });

  it.each`
    value             | reason
    ${hostileProxy()} | ${"proxy that throws on every trap"}
    ${revokedProxy()} | ${"revoked proxy"}
    ${{ get seconds() {
    throw new Error("hostile getter");
  }, nanos: 0 }} | ${"throwing seconds getter"}
    ${{ seconds: 0n, get nanos() {
    throw new Error("hostile getter");
  } }} | ${"throwing nanos getter"}
  `('returns "" without throwing for $reason', ({ value }) => {
    expect(fromProtoTimestamp(value)).toBe("");
  });

  it.each`
    iso
    ${"1970-01-01T00:00:00Z"}
    ${"1969-12-31T23:59:59.5Z"}
    ${"2024-03-10T12:34:56.789Z"}
    ${"0001-01-01T00:00:00Z"}
    ${"9999-12-31T23:59:59.999999999Z"}
  `("round-trips $iso through toProtoTimestamp", ({ iso }) => {
    expect(fromProtoTimestamp(toProtoTimestamp(iso)!)).toBe(iso);
  });

  it.each`
    seconds          | nanos
    ${0n}            | ${0}
    ${-1n}           | ${999999999}
    ${-62135596800n} | ${0}
    ${253402300799n} | ${999999999}
    ${1710074096n}   | ${789000000}
  `(
    "round-trips $seconds s + $nanos ns through toProtoTimestamp",
    ({ seconds, nanos }) => {
      expect(
        toProtoTimestamp(fromProtoTimestamp({ seconds, nanos })),
      ).toStrictEqual({ seconds, nanos });
    },
  );
});
