import { Temporal } from "../temporal";
import {
  type HostTemporal,
  timeZoneEquals,
  timeZoneEqualsByHost,
} from "./timeZoneEquals";

/** A host whose `equals` knows the two pairs ECMA-402 names: the primary identifier is the key. */
const primary: Record<string, string> = {
  UTC: "UTC",
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
  GMT: "UTC",
  "Asia/Kolkata": "Asia/Kolkata",
  "Asia/Calcutta": "Asia/Kolkata",
  "America/New_York": "America/New_York",
};

class StubZonedDateTime {
  constructor(
    readonly epochNanoseconds: bigint,
    readonly timeZone: string,
  ) {
    if (!(timeZone in primary)) throw new RangeError(`unknown ${timeZone}`);
  }
  equals(other: unknown): boolean {
    return primary[this.timeZone] === primary[(other as this).timeZone];
  }
}
const stubHost: HostTemporal = { ZonedDateTime: StubZonedDateTime };

const at = (zone: string) => new Temporal.ZonedDateTime(0n, zone);

describe("timeZoneEqualsByHost", () => {
  it.each`
    one                   | two               | expected
    ${"UTC"}              | ${"Etc/UTC"}      | ${true}
    ${"Etc/GMT"}          | ${"GMT"}          | ${true}
    ${"Asia/Calcutta"}    | ${"Asia/Kolkata"} | ${true}
    ${"America/New_York"} | ${"UTC"}          | ${false}
  `(
    "answers $one vs $two as the host does: $expected",
    ({ one, two, expected }) => {
      expect(timeZoneEqualsByHost(stubHost, one, two)).toBe(expected);
    },
  );

  it("returns undefined when the host has no Temporal", () => {
    expect(timeZoneEqualsByHost(undefined, "UTC", "Etc/UTC")).toBeUndefined();
  });

  it("returns undefined when the host's Temporal has no ZonedDateTime", () => {
    expect(timeZoneEqualsByHost({}, "UTC", "Etc/UTC")).toBeUndefined();
  });

  it("returns undefined when the host throws for an identifier", () => {
    expect(
      timeZoneEqualsByHost(stubHost, "UTC", "Europe/Nowhere"),
    ).toBeUndefined();
  });

  it("returns undefined when the host's equals is not a boolean", () => {
    const host: HostTemporal = {
      ZonedDateTime: class {
        constructor(_ns: bigint, _zone: string) {}
        equals(): unknown {
          return "true";
        }
      },
    };
    expect(timeZoneEqualsByHost(host, "UTC", "Etc/UTC")).toBeUndefined();
  });
});

describe("timeZoneEquals", () => {
  // ECMA-402 §6.5: "UTC" is primary; "Etc/UTC", "Etc/GMT" and "GMT" resolve to it. The other rows
  // are the polyfill's own TimeZoneEquals, which holds whether or not the probe passes.
  it.each`
    one                   | two                  | expected
    ${"UTC"}              | ${"UTC"}             | ${true}
    ${"UTC"}              | ${"Etc/UTC"}         | ${true}
    ${"Etc/GMT"}          | ${"GMT"}             | ${true}
    ${"Asia/Calcutta"}    | ${"Asia/Kolkata"}    | ${true}
    ${"America/New_York"} | ${"America/Chicago"} | ${false}
    ${"UTC"}              | ${"+00:00"}          | ${false}
    ${"Europe/London"}    | ${"UTC"}             | ${false}
  `("$one vs $two is $expected", ({ one, two, expected }) => {
    expect(timeZoneEquals(at(one), at(two))).toBe(expected);
    expect(timeZoneEquals(at(two), at(one))).toBe(expected);
  });
});
