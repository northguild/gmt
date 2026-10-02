/// <reference types="vitest/globals" />
/**
 * `punctuality-widgets.ts`'s pure helpers. Every expected literal that a
 * library call produces is an appendix Z row or a JSDoc example.
 */
import {
  callArgs,
  epochMs,
  formatValue,
  isoToMinutes,
  minuteTicks,
  minutesToIso,
  niceMinutes,
  placeLabels,
  segmentHitsRect,
  writeLike,
  zoneOf,
  signedText,
  spokenMinutes,
  stepMinutesFor,
  toleranceText,
  TIMESTAMP_CLASSES,
  PUNCTUALITY_LABELS,
  wallAsUtc,
  writtenLabel,
  writtenParts,
  writtenTime,
  heroLinesHtml,
  settledAnnouncer,
} from "./punctuality-widgets";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("minutesToIso", () => {
  it.each([
    [0, "PT0S"],
    [15, "PT15M"],
    [60, "PT1H"],
    [90, "PT1H30M"],
    [1440, "PT24H"],
  ])("%i minutes is %s", (minutes, iso) => {
    expect(minutesToIso(minutes)).toBe(iso);
  });

  it("clamps a negative to zero and rounds a fraction", () => {
    expect(minutesToIso(-5)).toBe("PT0S");
    expect(minutesToIso(14.6)).toBe("PT15M");
  });
});

describe("isoToMinutes", () => {
  it("reads a day as 24 hours with no reference point", () => {
    expect(isoToMinutes("P1D")).toBe(1440);
  });

  it("keeps seconds as a fraction of a minute", () => {
    expect(isoToMinutes("PT14M59S")).toBeCloseTo(14.9833, 3);
  });

  it("negates a leading minus", () => {
    expect(isoToMinutes("-PT36H")).toBe(-2160);
  });

  it("is null for weeks, months, years, junk and blank", () => {
    expect(isoToMinutes("P1W")).toBeNull();
    expect(isoToMinutes("P1M")).toBeNull();
    expect(isoToMinutes("P1Y")).toBeNull();
    expect(isoToMinutes("x")).toBeNull();
    expect(isoToMinutes("")).toBeNull();
  });
});

describe("signedText", () => {
  it.each([
    ["PT15M", "+15 min"],
    ["-PT3M", "−3 min"],
    ["PT0S", "0 min"],
    ["PT1H35M", "+1 h 35 min"],
    ["-PT36H", "−36 h"],
    ["PT14M59S", "+14 min 59 s"],
    ["", ""],
  ])("%s reads %s", (iso, text) => {
    expect(signedText(iso)).toBe(text);
  });
});

describe("toleranceText and spokenMinutes", () => {
  it("words a tolerance as the reader typed it", () => {
    expect(toleranceText("PT15M")).toBe("15 min");
    expect(toleranceText("PT1H30M")).toBe("1 h 30 min");
    expect(toleranceText("P1D")).toBe("24 h");
    expect(toleranceText("PT0S")).toBe("0 min");
  });

  it("returns text that is not a duration as typed", () => {
    expect(toleranceText("P1W")).toBe("P1W");
    expect(toleranceText("15 min")).toBe("15 min");
  });

  it("speaks a length", () => {
    expect(spokenMinutes(0)).toBe("0 minutes");
    expect(spokenMinutes(1)).toBe("1 minute");
    expect(spokenMinutes(15)).toBe("15 minutes");
    expect(spokenMinutes(60)).toBe("1 hour");
    expect(spokenMinutes(90)).toBe("1 hour 30 minutes");
    expect(spokenMinutes(1440)).toBe("24 hours");
  });
});

