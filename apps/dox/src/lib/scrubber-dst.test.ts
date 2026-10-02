/// <reference types="vitest/globals" />
/**
 * The Zone Planner's DST logic. Expectations come from the library's own
 * transition lists (`getDstTransitions`) and its in-DST judgement
 * (`isInDaylightSaving`), read for the zone under test, never from dates typed
 * in here: the point is that the planner agrees with the library at the
 * instant before, at and after every switch, for every kind of zone.
 */
import { describe, expect, it } from "vitest";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { isInDaylightSaving } from "@northguild/gmt/zoned/compare";
import { convertZonedToZoned } from "@northguild/gmt/zoned/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import { readZoneAt } from "./zone-clock";
import {
  crossedSwitch,
  dstStatus,
  nextSwitch,
  offsetMinutes,
  switchesBetween,
  switchesInWindow,
  zoneSwitchesInYear,
} from "./scrubber-dst";

const MIN = 60_000;
const YEAR = 2026;

/** The instant as the planner hands it to the library: UTC, bracketed. */
const utcZoned = (ms: number) =>
  convertUnixToUtc(ms, { epochUnit: "milliseconds" })
    .replace(/\.\d{3}Z$/, "Z")
    .replace("Z", "+00:00[UTC]");

/** What the planner shows for `zone` at `ms`, the way `updateRows` derives it. */
function statusAt(zone: string, ms: number) {
  const reading = readZoneAt(zone, utcZoned(ms));
  expect(reading.ok).toBe(true);
  return {
    reading,
    status: dstStatus(zone, Number(reading.date.slice(0, 4)), reading.inDst),
  };
}

describe("offsetMinutes", () => {
  it("reads ±HH:MM, including the half and quarter hours", () => {
    expect(offsetMinutes("+00:00")).toBe(0);
    expect(offsetMinutes("-05:00")).toBe(-300);
    expect(offsetMinutes("+10:30")).toBe(630);
    expect(offsetMinutes("+05:45")).toBe(345);
    expect(offsetMinutes("-00:30")).toBe(-30);
    expect(offsetMinutes("Z")).toBeNull();
    expect(offsetMinutes("")).toBeNull();
  });
});

describe("zoneSwitchesInYear", () => {
  it("is the library's transition list, with the shift worked out from the offsets", () => {
    for (const zone of [
      "America/New_York",
      "Australia/Lord_Howe",
      "Europe/Dublin",
    ]) {
      const listed = getDstTransitions(zone, YEAR);
      const mine = zoneSwitchesInYear(zone, YEAR);
      expect(mine.map((s) => s.instant)).toEqual(listed.map((t) => t.instant));
      expect(mine.map((s) => s.offsetAfter)).toEqual(
        listed.map((t) => t.offsetAfter),
      );
      mine.forEach((s) =>
        expect(s.shiftMin).toBe(
          offsetMinutes(s.offsetAfter)! - offsetMinutes(s.offsetBefore)!,
        ),
      );
    }
  });

  it("is empty for a zone that keeps one offset, and for an invalid zone", () => {
    expect(zoneSwitchesInYear("Asia/Tokyo", YEAR)).toEqual([]);
    expect(zoneSwitchesInYear("Atlantic/Reykjavik", YEAR)).toEqual([]);
    expect(zoneSwitchesInYear("Not/AZone", YEAR)).toEqual([]);
  });

  it("gives Lord Howe a thirty-minute switch each way", () => {
    const shifts = zoneSwitchesInYear("Australia/Lord_Howe", YEAR).map(
      (s) => s.shiftMin,
    );
    expect(shifts.sort((a, b) => a - b)).toEqual([-30, 30]);
  });
});

