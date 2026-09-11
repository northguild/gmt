/// <reference types="vitest/globals" />

import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  INTERVAL_OPERATIONS,
  RELATIONSHIP_PRESETS,
  FIXED_YEAR_SCALE,
  TIMELINE_END,
  TIMELINE_START,
  createTimelineScale,
  fitTimelineScale,
  buildRelationshipPreset,
  classifyRelationship,
  formatInstant,
  formatInterval,
  formatIntervalList,
  instantToPercent,
  percentToInstant,
  stepInstant,
  type ZonedInterval,
} from "../lib/interval-visualizer";

// ---------------------------------------------------------------------------
// instantToPercent / percentToInstant
// ---------------------------------------------------------------------------

describe("instantToPercent", () => {
  it("maps the timeline start to 0%", () => {
    expect(instantToPercent(TIMELINE_START)).toBe(0);
  });

  it("maps the timeline end to 100%", () => {
    expect(instantToPercent(TIMELINE_END)).toBe(100);
  });

  it("maps a midyear date to roughly 50%", () => {
    expect(instantToPercent("2024-07-02T00:00:00+00:00[UTC]")).toBeCloseTo(
      50,
      0,
    );
  });

  it("clamps values outside the window", () => {
    expect(instantToPercent("2023-01-01T00:00:00+00:00[UTC]")).toBe(0);
    expect(instantToPercent("2025-01-01T00:00:00+00:00[UTC]")).toBe(100);
  });

  it("returns NaN for unparseable input", () => {
    expect(instantToPercent("not a date")).toBeNaN();
  });
});

describe("percentToInstant", () => {
  it("round-trips 0% and 100% to the timeline bounds", () => {
    expect(percentToInstant(0)).toBe(TIMELINE_START);
    expect(percentToInstant(100)).toBe(TIMELINE_END);
  });

  it("clamps out-of-range percentages", () => {
    expect(percentToInstant(-50)).toBe(TIMELINE_START);
    expect(percentToInstant(150)).toBe(TIMELINE_END);
  });

  it("snaps to whole days by default", () => {
    const result = percentToInstant(33);
    expect(result).toMatch(/T00:00:00\+00:00\[UTC\]$/);
  });
});

describe("stepInstant", () => {
  it("steps forward and backward by whole days", () => {
    expect(stepInstant("2024-06-15T00:00:00+00:00[UTC]", 1)).toBe(
      "2024-06-16T00:00:00+00:00[UTC]",
    );
    expect(stepInstant("2024-06-15T00:00:00+00:00[UTC]", -1)).toBe(
      "2024-06-14T00:00:00+00:00[UTC]",
    );
  });

  it("clamps at the timeline end", () => {
    expect(stepInstant(TIMELINE_END, 30)).toBe(TIMELINE_END);
  });

  it("clamps at the timeline start", () => {
    expect(stepInstant(TIMELINE_START, -30)).toBe(TIMELINE_START);
  });

  it("returns the input unchanged for unparseable input", () => {
    expect(stepInstant("garbage", 1)).toBe("garbage");
  });
});

// ---------------------------------------------------------------------------
// RELATIONSHIP_PRESETS / buildRelationshipPreset
// ---------------------------------------------------------------------------

