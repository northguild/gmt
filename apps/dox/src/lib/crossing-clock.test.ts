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
  CROSSING_PRESETS,
  CUSTOM_PRESET_ID,
  NULL_REASON_TEXT,
  crossingStrip,
  explainNull,
  matchPreset,
  naiveText,
  naiveWallDifference,
  permalinkOf,
  readArgs,
} from "./crossing-clock";

const lib: TransportLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
};

function resultOf(id: string) {
  const preset = CROSSING_PRESETS.find((p) => p.id === id)!;
  return crossingTime(
    preset.state.entry,
    preset.state.exit,
    preset.state.targetZone,
  );
}

describe("presets", () => {
  it("match the section 9 rows", () => {
    expect(resultOf("canal")).toEqual({
      duration: "PT9H30M",
      enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]",
      exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]",
    });
    expect(resultOf("spring-forward")).toEqual({
      duration: "PT7H",
      enter: "2024-03-31T00:00:00+00:00[Europe/London]",
      exit: "2024-03-31T08:00:00+01:00[Europe/London]",
    });
    expect(resultOf("fall-back")).toEqual({
      duration: "PT1H",
      enter: "2024-10-27T01:30:00+01:00[Europe/London]",
      exit: "2024-10-27T01:30:00+00:00[Europe/London]",
    });
    expect(resultOf("fixed-offset")).toEqual({
      duration: "PT7H",
      enter: "2024-03-31T02:00:00+02:00[+02:00]",
      exit: "2024-03-31T09:00:00+02:00[+02:00]",
    });
    expect(resultOf("read-elsewhere")).toEqual({
      duration: "PT9H30M",
      enter: "2024-06-15T01:00:00-05:00[America/Panama]",
      exit: "2024-06-15T10:30:00-05:00[America/Panama]",
    });
    expect(resultOf("inverted")).toBeNull();
  });
});

describe("naiveWallDifference", () => {
  it("gives the documented minutes for every preset", () => {
    expect(naiveWallDifference(resultOf("canal")!)).toBe(570);
    expect(naiveWallDifference(resultOf("spring-forward")!)).toBe(480);
    expect(naiveWallDifference(resultOf("fall-back")!)).toBe(0);
    expect(naiveWallDifference(resultOf("fixed-offset")!)).toBe(420);
    expect(naiveWallDifference(resultOf("read-elsewhere")!)).toBe(570);
  });
});

describe("naiveText", () => {
  it("says agrees when the naive value matches elapsed", () => {
    expect(naiveText(570, 570)).toBe("9 h 30 min: agrees");
  });

  it("says more than elapsed when the naive value overstates it", () => {
    expect(naiveText(420, 480)).toBe("8 h: 1 h more than elapsed");
  });

  it("says less than elapsed when the naive value understates it", () => {
    expect(naiveText(60, 0)).toBe("0 min: 1 h less than elapsed");
  });
});

