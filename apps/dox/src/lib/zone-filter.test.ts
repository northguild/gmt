/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import type { ZoneReading } from "./zone-clock";
import {
  bucketFor,
  countBuckets,
  dayFilterLabel,
  defaultZoneFilter,
  dstFilterLabel,
  isFilterEngaged,
  matchesFilter,
  showToggle,
} from "./zone-filter";

function reading(over: Partial<ZoneReading> = {}): ZoneReading {
  return {
    id: "Europe/London",
    ok: true,
    date: "2026-09-30",
    time: "12:04:25",
    offset: "+01:00",
    inDst: true,
    observesDst: true,
    ...over,
  };
}

const TODAY = "2026-09-30";

describe("defaultZoneFilter", () => {
  it("hides nothing, and reports itself as not engaged", () => {
    const filter = defaultZoneFilter();
    expect(isFilterEngaged(filter)).toBe(false);
    expect(
      matchesFilter({ day: "prev", dst: "none", sky: "day" }, filter),
    ).toBe(true);
    expect(matchesFilter({ day: "next", dst: "dst", sky: "day" }, filter)).toBe(
      true,
    );
  });

  it("is engaged as soon as any single box is cleared", () => {
    const day = defaultZoneFilter();
    day.days.prev = false;
    expect(isFilterEngaged(day)).toBe(true);

    const dst = defaultZoneFilter();
    dst.dst.none = false;
    expect(isFilterEngaged(dst)).toBe(true);
  });

  it("returns a fresh object each call, not a shared one", () => {
    const a = defaultZoneFilter();
    a.days.same = false;
    expect(defaultZoneFilter().days.same).toBe(true);
  });
});

describe("bucketFor", () => {
  it("reads both axes off the reading", () => {
    expect(bucketFor(reading(), TODAY, "day")).toEqual({
      day: "same",
      dst: "dst",
      sky: "day",
    });
    expect(bucketFor(reading({ date: "2026-10-01" }), TODAY, "day")).toEqual({
      day: "next",
      dst: "dst",
      sky: "day",
    });
    expect(
      bucketFor(reading({ inDst: false, observesDst: false }), TODAY, "day"),
    ).toEqual({ day: "same", dst: "none", sky: "day" });
  });

  it("puts a failed reading in the buckets that are on by default", () => {
    /* A zone whose clock is broken already shows "no signal". It must not also
       quietly vanish from the list, so it lands where nothing filters it out
       until the reader asks for that. */
    const sentinel = bucketFor(
      reading({ ok: false, date: "", time: "", offset: "" }),
      TODAY,
      "day",
    );
    expect(sentinel).toEqual({ day: "same", dst: "none", sky: "day" });
    expect(matchesFilter(sentinel, defaultZoneFilter())).toBe(true);
  });

  it("claims no day shift when the viewer's own date is unknown", () => {
    expect(bucketFor(reading({ date: "2026-10-01" }), "", "day").day).toBe(
      "same",
    );
  });
});

describe("matchesFilter", () => {
  it("needs both axes to pass", () => {
    const filter = defaultZoneFilter();
    filter.days.next = false;
    expect(matchesFilter({ day: "next", dst: "dst", sky: "day" }, filter)).toBe(
      false,
    );
    expect(matchesFilter({ day: "same", dst: "dst", sky: "day" }, filter)).toBe(
      true,
    );

    filter.dst.dst = false;
    expect(matchesFilter({ day: "same", dst: "dst", sky: "day" }, filter)).toBe(
      false,
    );
  });
});

describe("countBuckets", () => {
  it("tallies each axis independently", () => {
    const counts = countBuckets([
      { day: "same", dst: "dst", sky: "day" },
      { day: "same", dst: "none", sky: "day" },
      { day: "next", dst: "dst", sky: "day" },
    ]);
    expect(counts.days).toEqual({ prev: 0, same: 2, next: 1 });
    expect(counts.dst).toEqual({ dst: 2, standard: 0, none: 1 });
    expect(counts.sky).toEqual({ day: 3, twilight: 0, night: 0 });
  });

  it("is all zeroes for no zones", () => {
    const counts = countBuckets([]);
    expect(counts.days).toEqual({ prev: 0, same: 0, next: 0 });
    expect(counts.dst).toEqual({ dst: 0, standard: 0, none: 0 });
    expect(counts.sky).toEqual({ day: 0, twilight: 0, night: 0 });
  });
});

describe("showToggle", () => {
  it("shows a toggle whose bucket has zones", () => {
    expect(showToggle(4, true)).toBe(true);
    expect(showToggle(4, false)).toBe(true);
  });

  it("hides an empty bucket that is not filtering anything out", () => {
    expect(showToggle(0, true)).toBe(false);
  });

  it("keeps an empty bucket on screen while it is switched off", () => {
    /* The regression this guards: hide an unchecked toggle once its bucket
       empties and the only control that could switch it back on disappears,
       leaving the reader with a filter they cannot undo. */
    expect(showToggle(0, false)).toBe(true);
  });
});

describe("labels", () => {
  it("words each bucket for a control, not for prose", () => {
    expect(dayFilterLabel("prev")).toBe("Yesterday");
    expect(dayFilterLabel("same")).toBe("Today");
    expect(dayFilterLabel("next")).toBe("Tomorrow");
    expect(dstFilterLabel("dst")).toBe("In DST");
    expect(dstFilterLabel("standard")).toBe("Standard time");
    expect(dstFilterLabel("none")).toBe("No DST");
  });
});