describe("RELATIONSHIP_PRESETS", () => {
  it("has exactly 5 presets", () => {
    expect(RELATIONSHIP_PRESETS).toHaveLength(5);
  });

  it("every preset has a non-empty label and description", () => {
    for (const preset of RELATIONSHIP_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

describe("buildRelationshipPreset", () => {
  it.each(RELATIONSHIP_PRESETS.map((p) => p.type))(
    "'%s' produces two intervals whose endpoints parse and whose starts precede their ends",
    (type) => {
      const { aStart, aEnd, bStart, bEnd } = buildRelationshipPreset(type);
      expect(instantToPercent(aStart)).not.toBeNaN();
      expect(instantToPercent(aEnd)).not.toBeNaN();
      expect(instantToPercent(bStart)).not.toBeNaN();
      expect(instantToPercent(bEnd)).not.toBeNaN();
      expect(instantToPercent(aStart)).toBeLessThanOrEqual(
        instantToPercent(aEnd),
      );
      expect(instantToPercent(bStart)).toBeLessThanOrEqual(
        instantToPercent(bEnd),
      );
    },
  );

  it("actually produces the relationship its name promises", () => {
    for (const preset of RELATIONSHIP_PRESETS) {
      const { aStart, aEnd, bStart, bEnd } = buildRelationshipPreset(
        preset.type,
      );
      const kind = classifyRelationship(
        { start: aStart, end: aEnd },
        { start: bStart, end: bEnd },
      );
      expect(kind).toBe(preset.type);
    }
  });
});

// ---------------------------------------------------------------------------
// classifyRelationship
// ---------------------------------------------------------------------------

describe("classifyRelationship", () => {
  const A: ZonedInterval = {
    start: "2024-01-01T00:00:00+00:00[UTC]",
    end: "2024-06-30T00:00:00+00:00[UTC]",
  };

  it("classifies identical intervals", () => {
    expect(classifyRelationship(A, { ...A })).toBe("identical");
  });

  it("classifies disjoint intervals", () => {
    const b: ZonedInterval = {
      start: "2024-08-01T00:00:00+00:00[UTC]",
      end: "2024-09-01T00:00:00+00:00[UTC]",
    };
    expect(classifyRelationship(A, b)).toBe("disjoint");
  });

  it("classifies adjacent (touching, non-overlapping) intervals both ways", () => {
    const bAfter: ZonedInterval = {
      start: A.end,
      end: "2024-09-01T00:00:00+00:00[UTC]",
    };
    expect(classifyRelationship(A, bAfter)).toBe("adjacent");

    const bBefore: ZonedInterval = {
      start: "2023-06-01T00:00:00+00:00[UTC]",
      end: A.start,
    };
    expect(classifyRelationship(A, bBefore)).toBe("adjacent");
  });

  it("classifies containment in both directions", () => {
    const bInside: ZonedInterval = {
      start: "2024-02-01T00:00:00+00:00[UTC]",
      end: "2024-03-01T00:00:00+00:00[UTC]",
    };
    expect(classifyRelationship(A, bInside)).toBe("a-contains-b");
    expect(classifyRelationship(bInside, A)).toBe("b-contains-a");
  });

  it("classifies containment that shares a boundary as containment, not adjacent", () => {
    const bSharesStart: ZonedInterval = {
      start: A.start,
      end: "2024-03-01T00:00:00+00:00[UTC]",
    };
    expect(classifyRelationship(A, bSharesStart)).toBe("a-contains-b");
  });

  it("classifies partial overlap", () => {
    const b: ZonedInterval = {
      start: "2024-04-01T00:00:00+00:00[UTC]",
      end: "2024-12-31T00:00:00+00:00[UTC]",
    };
    expect(classifyRelationship(A, b)).toBe("overlapping");
  });

  it("classifies a reversed interval as invalid", () => {
    const reversed: ZonedInterval = { start: A.end, end: A.start };
    expect(classifyRelationship(A, reversed)).toBe("invalid");
  });

  it("classifies unparseable input as invalid", () => {
    expect(
      classifyRelationship(A, { start: "garbage", end: "also garbage" }),
    ).toBe("invalid");
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe("formatInstant", () => {
  it("formats a whole-second instant with no fractional suffix", () => {
    expect(formatInstant("2024-01-01T00:00:00+00:00[UTC]")).toBe(
      "2024-01-01 00:00:00",
    );
  });

  it("formats and trims a nanosecond-precision boundary", () => {
    expect(formatInstant("2024-06-01T11:59:59.999999999+00:00[UTC]")).toBe(
      "2024-06-01 11:59:59.999999999",
    );
    expect(formatInstant("2024-07-01T13:00:00.000000001+00:00[UTC]")).toBe(
      "2024-07-01 13:00:00.000000001",
    );
  });

  it("returns the raw input for unparseable strings", () => {
    expect(formatInstant("garbage")).toBe("garbage");
  });
});

describe("formatInterval / formatIntervalList", () => {
  it("formats a single interval as 'start → end'", () => {
    const v: ZonedInterval = {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-06-30T00:00:00+00:00[UTC]",
    };
    expect(formatInterval(v)).toBe("2024-01-01 00:00:00 → 2024-06-30 00:00:00");
  });

  it("returns '' for null", () => {
    expect(formatInterval(null)).toBe("");
  });

  it("joins a list of intervals with newlines", () => {
    const list: ZonedInterval[] = [
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-03-01T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-09-01T00:00:00+00:00[UTC]",
        end: "2024-12-31T00:00:00+00:00[UTC]",
      },
    ];
    expect(formatIntervalList(list)).toBe(
      "2024-01-01 00:00:00 → 2024-03-01 00:00:00\n2024-09-01 00:00:00 → 2024-12-31 00:00:00",
    );
  });

  it("returns '' for an empty list", () => {
    expect(formatIntervalList([])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// INTERVAL_OPERATIONS
// ---------------------------------------------------------------------------

describe("INTERVAL_OPERATIONS", () => {
  it("has exactly the 4 operations required by DOX-B2c's Definition of Done", () => {
    expect(INTERVAL_OPERATIONS.map((o) => o.id)).toEqual([
      "intersection",
      "union",
      "difference",
      "xor",
    ]);
  });

  it("flags difference and xor as array-returning, intersection and union as not", () => {
    const byId = Object.fromEntries(
      INTERVAL_OPERATIONS.map((o) => [o.id, o.isArray]),
    );
    expect(byId.intersection).toBe(false);
    expect(byId.union).toBe(false);
    expect(byId.difference).toBe(true);
    expect(byId.xor).toBe(true);
  });

  it("every operation names a real exported gmt function", () => {
    for (const op of INTERVAL_OPERATIONS) {
      expect(op.fnName.startsWith("interval")).toBe(true);
      expect(op.fnName.endsWith("Zoned")).toBe(true);
    }
  });
});

/**
 * A zone-only ZonedDateTime — no offset — is valid, and this module used to
 * reject it silently.
 *
 * `isValidZonedDateTime("2024-03-01T09:00:00[UTC]")` is true: the zone
 * determines the offset. But `Temporal.Instant.from` requires an unambiguous
 * offset and throws on it, so every helper here that reached for `Instant.from`
 * returned NaN or "invalid" for input the widget had just validated as good.
 * A reader typing that string saw an empty timeline and a false claim that one
 * of their intervals was reversed.
 */
describe("zoned strings without an explicit offset", () => {
  const NO_OFFSET = "2024-03-01T09:00:00[UTC]";
  const WITH_OFFSET = "2024-03-01T09:00:00+00:00[UTC]";

  it("places a zone-only value at the same point as its offset-bearing twin", () => {
    expect(instantToPercent(NO_OFFSET)).toBeCloseTo(
      instantToPercent(WITH_OFFSET),
      10,
    );
    expect(Number.isNaN(instantToPercent(NO_OFFSET))).toBe(false);
  });

  it("classifies a relationship built from zone-only values", () => {
    expect(
      classifyRelationship(
        { start: "2024-03-01T09:00:00[UTC]", end: "2024-06-01T09:00:00[UTC]" },
        { start: "2024-05-01T09:00:00[UTC]", end: "2024-08-01T09:00:00[UTC]" },
      ),
    ).toBe("overlapping");
  });

  it("does not call a forward interval reversed", () => {
    // The exact false report a reader hit.
    expect(
      classifyRelationship(
        { start: "2024-03-01T09:00:00[UTC]", end: "2024-06-01T11:00:00[UTC]" },
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-12-31T00:00:00+00:00[UTC]",
        },
      ),
    ).not.toBe("invalid");
  });

  it("still reports genuinely reversed intervals as invalid", () => {
    expect(
      classifyRelationship(
        { start: "2024-06-01T09:00:00[UTC]", end: "2024-03-01T09:00:00[UTC]" },
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-12-31T00:00:00+00:00[UTC]",
        },
      ),
    ).toBe("invalid");
  });

  it("still reports unparseable input as invalid", () => {
    expect(Number.isNaN(instantToPercent("not a date"))).toBe(true);
    expect(
      classifyRelationship(
        { start: "nonsense", end: "also nonsense" },
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-12-31T00:00:00+00:00[UTC]",
        },
      ),
    ).toBe("invalid");
  });

  it("formats and steps a zone-only value", () => {
    expect(formatInstant(NO_OFFSET)).toBe(formatInstant(WITH_OFFSET));
    expect(stepInstant(NO_OFFSET, 1)).toBe(stepInstant(WITH_OFFSET, 1));
  });
});

// ---------------------------------------------------------------------------
// TimelineScale
// ---------------------------------------------------------------------------

describe("FIXED_YEAR_SCALE", () => {
  /* This canvas is what the five relationship presets are composed against, and
     what the three reference pages render. It has to stay exactly where the old
     module-level constants put it — a drift of even a fraction of a percent
     moves every bar on every built page. */
  it("agrees with the standalone helpers to the last digit", () => {
    for (const preset of RELATIONSHIP_PRESETS) {
      const v = buildRelationshipPreset(preset.type);
      for (const key of ["aStart", "aEnd", "bStart", "bEnd"] as const) {
        expect(
          FIXED_YEAR_SCALE.toPercent(v[key]),
          `${preset.type}.${key}`,
        ).toBe(instantToPercent(v[key]));
      }
    }
  });

  it("reproduces the axis labels the template ships with", () => {
    // The template's static markup reads Jan 2024 / Jul / Dec. If this ever
    // disagrees, the built pages change the moment the axis is rendered.
    expect(FIXED_YEAR_SCALE.labels()).toEqual(["Jan 2024", "Jul", "Dec"]);
  });

  it("keeps the one-day step the keyboard and drag paths had before", () => {
    expect(FIXED_YEAR_SCALE.snapMinutes).toBe(1440);
    expect(FIXED_YEAR_SCALE.fromPercent(0)).toBe(TIMELINE_START);
    expect(FIXED_YEAR_SCALE.fromPercent(100)).toBe(TIMELINE_END);
  });
});

describe("fitTimelineScale", () => {
  const MEETINGS = [
    "2024-03-15T09:00:00+00:00[Europe/London]",
    "2024-03-15T11:00:00+00:00[Europe/London]",
    "2024-03-15T10:00:00+00:00[Europe/London]",
    "2024-03-15T12:00:00+00:00[Europe/London]",
  ];

  /* The regression this whole abstraction exists for: three hours is 0.02% of a
     calendar year, so on the fixed canvas all four handles land on one pixel. */
  it("turns a three-hour span into a readable one, not a sliver", () => {
    expect(
      instantToPercent(MEETINGS[1]!) - instantToPercent(MEETINGS[0]!),
    ).toBeLessThan(0.05);

    const fitted = fitTimelineScale(MEETINGS)!;
    expect(
      fitted.toPercent(MEETINGS[1]!) - fitted.toPercent(MEETINGS[0]!),
    ).toBeGreaterThan(25);
  });

  it("keeps the whole span on the canvas with room to drag at both ends", () => {
    const fitted = fitTimelineScale(MEETINGS)!;
    const pcts = MEETINGS.map((m) => fitted.toPercent(m));
    expect(Math.min(...pcts)).toBeGreaterThan(0);
    expect(Math.max(...pcts)).toBeLessThan(100);
  });

  it("preserves the relationship it is drawing", () => {
    // A 09-11, B 10-12 partially overlap; the shared middle is 10-11.
    const f = fitTimelineScale(MEETINGS)!;
    const [aStart, aEnd, bStart, bEnd] = MEETINGS.map((m) => f.toPercent(m));
    expect(aStart!).toBeLessThan(bStart!);
    expect(bStart!).toBeLessThan(aEnd!);
    expect(aEnd!).toBeLessThan(bEnd!);
  });

  it("drops to a step a reader can actually scrub with", () => {
    // One day per arrow press on a three-hour canvas is unusable.
    expect(fitTimelineScale(MEETINGS)!.snapMinutes).toBe(1);
  });

  it("labels a sub-day canvas with clock time, not month names", () => {
    expect(fitTimelineScale(MEETINGS)!.labels()).toEqual([
      "08:42",
      "10:30",
      "12:18",
    ]);
  });

  it("returns null when there is too little to fit, so the caller keeps its canvas", () => {
    expect(fitTimelineScale([])).toBeNull();
    expect(fitTimelineScale(["nonsense", "also nonsense"])).toBeNull();
    expect(fitTimelineScale([TIMELINE_START, "nonsense"])).toBeNull();
  });

  it("still produces a canvas with width when every instant is identical", () => {
    const fitted = fitTimelineScale([TIMELINE_START, TIMELINE_START])!;
    expect(fitted.endMs).toBeGreaterThan(fitted.startMs);
    expect(fitted.toPercent(TIMELINE_START)).toBe(50);
  });

  it("ignores an unparseable field rather than refusing to fit the rest", () => {
    const fitted = fitTimelineScale([...MEETINGS.slice(0, 3), "garbage"]);
    expect(fitted).not.toBeNull();
    expect(fitted!.toPercent(MEETINGS[0]!)).toBeGreaterThan(0);
  });
});

describe("createTimelineScale label granularity", () => {
  const at = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;

  it("uses day-and-month across a week", () => {
    const scale = createTimelineScale(
      at("2024-03-11T00:00:00Z"),
      at("2024-03-18T00:00:00Z"),
    );
    expect(scale.labels()).toEqual(["11 Mar", "14 Mar", "18 Mar"]);
  });

  it("uses month names across a quarter", () => {
    const scale = createTimelineScale(
      at("2024-01-01T00:00:00Z"),
      at("2024-06-01T00:00:00Z"),
    );
    expect(scale.labels()).toEqual(["Jan 2024", "Mar", "Jun"]);
  });
});
