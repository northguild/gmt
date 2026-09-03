/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import {
  VALUE_PRESETS,
  buildValuePreset,
  buildZonedValueFromMinutes,
  classifyProbeResult,
  formatMinuteOfDay,
  getTickerTickStepMinutes,
  getTickerWindow,
  isGap,
  isMinuteInZone,
  isOverlap,
  isSentinel,
  localDateAtTransition,
  localHourAtTransition,
  localMinuteOfDayAtTransition,
  minuteToTickerPercent,
  parseOffsetMinutes,
  tickerPercentToMinute,
  transitionHour,
  transitionType,
  type DstTransition,
  type TickerWindow,
} from "../lib/dst-inspector";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SPRING_FORWARD: DstTransition = {
  instant: "2024-03-10T07:00:00Z",
  offsetBefore: "-05:00",
  offsetAfter: "-04:00",
};

const FALL_BACK: DstTransition = {
  instant: "2024-11-03T06:00:00Z",
  offsetBefore: "-04:00",
  offsetAfter: "-05:00",
};

const ZONE = "America/New_York";

// ---------------------------------------------------------------------------
// parseOffsetMinutes
// ---------------------------------------------------------------------------

describe("parseOffsetMinutes", () => {
  it("parses positive offsets", () => {
    expect(parseOffsetMinutes("+00:00")).toBe(0);
    expect(parseOffsetMinutes("+05:00")).toBe(300);
    expect(parseOffsetMinutes("+05:30")).toBe(330);
    expect(parseOffsetMinutes("+12:00")).toBe(720);
  });

  it("parses negative offsets", () => {
    expect(parseOffsetMinutes("-05:00")).toBe(-300);
    expect(parseOffsetMinutes("-04:00")).toBe(-240);
    expect(parseOffsetMinutes("-09:30")).toBe(-570);
  });

  it("returns 0 for malformed input", () => {
    expect(parseOffsetMinutes("")).toBe(0);
    expect(parseOffsetMinutes("invalid")).toBe(0);
    expect(parseOffsetMinutes("05:00")).toBe(0); // missing sign
    expect(parseOffsetMinutes("+5:00")).toBe(0); // single digit hour
  });
});

// ---------------------------------------------------------------------------
// isGap / isOverlap
// ---------------------------------------------------------------------------

describe("isGap", () => {
  it("returns true for spring-forward (offset increases)", () => {
    expect(isGap(SPRING_FORWARD)).toBe(true);
  });

  it("returns false for fall-back (offset decreases)", () => {
    expect(isGap(FALL_BACK)).toBe(false);
  });
});

