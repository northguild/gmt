import { Temporal } from "@js-temporal/polyfill";
import { journeyLib as lib } from "~/test/ledger-lib";
import { permalinkOf as deliveryPermalink } from "./delivery-scheduler";
import {
  JOURNEY_PRESETS,
  NO_JOURNEY_TEXT,
  TABLE_COLUMNS,
  axisTicks,
  bracketTexts,
  clampChip,
  hopCells,
  hoursText,
  isSeeded,
  journeyPlates,
  layoutRibbons,
  legSeries,
  matchPreset,
  nudgeBadges,
  permalinkOf,
  presetState,
  readJourney,
  ribbonsAria,
  segmentTotals,
  summaryText,
  waitChipText,
  type Hop,
  type JourneyState,
} from "./journey-split";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

/**
 * What a real run of the library gave for each preset, run against
 * `packages/gmt/dist`: `multimodalETA`'s result, then for each hand-off the
 * time waited and the part of it beyond the handling, then the time door to
 * door.
 */
const EXPECTED: Record<
  string,
  {
    journey: { eta: string; totalTransit: string; totalDwell: string } | null;
    hops: { handling: string; waited: string; beyond: string }[];
    door: string | null;
    calls: string[];
  }
> = {
  "scheduled-sailing": {
    journey: {
      eta: "2024-06-30T13:30:00+09:30[Australia/Adelaide]",
      totalTransit: "PT400H",
      totalDwell: "PT84H",
    },
    hops: [
      { handling: "PT6H", waited: "PT48H", beyond: "PT42H" },
      { handling: "PT36H", waited: "PT36H", beyond: "PT0S" },
    ],
    door: "PT484H",
    calls: [
      "multimodalETA",
      "scheduleDelivery",
      ...Array(7).fill("diffUtcAsDuration"),
    ],
  },
  "no-schedule": {
    journey: {
      eta: "2024-06-28T19:30:00+09:30[Australia/Adelaide]",
      totalTransit: "PT400H",
      totalDwell: "PT42H",
    },
    hops: [
      { handling: "PT6H", waited: "PT6H", beyond: "PT0S" },
      { handling: "PT36H", waited: "PT36H", beyond: "PT0S" },
    ],
    door: "PT442H",
    calls: [
      "multimodalETA",
      "scheduleDelivery",
      ...Array(7).fill("diffUtcAsDuration"),
    ],
  },
  "missed-connection": {
    journey: null,
    hops: [],
    door: null,
    calls: ["multimodalETA", "scheduleDelivery"],
  },
  "across-a-clock-change": {
    journey: {
      eta: "2024-03-31T12:00:00+01:00[Europe/London]",
      totalTransit: "PT13H",
      totalDwell: "PT2H",
    },
    hops: [{ handling: "PT2H", waited: "PT2H", beyond: "PT0S" }],
    door: "PT15H",
    calls: [
      "multimodalETA",
      "scheduleDelivery",
      ...Array(4).fill("diffUtcAsDuration"),
    ],
  },
};

const ms = (iso: string) =>
  Temporal.Duration.from(iso).total({ unit: "milliseconds" });

describe("presets", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      JOURNEY_PRESETS.map((p) => p.id).sort(),
    );
  });

  it("matches each preset's own controls and nothing else", () => {
    for (const p of JOURNEY_PRESETS) {
      expect(matchPreset(presetState(p)), p.id).toBe(p.id);
    }
    const custom = presetState(JOURNEY_PRESETS[0]!);
    custom.legs[0]!.duration = "PT7H";
    expect(matchPreset(custom)).toBe("custom");
  });

  it("matches a preset whose fields carry stray spaces", () => {
    const s = presetState(JOURNEY_PRESETS[1]!);
    s.legs[2]!.duration = ` ${s.legs[2]!.duration} `;
    expect(matchPreset(s)).toBe("no-schedule");
  });

  it("names no law, body or carrier and keeps the dwell word out of the prose", () => {
    for (const p of JOURNEY_PRESETS) {
      const text = `${p.label} ${p.description}`;
      expect(text, p.id).not.toMatch(/\bdwell/i);
      expect(text, p.id).not.toMatch(/maersk|msc|cma|fmc|imo|customs|statute/i);
    }
  });

  it("leaves a blank scheduled departure out of the call", () => {
    const state = presetState(JOURNEY_PRESETS[1]!);
    const read = readJourney(state, lib);
    expect(read.legs[1]).not.toHaveProperty("departure");
    expect(read.options).toBeUndefined();
  });
});

