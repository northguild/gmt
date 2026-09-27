import { describe, expect, it } from "vitest";
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import { resolveLocal } from "@northguild/gmt/instant/convert";
import type { TransportLib } from "./transport-widgets";
import {
  CUSTOM_PRESET_ID,
  SKIPPED_OFFSET_TEXT,
  TIMETABLE_PRESETS,
  classify,
  leavesAt,
  matchPreset,
  optionsOf,
  permalinkOf,
  readArgs,
  rowBadge,
  rowDeparture,
  rowLeg,
  rowResult,
  type TimetableState,
} from "./timetable-reader";

const lib: TransportLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
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
