import { Temporal as PolyfillTemporal } from "@northguild/gmt";
import { describe, expect, it } from "vitest";
import {
  parseLongOffset,
  sweepOffsets,
  sweepSpan,
} from "../../../../scripts/lib/offset-sweep.mjs";

/**
 * CORE-92: the offset sweep. Unit rows use fake offset functions; the expected values are written
 * out from the spec tables (CLDR gmtFormat / gmtZeroFormat, Temporal PlainDate.add clamp), never
 * read back from the module.
 */

const DAY_MS = 86_400_000;
const NOON_MS = 43_200_000;

describe("parseLongOffset", () => {
  it.each`
    text              | seconds
    ${"GMT"}          | ${0}
    ${"GMT+00:00"}    | ${0}
    ${"GMT+05:30"}    | ${19800}
    ${"GMT-03:00"}    | ${-10800}
    ${"GMT-00:44:30"} | ${-2670}
    ${"GMT+14:00"}    | ${50400}
    ${"GMT-00:00"}    | ${0}
  `("reads '$text' as $seconds seconds east of UTC", ({ text, seconds }) => {
    expect(parseLongOffset(text)).toBe(seconds);
  });

  it("returns positive zero for 'GMT-00:00'", () => {
    expect(Object.is(parseLongOffset("GMT-00:00"), 0)).toBe(true);
  });

  it.each`
    text
    ${"UTC"}
    ${"GMT+5"}
    ${"GMT+05"}
    ${"+05:30"}
    ${"GMT+05:30 "}
    ${""}
    ${"GMT+05:60"}
    ${"GMT+05:30:60"}
  `("rejects '$text' with null", ({ text }) => {
    expect(parseLongOffset(text)).toBeNull();
  });
});

describe("sweepSpan", () => {
  it.each`
    today           | through         | lastDay
    ${"2026-10-25"} | ${"2036-10-25"} | ${24404}
    ${"2028-02-29"} | ${"2038-02-28"} | ${24895}
    ${"1970-01-01"} | ${"1980-01-01"} | ${3652}
  `(
    "spans 1970-01-01 to $through for the run date $today",
    ({ today, through, lastDay }) => {
      expect(sweepSpan(PolyfillTemporal.PlainDate.from(today))).toEqual({
        from: "1970-01-01",
        through,
        firstDay: 0,
        lastDay,
      });
    },
  );
});

/** Fake sources: Intl says +01:00 always; the swap says +01:00 except where `bad` returns a value. */
function sweep(
  opts: {
    zones?: string[];
    firstDay?: number;
    lastDay?: number;
    bad?: (zone: string, day: number) => number | "throw" | undefined;
    intlText?: (zone: string, day: number) => string;
    seen?: number[];
  } = {},
) {
  const {
    zones = ["Z/A"],
    firstDay = 0,
    lastDay = 10,
    bad,
    intlText,
    seen,
  } = opts;
  return sweepOffsets({
    zones,
    firstDay,
    lastDay,
    implOffset: (zone: string, ms: number) => {
      const day = Math.floor(ms / DAY_MS);
      const b = bad?.(zone, day);
      if (b === "throw") throw new RangeError("boom");
      return b ?? 3600;
    },
    intlOffset: (zone: string, ms: number) => {
      seen?.push(ms);
      return intlText ? intlText(zone, Math.floor(ms / DAY_MS)) : "GMT+01:00";
    },
  });
}