describe("isSeeded", () => {
  it("reads a legs array, a leg count or the first duration as a seed", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ legs: [] })).toBe(true);
    expect(isSeeded({ legCount: "2" })).toBe(true);
    expect(isSeeded({ duration1: "PT1H" })).toBe(true);
  });
});

describe.each(JOURNEY_PRESETS.map((p) => [p.id]))("readJourney %s", (id) => {
  const want = EXPECTED[id!]!;
  const preset = JOURNEY_PRESETS.find((p) => p.id === id)!;
  const read = readJourney(presetState(preset), lib);

  it("calls the library in the order it prints, and the result is the library's", () => {
    expect(read.calls.map((c) => c.fn)).toEqual(want.calls);
    expect(read.journey).toEqual(
      want.journey === null
        ? null
        : { ...want.journey, totalLegs: preset.legs.length },
    );
    expect(read.doorToDoor).toBe(want.door);
    expect(
      read.hops.map((h) => ({
        handling: h.handling,
        waited: h.waited,
        beyond: h.beyond,
      })),
    ).toEqual(want.hops);
  });

  it("prints the calls it made, with the arguments it passed", () => {
    expect(read.calls[0]!.args).toEqual([read.legs]);
    expect(read.calls[1]!.args).toEqual([read.legs]);
    for (const c of read.calls.slice(2)) {
      expect(c.args).toHaveLength(3);
      expect(c.args[2]).toBe("hours");
    }
  });

  it("draws moving segments that add up to totalTransit and waiting ones to totalDwell", () => {
    if (want.journey === null) {
      expect(read.segments).toEqual([]);
      return;
    }
    const totals = segmentTotals(read.segments);
    expect(totals.movingMs).toBe(ms(want.journey.totalTransit));
    expect(totals.waitingMs).toBe(ms(want.journey.totalDwell));
    // The same holds on both ribbons, and the ribbons span the journey.
    const ribbons = layoutRibbons(read.segments);
    for (const ribbon of [ribbons.happens, ribbons.gathered]) {
      const sum = (kind: boolean) =>
        ribbon
          .filter((s) => (s.kind === "moving") === kind)
          .reduce((n, s) => n + (s.toMs - s.fromMs), 0);
      expect(sum(true)).toBe(ms(want.journey.totalTransit));
      expect(sum(false)).toBe(ms(want.journey.totalDwell));
    }
    expect(ribbons.spanMs).toBe(
      ms(want.journey.totalTransit) + ms(want.journey.totalDwell),
    );
    // Moving time for a leg is the caller's own duration.
    const moving = read.segments.filter((s) => s.kind === "moving");
    expect(moving.map((s) => s.endMs - s.startMs)).toEqual(
      preset.legs.map((l) => ms(l.duration)),
    );
  });

  it("splits each wait into the stated handling and the wait for a scheduled departure", () => {
    read.hops.forEach((hop, i) => {
      // The library's own result for the handling is the caller's dwellAfter.
      expect(ms(hop.handling)).toBe(ms(preset.legs[i]!.dwellAfter));
      expect(hop.handlingMs).toBe(ms(hop.handling));
      expect(ms(hop.handling) + ms(hop.beyond)).toBe(ms(hop.waited));
      expect(hop.beyondMs).toBe(ms(hop.beyond));
    });
  });

  it("agrees with the schedule: the hand-off instants are scheduleDelivery's", () => {
    if (want.journey === null) return;
    const schedule = read.facts.result!;
    read.hops.forEach((hop, i) => {
      expect(hop.arrival).toBe(schedule.legTimes[i]!.arrival);
      expect(hop.zone).toBe(preset.legs[i]!.timeZone);
    });
  });

  it("says why when there is no journey", () => {
    if (want.journey !== null) {
      expect(read.failure).toBeNull();
      return;
    }
    expect(read.failure).toMatch(/^Missed connection: leg 2 is scheduled/);
  });
});

