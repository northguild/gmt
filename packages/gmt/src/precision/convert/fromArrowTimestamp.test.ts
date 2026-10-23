import { battleTestTimeZones } from "../../test";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromArrowTimestamp } from "./fromArrowTimestamp";

const hostileOptions = [
  ["a hostile Proxy", hostileProxy()],
  ["a revoked Proxy", revokedProxy()],
  [
    "a throwing unit getter",
    {
      get unit(): never {
        throw new Error("hostile getter");
      },
    },
  ],
  [
    "a throwing timeZone getter",
    {
      unit: "second",
      get timeZone(): never {
        throw new Error("hostile getter");
      },
    },
  ],
] as const;

describe("fromArrowTimestamp", () => {
  it.each`
    value                         | options                                                 | expected
    ${0n}                         | ${{ unit: "second" }}                                   | ${{ local: "1970-01-01T00:00:00", zoneless: true }}
    ${0n}                         | ${{ unit: "second", timeZone: "UTC" }}                  | ${{ instant: "1970-01-01T00:00:00Z" }}
    ${0n}                         | ${{ unit: "second", timeZone: "Europe/Paris" }}         | ${{ instant: "1970-01-01T00:00:00Z" }}
    ${0n}                         | ${{ unit: "second", timeZone: "" }}                     | ${{ local: "1970-01-01T00:00:00", zoneless: true }}
    ${0n}                         | ${{ unit: "second", timeZone: undefined }}              | ${{ local: "1970-01-01T00:00:00", zoneless: true }}
    ${1_704_067_200_000n}         | ${{ unit: "milliseconds" }}                             | ${{ local: "2024-01-01T00:00:00", zoneless: true }}
    ${1_704_067_200_123_456_789n} | ${{ unit: "nanosecond", timeZone: "America/New_York" }} | ${{ instant: "2024-01-01T00:00:00.123456789Z" }}
    ${1_704_067_200_000_000n}     | ${{ unit: "microsecond", timeZone: "+07:30" }}          | ${{ instant: "2024-01-01T00:00:00Z" }}
    ${-1n}                        | ${{ unit: "nanosecond" }}                               | ${{ local: "1969-12-31T23:59:59.999999999", zoneless: true }}
    ${-1n}                        | ${{ unit: "second" }}                                   | ${{ local: "1969-12-31T23:59:59", zoneless: true }}
    ${2n ** 63n - 1n}             | ${{ unit: "nanosecond", timeZone: "UTC" }}              | ${{ instant: "2262-04-11T23:47:16.854775807Z" }}
    ${2n ** 63n - 1n}             | ${{ unit: "nanosecond" }}                               | ${{ local: "2262-04-11T23:47:16.854775807", zoneless: true }}
    ${-(2n ** 63n)}               | ${{ unit: "nanosecond", timeZone: "UTC" }}              | ${{ instant: "1677-09-21T00:12:43.145224192Z" }}
    ${8_640_000_000_000n}         | ${{ unit: "second" }}                                   | ${{ local: "+275760-09-13T00:00:00", zoneless: true }}
    ${8_640_000_000_000n}         | ${{ unit: "second", timeZone: "UTC" }}                  | ${{ instant: "+275760-09-13T00:00:00Z" }}
    ${-8_640_000_000_000n}        | ${{ unit: "second" }}                                   | ${{ local: "-271821-04-20T00:00:00", zoneless: true }}
    ${1_704_067_200n}             | ${{ unit: "seconds", timeZone: "UTC" }}                 | ${{ instant: "2024-01-01T00:00:00Z" }}
    ${1_704_067_200_123n}         | ${{ unit: "millisecond", timeZone: "UTC" }}             | ${{ instant: "2024-01-01T00:00:00.123Z" }}
    ${1_704_067_200_123_456n}     | ${{ unit: "microseconds", timeZone: "UTC" }}            | ${{ instant: "2024-01-01T00:00:00.123456Z" }}
    ${1_704_067_200_000_000_001n} | ${{ unit: "nanoseconds", timeZone: "UTC" }}             | ${{ instant: "2024-01-01T00:00:00.000000001Z" }}
    ${1_704_067_200_123n}         | ${{ unit: "millisecond" }}                              | ${{ local: "2024-01-01T00:00:00.123", zoneless: true }}
    ${1_704_067_200_123_456n}     | ${{ unit: "microsecond" }}                              | ${{ local: "2024-01-01T00:00:00.123456", zoneless: true }}
    ${1_709_164_800n}             | ${{ unit: "seconds" }}                                  | ${{ local: "2024-02-29T00:00:00", zoneless: true }}
    ${-1n}                        | ${{ unit: "millisecond" }}                              | ${{ local: "1969-12-31T23:59:59.999", zoneless: true }}
    ${-86_400_000n}               | ${{ unit: "milliseconds" }}                             | ${{ local: "1969-12-31T00:00:00", zoneless: true }}
    ${-(2n ** 63n)}               | ${{ unit: "nanosecond" }}                               | ${{ local: "1677-09-21T00:12:43.145224192", zoneless: true }}
    ${-8_640_000_000_000n}        | ${{ unit: "second", timeZone: "UTC" }}                  | ${{ instant: "-271821-04-20T00:00:00Z" }}
  `("returns $expected for $value $options", ({ value, options, expected }) => {
    expect(fromArrowTimestamp(value, options)).toStrictEqual(expected);
  });

  it.each`
    value                  | options
    ${8_640_000_000_001n}  | ${{ unit: "second", timeZone: "UTC" }}
    ${8_640_000_000_001n}  | ${{ unit: "second" }}
    ${-8_640_000_000_001n} | ${{ unit: "second", timeZone: "UTC" }}
    ${-8_640_000_000_001n} | ${{ unit: "second" }}
    ${-(2n ** 63n)}        | ${{ unit: "second" }}
    ${-(2n ** 63n)}        | ${{ unit: "microsecond", timeZone: "UTC" }}
    ${0n}                  | ${{ unit: "toString" }}
    ${0n}                  | ${{ unit: "second", timeZone: " " }}
    ${undefined}           | ${{ unit: "second" }}
    ${null}                | ${{ unit: "second" }}
    ${2n ** 63n - 1n}      | ${{ unit: "second" }}
    ${2n ** 63n}           | ${{ unit: "nanosecond" }}
    ${-(2n ** 63n) - 1n}   | ${{ unit: "nanosecond" }}
    ${0}                   | ${{ unit: "second" }}
    ${"0"}                 | ${{ unit: "second" }}
    ${0n}                  | ${{ unit: "s" }}
    ${0n}                  | ${{ unit: "day" }}
    ${0n}                  | ${{}}
    ${0n}                  | ${{ unit: "second", timeZone: "Not/AZone" }}
    ${0n}                  | ${{ unit: "second", timeZone: 0 }}
    ${0n}                  | ${undefined}
    ${0n}                  | ${null}
    ${0n}                  | ${"second"}
  `("returns null for $value $options", ({ value, options }) => {
    expect(fromArrowTimestamp(value, options)).toBeNull();
  });

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "reads 1704067200 seconds as the same UTC instant in $timeZone",
    ({ timeZone }) => {
      expect(
        fromArrowTimestamp(1_704_067_200n, { unit: "second", timeZone }),
      ).toStrictEqual({ instant: "2024-01-01T00:00:00Z" });
    },
  );

  it.each(hostileOptions)("does not throw for %s", (_name, options) => {
    expect(fromArrowTimestamp(0n, options as never)).toBeNull();
  });
});
