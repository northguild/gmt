/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import type { ZoneReading } from "./zone-clock";
import {
  dayDelta,
  dayShift,
  dayShiftChip,
  dayShiftLabel,
  dstBadge,
  dstLabel,
  dstState,
  renderZoneTooltip,
} from "./zone-readout";

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

describe("dayDelta", () => {
  it("is zero for the same date", () => {
    expect(dayDelta("2026-09-30", "2026-09-30")).toBe(0);
  });

  it("counts across a month boundary", () => {
    expect(dayDelta("2026-10-01", "2026-09-30")).toBe(1);
    expect(dayDelta("2026-09-30", "2026-10-01")).toBe(-1);
  });

  it("counts across a year boundary", () => {
    expect(dayDelta("2027-01-01", "2026-12-31")).toBe(1);
    expect(dayDelta("2026-12-31", "2027-01-01")).toBe(-1);
  });

  it("counts across a leap day", () => {
    expect(dayDelta("2028-02-29", "2028-02-28")).toBe(1);
    expect(dayDelta("2028-03-01", "2028-02-29")).toBe(1);
  });

  it("applies the century leap rules", () => {
    /* The part of a days-from-civil conversion that is easiest to get wrong:
       2000 is a leap year (divisible by 400), 1900 and 2100 are not. */
    expect(dayDelta("2000-03-01", "2000-02-28")).toBe(2);
    expect(dayDelta("2100-03-01", "2100-02-28")).toBe(1);
    expect(dayDelta("1900-03-01", "1900-02-28")).toBe(1);
    // A full common year and a full leap year, counted end to end.
    expect(dayDelta("2027-01-01", "2026-01-01")).toBe(365);
    expect(dayDelta("2029-01-01", "2028-01-01")).toBe(366);
  });

  it("reaches two days — the real UTC+14 vs UTC-12 spread", () => {
    // Kiritimati (UTC+14) just past midnight is 2026-10-01; Baker Island
    // (UTC-12) at that same instant is still 2026-09-29.
    expect(dayDelta("2026-09-29", "2026-10-01")).toBe(-2);
    expect(dayDelta("2026-10-01", "2026-09-29")).toBe(2);
  });

  it("returns zero rather than NaN for an unparseable date", () => {
    expect(dayDelta("", "2026-09-30")).toBe(0);
    expect(dayDelta("2026-09-30", "not-a-date")).toBe(0);
  });
});

describe("dayShift", () => {
  it("clamps each direction to one state", () => {
    expect(dayShift("2026-09-30", "2026-09-30")).toBe("same");
    expect(dayShift("2026-10-01", "2026-09-30")).toBe("next");
    expect(dayShift("2026-09-29", "2026-09-30")).toBe("prev");
  });

  it("clamps a two-day gap rather than falling through to same", () => {
    expect(dayShift("2026-10-01", "2026-09-29")).toBe("next");
    expect(dayShift("2026-09-29", "2026-10-01")).toBe("prev");
  });

  it("names and chips the difference it actually is", () => {
    expect(dayShiftChip(1)).toBe("+1d");
    expect(dayShiftChip(-1)).toBe("−1d");
    expect(dayShiftChip(0)).toBe("");
    expect(dayShiftLabel(1)).toBe("Tomorrow");
    expect(dayShiftLabel(-1)).toBe("Yesterday");
    expect(dayShiftLabel(0)).toBe("Today");
  });

  it("does not call a two-day gap one day", () => {
    /* The bug this pins: the filter only needs three buckets, so the label
       used to be derived from the clamped bucket and read "Yesterday" / "−1d"
       beside a date two days back. Reachable for about an hour a day between
       the extremes of the offset range. */
    expect(dayShiftChip(2)).toBe("+2d");
    expect(dayShiftChip(-2)).toBe("−2d");
    expect(dayShiftLabel(2)).toBe("2 days ahead");
    expect(dayShiftLabel(-2)).toBe("2 days behind");
  });
});

