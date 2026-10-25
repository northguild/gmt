import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { toProtoTimestamp } from "./toProtoTimestamp";

describe("toProtoTimestamp", () => {
  it.each`
    iso                                              | seconds          | nanos        | reason
    ${"1970-01-01T00:00:00Z"}                        | ${0n}            | ${0}         | ${"epoch"}
    ${"1969-12-31T23:59:59.5Z"}                      | ${-1n}           | ${500000000} | ${"negative seconds, nanos count forward"}
    ${"1969-12-31T23:59:59.999999999Z"}              | ${-1n}           | ${999999999} | ${"one nanosecond before the epoch"}
    ${"1969-12-31T23:59:59Z"}                        | ${-1n}           | ${0}         | ${"whole negative second"}
    ${"2024-03-10T12:34:56.789Z"}                    | ${1710074096n}   | ${789000000} | ${"1710074096 s after the epoch"}
    ${"2024-03-10T13:34:56.789+01:00[Europe/Paris]"} | ${1710074096n}   | ${789000000} | ${"offset applied first"}
    ${"0001-01-01T00:00:00Z"}                        | ${-62135596800n} | ${0}         | ${"proto minimum"}
    ${"9999-12-31T23:59:59.999999999Z"}              | ${253402300799n} | ${999999999} | ${"proto maximum"}
    ${"9999-12-31T23:59:59Z"}                        | ${253402300799n} | ${0}         | ${"last whole second of the range"}
    ${"0001-01-01T00:00:00.000000001Z"}              | ${-62135596800n} | ${1}         | ${"one nanosecond past the proto minimum"}
    ${"0001-01-01T01:00:00+01:00"}                   | ${-62135596800n} | ${0}         | ${"offset lands exactly on the minimum"}
    ${"9999-12-31T23:59:59+01:00"}                   | ${253402297199n} | ${0}         | ${"offset subtracts 3600 s"}
    ${"1970-01-01T00:00:00.5+01:00"}                 | ${-3600n}        | ${500000000} | ${"-3599.5 s floors to -3600 s, nanos count forward"}
    ${"2024-03-10T12:34:56.123456789Z"}              | ${1710074096n}   | ${123456789} | ${"nine fractional digits kept exactly"}
  `(
    "returns $seconds s + $nanos ns for $iso ($reason)",
    ({ iso, seconds, nanos }) => {
      expect(toProtoTimestamp(iso)).toStrictEqual({ seconds, nanos });
    },
  );

  it.each`
    iso                                      | reason
    ${"0000-12-31T23:59:59.999999999Z"}      | ${"one nanosecond before the proto minimum"}
    ${"+010000-01-01T00:00:00Z"}             | ${"first instant past the proto maximum"}
    ${"0001-01-01T00:00:00+01:00"}           | ${"offset puts it one hour before the proto minimum"}
    ${"9999-12-31T23:59:59.999999999-01:00"} | ${"offset puts it one hour past the proto maximum"}
    ${"1970-01-01T00:00:00.0000000001Z"}     | ${"sub-nanosecond: ten fractional digits"}
    ${"2024-03-10"}                          | ${"date only"}
    ${"2016-12-31T23:59:60Z"}                | ${"leap second 60"}
    ${"2024-03-10T12:34:56"}                 | ${"no offset designator"}
    ${"invalid"}                             | ${"not a date"}
    ${""}                                    | ${"empty"}
    ${"2024-01-01T00:00:00Z[!foo=bar]"}      | ${"critical unknown annotation"}
  `("returns null for '$iso' ($reason)", ({ iso }) => {
    expect(toProtoTimestamp(iso)).toBeNull();
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
    expect(toProtoTimestamp(value)).toBeNull();
  });
});
