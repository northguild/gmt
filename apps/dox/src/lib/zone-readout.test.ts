// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { renderHtml } from "~/widgets/test-fixture";
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
import { skyLabel } from "./zone-sky";

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

  it("shows the zone, time, date, offset and DST wording", () => {
    renderHtml(renderZoneTooltip(reading(), TODAY));
    expect(screen.getByText("12:04:25")).toBeInTheDocument();
    expect(screen.getByText("2026-09-30")).toBeInTheDocument();
    expect(screen.getByText("UTC+01:00")).toBeInTheDocument();
    expect(screen.getByText("in DST")).toBeInTheDocument();
  });

  it("names the shift when the day differs", () => {
    renderHtml(
      renderZoneTooltip(
        reading({ id: "Asia/Tokyo", date: "2026-10-01" }),
        TODAY,
      ),
    );
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
  });

  it("names a day behind as Yesterday", () => {
    renderHtml(
      renderZoneTooltip(
        reading({ id: "Pacific/Midway", date: "2026-09-29" }),
        TODAY,
      ),
    );
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("says nothing about a shift on the viewer's own day", () => {
    renderHtml(renderZoneTooltip(reading(), TODAY));
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
  });

  it("suppresses the shift entirely when the viewer's date is unknown", () => {
    renderHtml(renderZoneTooltip(reading({ date: "2026-10-01" }), ""));
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
    expect(screen.getByText("2026-10-01")).toBeInTheDocument();
  });

  it("states the DST condition in words", () => {
    renderHtml(
      renderZoneTooltip(
        reading({ id: "Asia/Tokyo", observesDst: false, inDst: false }),
        TODAY,
      ),
    );
    expect(screen.getByText("no DST")).toBeInTheDocument();
  });

  it("says in DST for a zone on summer time", () => {
    renderHtml(renderZoneTooltip(reading(), TODAY));
    expect(screen.getByText("in DST")).toBeInTheDocument();
  });

  it("says whether the sun is up when it is told", () => {
    renderHtml(renderZoneTooltip(reading(), TODAY, "day"));
    expect(screen.getByText(skyLabel("day"))).toBeInTheDocument();
  });

  it("renders the sentinel and no clock fields when the reading failed", () => {
    renderHtml(
      renderZoneTooltip(
        reading({ ok: false, date: "", time: "", offset: "" }),
        TODAY,
      ),
    );
    expect(screen.getByText(/NO SIGNAL/)).toBeInTheDocument();
    expect(screen.queryByText(/^UTC/)).not.toBeInTheDocument();
  });

  it("escapes the zone id", () => {
    renderHtml(renderZoneTooltip(reading({ id: "a<b>c" }), TODAY));
    expect(screen.getByText("a<b>c")).toBeInTheDocument();
  });
});