describe("dstState", () => {
  it("is none whenever the zone observes no DST, whatever inDst says", () => {
    expect(dstState(reading({ observesDst: false, inDst: false }))).toBe(
      "none",
    );
    expect(dstState(reading({ observesDst: false, inDst: true }))).toBe("none");
  });

  it("splits an observing zone by the instant", () => {
    expect(dstState(reading({ observesDst: true, inDst: true }))).toBe("dst");
    expect(dstState(reading({ observesDst: true, inDst: false }))).toBe(
      "standard",
    );
  });

  it("words each state", () => {
    expect(dstLabel("dst")).toBe("in DST");
    expect(dstLabel("standard")).toBe("standard time");
    expect(dstLabel("none")).toBe("no DST");
  });
});

describe("dstBadge", () => {
  it("marks only a zone actually on summer time", () => {
    /* It was a sun, and beside a globe that draws a day/night terminator a sun
       reads as "daytime here". DST is a property of the clock, not the sky. */
    expect(dstBadge("dst")).toBe("DST");
    expect(dstBadge("standard")).toBe("");
    expect(dstBadge("none")).toBe("");
  });
});

describe("renderZoneTooltip", () => {
  const TODAY = "2026-09-30";

  it("puts the time, the date and the offset on their own spans", () => {
    const html = renderZoneTooltip(reading(), TODAY);
    expect(html).toContain(
      '<span class="gmt-globe-tooltip-time">12:04:25</span>',
    );
    expect(html).toContain(
      '<span class="gmt-globe-tooltip-date">2026-09-30</span>',
    );
    expect(html).toContain(
      '<span class="gmt-globe-tooltip-offset">UTC+01:00</span>',
    );
    expect(html).toContain("in DST");
  });

  it("names the shift and tints the date when the day differs", () => {
    const ahead = renderZoneTooltip(
      reading({ id: "Asia/Tokyo", date: "2026-10-01" }),
      TODAY,
    );
    expect(ahead).toContain('data-shift="next"');
    expect(ahead).toContain("Tomorrow");

    const behind = renderZoneTooltip(
      reading({ id: "Pacific/Midway", date: "2026-09-29" }),
      TODAY,
    );
    expect(behind).toContain('data-shift="prev"');
    expect(behind).toContain("Yesterday");
  });

  it("says nothing about a shift on the viewer's own day", () => {
    const html = renderZoneTooltip(reading(), TODAY);
    expect(html).not.toContain("data-shift");
    expect(html).not.toContain("Today");
  });

  it("suppresses the shift entirely when the viewer's date is unknown", () => {
    const html = renderZoneTooltip(reading({ date: "2026-10-01" }), "");
    expect(html).not.toContain("data-shift");
    expect(html).toContain("2026-10-01");
  });

  it("states the DST condition in words, with no glyph", () => {
    const none = renderZoneTooltip(
      reading({ id: "Asia/Tokyo", observesDst: false, inDst: false }),
      TODAY,
    );
    expect(none).not.toContain("<svg");
    expect(none).toContain("no DST");
    expect(none).toContain('data-dst="none"');

    const dst = renderZoneTooltip(reading(), TODAY);
    expect(dst).not.toContain("<svg");
    expect(dst).toContain('data-dst="dst"');
    // The wording is what carries the colour, so it needs its own element.
    expect(dst).toContain('<span class="gmt-globe-tooltip-dst">in DST</span>');
  });

  it("renders the sentinel and no clock fields when the reading failed", () => {
    const html = renderZoneTooltip(
      reading({ ok: false, date: "", time: "", offset: "" }),
      TODAY,
    );
    expect(html).toContain("gmt-signal-lost");
    expect(html).toContain("NO SIGNAL");
    expect(html).not.toContain("gmt-globe-tooltip-time");
    expect(html).not.toContain("gmt-globe-tooltip-offset");
  });

  it("escapes the zone id", () => {
    const html = renderZoneTooltip(reading({ id: "a<b>c" }), TODAY);
    expect(html).toContain("a&lt;b&gt;c");
    expect(html).not.toContain("a<b>c");
  });
});