describe("a scrub across every switch of a zone", () => {
  const ZONES = [
    "America/New_York", // northern hemisphere
    "Europe/London",
    "Australia/Sydney", // southern hemisphere
    "America/Santiago",
    "Australia/Lord_Howe", // a 30-minute shift
    "Europe/Dublin", // negative DST in the tz source
    "Africa/Casablanca", // several switches around Ramadan
  ];

  for (const zone of ZONES) {
    it(`${zone}: the crossed switch and the pill follow the library at, before and after each one`, () => {
      const switches = zoneSwitchesInYear(zone, YEAR);
      expect(switches.length).toBeGreaterThan(0);
      for (const s of switches) {
        const reference = s.instantMs - 60 * MIN;
        // Before the switch, the scrub has crossed nothing.
        expect(crossedSwitch(zone, reference, s.instantMs - MIN)).toBeNull();
        // At the switch's own instant, and after it, it has.
        expect(crossedSwitch(zone, reference, s.instantMs)?.instant).toBe(
          s.instant,
        );
        expect(
          crossedSwitch(zone, reference, s.instantMs + 60 * MIN)?.instant,
        ).toBe(s.instant);
        // Scrubbing back across it from after is the same switch.
        expect(
          crossedSwitch(zone, s.instantMs + 60 * MIN, reference)?.instant,
        ).toBe(s.instant);

        // The pill is the library's judgement of the instant, for that zone.
        for (const ms of [s.instantMs - MIN, s.instantMs, s.instantMs + MIN]) {
          const { reading, status } = statusAt(zone, ms);
          expect(reading.inDst).toBe(
            isInDaylightSaving(convertZonedToZoned(utcZoned(ms), zone)),
          );
          expect(status).toBe(reading.inDst ? "dst" : "standard");
        }
        // The new offset is the one the tile shows after it.
        expect(statusAt(zone, s.instantMs).reading.offset).toBe(s.offsetAfter);
        expect(statusAt(zone, s.instantMs - MIN).reading.offset).toBe(
          s.offsetBefore,
        );
      }
    });
  }

  it("a northern zone enters DST on its forward switch and leaves it on its back switch", () => {
    for (const zone of ["America/New_York", "Europe/London", "Europe/Dublin"]) {
      for (const s of zoneSwitchesInYear(zone, YEAR)) {
        const before = statusAt(zone, s.instantMs - MIN).status;
        const after = statusAt(zone, s.instantMs + MIN).status;
        if (s.shiftMin > 0)
          expect([before, after]).toEqual(["standard", "dst"]);
        else expect([before, after]).toEqual(["dst", "standard"]);
      }
    }
  });

  it("a southern zone enters DST on its forward switch too, in the other half of the year", () => {
    for (const zone of ["Australia/Sydney", "America/Santiago"]) {
      const [first, second] = zoneSwitchesInYear(zone, YEAR);
      // January is its summer, so the first switch of the year is the one that
      // ends DST, and the second begins it.
      expect(first!.shiftMin).toBeLessThan(0);
      expect(second!.shiftMin).toBeGreaterThan(0);
      expect(statusAt(zone, first!.instantMs - MIN).status).toBe("dst");
      expect(statusAt(zone, first!.instantMs + MIN).status).toBe("standard");
      expect(statusAt(zone, second!.instantMs + MIN).status).toBe("dst");
    }
  });

  it("Lord Howe moves by thirty minutes and is in DST on the larger offset", () => {
    for (const s of zoneSwitchesInYear("Australia/Lord_Howe", YEAR)) {
      expect(Math.abs(s.shiftMin)).toBe(30);
      const after = statusAt("Australia/Lord_Howe", s.instantMs + MIN);
      expect(after.status).toBe(s.shiftMin > 0 ? "dst" : "standard");
    }
  });

  it("Casablanca's switches are all found, whatever number the runtime's tz data has", () => {
    const listed = getDstTransitions("Africa/Casablanca", YEAR);
    const mine = zoneSwitchesInYear("Africa/Casablanca", YEAR);
    expect(mine).toHaveLength(listed.length);
    // Each is found by a scrub that straddles only it.
    for (const s of mine) {
      expect(
        switchesBetween(
          "Africa/Casablanca",
          s.instantMs - MIN,
          s.instantMs,
        ).map((x) => x.instant),
      ).toEqual([s.instant]);
    }
  });
});