describe("crossingStrip", () => {
  it("V48: one skip marker, '01:00–02:00 never shown · clocks jumped to +01:00'", () => {
    const strip = crossingStrip(resultOf("spring-forward")!, "Europe/London");
    expect(strip.entryLabel).toBe("00:00 +00:00");
    expect(strip.exitLabel).toBe("08:00 +01:00");
    expect(strip.changes).toHaveLength(1);
    expect(strip.changes[0]).toEqual({
      kind: "skip",
      percent: expect.closeTo(14.2857, 3),
      label: "01:00–02:00 never shown · clocks jumped to +01:00",
      fromHour: 1,
      fromMinute: 0,
      toHour: 2,
      toMinute: 0,
    });
    expect(strip.ticks[0].percent).toBe(0);
    expect(strip.ticks.at(-1)!.percent).toBe(100);
    expect(strip.stepHours).toBe(1);
    expect(strip.summary).toContain("00:00 +00:00 to 08:00 +01:00");
    expect(strip.summary).toContain("never shown");
  });

  it("V49: one repeat marker, '01:00–02:00 shown twice · +01:00 then +00:00'", () => {
    const strip = crossingStrip(resultOf("fall-back")!, "Europe/London");
    expect(strip.entryLabel).toBe("01:30 +01:00");
    expect(strip.exitLabel).toBe("01:30 +00:00");
    expect(strip.changes).toHaveLength(1);
    expect(strip.changes[0]).toEqual({
      kind: "repeat",
      percent: 50,
      label: "01:00–02:00 shown twice · +01:00 then +00:00",
      fromHour: 1,
      fromMinute: 0,
      toHour: 2,
      toMinute: 0,
    });
  });

  it("V46: no DST change — empty changes, ticks span the whole 9h30m", () => {
    const strip = crossingStrip(resultOf("canal")!, "Europe/Berlin");
    expect(strip.entryLabel).toBe("10:00 +02:00");
    expect(strip.exitLabel).toBe("19:30 +02:00");
    expect(strip.changes).toEqual([]);
    expect(strip.summary).toContain(
      "No clock change during the crossing — every hour showed once",
    );
    expect(strip.ticks[0].percent).toBe(0);
    expect(strip.ticks.at(-1)!.percent).toBe(100);
  });

  it("a fixed offset has no transition to find", () => {
    const strip = crossingStrip(resultOf("fixed-offset")!, "+02:00");
    expect(strip.changes).toEqual([]);
  });

  it("steps the ticks by more than one hour past 48 of them on a multi-day crossing", () => {
    const result = crossingTime(
      "2024-06-01T00:00:00Z",
      "2024-06-11T00:00:00Z",
      "UTC",
    )!;
    const strip = crossingStrip(result, "UTC");
    expect(strip.stepHours).toBeGreaterThan(1);
    expect(strip.ticks.length).toBeLessThanOrEqual(49);
    expect(strip.ticks.at(-1)!.percent).toBe(100);
  });
});

describe("explainNull", () => {
  it("invalid-entry, invalid-exit, unknown-zone and inverted, in that order", () => {
    expect(
      explainNull("not-an-instant", "2024-06-15T10:00:00Z", "UTC", lib),
    ).toBe("invalid-entry");
    expect(
      explainNull("2024-06-15T10:00:00Z", "2024-06-15T10:00:00", "UTC", lib),
    ).toBe("invalid-exit");
    expect(
      explainNull(
        "2024-06-15T08:00:00Z",
        "2024-06-15T10:00:00Z",
        "Europe/Londres",
        lib,
      ),
    ).toBe("unknown-zone");
    expect(
      explainNull(
        "2024-06-16T01:00:00Z",
        "2024-06-15T22:30:00Z",
        "Europe/London",
        lib,
      ),
    ).toBe("inverted");
  });

  it("has text for every reason", () => {
    for (const reason of Object.keys(
      NULL_REASON_TEXT,
    ) as (keyof typeof NULL_REASON_TEXT)[]) {
      expect(NULL_REASON_TEXT[reason]).toBeTruthy();
    }
  });
});

describe("readArgs / matchPreset / permalinkOf", () => {
  it("matches every preset and falls back to custom", () => {
    for (const preset of CROSSING_PRESETS) {
      expect(matchPreset(preset.state)).toBe(preset.id);
    }
    expect(matchPreset({ entry: "", exit: "", targetZone: "" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("readArgs turns anything that isn't a string into blank", () => {
    expect(readArgs({}).entry).toBe("");
    expect(readArgs({ entry: "x", exit: "y", targetZone: "z" })).toEqual({
      entry: "x",
      exit: "y",
      targetZone: "z",
    });
  });

  it("permalinkOf carries only non-blank strings", () => {
    const preset = CROSSING_PRESETS.find((p) => p.id === "canal")!;
    const link = permalinkOf(preset.state);
    for (const v of Object.values(link)) expect(typeof v).toBe("string");
    expect(link.targetZone).toBe("Europe/Berlin");
  });
});
