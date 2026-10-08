import { describe, expect, it } from "vitest";
import { formatSchedule } from "./transport-widgets";
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import { classifyLocal, resolveLocal } from "@northguild/gmt/instant/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import {
  CUSTOM_PRESET_ID,
  SKIPPED_OFFSET_TEXT,
  LONGEST_BADGE,
  MAX_MINUTE,
  TIMETABLE_PRESETS,
  arrivalChipText,
  bandAt,
  bandChipText,
  chartLayout,
  chartSummary,
  chartWindow,
  classify,
  dayBands,
  exactTickLabel,
  handleValueText,
  hhmmOfMinute,
  jumpMinute,
  laneState,
  minuteAtPointer,
  pointerStep,
  rowMinute,
  shapeOf,
  OFFSET_LABEL_MAX,
  offsetReason,
  LONGEST_REASON,
  arrivalChipPlacement,
  stepMinute,
  tagText,
  tickStepHours,
  trackDate,
  windowPct,
  withMinute,
  zonedParts,
  offsetChoices,
  leavesAt,
  matchPreset,
  optionsOf,
  permalinkOf,
  readArgs,
  rowBadge,
  rowDeparture,
  rowLeg,
  rowResult,
  type TimetableLib,
  type TimetableState,
} from "./timetable-reader";

const lib: TimetableLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
  getDstTransitions,
  classifyLocal,
};

function stateOf(preset: (typeof TIMETABLE_PRESETS)[number]): TimetableState {
  return {
    startTimeZone: preset.startTimeZone,
    duration: preset.duration,
    timeZone: preset.timeZone,
    rows: [
      preset.rows[0] ?? { departure: "", offset: "" },
      preset.rows[1] ?? { departure: "", offset: "" },
      preset.rows[2] ?? { departure: "", offset: "" },
      preset.rows[3] ?? { departure: "", offset: "" },
    ],
  };
}

describe("rowDeparture", () => {
  it("is the printed text alone when the row has no offset", () => {
    expect(
      rowDeparture(
        { departure: "2024-11-03T01:30:00", offset: "" },
        "America/New_York",
      ),
    ).toBe("2024-11-03T01:30:00");
  });

  it("appends the offset and brackets the zone when the row has one", () => {
    expect(
      rowDeparture(
        { departure: "2024-03-10T02:30:00", offset: "-05:00" },
        "America/New_York",
      ),
    ).toBe("2024-03-10T02:30:00-05:00[America/New_York]");
  });
});

describe("classify", () => {
  it("once, for a New York time that happens only once (V91)", () => {
    expect(classify("2024-11-03T00:30:00", "America/New_York", lib)).toBe(
      "once",
    );
  });

  it("twice, for New York's fall-back 01:30 (V89)", () => {
    expect(classify("2024-11-03T01:30:00", "America/New_York", lib)).toBe(
      "twice",
    );
  });

  it("skipped, for New York's spring-forward 02:30 (V90)", () => {
    expect(classify("2024-03-10T02:30:00", "America/New_York", lib)).toBe(
      "skipped",
    );
  });

  it("twice, for Berlin's fall-back 02:30 (V93)", () => {
    expect(classify("2024-10-27T02:30:00", "Europe/Berlin", lib)).toBe("twice");
  });

  /* Samoa skipped 2011-12-30 whole. The earlier resolution reads 12:00 on the
     29th, the same HH:MM as printed, so comparing HH:MM said "twice". */
  it("skipped, for a time on a date the zone skipped whole (section 9 C3)", () => {
    expect(classify("2011-12-30T12:00:00", "Pacific/Apia", lib)).toBe(
      "skipped",
    );
  });
});

describe("offsetChoices", () => {
  const NY = "America/New_York";

  /* The label is cut off when it is wider than the select's text area. At the
     narrowest four-in-a-row frame it must show whole; OFFSET_LABEL_MAX is that
     width in characters (see its comment for the measurement). */
  it("keeps every option label within OFFSET_LABEL_MAX characters", () => {
    const cases: [string, string][] = [
      ["2024-11-03T01:30:00", NY],
      ["2024-03-10T02:30:00", NY],
      ["2024-10-27T02:30:00", "Europe/Berlin"],
      ["2011-12-30T12:00:00", "Pacific/Apia"],
      ["2024-04-07T02:15:00", "Australia/Lord_Howe"],
      ["2024-10-06T02:15:00", "Australia/Lord_Howe"],
      ["2024-10-27T01:30:00", "Europe/London"],
    ];
    let longest = 0;
    for (const [printed, zone] of cases) {
      for (const c of offsetChoices(printed, zone, lib)) {
        longest = Math.max(longest, c.label.length);
        expect(c.label.length).toBeLessThanOrEqual(OFFSET_LABEL_MAX);
      }
    }
    expect(longest).toBe(OFFSET_LABEL_MAX);
  });

  it("offers only None for a time that happens once (V91)", () => {
    expect(offsetChoices("2024-11-03T00:30:00", NY, lib)).toEqual([
      { value: "", label: "None" },
    ]);
  });

  it("offers both passes of New York's fall-back 01:30, named as passes (V89)", () => {
    const choices = offsetChoices("2024-11-03T01:30:00", NY, lib);
    expect(choices.map((c) => c.value)).toEqual(["", "-04:00", "-05:00"]);
    expect(choices[0]!.label).toBe("None (earlier)");
    expect(choices[1]!.label).toBe("-04:00 (earlier)");
    expect(choices[2]!.label).toBe("-05:00 (later)");
  });

  it("offers both offsets of a skipped hour, so V83 stays reachable (V90)", () => {
    const choices = offsetChoices("2024-03-10T02:30:00", NY, lib);
    expect(choices.map((c) => c.value)).toContain("-05:00");
    /* Neither offset names an instant here, so neither is dressed as a pass. */
    for (const c of choices.slice(1)) expect(c.label).toContain("(skipped)");
  });

  it("offers only None for a blank time, a blank zone or an unparseable time", () => {
    const only = [{ value: "", label: "None" }];
    expect(offsetChoices("", NY, lib)).toEqual(only);
    expect(offsetChoices("2024-11-03T01:30:00", "", lib)).toEqual(only);
    expect(offsetChoices("not a time", NY, lib)).toEqual(only);
  });
});