describe("writtenParts, writtenLabel, writtenTime", () => {
  it("reads an impossible time as unparseable, like an impossible date", () => {
    for (const s of [
      "2024-06-15T25:61:00+02:00",
      "2024-06-15T24:00:00+02:00",
      "2024-06-15T12:60:00+02:00",
    ]) {
      expect(writtenParts(s)).toEqual({
        date: "",
        weekday: "",
        time: "",
        offset: "",
        zone: "",
      });
      expect(writtenLabel(s)).not.toMatch(/25:61|24:00|12:60/);
    }
  });

  it("reads a zoned string through localParts", () => {
    const s = "2024-06-14T09:15:00+01:00[Europe/London]";
    expect(writtenParts(s)).toEqual({
      date: "2024-06-14",
      weekday: "Fri",
      time: "09:15",
      offset: "+01:00",
      zone: "Europe/London",
    });
    expect(writtenLabel(s)).toBe("Fri 14 Jun 09:15");
    expect(writtenTime(s)).toBe("09:15");
  });

  it("reads a Z instant as written", () => {
    expect(writtenParts("2024-06-15T13:00:00Z")).toEqual({
      date: "2024-06-15",
      weekday: "Sat",
      time: "13:00",
      offset: "Z",
      zone: "",
    });
    expect(writtenLabel("2024-06-15T13:00:00Z")).toBe("Sat 15 Jun 13:00");
  });

  it("reads a numeric offset as written", () => {
    expect(writtenParts("2024-06-15T06:20:00+02:00")).toMatchObject({
      time: "06:20",
      offset: "+02:00",
      zone: "",
    });
    expect(writtenTime("2024-06-15T06:20:00+02:00")).toBe("06:20");
  });

  it("shows seconds only when non-zero", () => {
    expect(writtenTime("2024-06-15T06:20:30Z")).toBe("06:20:30");
  });

  it("is all empty when the text does not parse", () => {
    expect(writtenParts("soon")).toEqual({
      date: "",
      weekday: "",
      time: "",
      offset: "",
      zone: "",
    });
    expect(writtenLabel("soon")).toBe("");
    expect(writtenTime("2024-06-15T10:00:00")).toBe("");
  });

  it("is all empty, and does not throw, for an impossible date in a zoned string", () => {
    const blank = { date: "", weekday: "", time: "", offset: "", zone: "" };
    for (const s of [
      "2024-06-31T10:05:00+03:00[Europe/Helsinki]",
      "2024-02-30T08:00:00+00:00[Europe/London]",
      "2023-02-29T08:00:00+00:00[Europe/London]",
    ]) {
      expect(writtenParts(s)).toEqual(blank);
      expect(writtenLabel(s)).toBe("");
      expect(writtenTime(s)).toBe("");
    }
  });
});

describe("wallAsUtc", () => {
  it("keeps the wall time and writes it as UTC", () => {
    expect(wallAsUtc("2024-11-03T01:30:00-05:00[America/New_York]")).toBe(
      "2024-11-03T01:30:00Z",
    );
    expect(wallAsUtc("2024-06-14T09:00:00+01:00[Europe/London]")).toBe(
      "2024-06-14T09:00:00Z",
    );
  });

  it("is empty with no date-time part", () => {
    expect(wallAsUtc("soon")).toBe("");
    expect(wallAsUtc("")).toBe("");
  });
});

describe("formatValue", () => {
  it("prints the PB1 rate as the JSDoc does", () => {
    expect(formatValue({ onTime: 4, total: 6, rate: 0.6666666666666666 })).toBe(
      "{ onTime: 4, total: 6, rate: 0.6666666666666666 }",
    );
  });

  it("prints the ED1 report with its null", () => {
    expect(
      formatValue({
        exceedsTolerance: true,
        revisions: 3,
        drift: "PT9H",
        last: "2024-06-20T17:00:00Z",
        first: "2024-06-20T08:00:00Z",
      }),
    ).toBe(
      '{ first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }',
    );
    expect(
      formatValue({
        first: "a",
        last: "b",
        drift: "PT25M",
        revisions: 2,
        exceedsTolerance: null,
      }),
    ).toBe(
      '{ first: "a", last: "b", drift: "PT25M", revisions: 2, exceedsTolerance: null }',
    );
  });

  it("prints the ED2 classified pick at-first", () => {
    expect(formatValue({ classifier: "ACT", at: "2024-06-15T12:52:00Z" })).toBe(
      '{ at: "2024-06-15T12:52:00Z", classifier: "ACT" }',
    );
  });

  it("prints null, a string and a list", () => {
    expect(formatValue(null)).toBe("null");
    expect(formatValue("PT15M")).toBe('"PT15M"');
    expect(formatValue(["a", "b"])).toBe('["a", "b"]');
  });

  it("omits an undefined key and keeps an unknown one", () => {
    expect(formatValue({ late: "PT15M", early: undefined })).toBe(
      '{ late: "PT15M" }',
    );
    expect(formatValue({ late: "PT15M", extra: 1 })).toBe(
      '{ late: "PT15M", extra: 1 }',
    );
  });

  it("orders an event and a headway row by shape", () => {
    expect(formatValue({ recordedAt: "r", at: "a", classifier: "EST" })).toBe(
      '{ classifier: "EST", at: "a", recordedAt: "r" }',
    );
    expect(formatValue({ to: "t", from: "f", headway: "PT20M" })).toBe(
      '{ headway: "PT20M", from: "f", to: "t" }',
    );
  });
});

