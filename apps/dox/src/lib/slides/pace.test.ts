import {
  elapsedMs,
  formatClock,
  formatPace,
  msToNextSecond,
  ON_PACE_MS,
  pace,
  paceTone,
  plannedMsAt,
  WARN_BEHIND_MS,
} from "./pace";

const SLIDES = [
  { minutes: 0.5 },
  { minutes: 1.5 },
  { minutes: null },
  { minutes: 2 },
];

describe("elapsedMs", () => {
  it("is the time since the start, and never negative", () => {
    expect(elapsedMs(1000, 4500)).toBe(3500);
    expect(elapsedMs(5000, 4000)).toBe(0);
  });
});

describe("plannedMsAt", () => {
  it("sums the minutes of the slides before the current one", () => {
    expect(plannedMsAt(SLIDES, 0)).toBe(0);
    expect(plannedMsAt(SLIDES, 1)).toBe(30_000);
    expect(plannedMsAt(SLIDES, 2)).toBe(120_000);
    expect(plannedMsAt(SLIDES, 3)).toBe(120_000);
    expect(plannedMsAt(SLIDES, 4)).toBe(240_000);
  });

  it("clamps an index past the end or below zero", () => {
    expect(plannedMsAt(SLIDES, 99)).toBe(240_000);
    expect(plannedMsAt(SLIDES, -3)).toBe(0);
  });
});

describe("pace", () => {
  it("is ahead when the talk used less than the plan allows", () => {
    expect(pace(120_000, 40_000)).toEqual({ deltaMs: 80_000, side: "ahead" });
  });

  it("is behind when it used more", () => {
    expect(pace(120_000, 165_000)).toEqual({
      deltaMs: -45_000,
      side: "behind",
    });
  });

  it("is on pace within 15 seconds either way, and not at 15.001", () => {
    expect(pace(60_000, 60_000).side).toBe("on");
    expect(pace(60_000, 60_000 + ON_PACE_MS).side).toBe("on");
    expect(pace(60_000, 60_000 - ON_PACE_MS).side).toBe("on");
    expect(pace(60_000, 60_000 + ON_PACE_MS + 1).side).toBe("behind");
    expect(pace(60_000, 60_000 - ON_PACE_MS - 1).side).toBe("ahead");
  });
});

describe("paceTone", () => {
  it("is spring while ahead or on pace", () => {
    expect(paceTone(pace(100_000, 0))).toBe("spring");
    expect(paceTone(pace(100_000, 110_000))).toBe("spring");
  });

  it("is plain up to a minute behind and a warning past it", () => {
    expect(paceTone(pace(0, 30_000))).toBe("plain");
    expect(paceTone(pace(0, WARN_BEHIND_MS))).toBe("plain");
    expect(paceTone(pace(0, WARN_BEHIND_MS + 1))).toBe("signal");
  });
});

describe("formatClock", () => {
  it.each([
    [0, "00:00"],
    [59_999, "00:59"],
    [60_000, "01:00"],
    [599_000, "09:59"],
    [3_599_000, "59:59"],
    [6_000_000, "100:00"],
    [-1000, "−00:01"],
    [-599_000, "−09:59"],
    [-400, "00:00"],
  ])("writes %i ms as %s", (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});

describe("formatPace", () => {
  it("writes the side in words, with no leading zero in the minutes", () => {
    expect(formatPace(pace(120_000, 40_000))).toBe("+1:20 ahead");
    expect(formatPace(pace(120_000, 165_000))).toBe("−0:45 behind");
    expect(formatPace(pace(3_600_000, 1_000))).toBe("+59:59 ahead");
    expect(formatPace(pace(0, 3_599_000))).toBe("−59:59 behind");
  });

  it("says on pace inside the band", () => {
    expect(formatPace(pace(60_000, 65_000))).toBe("On pace");
  });
});

describe("msToNextSecond", () => {
  it("counts to the next whole second, a full second on the boundary", () => {
    expect(msToNextSecond(1_700_000_000_250)).toBe(750);
    expect(msToNextSecond(1_700_000_000_000)).toBe(1000);
    expect(msToNextSecond(999)).toBe(1);
  });
});