describe("the scheduled sailing, in full", () => {
  const state = presetState(JOURNEY_PRESETS[0]!);
  const read = readJourney(state, lib);

  it("waits 48 hours at the first hand-off: 6 of handling and 42 for the sailing", () => {
    const hop = read.hops[0]!;
    expect(hop.waited).toBe("PT48H");
    expect(hop.beyond).toBe("PT42H");
    expect(waitChipText(hop)).toBe(
      "2 d: 6 h handling + 42 h for the scheduled departure",
    );
    expect(hopCells(hop)).toEqual([
      "Leg 1: Mon 10 Jun 14:00",
      "6 h",
      "Mon 10 Jun 20:00",
      "Wed 12 Jun 14:00",
      "2 d",
    ]);
  });

  it("waits only for the handling at the second hand-off", () => {
    const hop = read.hops[1]!;
    expect(waitChipText(hop)).toBe("1 d 12 h of handling");
    expect(hopCells(hop)[4]).toBe("1 d 12 h");
  });

  it("puts the plates in the library's words", () => {
    const plates = journeyPlates(read);
    expect(plates.map((p) => [p.role, p.value, p.lines])).toEqual([
      [
        "hero-eta",
        "Sun 30 Jun 13:30",
        ["Australia/Adelaide", "484 h door to door"],
      ],
      ["hero-moving", "16 d 16 h", ["PT400H"]],
      ["hero-waiting", "3 d 12 h", ["PT84H"]],
    ]);
    expect(plates.map((p) => p.series)).toEqual([1, 2, 3]);
  });

  it("brackets the totals as returned", () => {
    expect(bracketTexts(read.journey!)).toEqual({
      moving: "moving · PT400H",
      waiting: "waiting · PT84H",
    });
  });

  it("has a sentence for a screen reader and a name for the ribbons", () => {
    expect(summaryText(read)).toBe(
      "Moving 16 d 16 h and waiting 3 d 12 h. ETA Sun 30 Jun 13:30 in Australia/Adelaide, 484 h door to door.",
    );
    expect(ribbonsAria(read)).toContain(
      "leg 1 moving, then 6 h of handling after leg 1",
    );
    expect(ribbonsAria(read)).toContain(
      "1 d 18 h of waiting for the scheduled departure after leg 1",
    );
    expect(ribbonsAria(read)).toContain(
      "Gathered: moving 16 d 16 h, then waiting 3 d 12 h.",
    );
  });
});

describe("the clock change", () => {
  it("counts the hours that passed, not the wall clock", () => {
    const read = readJourney(presetState(JOURNEY_PRESETS[3]!), lib);
    expect(read.journey!.totalTransit).toBe("PT13H");
    expect(journeyPlates(read)[1]!.value).toBe("13 h");
    // The train's 10 hours cross a spring-forward: the wall clock shows 11.
    const hop = read.hops[0]!;
    expect(hopCells(hop)[0]).toBe("Leg 1: Sun 31 Mar 07:00");
    expect(hopCells(hop)[4]).toBe("2 h");
  });
});

describe("a journey the library refuses", () => {
  const read = readJourney(presetState(JOURNEY_PRESETS[2]!), lib);

  it("keeps the plates' boxes and reads no result", () => {
    const plates = journeyPlates(read);
    expect(plates.map((p) => p.value)).toEqual([null, null, null]);
    expect(plates.map((p) => p.lines.length)).toEqual([2, 1, 1]);
    expect(plates.map((p) => p.caption)).toEqual(["ETA", "Moving", "Waiting"]);
    expect(journeyPlates(null).map((p) => p.value)).toEqual([null, null, null]);
  });

  it("says in words that there is no journey to draw", () => {
    expect(ribbonsAria(read)).toContain(NO_JOURNEY_TEXT);
    expect(summaryText(read)).toMatch(/^No journey\. Missed connection/);
    expect(layoutRibbons(read.segments)).toEqual({
      spanMs: 0,
      happens: [],
      gathered: [],
    });
  });
});

describe("invalid input is the library's sentinel with its sentence", () => {
  const base = presetState(JOURNEY_PRESETS[0]!);

  it.each([
    [
      "a bad duration",
      (s: JourneyState) => (s.legs[0]!.duration = "6 hours"),
      /^Leg 1's duration/,
    ],
    [
      "a calendar duration",
      (s: JourneyState) => (s.legs[1]!.duration = "P1M"),
      /^Leg 2's duration/,
    ],
    [
      "a bad zone",
      (s: JourneyState) => (s.legs[1]!.timeZone = "Mars/Base"),
      /^Leg 2's arrival zone/,
    ],
    [
      "a bad handling time",
      (s: JourneyState) => (s.legs[0]!.dwellAfter = "soon"),
      "Leg 1's handling time is not a duration of time units, or it is negative.",
    ],
    [
      "no first departure",
      (s: JourneyState) => (s.legs[0]!.departure = ""),
      /^Leg 1 has no departure/,
    ],
  ])("%s", (_name, edit, sentence) => {
    const state = structuredClone(base);
    edit(state);
    const read = readJourney(state, lib);
    expect(read.journey).toBeNull();
    expect(read.hops).toEqual([]);
    expect(read.doorToDoor).toBeNull();
    if (typeof sentence === "string") expect(read.failure).toBe(sentence);
    else expect(read.failure).toMatch(sentence);
    expect(read.failure).not.toMatch(/\bdwell\b/i);
  });
});