describe("callArgs", () => {
  it("prints a pairs array and a tolerance as the JSDoc does", () => {
    const [html, plain] = callArgs([
      [
        {
          actual: "2024-06-14T09:15:00+01:00[Europe/London]",
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
        },
      ],
      { early: undefined, late: "PT15M" },
    ]);
    expect(plain).toBe(
      '[{ planned: "2024-06-14T09:00:00+01:00[Europe/London]", actual: "2024-06-14T09:15:00+01:00[Europe/London]" }], { late: "PT15M" }',
    );
    expect(html).toContain('<span class="gmt-code-str">');
    expect(html.replace(/<[^>]+>/g, "")).toBe(plain.replace(/&/g, "&amp;"));
  });

  it("prints a string argument and an options object", () => {
    const [, plain] = callArgs([
      "2024-06-15T06:12:00Z",
      { minimumConnection: "PT10M" },
    ]);
    expect(plain).toBe(
      '"2024-06-15T06:12:00Z", { minimumConnection: "PT10M" }',
    );
  });
});

describe("niceMinutes", () => {
  it.each([
    [1, 5],
    [5, 5],
    [18, 20],
    [36, 45],
    [1440, 1440],
    [10080, 10080],
  ])("%i rounds up to %i", (m, nice) => {
    expect(niceMinutes(m)).toBe(nice);
  });

  it("rounds past a week up to whole days", () => {
    expect(niceMinutes(10081)).toBe(11520);
  });
});

describe("stepMinutesFor", () => {
  it("steps by 1, 15 or 60 as the axis grows", () => {
    expect(stepMinutesFor(30)).toBe(1);
    expect(stepMinutesFor(180)).toBe(1);
    expect(stepMinutesFor(181)).toBe(15);
    expect(stepMinutesFor(2880)).toBe(15);
    expect(stepMinutesFor(2881)).toBe(60);
  });
});

describe("minuteTicks", () => {
  it("walks exact-minute ticks aligned to the local hour", () => {
    const start = epochMs("2024-06-15T04:10:00Z");
    const end = epochMs("2024-06-15T05:10:00Z");
    expect(
      minuteTicks(start, end, "Europe/Amsterdam", 20).map((t) => t.label),
    ).toEqual(["06:20", "06:40", "07:00"]);
  });

  it("is empty for a backwards window", () => {
    expect(minuteTicks(10, 5, "UTC", 20)).toEqual([]);
  });
});

describe("constants", () => {
  it("lists DCSA's four classes and the three punctuality words", () => {
    expect(TIMESTAMP_CLASSES.map((c) => c.code)).toEqual([
      "PLN",
      "EST",
      "REQ",
      "ACT",
    ]);
    expect(PUNCTUALITY_LABELS).toEqual({
      early: "early",
      onTime: "on time",
      late: "late",
    });
  });
});

