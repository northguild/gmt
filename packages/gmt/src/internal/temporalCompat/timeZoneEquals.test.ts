import { Temporal } from "../temporal";
import { isTimeZoneEqualsCompatNeeded } from "./capabilities";
import {
  type HostTemporal,
  timeZoneEquals,
  timeZoneEqualsByHost,
} from "./timeZoneEquals";

// The real D19 probe by default; the "with probe D19 failing" rows force it on, as in WebKit.
vi.mock("./capabilities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./capabilities")>();
  return {
    ...actual,
    isTimeZoneEqualsCompatNeeded: vi.fn(actual.isTimeZoneEqualsCompatNeeded),
  };
});

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

describe("timeZoneEquals with probe D19 failing", () => {
  beforeEach(() => {
    vi.mocked(isTimeZoneEqualsCompatNeeded).mockReturnValue(true);
  });
  afterEach(() => {
    vi.mocked(isTimeZoneEqualsCompatNeeded).mockReset();
    vi.unstubAllGlobals();
  });

  /** A host `Temporal` that knows no links, so its answer differs from the polyfill's. */
  const linklessHost = () => {
    const asked = vi.fn();
    class ZonedDateTime {
      constructor(
        readonly epochNanoseconds: bigint,
        readonly timeZone: string,
      ) {}
      equals(other: unknown): boolean {
        asked();
        return this.timeZone === (other as this).timeZone;
      }
    }
    vi.stubGlobal("Temporal", { ZonedDateTime });
    return asked;
  };

  it("asks the host's Temporal for an IANA link, and its answer wins", () => {
    linklessHost();
    expect(timeZoneEquals(at("Asia/Calcutta"), at("Asia/Kolkata"))).toBe(false);
  });

  // ECMA-402 §6.5: "Etc/UTC", "Etc/GMT" and "GMT" resolve to "UTC" by name.
  it.each`
    one          | two
    ${"UTC"}     | ${"Etc/UTC"}
    ${"UTC"}     | ${"GMT"}
    ${"Etc/GMT"} | ${"GMT"}
    ${"Etc/UTC"} | ${"Etc/GMT"}
  `("resolves $one and $two to UTC without asking the host", ({ one, two }) => {
    const asked = linklessHost();
    expect(timeZoneEquals(at(one), at(two))).toBe(true);
    expect(timeZoneEquals(at(two), at(one))).toBe(true);
    expect(asked).not.toHaveBeenCalled();
  });

  it.each`
    one          | two
    ${"UTC"}     | ${"Etc/UTC"}
    ${"Etc/GMT"} | ${"GMT"}
  `(
    "resolves $one and $two to UTC on a host without Temporal",
    ({ one, two }) => {
      vi.stubGlobal("Temporal", undefined);
      expect(timeZoneEquals(at(one), at(two))).toBe(true);
    },
  );

  // The polyfill's answer for a link depends on the host's Intl: true on Node, false in WebKit
  // (record U). The row holds GMT to that answer, whatever it is on the host running the suite.
  it.each`
    one                | two
    ${"Asia/Calcutta"} | ${"Asia/Kolkata"}
    ${"Europe/London"} | ${"UTC"}
    ${"Etc/GMT"}       | ${"Europe/London"}
  `(
    "keeps the polyfill's answer for $one vs $two on a host without Temporal",
    ({ one, two }) => {
      const byPolyfill = at(one).equals(at(two));
      vi.stubGlobal("Temporal", undefined);
      expect(timeZoneEquals(at(one), at(two))).toBe(byPolyfill);
      expect(timeZoneEquals(at(two), at(one))).toBe(byPolyfill);
    },
  );
});