describe("a single leg", () => {
  it("has no hand-off and no wait", () => {
    const state = structuredClone(presetState(JOURNEY_PRESETS[0]!));
    state.legCount = "1";
    const read = readJourney(state, lib);
    expect(read.hops).toEqual([]);
    expect(read.segments.map((s) => s.kind)).toEqual(["moving"]);
    expect(read.journey!.totalDwell).toBe("PT0S");
    expect(journeyPlates(read)[2]!.value).toBe("0 h");
    expect(read.calls.map((c) => c.fn)).toEqual([
      "multimodalETA",
      "scheduleDelivery",
      "diffUtcAsDuration",
    ]);
  });
});

describe("an option is passed on when it is set", () => {
  it("passes startTimeZone to both calls", () => {
    const state = structuredClone(presetState(JOURNEY_PRESETS[0]!));
    state.legCount = "1";
    state.startTimeZone = "Asia/Shanghai";
    state.legs[0]!.departure = "2024-06-10T08:00:00";
    const read = readJourney(state, lib);
    expect(read.calls[0]!.args).toEqual([
      read.legs,
      { startTimeZone: "Asia/Shanghai" },
    ]);
    expect(read.calls[1]!.args).toEqual([
      read.legs,
      { startTimeZone: "Asia/Shanghai" },
    ]);
    expect(read.journey).not.toBeNull();
  });
});

describe("layoutRibbons", () => {
  const read = readJourney(presetState(JOURNEY_PRESETS[0]!), lib);
  const ribbons = layoutRibbons(read.segments);

  it("keeps each segment where it falls in 'as it happens'", () => {
    const first = ribbons.happens[0]!;
    expect(first.fromMs).toBe(0);
    expect(first.toMs).toBe(ms("PT6H"));
    // The ship leaves at the end of the scheduled wait.
    const sail = ribbons.happens.find(
      (s) => s.kind === "moving" && s.leg === 2,
    )!;
    expect(sail.fromMs).toBe(ms("PT54H"));
    expect(ribbons.happens.at(-1)!.toMs).toBe(ribbons.spanMs);
  });

  it("packs moving at the left and waiting at the right in 'gathered'", () => {
    const moving = ribbons.gathered.filter((s) => s.kind === "moving");
    const waiting = ribbons.gathered.filter((s) => s.kind !== "moving");
    expect(moving[0]!.fromMs).toBe(0);
    expect(moving.at(-1)!.toMs).toBe(ms("PT400H"));
    expect(waiting[0]!.fromMs).toBe(ms("PT400H"));
    expect(waiting.at(-1)!.toMs).toBe(ribbons.spanMs);
    // Each segment keeps its length and its place in the order.
    ribbons.gathered.forEach((s, i) => {
      expect(s.toMs - s.fromMs).toBe(
        ribbons.happens[i]!.toMs - ribbons.happens[i]!.fromMs,
      );
      expect(s.kind).toBe(ribbons.happens[i]!.kind);
    });
  });

  it("splits a wait into handling and a scheduled departure", () => {
    expect(read.segments.map((s) => s.kind)).toEqual([
      "moving",
      "handling",
      "scheduled",
      "moving",
      "handling",
      "moving",
    ]);
  });

  it("gives the scheduled wait no segment when the departure is the ready instant", () => {
    const none = readJourney(presetState(JOURNEY_PRESETS[1]!), lib);
    expect(none.segments.map((s) => s.kind)).toEqual([
      "moving",
      "handling",
      "moving",
      "handling",
      "moving",
    ]);
  });
});

describe("axisTicks", () => {
  it("ticks a journey of days in days, six at most after the first", () => {
    const ticks = axisTicks(ms("PT484H"));
    expect(ticks.map((t) => t.label)).toEqual([
      "0",
      "5 d",
      "10 d",
      "15 d",
      "20 d",
    ]);
    expect(ticks[1]!.ms).toBe(5 * 24 * 3_600_000);
  });

  it("ticks a short journey in hours", () => {
    const ticks = axisTicks(ms("PT15H"));
    expect(ticks.map((t) => t.label)).toEqual([
      "0",
      "3 h",
      "6 h",
      "9 h",
      "12 h",
      "15 h",
    ]);
  });

  it("gives one tick for a journey with no length", () => {
    expect(axisTicks(0)).toEqual([{ ms: 0, label: "0" }]);
  });

  it("never gives more than seven ticks, for any length", () => {
    for (const hours of [1, 7, 36, 71, 72, 100, 484, 2000, 20000]) {
      expect(
        axisTicks(hours * 3_600_000).length,
        `${hours} h`,
      ).toBeLessThanOrEqual(7);
    }
  });
});