describe("placeLabels", () => {
  it("puts a label to the right of its mark when there is room", () => {
    expect(placeLabels([{ x: 20, y: 50, w: 40, h: 16 }], 300, 200)).toEqual([
      { left: 29, top: 42 },
    ]);
  });

  it("flips to the left near the right edge", () => {
    expect(placeLabels([{ x: 290, y: 50, w: 40, h: 16 }], 300, 200)[0]).toEqual(
      {
        left: 241,
        top: 42,
      },
    );
  });

  it("moves a label that would cross another", () => {
    const [a, b] = placeLabels(
      [
        { x: 20, y: 50, w: 60, h: 16 },
        { x: 22, y: 52, w: 60, h: 16 },
      ],
      300,
      200,
    );
    const hit =
      a!.left < b!.left + 60 &&
      b!.left < a!.left + 60 &&
      a!.top < b!.top + 16 &&
      b!.top < a!.top + 16;
    expect(hit).toBe(false);
  });

  it("keeps a label inside the plot", () => {
    const [p] = placeLabels([{ x: 10, y: 2, w: 40, h: 16 }], 300, 100);
    expect(p!.top).toBeGreaterThanOrEqual(0);
  });
});

describe("writeLike and zoneOf", () => {
  const ams = "2024-06-15T09:00:00+02:00[Europe/Amsterdam]";
  const t0840 = epochMs("2024-06-15T08:40:00+02:00");

  it("keeps a bracketed zone", () => {
    expect(writeLike(ams, t0840)).toBe(
      "2024-06-15T08:40:00+02:00[Europe/Amsterdam]",
    );
  });

  it("keeps a numeric offset and Z", () => {
    expect(writeLike("2024-06-15T09:00:00+02:00", t0840)).toBe(
      "2024-06-15T08:40:00+02:00",
    );
    expect(writeLike("2024-06-15T09:00:00Z", t0840)).toBe(
      "2024-06-15T06:40:00Z",
    );
  });

  it("is empty when the sample does not parse", () => {
    expect(writeLike("soon", t0840)).toBe("");
  });

  it("reads the zone an axis draws in", () => {
    expect(zoneOf(ams)).toBe("Europe/Amsterdam");
    expect(zoneOf("2024-06-15T09:00:00+02:00")).toBe("+02:00");
    expect(zoneOf("2024-06-15T09:00:00Z")).toBe("UTC");
    expect(zoneOf("soon")).toBe("");
  });
});

describe("segmentHitsRect", () => {
  const box = { left: 10, top: 10, w: 20, h: 10 };

  it("is true for a segment through the box, in any direction", () => {
    expect(segmentHitsRect({ x1: 0, y1: 15, x2: 40, y2: 15 }, box)).toBe(true);
    expect(segmentHitsRect({ x1: 40, y1: 15, x2: 0, y2: 15 }, box)).toBe(true);
    expect(segmentHitsRect({ x1: 0, y1: 0, x2: 40, y2: 30 }, box)).toBe(true);
  });

  it("is true for a segment that ends inside it", () => {
    expect(segmentHitsRect({ x1: 0, y1: 15, x2: 15, y2: 15 }, box)).toBe(true);
  });

  it("is false for a segment that misses, or stops short", () => {
    expect(segmentHitsRect({ x1: 0, y1: 0, x2: 40, y2: 5 }, box)).toBe(false);
    expect(segmentHitsRect({ x1: 0, y1: 15, x2: 8, y2: 15 }, box)).toBe(false);
    expect(segmentHitsRect({ x1: 50, y1: 0, x2: 50, y2: 40 }, box)).toBe(false);
  });
});

