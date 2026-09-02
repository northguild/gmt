/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import {
  INTERVAL_OPERATIONS,
  RELATIONSHIP_PRESETS,
  TIMELINE_END,
  TIMELINE_START,
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
    expect(instantToPercent("2024-07-02T00:00:00+00:00[UTC]")).toBeCloseTo(50, 0);
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
    expect(stepInstant("2024-06-15T00:00:00+00:00[UTC]", 1)).toBe("2024-06-16T00:00:00+00:00[UTC]");
    expect(stepInstant("2024-06-15T00:00:00+00:00[UTC]", -1)).toBe("2024-06-14T00:00:00+00:00[UTC]");
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
      expect(instantToPercent(aStart)).toBeLessThanOrEqual(instantToPercent(aEnd));
      expect(instantToPercent(bStart)).toBeLessThanOrEqual(instantToPercent(bEnd));
    },
  );

  it("actually produces the relationship its name promises", () => {
    for (const preset of RELATIONSHIP_PRESETS) {
      const { aStart, aEnd, bStart, bEnd } = buildRelationshipPreset(preset.type);
      const kind = classifyRelationship({ start: aStart, end: aEnd }, { start: bStart, end: bEnd });
      expect(kind).toBe(preset.type);
    }
  });
});

// ---------------------------------------------------------------------------
// classifyRelationship
// ---------------------------------------------------------------------------

describe("classifyRelationship", () => {
  const A: ZonedInterval = { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T00:00:00+00:00[UTC]" };

  it("classifies identical intervals", () => {
    expect(classifyRelationship(A, { ...A })).toBe("identical");
  });

  it("classifies disjoint intervals", () => {
    const b: ZonedInterval = { start: "2024-08-01T00:00:00+00:00[UTC]", end: "2024-09-01T00:00:00+00:00[UTC]" };
    expect(classifyRelationship(A, b)).toBe("disjoint");
  });

  it("classifies adjacent (touching, non-overlapping) intervals both ways", () => {
    const bAfter: ZonedInterval = { start: A.end, end: "2024-09-01T00:00:00+00:00[UTC]" };
    expect(classifyRelationship(A, bAfter)).toBe("adjacent");

    const bBefore: ZonedInterval = { start: "2023-06-01T00:00:00+00:00[UTC]", end: A.start };
    expect(classifyRelationship(A, bBefore)).toBe("adjacent");
  });

  it("classifies containment in both directions", () => {
    const bInside: ZonedInterval = { start: "2024-02-01T00:00:00+00:00[UTC]", end: "2024-03-01T00:00:00+00:00[UTC]" };
    expect(classifyRelationship(A, bInside)).toBe("a-contains-b");
    expect(classifyRelationship(bInside, A)).toBe("b-contains-a");
  });

  it("classifies containment that shares a boundary as containment, not adjacent", () => {
    const bSharesStart: ZonedInterval = { start: A.start, end: "2024-03-01T00:00:00+00:00[UTC]" };
    expect(classifyRelationship(A, bSharesStart)).toBe("a-contains-b");
  });

  it("classifies partial overlap", () => {
    const b: ZonedInterval = { start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-12-31T00:00:00+00:00[UTC]" };
    expect(classifyRelationship(A, b)).toBe("overlapping");
  });

  it("classifies a reversed interval as invalid", () => {
    const reversed: ZonedInterval = { start: A.end, end: A.start };
    expect(classifyRelationship(A, reversed)).toBe("invalid");
  });

  it("classifies unparseable input as invalid", () => {
    expect(classifyRelationship(A, { start: "garbage", end: "also garbage" })).toBe("invalid");
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe("formatInstant", () => {
  it("formats a whole-second instant with no fractional suffix", () => {
    expect(formatInstant("2024-01-01T00:00:00+00:00[UTC]")).toBe("2024-01-01 00:00:00");
  });

  it("formats and trims a nanosecond-precision boundary", () => {
    expect(formatInstant("2024-06-01T11:59:59.999999999+00:00[UTC]")).toBe("2024-06-01 11:59:59.999999999");
    expect(formatInstant("2024-07-01T13:00:00.000000001+00:00[UTC]")).toBe("2024-07-01 13:00:00.000000001");
  });

  it("returns the raw input for unparseable strings", () => {
    expect(formatInstant("garbage")).toBe("garbage");
  });
});

describe("formatInterval / formatIntervalList", () => {
  it("formats a single interval as 'start → end'", () => {
    const v: ZonedInterval = { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T00:00:00+00:00[UTC]" };
    expect(formatInterval(v)).toBe("2024-01-01 00:00:00 → 2024-06-30 00:00:00");
  });

  it("returns '' for null", () => {
    expect(formatInterval(null)).toBe("");
  });

  it("joins a list of intervals with newlines", () => {
    const list: ZonedInterval[] = [
      { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-03-01T00:00:00+00:00[UTC]" },
      { start: "2024-09-01T00:00:00+00:00[UTC]", end: "2024-12-31T00:00:00+00:00[UTC]" },
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
    expect(INTERVAL_OPERATIONS.map((o) => o.id)).toEqual(["intersection", "union", "difference", "xor"]);
  });

  it("flags difference and xor as array-returning, intersection and union as not", () => {
    const byId = Object.fromEntries(INTERVAL_OPERATIONS.map((o) => [o.id, o.isArray]));
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