describe("dstStatus", () => {
  it("says a zone that keeps one offset all year has no DST, in any state of the year", () => {
    for (const zone of ["Asia/Tokyo", "Atlantic/Reykjavik", "Asia/Calcutta"]) {
      // 2026-01-01T00:00:00Z.
      const { status } = statusAt(zone, 1_767_225_600_000);
      expect(status).toBe("none");
    }
  });

  it("is the instant's own year: Istanbul observed DST in 2010 and keeps one offset in 2026", () => {
    // 2010-07-01T12:00Z and 2026-07-01T12:00Z.
    const summer2010 = statusAt("Europe/Istanbul", 1_277_985_600_000);
    const winter2010 = statusAt("Europe/Istanbul", 1_262_347_200_000);
    const summer2026 = statusAt("Europe/Istanbul", 1_782_907_200_000);
    expect(summer2010.status).toBe("dst");
    expect(winter2010.status).toBe("standard");
    expect(summer2026.status).toBe("none");
  });
});

describe("nextSwitch", () => {
  it("is the earliest switch strictly after the instant, of either kind", () => {
    const [spring, fall] = zoneSwitchesInYear("America/New_York", YEAR);
    expect(
      nextSwitch(["America/New_York"], spring!.instantMs - MIN)?.instant,
    ).toBe(spring!.instant);
    expect(
      nextSwitch(["America/New_York"], fall!.instantMs - MIN)?.instant,
    ).toBe(fall!.instant);
  });

  it("advances when the instant is exactly on a switch", () => {
    const [spring, fall] = zoneSwitchesInYear("America/New_York", YEAR);
    expect(nextSwitch(["America/New_York"], spring!.instantMs)?.instant).toBe(
      fall!.instant,
    );
  });

  it("goes into the next year once this year's are behind it", () => {
    const fall = zoneSwitchesInYear("America/New_York", YEAR).at(-1)!;
    const next = nextSwitch(["America/New_York"], fall.instantMs)!;
    expect(next.instantMs).toBeGreaterThan(fall.instantMs);
    expect(next.instant.startsWith(String(YEAR + 1))).toBe(true);
  });

  it("takes the earliest across the shown zones, southern ones included", () => {
    const sydney = zoneSwitchesInYear("Australia/Sydney", YEAR);
    const ny = zoneSwitchesInYear("America/New_York", YEAR);
    // Just after Sydney's first switch of the year (April), New York's spring
    // switch is already behind; Sydney's second (October) comes before New
    // York's fall one.
    const from = sydney[0]!.instantMs + MIN;
    const next = nextSwitch(["America/New_York", "Australia/Sydney"], from)!;
    const expected = [...sydney, ...ny]
      .filter((s) => s.instantMs > from)
      .sort((a, b) => a.instantMs - b.instantMs)[0]!;
    expect(next.instant).toBe(expected.instant);
    expect(next.zone).toBe(expected.zone);
  });

  it("is null when every shown zone keeps one offset", () => {
    expect(
      nextSwitch(["Asia/Tokyo", "Atlantic/Reykjavik", "UTC"], 0),
    ).toBeNull();
    expect(nextSwitch([], 0)).toBeNull();
  });
});

describe("switchesInWindow", () => {
  it("lists the switches of every zone inside the window, in time order", () => {
    const ny = zoneSwitchesInYear("America/New_York", YEAR)[0]!;
    const london = zoneSwitchesInYear("Europe/London", YEAR)[0]!;
    const centre = ny.instantMs;
    const found = switchesInWindow(
      ["America/New_York", "Europe/London", "Asia/Tokyo"],
      centre,
      36 * 60 * MIN,
    );
    expect(found.map((s) => s.zone)).toEqual(["America/New_York"]);
    // A wider window takes London's too, three weeks later: not in 36 hours.
    expect(london.instantMs - ny.instantMs).toBeGreaterThan(36 * 60 * MIN);
  });
});