describe("placeLabels with lines, blocked rectangles and ring-sized marks", () => {
  const rectOf = (p: { left: number; top: number }, w: number, h: number) => ({
    left: p.left,
    top: p.top,
    w,
    h,
  });
  const hitsRect = (
    a: { left: number; top: number; w: number; h: number },
    b: { left: number; top: number; w: number; h: number },
  ) =>
    a.left < b.left + b.w &&
    b.left < a.left + a.w &&
    a.top < b.top + b.h &&
    b.top < a.top + a.h;

  it("keeps a label off a rule that runs beside its anchor", () => {
    const line = { x1: 0, y1: 50, x2: 300, y2: 50 };
    const [p] = placeLabels([{ x: 100, y: 50, w: 60, h: 16 }], 300, 120, {
      markPx: 0,
      lines: [line],
    });
    expect(segmentHitsRect(line, rectOf(p!, 60, 16))).toBe(false);
  });

  it("keeps a label off a rectangle it may not cover", () => {
    const blocked = [{ left: 90, top: 28, w: 44, h: 44 }];
    const [p] = placeLabels([{ x: 100, y: 50, w: 60, h: 16 }], 300, 120, {
      markPx: 0,
      blocked,
    });
    expect(hitsRect(rectOf(p!, 60, 16), blocked[0]!)).toBe(false);
  });

  it("keeps every label off every ring and off the other labels", () => {
    const boxes = [
      { x: 150, y: 40, w: 90, h: 16 },
      { x: 152, y: 44, w: 70, h: 16 },
      { x: 148, y: 60, w: 50, h: 16 },
    ];
    const placed = placeLabels(boxes, 300, 160, { markPx: 34 });
    placed.forEach((p, i) => {
      const r = rectOf(p, boxes[i]!.w, boxes[i]!.h);
      boxes.forEach((b, j) => {
        expect(
          hitsRect(r, { left: b.x - 17, top: b.y - 17, w: 34, h: 34 }),
        ).toBe(false);
        if (j > i)
          expect(hitsRect(r, rectOf(placed[j]!, b.w, b.h))).toBe(false);
      });
    });
  });

  it("falls back to a position on a line when nothing else is clear", () => {
    const lines = [{ x1: 0, y1: 8, x2: 100, y2: 8 }];
    const [p] = placeLabels([{ x: 50, y: 8, w: 60, h: 16 }], 100, 16, {
      markPx: 0,
      lines,
    });
    expect(p).toBeDefined();
  });
});

describe("heroLinesHtml", () => {
  it("escapes the text it is given, with the shared escaper", () => {
    expect(heroLinesHtml([{ text: "a < b & c > d", sep: " & " }])).toBe(
      '<span class="gmt-punct-hero-sub"><span class="gmt-punct-hero-line">' +
        '<span class="gmt-punct-hero-sep"> &amp; </span>a &lt; b &amp; c &gt; d' +
        "</span></span>",
    );
  });
});

describe("settledAnnouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes once, after the last call has been quiet for the delay", () => {
    const el = { textContent: "" } as HTMLElement;
    const a = settledAnnouncer(el, 500);
    let n = 0;
    for (let i = 0; i < 4; i++) {
      a.say(() => `read ${++n}`);
      vi.advanceTimersByTime(200);
    }
    expect(el.textContent).toBe("");
    vi.advanceTimersByTime(300);
    expect(el.textContent).toBe("read 1");
    vi.advanceTimersByTime(5000);
    expect(el.textContent).toBe("read 1");
  });

  it("reads the text when the timer fires, not when `say` was called", () => {
    const el = { textContent: "" } as HTMLElement;
    const a = settledAnnouncer(el, 100);
    let now = "early";
    a.say(() => now);
    now = "settled";
    vi.advanceTimersByTime(100);
    expect(el.textContent).toBe("settled");
  });

  it("cancel drops a pending reading, and a missing region is a no-op", () => {
    const el = { textContent: "" } as HTMLElement;
    const a = settledAnnouncer(el, 100);
    a.say(() => "x");
    a.cancel();
    vi.advanceTimersByTime(1000);
    expect(el.textContent).toBe("");
    expect(() => settledAnnouncer(null).say(() => "x")).not.toThrow();
  });
});

describe("the punctuality sheet", () => {
  const css = readFileSync(
    fileURLToPath(
      new URL("../styles/gmt-punctuality-widgets.css", import.meta.url),
    ),
    "utf8",
  );

  it("keeps a hidden naive line's reserved height and draws nothing", () => {
    // `.gmt-punct-naive { display: block }` beats the UA `[hidden]` rule, so the
    // sheet states what hidden means: the space stays, nothing is painted.
    expect(css).toMatch(
      /\.gmt-punct-naive\[hidden\]\s*\{[^}]*visibility:\s*hidden/,
    );
    expect(css).not.toMatch(
      /\.gmt-punct-naive\[hidden\]\s*\{[^}]*display:\s*none/,
    );
  });

  it("states each table rule once", () => {
    const heads = [...css.matchAll(/^([^{}\n][^{}]*)\{/gm)].map((m) =>
      m[1]!.replace(/\s+/g, " ").trim(),
    );
    const dupes = heads.filter((h, i) => heads.indexOf(h) !== i);
    expect(dupes).toEqual([]);
  });
});