describe("rowBadge", () => {
  it("shows no badge for once", () => {
    expect(rowBadge("once", false)).toBeNull();
  });

  it("names the earlier instant for twice with no offset", () => {
    expect(rowBadge("twice", false)).toBe("Occurs twice: the earlier instant");
  });

  it("names the offset as what picked the pass, when one is written", () => {
    expect(rowBadge("twice", true)).toBe("Offset written: this pass");
  });

  it("names the later instant for skipped", () => {
    expect(rowBadge("skipped", false)).toBe(
      "Never shows on the clock: the later instant",
    );
  });
});

describe("presets", () => {
  it("fall-back: 00:30 and 02:30 once, 01:30 (compatible/earlier) twice (V95, V86, V96)", () => {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === "fall-back")!;
    const state = stateOf(preset);
    expect(leavesAt(state, 0, lib)).toBe(
      "2024-11-03T00:30:00-04:00[America/New_York]", // V95
    );
    expect(leavesAt(state, 1, lib)).toBe(
      "2024-11-03T01:30:00-04:00[America/New_York]", // V86
    );
    expect(leavesAt(state, 2, lib)).toBe(
      "2024-11-03T02:30:00-05:00[America/New_York]", // V96
    );
  });

  it("offset-picks: no offset resolves earlier, -05:00 resolves later (V86, V97)", () => {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === "offset-picks")!;
    const state = stateOf(preset);
    expect(leavesAt(state, 0, lib)).toBe(
      "2024-11-03T01:30:00-04:00[America/New_York]", // V86
    );
    expect(leavesAt(state, 1, lib)).toBe(
      "2024-11-03T01:30:00-05:00[America/New_York]", // V97
    );
  });

  it("spring-forward: rows 2 and 3 leave at the same instant (V80-V82)", () => {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === "spring-forward")!;
    const state = stateOf(preset);
    const leg1 = rowLeg(state, 0)!;
    const leg2 = rowLeg(state, 1)!;
    const leg3 = rowLeg(state, 2)!;
    expect(scheduleDelivery([leg1], optionsOf(state))).toEqual({
      eta: "2024-03-10T03:30:00-04:00[America/New_York]",
      legTimes: [
        {
          arrival: "2024-03-10T07:30:00Z",
          localArrival: "2024-03-10T03:30:00-04:00[America/New_York]",
          dwellAfter: "PT0S",
        },
      ],
    });
    const result2 = scheduleDelivery([leg2], optionsOf(state));
    const result3 = scheduleDelivery([leg3], optionsOf(state));
    expect(result2).toEqual(result3);
    expect(result2?.eta).toBe("2024-03-10T04:30:00-04:00[America/New_York]");
  });

  it("published-local matches the JSDoc verbatim (V4)", () => {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === "published-local")!;
    const state = stateOf(preset);
    const leg = rowLeg(state, 0)!;
    expect(scheduleDelivery([leg], optionsOf(state))).toEqual({
      eta: "2024-06-15T15:00:00+00:00[UTC]",
      legTimes: [
        {
          arrival: "2024-06-15T15:00:00Z",
          localArrival: "2024-06-15T15:00:00+00:00[UTC]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });

  it("berlin-fall-back gives V84's twice badge", () => {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === "berlin-fall-back")!;
    const state = stateOf(preset);
    expect(classify(state.rows[0]!.departure, state.startTimeZone, lib)).toBe(
      "twice",
    );
    const leg = rowLeg(state, 0)!;
    expect(scheduleDelivery([leg], optionsOf(state))).toEqual({
      eta: "2024-10-27T02:30:00+01:00[Europe/Amsterdam]",
      legTimes: [
        {
          arrival: "2024-10-27T01:30:00Z",
          localArrival: "2024-10-27T02:30:00+01:00[Europe/Amsterdam]",
          dwellAfter: "PT0S",
        },
      ],
    });
  });
});

describe("rowResult", () => {
  it("names the skipped-offset reason when an offset is written into a skipped row (V83)", () => {
    const state: TimetableState = {
      startTimeZone: "America/New_York",
      duration: "PT1H",
      timeZone: "America/New_York",
      rows: [
        { departure: "2024-03-10T02:30:00", offset: "-05:00" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
      ],
    };
    const { result, reason } = rowResult(state, 0, lib);
    expect(result).toBeNull();
    expect(reason).toBe(SKIPPED_OFFSET_TEXT);
  });

  it("is null/null for a blank row", () => {
    const state: TimetableState = {
      startTimeZone: "America/New_York",
      duration: "PT1H",
      timeZone: "America/New_York",
      rows: [
        { departure: "", offset: "" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
      ],
    };
    expect(rowResult(state, 0, lib)).toEqual({ result: null, reason: null });
  });
});

describe("readArgs / matchPreset / permalinkOf", () => {
  it("reads the chat's departures/offsets arrays", () => {
    const state = readArgs({
      startTimeZone: "Europe/Berlin",
      duration: "PT1H",
      timeZone: "Europe/Amsterdam",
      departures: ["2024-10-27T02:30:00"],
    });
    expect(state.rows[0]).toEqual({
      departure: "2024-10-27T02:30:00",
      offset: "",
    });
    expect(state.rows[1]).toEqual({ departure: "", offset: "" });
  });

  it("reads the flat permalink keys", () => {
    const state = readArgs({
      startTimeZone: "America/New_York",
      departure1: "2024-03-10T02:30:00",
      offset1: "-05:00",
    });
    expect(state.rows[0]).toEqual({
      departure: "2024-03-10T02:30:00",
      offset: "-05:00",
    });
  });

  it("matches every preset and falls back to custom", () => {
    for (const preset of TIMETABLE_PRESETS) {
      expect(matchPreset(stateOf(preset))).toBe(preset.id);
    }
    expect(
      matchPreset({
        startTimeZone: "",
        duration: "",
        timeZone: "",
        rows: [
          { departure: "", offset: "" },
          { departure: "", offset: "" },
          { departure: "", offset: "" },
          { departure: "", offset: "" },
        ],
      }),
    ).toBe(CUSTOM_PRESET_ID);
  });

  it("permalinkOf carries only non-blank strings", () => {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === "fall-back")!;
    const link = permalinkOf(stateOf(preset));
    for (const v of Object.values(link)) expect(typeof v).toBe("string");
    expect(link.departure1).toBe("2024-11-03T00:30:00");
    expect(link.departure4).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The day track, the chart and the sizers
// ---------------------------------------------------------------------------

const NY = "America/New_York";
const preset = (id: string) => TIMETABLE_PRESETS.find((p) => p.id === id)!;

describe("classify at the band edges (section 9 C1, C2, C5)", () => {
  it("is once, twice, twice, once around New York's fall-back hour", () => {
    expect(
      ["00:59", "01:00", "01:59", "02:00"].map((t) =>
        classify(`2024-11-03T${t}:00`, NY, lib),
      ),
    ).toEqual(["once", "twice", "twice", "once"]);
  });

  it("is once, skipped, skipped, once around New York's spring-forward hour", () => {
    expect(
      ["01:59", "02:00", "02:59", "03:00"].map((t) =>
        classify(`2024-03-10T${t}:00`, NY, lib),
      ),
    ).toEqual(["once", "skipped", "skipped", "once"]);
  });

  it("is invalid for text that is not a time and for a zone that does not exist", () => {
    expect(classify("not a time", NY, lib)).toBe("invalid");
    expect(classify("2024-11-03T01:30:00", "Nope/Zone", lib)).toBe("invalid");
  });

  it("offers no offset and no badge for an invalid row", () => {
    expect(offsetChoices("2024-11-03T01:30:00", "Nope/Zone", lib)).toEqual([
      { value: "", label: "None" },
    ]);
    expect(rowBadge("invalid", false)).toBeNull();
  });
});

describe("trackDate, rowMinute, withMinute, laneState", () => {
  it("names the first valid row's date for every preset", () => {
    for (const p of TIMETABLE_PRESETS) {
      expect(trackDate(stateOf(p), lib)).toBe(
        p.rows[0]!.departure.slice(0, 10),
      );
    }
  });

  it("skips a blank first row, and is null with no valid row", () => {
    const base = stateOf(preset("fall-back"));
    const blankFirst = {
      ...base,
      rows: [
        { departure: "", offset: "" },
        { departure: "2024-11-03T01:30:00", offset: "" },
        base.rows[2],
        base.rows[3],
      ],
    } as TimetableState;
    expect(trackDate(blankFirst, lib)).toBe("2024-11-03");
    const none = {
      ...base,
      rows: base.rows.map(() => ({ departure: "nonsense", offset: "" })),
    } as TimetableState;
    expect(trackDate(none, lib)).toBeNull();
  });

  it("reads minutes after 00:00 and drops seconds", () => {
    expect(rowMinute("2024-11-03T01:30:45")).toBe(90);
    expect(rowMinute("2024-11-03T23:55:00")).toBe(1435);
    expect(rowMinute("not a time")).toBeNull();
  });

  it("writes the form the presets use", () => {
    expect(withMinute("2024-11-03", 90)).toBe("2024-11-03T01:30:00");
    expect(withMinute("2024-11-03", 1435)).toBe("2024-11-03T23:55:00");
    expect(withMinute("2024-11-03", 0)).toBe("2024-11-03T00:00:00");
  });

  it("says what each lane holds", () => {
    const base = stateOf(preset("fall-back"));
    const state = {
      ...base,
      rows: [
        { departure: "2024-11-03T01:30:45", offset: "" },
        { departure: "2024-11-04T01:30:00", offset: "" },
        { departure: "nonsense", offset: "" },
        { departure: "", offset: "" },
      ],
    } as TimetableState;
    expect(laneState(state, 0, "2024-11-03", lib)).toEqual({
      state: "on",
      minute: 90,
      kind: "twice",
    });
    expect(laneState(state, 1, "2024-11-03", lib)).toEqual({
      state: "off",
      date: "2024-11-04",
    });
    expect(laneState(state, 2, "2024-11-03", lib)).toEqual({
      state: "invalid",
    });
    expect(laneState(state, 3, "2024-11-03", lib)).toEqual({ state: "blank" });
  });

  it("puts every preset's rows on the lanes with the kind the library gives", () => {
    const state = stateOf(preset("spring-forward"));
    expect(
      [0, 1, 2].map((i) => laneState(state, i, "2024-03-10", lib)),
    ).toEqual([
      { state: "on", minute: 90, kind: "once" },
      { state: "on", minute: 150, kind: "skipped" },
      { state: "on", minute: 210, kind: "once" },
    ]);
  });
});

describe("dayBands (section 9 B1 to B12)", () => {
  const bands = (zone: string, date: string) =>
    dayBands(zone, date, lib).map((b) => [
      b.kind,
      b.startMinute,
      b.endMinute,
      b.from,
      b.to,
    ]);

  it.each([
    ["B1", NY, "2024-11-03", [["twice", 60, 120, "01:00", "02:00"]]],
    ["B2", NY, "2024-03-10", [["skipped", 120, 180, "02:00", "03:00"]]],
    ["B3", NY, "2024-06-15", []],
    [
      "B4",
      "Europe/Berlin",
      "2024-10-27",
      [["twice", 120, 180, "02:00", "03:00"]],
    ],
    [
      "B5",
      "Australia/Lord_Howe",
      "2024-04-07",
      [["twice", 90, 120, "01:30", "02:00"]],
    ],
    [
      "B6",
      "Pacific/Apia",
      "2011-12-30",
      [["skipped", 0, 1440, "00:00", "00:00"]],
    ],
    [
      "B7",
      "America/Santiago",
      "2024-04-06",
      [["twice", 1380, 1440, "23:00", "00:00"]],
    ],
    ["B8", "America/Santiago", "2024-04-07", []],
    [
      "B9",
      "America/Havana",
      "2024-11-03",
      [["twice", 0, 60, "00:00", "01:00"]],
    ],
    [
      "B10",
      "Asia/Beirut",
      "2024-03-31",
      [["skipped", 0, 60, "00:00", "01:00"]],
    ],
    [
      "B11",
      "Asia/Singapore",
      "1981-12-31",
      [["skipped", 1410, 1440, "23:30", "00:00"]],
    ],
    ["B12", "UTC", "2024-11-03", []],
  ])("%s: %s on %s", (_id, zone, date, want) => {
    expect(bands(zone as string, date as string)).toEqual(want);
  });

  it("starts each band on a printed time the library calls repeated or skipped, and ends it on one it calls unique", () => {
    for (const [zone, date] of [
      [NY, "2024-11-03"],
      [NY, "2024-03-10"],
      ["Europe/Berlin", "2024-10-27"],
      ["Australia/Lord_Howe", "2024-04-07"],
    ] as const) {
      for (const b of dayBands(zone, date, lib)) {
        expect(lib.classifyLocal(b.startWall, zone)).toBe(
          b.kind === "twice" ? "ambiguous" : "nonexistent",
        );
        expect(lib.classifyLocal(b.endWall, zone)).toBe("unique");
      }
    }
  });

  it("is empty for an invalid zone, date or year", () => {
    expect(dayBands("Nope/Zone", "2024-11-03", lib)).toEqual([]);
    expect(dayBands(NY, "2024-02-30", lib)).toEqual([]);
    expect(dayBands(NY, "not a date", lib)).toEqual([]);
    expect(dayBands(NY, "0000-01-01", lib)).toEqual([]);
  });

  it("asks the previous year on 1 January, the next on 31 December, and no other year otherwise", () => {
    const asked: number[] = [];
    const stub = {
      ...lib,
      getDstTransitions: (_zone: string, year: number) => {
        asked.push(year);
        return [];
      },
    } as TimetableLib;
    dayBands(NY, "2024-06-15", stub);
    expect(asked).toEqual([2024]);
    asked.length = 0;
    dayBands(NY, "2024-01-01", stub);
    expect(asked).toEqual([2023, 2024]);
    asked.length = 0;
    dayBands(NY, "2024-12-31", stub);
    expect(asked).toEqual([2024, 2025]);
  });

  it("finds the band a minute falls in, start inclusive and end exclusive", () => {
    const list = dayBands(NY, "2024-11-03", lib);
    expect(bandAt(59, list)).toBeNull();
    expect(bandAt(60, list)?.kind).toBe("twice");
    expect(bandAt(119, list)?.kind).toBe("twice");
    expect(bandAt(120, list)).toBeNull();
  });

  it("words the chip", () => {
    expect(bandChipText(dayBands(NY, "2024-11-03", lib))).toBe(
      "01:00\u201302:00 happens twice",
    );
    expect(bandChipText(dayBands(NY, "2024-03-10", lib))).toBe(
      "02:00\u201303:00 never shows",
    );
    expect(bandChipText(dayBands(NY, "2024-06-15", lib))).toBe(
      "No clock change this day",
    );
    expect(bandChipText(dayBands("Pacific/Apia", "2011-12-30", lib))).toBe(
      "This date never shows on the clock",
    );
  });
});

describe("pointer and key movement", () => {
  it("snaps the pointer to the finest of 5, 10, 15 and 30 minutes that is 2.5px wide", () => {
    expect(pointerStep(1826)).toBe(5);
    expect(pointerStep(720)).toBe(5);
    expect(pointerStep(719)).toBe(10);
    expect(pointerStep(360)).toBe(10);
    expect(pointerStep(359)).toBe(15);
    expect(pointerStep(240)).toBe(15);
    expect(pointerStep(239)).toBe(30);
  });

  it("reads the pointer's minute, rounded and clamped", () => {
    expect(minuteAtPointer(0, 0, 1440, 5)).toBe(0);
    expect(minuteAtPointer(1440, 0, 1440, 5)).toBe(MAX_MINUTE);
    expect(minuteAtPointer(-50, 0, 1440, 5)).toBe(0);
    expect(minuteAtPointer(2000, 0, 1440, 5)).toBe(MAX_MINUTE);
    expect(minuteAtPointer(92, 0, 1440, 5)).toBe(90);
    expect(minuteAtPointer(92, 0, 1440, 15)).toBe(90);
    expect(minuteAtPointer(100, 0, 1440, 15)).toBe(105);
    expect(minuteAtPointer(100, 0, 1440, 30)).toBe(90);
    expect(minuteAtPointer(100, 0, 0, 5)).toBe(0);
  });

  it("steps to the next multiple of five, on and off the grid", () => {
    expect(stepMinute(92, 1)).toBe(95);
    expect(stepMinute(92, -1)).toBe(90);
    expect(stepMinute(90, 1)).toBe(95);
    expect(stepMinute(90, -1)).toBe(85);
    expect(stepMinute(0, -1)).toBe(0);
    expect(stepMinute(MAX_MINUTE, 1)).toBe(MAX_MINUTE);
    expect(stepMinute(1433, 1)).toBe(MAX_MINUTE);
  });

  it("jumps an hour and keeps the minutes", () => {
    expect(jumpMinute(30, 1)).toBe(90);
    expect(jumpMinute(90, -1)).toBe(30);
    expect(jumpMinute(30, -1)).toBe(0);
    expect(jumpMinute(1400, 1)).toBe(MAX_MINUTE);
  });

  it("picks the smallest tick step whose pitch holds a label", () => {
    expect(tickStepHours(60, 44)).toBe(1);
    expect(tickStepHours(30, 44)).toBe(2);
    expect(tickStepHours(20, 44)).toBe(3);
    expect(tickStepHours(10, 44)).toBe(6);
    expect(tickStepHours(1, 44)).toBe(12);
  });
});

describe("handleValueText and tagText", () => {
  it("says what each time means", () => {
    expect(handleValueText("00:30", "once", "", "00:30")).toBe("00:30");
    expect(handleValueText("01:30", "twice", "", "01:30")).toBe(
      "01:30, happens twice, read as the earlier pass",
    );
    expect(handleValueText("01:30", "twice", "-05:00", "01:30")).toBe(
      "01:30, happens twice, offset -05:00 written",
    );
    expect(handleValueText("02:30", "skipped", "", "03:30")).toBe(
      "02:30, never shows on the clock, read as 03:30",
    );
    expect(handleValueText("02:30", "skipped", "-05:00", null)).toBe(
      "02:30, never shows on the clock, no instant",
    );
  });

  it("builds the tag", () => {
    expect(tagText(1, "00:30", "once")).toBe("1 \u00b7 00:30");
    expect(tagText(2, "01:30", "twice")).toBe("2 \u00b7 01:30 twice");
    expect(tagText(2, "02:30", "skipped")).toBe("2 \u00b7 02:30 skipped");
  });

  it("formats a minute and an arrival chip", () => {
    expect(hhmmOfMinute(90)).toBe("01:30");
    expect(
      arrivalChipText(
        "2024-11-03T01:30:00-04:00[America/New_York]",
        "2024-11-03",
      ),
    ).toBe("01:30 -04:00");
    expect(
      arrivalChipText(
        "2024-11-04T00:30:00-05:00[America/New_York]",
        "2024-11-03",
      ),
    ).toBe("00:30 -05:00 11-04");
  });
});

describe("chartLayout (section 9 L1 to L6)", () => {
  const rows = (id: string) =>
    chartLayout(stateOf(preset(id)), lib)!.rows.map((r) => [
      r.printedMinute,
      r.instantMinute,
      r.arrivalMinute,
    ]);

  it("fall-back", () => {
    const layout = chartLayout(stateOf(preset("fall-back")), lib)!;
    expect(layout.date).toBe("2024-11-03");
    expect(layout.dayStart).toBe("2024-11-03T04:00:00Z");
    expect(layout.dayMinutes).toBe(1500);
    expect(layout.domainMinutes).toBe(1560);
    expect(rows("fall-back")).toEqual([
      [30, 30, 90],
      [90, 90, 150],
      [150, 210, 270],
    ]);
    expect(layout.fans).toEqual([
      { kind: "twice", wallStart: 60, wallEnd: 120, exact: [60, 120, 180] },
    ]);
    expect(chartWindow(layout)).toEqual({ start: 0, end: 300 });
  });

  it("offset-picks", () => {
    const layout = chartLayout(stateOf(preset("offset-picks")), lib)!;
    expect(rows("offset-picks")).toEqual([
      [90, 90, 150],
      [90, 150, 210],
    ]);
    expect(layout.fans[0]!.exact).toEqual([60, 120, 180]);
    expect(chartWindow(layout)).toEqual({ start: 0, end: 240 });
  });

  it("spring-forward", () => {
    const layout = chartLayout(stateOf(preset("spring-forward")), lib)!;
    expect(layout.dayStart).toBe("2024-03-10T05:00:00Z");
    expect(layout.dayMinutes).toBe(1380);
    expect(layout.domainMinutes).toBe(1500);
    expect(rows("spring-forward")).toEqual([
      [90, 90, 150],
      [150, 150, 210],
      [210, 150, 210],
    ]);
    expect(layout.rows.map((r) => r.dashed)).toEqual([false, true, false]);
    expect(layout.fans).toEqual([
      { kind: "skipped", wallStart: 120, wallEnd: 180, exact: [120] },
    ]);
    expect(chartWindow(layout)).toEqual({ start: 60, end: 300 });
  });

  it("published-local", () => {
    const layout = chartLayout(stateOf(preset("published-local")), lib)!;
    expect(layout.dayMinutes).toBe(1440);
    expect(layout.domainMinutes).toBe(1500);
    expect(rows("published-local")).toEqual([[600, 600, 660]]);
    expect(layout.fans).toEqual([]);
    expect(chartWindow(layout)).toEqual({ start: 540, end: 780 });
  });

  it("berlin-fall-back", () => {
    const layout = chartLayout(stateOf(preset("berlin-fall-back")), lib)!;
    expect(layout.dayStart).toBe("2024-10-26T22:00:00Z");
    expect(layout.domainMinutes).toBe(1560);
    expect(rows("berlin-fall-back")).toEqual([[150, 150, 210]]);
    expect(layout.fans[0]!.exact).toEqual([120, 180, 240]);
    expect(chartWindow(layout)).toEqual({ start: 60, end: 300 });
  });

  it("has null minutes and no dashes for an offset the clock never showed (L6)", () => {
    const state = {
      ...stateOf(preset("spring-forward")),
      rows: [
        { departure: "2024-03-10T02:30:00", offset: "-05:00" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
      ],
    } as TimetableState;
    const row = chartLayout(state, lib)!.rows[0]!;
    expect(row.instantMinute).toBeNull();
    expect(row.arrivalMinute).toBeNull();
    expect(row.dashed).toBe(false);
  });

  it("is null when no row names a date", () => {
    const state = {
      ...stateOf(preset("fall-back")),
      rows: [1, 2, 3, 4].map(() => ({ departure: "", offset: "" })),
    } as TimetableState;
    expect(chartLayout(state, lib)).toBeNull();
  });

  it("lists a row on another date and draws only the rows on the track's date", () => {
    const base = stateOf(preset("fall-back"));
    const state = {
      ...base,
      rows: [
        base.rows[0],
        { departure: "2024-11-04T01:30:00", offset: "" },
        base.rows[2],
        base.rows[3],
      ],
    } as TimetableState;
    const layout = chartLayout(state, lib)!;
    expect(layout.rows.map((r) => r.n)).toEqual([1, 3]);
    expect(layout.others).toEqual([{ n: 2, date: "2024-11-04" }]);
  });

  it("reaches the domain's end for a row at 23:55", () => {
    const state = {
      ...stateOf(preset("published-local")),
      rows: [
        { departure: "2024-06-15T23:55:00", offset: "" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
        { departure: "", offset: "" },
      ],
    } as TimetableState;
    const layout = chartLayout(state, lib)!;
    // The mark is 1435 to 1495; the window cannot pass the domain's 1500, so
    // the four-hour minimum is made up before it.
    expect(chartWindow(layout)).toEqual({
      start: layout.domainMinutes - 240,
      end: layout.domainMinutes,
    });
  });

  describe("the window fits the marks", () => {
    const windowOf = (departures: string[], id = "published-local") => {
      const rows = [0, 1, 2, 3].map((i) => ({
        departure: departures[i] ?? "",
        offset: "",
      }));
      const layout = chartLayout(
        { ...stateOf(preset(id)), rows } as TimetableState,
        lib,
      )!;
      return { layout, win: chartWindow(layout) };
    };

    it("fits one row to the hours around it, never under four hours", () => {
      const { layout, win } = windowOf(["2024-06-15T10:00:00"]);
      expect(
        layout.rows.map((r) => [r.printedMinute, r.arrivalMinute]),
      ).toEqual([[600, 660]]);
      // 570 to 690 with the half-hour margin snaps out to 540 to 720; the
      // four-hour minimum then adds an hour after it.
      expect(win).toEqual({ start: 540, end: 780 });
    });

    it("pads half an hour and snaps outward to whole hours", () => {
      // Marks 605 to 665: 575 and 695 floor and ceil to 540 and 720.
      const { win } = windowOf(["2024-06-15T10:05:00"]);
      expect(win).toEqual({ start: 540, end: 780 });
      expect(win.start % 60).toBe(0);
      expect(win.end % 60).toBe(0);
    });

    it("follows rows more than six hours apart", () => {
      const { win } = windowOf(["2024-06-15T02:00:00", "2024-06-15T20:00:00"]);
      expect(win).toEqual({ start: 60, end: 1320 });
    });

    it("starts at 0 for a row at 00:00 and makes up the minimum after it", () => {
      const { win } = windowOf(["2024-06-15T00:00:00"]);
      expect(win).toEqual({ start: 0, end: 240 });
    });

    it("fits an arrival past midnight, to the domain's end", () => {
      const { layout, win } = windowOf(["2024-06-15T23:00:00"]);
      expect(layout.rows[0]!.arrivalMinute).toBe(1440);
      expect(win).toEqual({ start: 1260, end: 1500 });
    });

    it("clamps an arrival beyond the domain", () => {
      const { layout, win } = windowOf(["2024-06-15T23:55:00"]);
      expect(layout.rows[0]!.arrivalMinute).toBe(1495);
      expect(win.end).toBe(layout.domainMinutes);
    });

    it("leaves out a band the marks do not reach", () => {
      // fall-back's band is at 60 to 180; a row at noon is far from it.
      const { layout, win } = windowOf(["2024-11-03T12:00:00"], "fall-back");
      expect(layout.fans).toHaveLength(1);
      expect(win.start).toBeGreaterThan(180);
    });

    it("takes in a band that touches the marks, whole", () => {
      const { layout } = windowOf(["2024-11-03T01:00:00"], "fall-back");
      const fan = layout.fans[0]!;
      const edge = Math.max(fan.wallEnd, ...fan.exact);
      const at = (m: number) => ({
        ...layout,
        rows: [
          {
            ...layout.rows[0]!,
            printedMinute: m,
            instantMinute: m,
            arrivalMinute: m + 60,
          },
        ],
      });
      // The row's first mark sits on the band's last: the band is in.
      expect(chartWindow(at(edge)).start).toBe(
        Math.max(
          0,
          Math.floor((Math.min(fan.wallStart, ...fan.exact) - 30) / 60) * 60,
        ),
      );
      // One minute past it: the band is out.
      expect(chartWindow(at(edge + 1)).start).toBeGreaterThan(
        Math.floor((Math.min(fan.wallStart, ...fan.exact) - 30) / 60) * 60,
      );
    });
  });

  it("windows to six hours when there is nothing to draw", () => {
    const layout = chartLayout(stateOf(preset("published-local")), lib)!;
    expect(chartWindow({ ...layout, rows: [], fans: [] })).toEqual({
      start: 0,
      end: 360,
    });
  });

  it("places a minute in the window and labels the exact axis in UTC", () => {
    expect(windowPct(180, { start: 0, end: 360 })).toBe(50);
    expect(windowPct(540, { start: 540, end: 900 })).toBe(0);
    const layout = chartLayout(stateOf(preset("fall-back")), lib)!;
    expect(exactTickLabel(layout, 0)).toBe("04:00Z");
    expect(exactTickLabel(layout, 180)).toBe("07:00Z");
  });
});

describe("chartSummary", () => {
  it("reads fall-back word for word", () => {
    expect(chartSummary(chartLayout(stateOf(preset("fall-back")), lib)!)).toBe(
      "Two clocks for 2024-11-03 in America/New_York. 01:00 to 02:00 happens twice. " +
        "Row 1 prints 00:30 and leaves at 2024-11-03T00:30:00-04:00[America/New_York], arriving 2024-11-03T01:30:00-04:00[America/New_York]. " +
        "Row 2 prints 01:30, which happens twice; it is read as the earlier pass and leaves at 2024-11-03T01:30:00-04:00[America/New_York], arriving 2024-11-03T01:30:00-05:00[America/New_York]. " +
        "Row 3 prints 02:30 and leaves at 2024-11-03T02:30:00-05:00[America/New_York], arriving 2024-11-03T03:30:00-05:00[America/New_York].",
    );
  });

  it("reads spring-forward, with the skipped hour and the skipped row", () => {
    const text = chartSummary(
      chartLayout(stateOf(preset("spring-forward")), lib)!,
    );
    expect(text).toContain("02:00 to 03:00 never shows on the clock.");
    expect(text).toContain(
      "Row 2 prints 02:30, which never shows on the clock; it is read as the later instant and leaves at 2024-03-10T03:30:00-04:00[America/New_York], arriving 2024-03-10T04:30:00-04:00[America/New_York].",
    );
  });

  it("says there is no clock change on published-local", () => {
    expect(
      chartSummary(chartLayout(stateOf(preset("published-local")), lib)!),
    ).toContain("No clock change that day.");
  });

  it("names an offset, a row with no instant and a row on another date", () => {
    const state = {
      ...stateOf(preset("fall-back")),
      rows: [
        { departure: "2024-11-03T01:30:00", offset: "-05:00" },
        { departure: "2024-03-10T02:30:00", offset: "-05:00" },
        { departure: "2024-11-03T02:30:00", offset: "-05:00" },
        { departure: "2024-11-04T01:30:00", offset: "" },
      ],
    } as TimetableState;
    const text = chartSummary(chartLayout(state, lib)!);
    expect(text).toContain(
      "Row 1 prints 01:30 with offset -05:00 and leaves at 2024-11-03T01:30:00-05:00[America/New_York]",
    );
    expect(text).toContain("Row 2 is on 2024-03-10 and is not drawn.");
    expect(text).toContain(
      "Row 3 prints 02:30 with offset -05:00 and leaves at 2024-11-03T02:30:00-05:00[America/New_York]",
    );
    expect(text).toContain("Row 4 is on 2024-11-04 and is not drawn.");
    const noInstant = {
      ...state,
      rows: [
        { departure: "2024-11-03T00:55:00", offset: "-05:00" },
        ...state.rows.slice(1),
      ],
    } as TimetableState;
    expect(chartSummary(chartLayout(noInstant, lib)!)).toContain(
      "Row 1 prints 00:55 with offset -05:00 and names no instant.",
    );
  });
});

describe("the hidden sizers", () => {
  it("has a note shape at least as long as every badge", () => {
    for (const [kind, offset] of [
      ["twice", false],
      ["twice", true],
      ["skipped", false],
    ] as const) {
      expect(LONGEST_BADGE.length).toBeGreaterThanOrEqual(
        rowBadge(kind, offset)!.length,
      );
    }
    expect(shapeOf.note()).toBe(LONGEST_BADGE);
  });

  it("splits a zoned string only before the bracket and after each slash in the zone", () => {
    expect(zonedParts("2024-11-03T01:30:00-05:00[America/New_York]")).toEqual([
      "2024-11-03T01:30:00-05:00",
      "[America/",
      "New_York]",
    ]);
    expect(zonedParts("2024-11-03T01:30:00-05:00")).toEqual([
      "2024-11-03T01:30:00-05:00",
    ]);
    expect(zonedParts("2024-11-03T01:30:00Z[UTC]")).toEqual([
      "2024-11-03T01:30:00Z",
      "[UTC]",
    ]);
  });

  it("gives every preset row a shape with the real value's lengths", () => {
    for (const p of TIMETABLE_PRESETS) {
      const state = stateOf(p);
      for (let i = 0; i < p.rows.length; i++) {
        const leaves = leavesAt(state, i, lib)!;
        const local = rowResult(state, i, lib).result!.legTimes[0]!
          .localArrival;
        for (const [real, zone] of [
          [leaves, p.startTimeZone],
          [local, p.timeZone],
        ] as const) {
          const want = zonedParts(real).map((x) => x.length);
          const got = shapeOf.time(zone).parts.map((x) => x.length);
          expect(got).toEqual(want);
        }
        expect(shapeOf.time(p.timeZone).short.length).toBe(
          "00:00 +00:00".length,
        );
      }
    }
  });

  it("gives the output a shape as long as the real call result", () => {
    for (const p of TIMETABLE_PRESETS) {
      const result = rowResult(stateOf(p), 0, lib).result!;
      expect(shapeOf.output(p.timeZone).length).toBe(
        formatSchedule(result).length,
      );
    }
  });
});

describe("arrivalChipPlacement", () => {
  const base = { trackPx: 270, offsetPx: 8 };

  it("puts the chip right of the bar when it fits there", () => {
    expect(
      arrivalChipPlacement({ ...base, startPx: 20, endPx: 60, labelPx: 98 }),
    ).toEqual({ side: "start", leftPx: 60 });
  });

  it("puts it left of the bar's START, not its end, when the right is full", () => {
    expect(
      arrivalChipPlacement({ ...base, startPx: 150, endPx: 190, labelPx: 98 }),
    ).toEqual({ side: "end", leftPx: 150 });
  });

  it("never lets the left side reach the gutter: it clamps to the far edge", () => {
    /* The old check measured the left side from the bar's end (190 - 8 - 98 =
       84, clear) while drawing it from the start (100 - 8 - 98 = -6). */
    const p = arrivalChipPlacement({
      ...base,
      startPx: 100,
      endPx: 190,
      labelPx: 98,
    });
    expect(p.side).toBe("clamp");
    expect(p.leftPx).toBe(172);
    expect(p.leftPx + 98).toBeLessThanOrEqual(270);
  });
});

describe("offsetReason", () => {
  const NY = "America/New_York";

  it("says a time that happens once has nothing to choose", () => {
    expect(offsetReason("2024-11-03T00:30:00", NY, "", lib)).toBe(
      "Happens once: nothing to choose.",
    );
  });

  it("says how to clear an offset a once-row still holds", () => {
    expect(offsetReason("2024-11-03T00:30:00", NY, "-05:00", lib)).toBe(
      "Happens once: choose None to clear the offset.",
    );
  });

  it("says a repeated hour's offset picks the pass", () => {
    expect(offsetReason("2024-11-03T01:30:00", NY, "", lib)).toBe(
      "Happens twice: the offset picks the pass.",
    );
  });

  it("says a skipped hour has no offset that makes it valid", () => {
    expect(offsetReason("2024-03-10T02:30:00", NY, "", lib)).toBe(
      "Never shows: no offset makes it valid.",
    );
  });

  it("asks for a time when the row is empty or is not one", () => {
    expect(offsetReason("", NY, "", lib)).toBe("Type a printed time first.");
    expect(offsetReason("not a time", NY, "", lib)).toBe(
      "Type a printed time first.",
    );
    expect(offsetReason("2024-11-03T01:30:00", "", "", lib)).toBe(
      "Type a printed time first.",
    );
  });

  it("is never longer than LONGEST_REASON, which sizes the reserved slot", () => {
    for (const [t, z, o] of [
      ["2024-11-03T00:30:00", NY, ""],
      ["2024-11-03T00:30:00", NY, "-05:00"],
      ["2024-11-03T01:30:00", NY, ""],
      ["2024-03-10T02:30:00", NY, ""],
      ["", NY, ""],
    ] as const) {
      expect(offsetReason(t, z, o, lib).length).toBeLessThanOrEqual(
        LONGEST_REASON.length,
      );
    }
  });
});

describe("arrivalChipPlacement, at the plot's edges", () => {
  const base = { trackPx: 270, offsetPx: 8 };

  it("keeps the right side when the chip ends exactly at the track's end", () => {
    expect(
      arrivalChipPlacement({ ...base, startPx: 10, endPx: 164, labelPx: 98 }),
    ).toEqual({ side: "start", leftPx: 164 });
  });

  it("keeps the left side when the chip starts exactly at the track's start", () => {
    expect(
      arrivalChipPlacement({ ...base, startPx: 106, endPx: 250, labelPx: 98 }),
    ).toEqual({ side: "end", leftPx: 106 });
  });

  it("clamps flush with the far edge one pixel past either side", () => {
    expect(
      arrivalChipPlacement({ ...base, startPx: 105, endPx: 250, labelPx: 98 }),
    ).toEqual({ side: "clamp", leftPx: 172 });
    expect(
      arrivalChipPlacement({ ...base, startPx: 10, endPx: 166, labelPx: 98 }),
    ).toEqual({ side: "clamp", leftPx: 172 });
  });

  it("clamps to the near edge when the chip is wider than the whole track", () => {
    expect(
      arrivalChipPlacement({ ...base, startPx: 50, endPx: 100, labelPx: 300 }),
    ).toEqual({ side: "clamp", leftPx: 0 });
  });
});
