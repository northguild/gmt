import { battleTestTimeZones } from "../../test";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromArrowTimestamp } from "./fromArrowTimestamp";
import { toArrowTimestamp } from "./toArrowTimestamp";

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

describe("toArrowTimestamp", () => {
  it.each`
    iso                                        | options                                       | expected
    ${"2024-01-01T00:00:00Z"}                  | ${{ unit: "millisecond", timeZone: "UTC" }}   | ${1_704_067_200_000n}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"} | ${{ unit: "second", timeZone: "Asia/Tokyo" }} | ${1_704_067_200n}
    ${"2024-01-01T00:00:00"}                   | ${{ unit: "millisecond" }}                    | ${1_704_067_200_000n}
    ${"2024-01-01T00:00:00"}                   | ${{ unit: "millisecond", timeZone: "" }}      | ${1_704_067_200_000n}
    ${"2024-01-01T00:00:00.123456789Z"}        | ${{ unit: "microsecond", timeZone: "UTC" }}   | ${1_704_067_200_123_456n}
    ${"2024-01-01T00:00:00.123456789Z"}        | ${{ unit: "nanoseconds", timeZone: "UTC" }}   | ${1_704_067_200_123_456_789n}
    ${"1969-12-31T23:59:59.9999999Z"}          | ${{ unit: "microsecond", timeZone: "UTC" }}   | ${-1n}
    ${"1969-12-31T23:59:59.999999999"}         | ${{ unit: "second" }}                         | ${-1n}
    ${"2262-04-11T23:47:16.854775807Z"}        | ${{ unit: "nanosecond", timeZone: "UTC" }}    | ${9_223_372_036_854_775_807n}
    ${"1677-09-21T00:12:43.145224192Z"}        | ${{ unit: "nanosecond", timeZone: "UTC" }}    | ${-(2n ** 63n)}
    ${"+275760-09-13T00:00:00"}                | ${{ unit: "second" }}                         | ${8_640_000_000_000n}
    ${"-271821-04-20T00:00:00"}                | ${{ unit: "second" }}                         | ${-8_640_000_000_000n}
    ${"2024-01-01T00:00:00Z"}                  | ${{ unit: "seconds", timeZone: "UTC" }}       | ${1_704_067_200n}
    ${"2024-01-01T00:00:00.123456789Z"}        | ${{ unit: "milliseconds", timeZone: "UTC" }}  | ${1_704_067_200_123n}
    ${"2024-01-01T00:00:00.123456789Z"}        | ${{ unit: "microseconds", timeZone: "UTC" }}  | ${1_704_067_200_123_456n}
    ${"2024-01-01T00:00:00.123456789Z"}        | ${{ unit: "nanosecond", timeZone: "UTC" }}    | ${1_704_067_200_123_456_789n}
    ${"2024-01-01T00:00:00.999999999Z"}        | ${{ unit: "second", timeZone: "UTC" }}        | ${1_704_067_200n}
    ${"1969-12-31T23:59:59.5Z"}                | ${{ unit: "second", timeZone: "UTC" }}        | ${-1n}
    ${"1969-12-31T23:59:59.9996Z"}             | ${{ unit: "millisecond", timeZone: "UTC" }}   | ${-1n}
    ${"1969-12-31T23:59:59.999999999"}         | ${{ unit: "millisecond" }}                    | ${-1n}
    ${"1969-12-31T23:59:59.9999999"}           | ${{ unit: "microsecond" }}                    | ${-1n}
    ${"1969-12-31T00:00:00.000000001"}         | ${{ unit: "seconds" }}                        | ${-86_400n}
    ${"1970-01-01T00:00:00Z"}                  | ${{ unit: "second", timeZone: "UTC" }}        | ${0n}
    ${"1970-01-01T00:00:00"}                   | ${{ unit: "second" }}                         | ${0n}
    ${"2024-02-29T00:00:00.123456"}            | ${{ unit: "microsecond" }}                    | ${1_709_164_800_123_456n}
    ${"+275760-09-13T00:00:00Z"}               | ${{ unit: "second", timeZone: "UTC" }}        | ${8_640_000_000_000n}
    ${"-271821-04-20T00:00:00Z"}               | ${{ unit: "second", timeZone: "UTC" }}        | ${-8_640_000_000_000n}
    ${"1677-09-21T00:12:43.145224192"}         | ${{ unit: "nanosecond" }}                     | ${-(2n ** 63n)}
    ${"2024-01-01T00:00:00[Asia/Tokyo]"}       | ${{ unit: "second" }}                         | ${1_704_067_200n}
  `("returns $expected for $iso $options", ({ iso, options, expected }) => {
    expect(toArrowTimestamp(iso, options)).toBe(expected);
  });

  it.each`
    iso                                     | options
    ${"2262-04-11T23:47:16.854775808Z"}     | ${{ unit: "nanosecond", timeZone: "UTC" }}
    ${"+275760-09-13T00:00:00.000000001"}   | ${{ unit: "nanosecond" }}
    ${"2024-01-01T00:00:00Z"}               | ${{ unit: "millisecond" }}
    ${"2024-01-01T00:00:00"}                | ${{ unit: "millisecond", timeZone: "UTC" }}
    ${"1677-09-21T00:12:43.145224191Z"}     | ${{ unit: "nanosecond", timeZone: "UTC" }}
    ${"1677-09-21T00:12:43.145224191"}      | ${{ unit: "nanosecond" }}
    ${"+275760-09-13T00:00:00.000000001Z"}  | ${{ unit: "second", timeZone: "UTC" }}
    ${"-271821-04-19T23:59:59.999999999Z"}  | ${{ unit: "second", timeZone: "UTC" }}
    ${"2024-01-01T00:00:00Z"}               | ${{ unit: "toString", timeZone: "UTC" }}
    ${"2024-01-01T00:00:00Z"}               | ${{ unit: "second", timeZone: " " }}
    ${"2024-01-01T00:00:00[u-ca=japanese]"} | ${{ unit: "second" }}
    ${"2024-01-01T00:00:00[!foo=bar]"}      | ${{ unit: "second" }}
    ${"2024-01-01T00:00:00[!foo=bar]"}      | ${{ unit: "second", timeZone: "UTC" }}
    ${null}                                 | ${{ unit: "second", timeZone: "UTC" }}
    ${undefined}                            | ${{ unit: "second" }}
    ${"2024-01-01"}                         | ${{ unit: "second" }}
    ${"2024-01-01T00:00:00+01:00"}          | ${{ unit: "second" }}
    ${"2024-01-01T23:59:60"}                | ${{ unit: "second" }}
    ${"2024-01-01T00:00:00Z"}               | ${{ unit: "ms", timeZone: "UTC" }}
    ${"2024-01-01T00:00:00Z"}               | ${null}
    ${"2024-01-01T00:00:00Z"}               | ${undefined}
    ${"2024-01-01T00:00:00Z"}               | ${{ unit: "second", timeZone: "Not/AZone" }}
    ${"invalid"}                            | ${{ unit: "second" }}
    ${""}                                   | ${{ unit: "second", timeZone: "UTC" }}
    ${42}                                   | ${{ unit: "second" }}
  `("returns 0n for $iso $options", ({ iso, options }) => {
    expect(toArrowTimestamp(iso, options)).toBe(0n);
  });

  it.each`
    iso                                | options
    ${"2024-01-01T00:00:00Z"}          | ${{ unit: "second", timeZone: "UTC" }}
    ${"2024-01-01T00:00:00.123Z"}      | ${{ unit: "milliseconds", timeZone: "Europe/Paris" }}
    ${"1969-12-31T23:59:59.999999Z"}   | ${{ unit: "microsecond", timeZone: "UTC" }}
    ${"2024-01-01T00:00:00"}           | ${{ unit: "second" }}
    ${"1969-12-31T23:59:59.999999999"} | ${{ unit: "nanosecond" }}
    ${"+275760-09-13T00:00:00"}        | ${{ unit: "second" }}
  `("round-trips $iso $options", ({ iso, options }) => {
    const result = fromArrowTimestamp(toArrowTimestamp(iso, options), options);

    expect(result).toStrictEqual(
      options.timeZone ? { instant: iso } : { local: iso, zoneless: true },
    );
  });

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "gives the same count for one instant whatever the column zone is, $timeZone",
    ({ timeZone }) => {
      expect(
        toArrowTimestamp("2024-01-01T00:00:00Z", { unit: "second", timeZone }),
      ).toBe(1_704_067_200n);
    },
  );

  it.each(hostileOptions)("does not throw for %s", (_name, options) => {
    expect(toArrowTimestamp("2024-01-01T00:00:00Z", options as never)).toBe(0n);
  });
});