describe("nudgeBadges", () => {
  it("keeps badges in order, apart, and inside the track", () => {
    const lefts = nudgeBadges([2, 3, 4, 500], 22, 600);
    expect(lefts[0]).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]! - lefts[i - 1]!).toBeGreaterThanOrEqual(22);
    }
    expect(lefts.at(-1)! + 22).toBeLessThanOrEqual(600);
  });

  it("leaves a badge centred when nothing is in the way", () => {
    expect(nudgeBadges([100, 300], 22, 600)).toEqual([89, 289]);
  });

  it("pushes a crowded run back from the right edge", () => {
    const lefts = nudgeBadges([595, 598, 599], 22, 600);
    expect(lefts.at(-1)! + 22).toBeLessThanOrEqual(600);
    expect(lefts[1]! - lefts[0]!).toBeGreaterThanOrEqual(22);
  });
});

describe("clampChip", () => {
  it("centres a chip and keeps it inside the track", () => {
    expect(clampChip(100, 40, 400)).toBe(80);
    expect(clampChip(5, 40, 400)).toBe(0);
    expect(clampChip(399, 40, 400)).toBe(360);
  });
});

describe("type setting", () => {
  it("shows hours the library gave", () => {
    expect(hoursText("PT484H")).toBe("484 h");
    expect(hoursText("PT139H30M")).toBe("139 h 30 min");
    expect(hoursText("PT0S")).toBe("PT0S");
    expect(hoursText("")).toBe("");
  });

  it("gives a leg its series, cycling past four", () => {
    expect([1, 2, 3, 4, 5].map(legSeries)).toEqual([1, 2, 3, 4, 1]);
  });

  it("words a wait with no handling and no scheduled departure", () => {
    const hop = {
      handlingMs: 0,
      beyondMs: 0,
      waited: "PT0S",
      beyond: "PT0S",
    } as Hop;
    expect(waitChipText(hop)).toBe("no wait");
    expect(
      waitChipText({
        ...hop,
        beyondMs: 3_600_000,
        beyond: "PT1H",
        waited: "PT1H",
      }),
    ).toBe("1 h for the scheduled departure");
  });

  it("has the five table columns", () => {
    expect(TABLE_COLUMNS).toEqual([
      "Arrives",
      "Handling",
      "Ready",
      "Departs",
      "Waited",
    ]);
  });
});

describe("the hand-off to the Delivery Scheduler", () => {
  it("is the Delivery Scheduler's own permalink under the other kind, and round-trips every key", () => {
    for (const preset of JOURNEY_PRESETS) {
      const state = presetState(preset);
      state.startTimeZone = preset.id === "no-schedule" ? "Asia/Shanghai" : "";
      const args = permalinkOf(state);
      expect(args).toEqual(deliveryPermalink(state));
      const href = encodeWidgetPermalink("delivery", args);
      expect(href.startsWith("/tools/delivery-scheduler/?w=delivery&wa=")).toBe(
        true,
      );
      const seeded = seedFromLocation(
        "delivery",
        new URL(href, "https://example.test").search,
      );
      expect(seeded, preset.id).toEqual(args);
    }
  });

  it("round-trips the other way: a Delivery Scheduler link opens as a journey", () => {
    const state = presetState(JOURNEY_PRESETS[0]!);
    const args = permalinkOf(state);
    const href = encodeWidgetPermalink("journeysplit", args);
    expect(href.startsWith("/tools/journey-split/?w=journeysplit&wa=")).toBe(
      true,
    );
    const seeded = seedFromLocation(
      "journeysplit",
      new URL(href, "https://example.test").search,
    );
    expect(seeded).toEqual(args);
    expect(Object.keys(args)).toEqual(
      expect.arrayContaining([
        "legCount",
        "departure1",
        "duration1",
        "timeZone1",
        "dwellAfter1",
        "mode1",
        "departure2",
        "dwellAfter2",
        "duration3",
        "timeZone3",
        "mode3",
      ]),
    );
  });
});