describe("sweepOffsets", () => {
  it("reports no zone when every day matches", () => {
    expect(sweep({ zones: ["Z/A", "Z/B"], firstDay: 0, lastDay: 4 })).toEqual({
      from: "1970-01-01",
      through: "1970-01-05",
      zones: 2,
      days: 5,
      comparisons: 10,
      differingZones: 0,
      differing: [],
      differingTruncated: false,
    });
  });

  it("merges days 3-5 under one pair and splits off day 9 under another", () => {
    const r = sweep({
      bad: (_z, d) => (d >= 3 && d <= 5 ? 7200 : d === 9 ? 0 : undefined),
    });
    expect(r.differingZones).toBe(1);
    expect(r.differing).toEqual([
      {
        zone: "Z/A",
        days: 4,
        runs: [
          {
            from: "1970-01-04",
            through: "1970-01-06",
            intl: 3600,
            polyfill: 7200,
          },
          {
            from: "1970-01-10",
            through: "1970-01-10",
            intl: 3600,
            polyfill: 0,
          },
        ],
        runsTruncated: false,
      },
    ]);
  });

  it("splits a run when the pair changes on the next day", () => {
    const r = sweep({
      bad: (_z, d) => (d >= 3 && d <= 5 ? 7200 : d === 6 ? 0 : undefined),
    });
    expect(r.differing[0]).toMatchObject({
      days: 4,
      runs: [
        { from: "1970-01-04", through: "1970-01-06", polyfill: 7200 },
        { from: "1970-01-07", through: "1970-01-07", polyfill: 0 },
      ],
    });
  });

  it("counts a throwing day as differing with a null polyfill offset", () => {
    const r = sweep({ bad: (_z, d) => (d === 2 ? "throw" : undefined) });
    expect(r.differing[0]?.runs).toEqual([
      { from: "1970-01-03", through: "1970-01-03", intl: 3600, polyfill: null },
    ]);
  });

  it("throws naming zone, date and text when Intl text is unreadable", () => {
    expect(() =>
      sweep({ intlText: (_z, d) => (d === 2 ? "GMT+5" : "GMT+01:00") }),
    ).toThrow(
      'Intl longOffset text for Z/A on 1970-01-03 is "GMT+5", which the sweep cannot read',
    );
  });

  it("lists 50 of 51 differing zones and says it truncated", () => {
    const zones = Array.from({ length: 51 }, (_, i) => `Z/${i}`);
    const r = sweep({ zones, lastDay: 0, bad: () => 0 });
    expect(r.differingZones).toBe(51);
    expect(r.differing).toHaveLength(50);
    expect(r.differing[0]?.zone).toBe("Z/0");
    expect(r.differingTruncated).toBe(true);
  });

  it("lists 20 of 21 runs in one zone while days counts all", () => {
    // Alternating match / differ: differing on even days 0,2,...,40 gives 21 runs.
    const r = sweep({
      lastDay: 40,
      bad: (_z, d) => (d % 2 === 0 ? 0 : undefined),
    });
    expect(r.differing[0]?.runs).toHaveLength(20);
    expect(r.differing[0]?.runsTruncated).toBe(true);
    expect(r.differing[0]?.days).toBe(21);
  });

  it("passes 12:00 UTC of day 0 as the first instant", () => {
    const seen: number[] = [];
    sweep({ seen, lastDay: 1 });
    expect(seen).toEqual([NOON_MS, DAY_MS + NOON_MS]);
  });

  it.each`
    day      | date
    ${11016} | ${"2000-02-29"}
    ${20751} | ${"2026-10-25"}
    ${24895} | ${"2038-02-28"}
    ${59}    | ${"1970-03-01"}
  `("names epoch day $day as $date", ({ day, date }) => {
    expect(sweep({ firstDay: day, lastDay: day }).from).toBe(date);
  });

  it("throws when there are no zones", () => {
    expect(() => sweep({ zones: [] })).toThrow(
      'Intl.supportedValuesOf("timeZone") returned no zones',
    );
  });

  it("throws when lastDay is before firstDay", () => {
    expect(() => sweep({ firstDay: 5, lastDay: 4 })).toThrow();
  });
});

// These rows check the plumbing on real data: that the `longOffset` text parses, that Temporal's
// nanoseconds and the sweep's seconds line up (the ms/s units), and that Monrovia's real
// seconds-form offset reads. They cannot catch a transition-search defect: both sides read the
// same ICU data, so a wrong transition in it would be wrong on both. Each window holds a real
// transition of its zones and stays short, so the rows run in a few milliseconds.
describe("sweepOffsets on real data", () => {
  const epochDay = (date: string) =>
    Number(
      PolyfillTemporal.PlainDate.from(date).toZonedDateTime("UTC")
        .epochMilliseconds,
    ) / DAY_MS;

  const compare = (zones: string[], from: string, through: string) => {
    const formats = new Map(
      zones.map((zone) => [
        zone,
        new Intl.DateTimeFormat("en", {
          timeZone: zone,
          timeZoneName: "longOffset",
        }),
      ]),
    );
    return sweepOffsets({
      zones,
      firstDay: epochDay(from),
      lastDay: epochDay(through),
      implOffset: (zone: string, ms: number) =>
        Number(
          PolyfillTemporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(
            zone,
          ).offsetNanoseconds,
        ) / 1e9,
      intlOffset: (zone: string, ms: number) =>
        formats
          .get(zone)!
          .formatToParts(ms)
          .find((p) => p.type === "timeZoneName")!.value,
    });
  };

  it("Monrovia from 1970 to 1972: the seconds form, then its 1972-01-07 change, match", () => {
    // Monrovia was at -00:44:30 until 1972-01-07; Intl prints it as "GMT-00:44:30".
    expect(
      compare(["Africa/Monrovia"], "1970-01-01", "1972-03-01"),
    ).toMatchObject({ differingZones: 0, days: 791 });
  });

  it("three zones across 2018 to 2020, with their DST changes, match", () => {
    // Casablanca: permanent +01 from 2018-10-28, then Ramadan breaks; Chisinau and New York: DST.
    const r = compare(
      ["Africa/Casablanca", "Europe/Chisinau", "America/New_York"],
      "2018-01-01",
      "2020-12-31",
    );
    expect(r).toMatchObject({ differingZones: 0, zones: 3, days: 1096 });
  });
});