describe("isOverlap", () => {
  it("returns true for fall-back (offset decreases)", () => {
    expect(isOverlap(FALL_BACK)).toBe(true);
  });

  it("returns false for spring-forward (offset increases)", () => {
    expect(isOverlap(SPRING_FORWARD)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transitionType
// ---------------------------------------------------------------------------

describe("transitionType", () => {
  it("returns 'gap' for spring-forward", () => {
    expect(transitionType(SPRING_FORWARD)).toBe("gap");
  });

  it("returns 'overlap' for fall-back", () => {
    expect(transitionType(FALL_BACK)).toBe("overlap");
  });
});

// ---------------------------------------------------------------------------
// transitionHour (UTC-only, kept for backwards compatibility)
// ---------------------------------------------------------------------------

describe("transitionHour", () => {
  it("extracts the UTC hour from the instant", () => {
    expect(transitionHour(SPRING_FORWARD)).toBe(7);
    expect(transitionHour(FALL_BACK)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// localHourAtTransition (zone-aware)
// ---------------------------------------------------------------------------

describe("localHourAtTransition", () => {
  it("returns the local hour for spring-forward in America/New_York", () => {
    // 2024-03-10T07:00:00Z = 2024-03-10T03:00:00-04:00 (after transition)
    expect(localHourAtTransition(SPRING_FORWARD, ZONE)).toBe(3);
  });

  it("returns the local hour for fall-back in America/New_York", () => {
    // 2024-11-03T06:00:00Z = 2024-11-03T01:00:00-05:00 (after transition, the offset shifts back)
    expect(localHourAtTransition(FALL_BACK, ZONE)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// localDateAtTransition
// ---------------------------------------------------------------------------

describe("localDateAtTransition", () => {
  it("returns the local date for spring-forward in America/New_York", () => {
    expect(localDateAtTransition(SPRING_FORWARD, ZONE)).toBe("2024-03-10");
  });

  it("returns the local date for fall-back in America/New_York", () => {
    expect(localDateAtTransition(FALL_BACK, ZONE)).toBe("2024-11-03");
  });
});

// ---------------------------------------------------------------------------
// localMinuteOfDayAtTransition
// ---------------------------------------------------------------------------

describe("localMinuteOfDayAtTransition", () => {
  it("returns 180 (03:00) for spring-forward in America/New_York", () => {
    expect(localMinuteOfDayAtTransition(SPRING_FORWARD, ZONE)).toBe(180);
  });

  it("returns 60 (01:00) for fall-back in America/New_York", () => {
    expect(localMinuteOfDayAtTransition(FALL_BACK, ZONE)).toBe(60);
  });

  it("returns NaN for an unreadable instant", () => {
    expect(
      localMinuteOfDayAtTransition(
        { ...SPRING_FORWARD, instant: "nope" },
        ZONE,
      ),
    ).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// formatMinuteOfDay
// ---------------------------------------------------------------------------

describe("formatMinuteOfDay", () => {
  it("zero-pads hours and minutes", () => {
    expect(formatMinuteOfDay(0)).toBe("00:00");
    expect(formatMinuteOfDay(90)).toBe("01:30");
    expect(formatMinuteOfDay(1439)).toBe("23:59");
  });

  it("returns a placeholder for non-finite input", () => {
    expect(formatMinuteOfDay(NaN)).toBe("--:--");
  });
});

// ---------------------------------------------------------------------------
// getTickerWindow
// ---------------------------------------------------------------------------

describe("getTickerWindow", () => {
  it("puts the skipped hour before the post-transition reading for a gap", () => {
    // Spring-forward reads 03:00 local; 02:00-03:00 is what never happens.
    const w = getTickerWindow(SPRING_FORWARD, ZONE);
    expect(w).not.toBeNull();
    expect(w!.zoneStartMinutes).toBe(120);
    expect(w!.zoneEndMinutes).toBe(180);
    expect(w!.windowStartMinutes).toBe(90);
    expect(w!.windowEndMinutes).toBe(210);
  });

  it("starts the repeated hour at the post-transition reading for an overlap", () => {
    // Fall-back reads 01:00 local; 01:00-02:00 is what happens twice.
    const w = getTickerWindow(FALL_BACK, ZONE);
    expect(w).not.toBeNull();
    expect(w!.zoneStartMinutes).toBe(60);
    expect(w!.zoneEndMinutes).toBe(120);
  });

  it("sizes the zone from the real offset delta, not a hardcoded hour", () => {
    // Lord Howe Island shifts 30 minutes, not 60.
    const lordHowe: DstTransition = {
      instant: "2024-10-05T15:00:00Z", // 2024-10-06T02:00 local (+11:00)
      offsetBefore: "+10:30",
      offsetAfter: "+11:00",
    };
    const w = getTickerWindow(lordHowe, "Australia/Lord_Howe");
    expect(w).not.toBeNull();
    expect(w!.zoneEndMinutes - w!.zoneStartMinutes).toBe(30);
  });

  it("clamps the padded window to a single day", () => {
    const w = getTickerWindow(SPRING_FORWARD, ZONE, 500);
    expect(w!.windowStartMinutes).toBe(0);
    expect(w!.windowEndMinutes).toBeLessThanOrEqual(1439);
  });

  it("returns null when the offsets don't differ", () => {
    expect(
      getTickerWindow({ ...SPRING_FORWARD, offsetAfter: "-05:00" }, ZONE),
    ).toBeNull();
  });

  it("returns null for an unreadable instant", () => {
    expect(
      getTickerWindow({ ...SPRING_FORWARD, instant: "nope" }, ZONE),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isMinuteInZone
// ---------------------------------------------------------------------------

describe("isMinuteInZone", () => {
  const window: TickerWindow = {
    zoneStartMinutes: 120,
    zoneEndMinutes: 180,
    windowStartMinutes: 90,
    windowEndMinutes: 210,
  };

  it("includes the zone start and excludes the zone end", () => {
    expect(isMinuteInZone(120, window)).toBe(true);
    expect(isMinuteInZone(180, window)).toBe(false);
  });

  it("is false just outside the zone on either side", () => {
    expect(isMinuteInZone(119, window)).toBe(false);
    expect(isMinuteInZone(181, window)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// minuteToTickerPercent / tickerPercentToMinute
// ---------------------------------------------------------------------------

describe("minuteToTickerPercent / tickerPercentToMinute", () => {
  const window: TickerWindow = {
    zoneStartMinutes: 120,
    zoneEndMinutes: 180,
    windowStartMinutes: 90,
    windowEndMinutes: 210,
  };

  it("maps the window bounds to 0% and 100%", () => {
    expect(minuteToTickerPercent(90, window)).toBe(0);
    expect(minuteToTickerPercent(210, window)).toBe(100);
    expect(minuteToTickerPercent(150, window)).toBe(50);
  });

  it("clamps out-of-range minutes", () => {
    expect(minuteToTickerPercent(0, window)).toBe(0);
    expect(minuteToTickerPercent(1439, window)).toBe(100);
  });

  it("round-trips the window bounds", () => {
    expect(tickerPercentToMinute(0, window)).toBe(90);
    expect(tickerPercentToMinute(100, window)).toBe(210);
  });

  it("snaps to the nearest step", () => {
    // 51% of a 120-minute window from 90 = 151.2 → snaps to 150
    expect(tickerPercentToMinute(51, window)).toBe(150);
  });

  it("clamps out-of-range percentages", () => {
    expect(tickerPercentToMinute(-20, window)).toBe(90);
    expect(tickerPercentToMinute(150, window)).toBe(210);
  });
});

// ---------------------------------------------------------------------------
// getTickerTickStepMinutes
// ---------------------------------------------------------------------------

describe("getTickerTickStepMinutes", () => {
  it("uses 15-minute ticks for a narrow window", () => {
    expect(
      getTickerTickStepMinutes({
        zoneStartMinutes: 120,
        zoneEndMinutes: 180,
        windowStartMinutes: 90,
        windowEndMinutes: 210,
      }),
    ).toBe(15);
  });

  it("uses 30-minute ticks for a wider window", () => {
    expect(
      getTickerTickStepMinutes({
        zoneStartMinutes: 120,
        zoneEndMinutes: 180,
        windowStartMinutes: 0,
        windowEndMinutes: 300,
      }),
    ).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// buildZonedValueFromMinutes
// ---------------------------------------------------------------------------

describe("buildZonedValueFromMinutes", () => {
  it("builds a zoned ISO string from a date and minute-of-day", () => {
    expect(buildZonedValueFromMinutes(ZONE, "2024-03-10", 195)).toBe(
      "2024-03-10T03:15:00[America/New_York]",
    );
  });

  it("returns '' for a malformed date", () => {
    expect(buildZonedValueFromMinutes(ZONE, "March 10", 195)).toBe("");
    expect(buildZonedValueFromMinutes(ZONE, "", 195)).toBe("");
  });

  it("returns '' for an out-of-range or non-finite minute", () => {
    expect(buildZonedValueFromMinutes(ZONE, "2024-03-10", -1)).toBe("");
    expect(buildZonedValueFromMinutes(ZONE, "2024-03-10", 1440)).toBe("");
    expect(buildZonedValueFromMinutes(ZONE, "2024-03-10", NaN)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// VALUE_PRESETS
// ---------------------------------------------------------------------------

describe("VALUE_PRESETS", () => {
  it("has exactly 4 presets", () => {
    expect(VALUE_PRESETS).toHaveLength(4);
  });

  it("includes all required preset types", () => {
    const types = VALUE_PRESETS.map((p) => p.type);
    expect(types).toContain("normal");
    expect(types).toContain("gap");
    expect(types).toContain("overlap");
    expect(types).toContain("transition");
  });

  it("every preset has a non-empty label and description", () => {
    for (const preset of VALUE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildValuePreset
// ---------------------------------------------------------------------------

describe("buildValuePreset", () => {
  it("returns '' when there are no transitions", () => {
    expect(buildValuePreset("normal", ZONE, [])).toBe("");
    expect(buildValuePreset("gap", ZONE, [])).toBe("");
    expect(buildValuePreset("overlap", ZONE, [])).toBe("");
    expect(buildValuePreset("transition", ZONE, [])).toBe("");
  });

  it("'normal' generates a date 14 days after the first transition at 12:00", () => {
    // SPRING_FORWARD is 2024-03-10 (local), +14 days = 2024-03-24
    const result = buildValuePreset("normal", ZONE, [SPRING_FORWARD]);
    expect(result).toBe("2024-03-24T12:00:00[America/New_York]");
  });

  it("'gap' generates the skipped hour on the spring-forward date", () => {
    // Spring-forward at 03:00 local (the skipped hour is 03:00)
    const result = buildValuePreset("gap", ZONE, [SPRING_FORWARD, FALL_BACK]);
    expect(result).toBe("2024-03-10T03:00:00[America/New_York]");
  });

  it("'overlap' generates the ambiguous hour on the fall-back date", () => {
    // Fall-back transition at 2024-11-03T06:00:00Z = 01:00 local in NY
    // (the hour 01:00-02:00 happens twice — once with -04:00, once with -05:00)
    const result = buildValuePreset("overlap", ZONE, [
      SPRING_FORWARD,
      FALL_BACK,
    ]);
    expect(result).toBe("2024-11-03T01:00:00[America/New_York]");
  });

  it("'transition' generates a zoned ISO string from the first transition's UTC instant", () => {
    // 2024-03-10T07:00:00Z in America/New_York = 2024-03-10T03:00:00-04:00
    const result = buildValuePreset("transition", ZONE, [
      SPRING_FORWARD,
      FALL_BACK,
    ]);
    expect(result).toBe("2024-03-10T03:00:00-04:00[America/New_York]");
  });

  it("'gap' falls back to 03:00 on first transition date when no gap transition found", () => {
    // Only a fall-back (overlap) transition — no gap exists
    const result = buildValuePreset("gap", ZONE, [FALL_BACK]);
    expect(result).toBe("2024-11-03T03:00:00[America/New_York]");
  });

  it("'overlap' falls back to 01:00 on first transition date when no overlap transition found", () => {
    // Only a spring-forward (gap) transition — no overlap exists
    const result = buildValuePreset("overlap", ZONE, [SPRING_FORWARD]);
    expect(result).toBe("2024-03-10T01:00:00[America/New_York]");
  });
});

// ---------------------------------------------------------------------------
// classifyProbeResult (signature: result, transitions, probeHour, zone, options?)
// ---------------------------------------------------------------------------

describe("classifyProbeResult", () => {
  it("classifies a normal result as 'normal'", () => {
    const transitions = [SPRING_FORWARD, FALL_BACK];
    const classification = classifyProbeResult(
      "2024-03-10T12:00:00-04:00[America/New_York]",
      transitions,
      12,
      ZONE,
    );
    expect(classification.type).toBe("normal");
    expect(classification.explanation).toContain("normal wall-clock time");
  });

  it("classifies a sentinel result with disambiguation=reject as 'overlap'", () => {
    const transitions = [SPRING_FORWARD, FALL_BACK];
    const classification = classifyProbeResult(
      "",
      transitions,
      1, // probe hour = fall-back local hour (ambiguous: 1 AM happens twice)
      ZONE,
      { disambiguation: "reject", offset: "ignore" },
    );
    expect(classification.type).toBe("overlap");
    expect(classification.explanation).toContain('disambiguation="reject"');
  });

  it("classifies a sentinel result with offset=prefer+reject as 'normal' with insight", () => {
    // Use probe hour far from any transition so the "prefer makes disambiguation inert"
    // insight path is reached rather than the gap/overlap classification.
    const transitions = [SPRING_FORWARD, FALL_BACK];
    const classification = classifyProbeResult("", transitions, 23, ZONE, {
      disambiguation: "reject",
      offset: "prefer",
    });
    expect(classification.type).toBe("normal");
    expect(classification.explanation).toContain(
      'offset:"prefer" makes disambiguation inert',
    );
  });

  it("classifies a sentinel with no nearby transition as 'normal'", () => {
    const transitions = [SPRING_FORWARD, FALL_BACK];
    const classification = classifyProbeResult(
      "",
      transitions,
      23, // far from any transition
      ZONE,
      { disambiguation: "reject", offset: "ignore" },
    );
    expect(classification.type).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// isSentinel
// ---------------------------------------------------------------------------

describe("isSentinel", () => {
  it("returns true for empty string (startOfZoned sentinel)", () => {
    expect(isSentinel("")).toBe(true);
  });

  it("returns false for a valid result", () => {
    expect(isSentinel("2024-03-10T12:00:00-04:00[America/New_York]")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Widget behavior tests
// ---------------------------------------------------------------------------

describe("DST widget behavior", () => {
  const NY_TRANSITIONS: DstTransition[] = [
    {
      instant: "2024-03-10T07:00:00Z",
      offsetBefore: "-05:00",
      offsetAfter: "-04:00",
    },
    {
      instant: "2024-11-03T06:00:00Z",
      offsetBefore: "-04:00",
      offsetAfter: "-05:00",
    },
  ];

  it("identifies spring-forward as a gap", () => {
    expect(isGap(NY_TRANSITIONS[0])).toBe(true);
    expect(isOverlap(NY_TRANSITIONS[0])).toBe(false);
  });

  it("identifies fall-back as an overlap", () => {
    expect(isOverlap(NY_TRANSITIONS[1])).toBe(true);
    expect(isGap(NY_TRANSITIONS[1])).toBe(false);
  });

  it("calculates the correct local hour for fall-back overlap", () => {
    // Fall back happens at 6am UTC = 2am EDT (after transition)
    const transition = NY_TRANSITIONS[1];
    const instant = new Date(transition.instant);
    expect(instant.getUTCHours()).toBe(6);
    expect(localHourAtTransition(transition, ZONE)).toBe(1);
  });

  it("detects sentinel for failed startOfZoned (disambiguation: reject + offset: ignore)", () => {
    // When startOfZoned fails, it returns ""
    const result = "";
    expect(isSentinel(result)).toBe(true);
  });

  it("detects valid result for successful startOfZoned (offset: prefer)", () => {
    // When offset: "prefer" makes disambiguation inert, startOfZoned succeeds
    const result = "2024-11-03T01:00:00-05:00[America/New_York]";
    expect(isSentinel(result)).toBe(false);
  });
});
