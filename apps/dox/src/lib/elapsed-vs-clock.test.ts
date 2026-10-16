import { lib } from "~/test/timescale-lib";
import {
  BEFORE_1972_TEXT,
  CLOCK_REFUSES_TEXT,
  CUSTOM_PRESET_ID,
  ELAPSED_PRESETS,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  blankPlates,
  canDrawRulers,
  elapsedPlates,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readElapsed,
  resultsText,
  rulerMarks,
  summaryText,
} from "./elapsed-vs-clock";

const NS = 1_000_000_000n;

/** What each preset reads, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<
  string,
  {
    clock: bigint | null;
    elapsed: bigint | null;
    count: number | null;
    counted: string[];
    reasons: [string, string, string];
  }
> = {
  "across-2016": {
    clock: 2_000_000_000n,
    elapsed: 3_000_000_000n,
    count: 1,
    counted: ["2016-12-31T23:59:60Z"],
    reasons: ["", "", ""],
  },
  "start-is-the-leap-second": {
    clock: null,
    elapsed: 1_000_000_000n,
    count: 1,
    counted: ["2016-12-31T23:59:60Z"],
    reasons: [CLOCK_REFUSES_TEXT, "", ""],
  },
  "twenty-four-years": {
    clock: 757_382_400_000_000_000n,
    elapsed: 757_382_405_000_000_000n,
    count: 5,
    counted: [
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ],
    reasons: ["", "", ""],
  },
  "no-insertions": {
    clock: 126_230_400_000_000_000n,
    elapsed: 126_230_400_000_000_000n,
    count: 0,
    counted: [],
    reasons: ["", "", ""],
  },
  backwards: {
    clock: -757_382_400_000_000_000n,
    elapsed: -757_382_405_000_000_000n,
    count: -5,
    counted: [
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ],
    reasons: ["", "", ""],
  },
  "not-inserted": {
    clock: null,
    elapsed: null,
    count: null,
    counted: [],
    reasons: [NOT_INSERTED_TEXT, NOT_INSERTED_TEXT, NOT_INSERTED_TEXT],
  },
  "before-1972": {
    clock: 1_672_531_200_000_000_000n,
    elapsed: null,
    count: null,
    counted: [],
    reasons: ["", BEFORE_1972_TEXT, BEFORE_1972_TEXT],
  },
};

describe("every preset reads what the library returns", () => {
  it("covers every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      ELAPSED_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(ELAPSED_PRESETS.map((p) => [p.id, p] as const))("%s", (id, p) => {
    const want = EXPECTED[id]!;
    const read = readElapsed(lib, presetState(p));
    expect(read.clock).toBe(want.clock);
    expect(read.elapsed).toBe(want.elapsed);
    expect(read.count).toBe(want.count);
    expect(read.counted).toEqual(want.counted);
    expect([read.clockReason, read.elapsedReason, read.countReason]).toEqual(
      want.reasons,
    );
    // The list is as long as the count says, whichever way the span runs.
    expect(read.counted).toHaveLength(Math.abs(want.count ?? 0));
  });

  it("elapsed minus clock is the count in seconds wherever all three read", () => {
    let checked = 0;
    for (const p of ELAPSED_PRESETS) {
      const read = readElapsed(lib, presetState(p));
      if (read.clock === null || read.elapsed === null || read.count === null) {
        continue;
      }
      expect(read.elapsed - read.clock).toBe(BigInt(read.count) * NS);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("prints the calls it made, with the TAI readings put back as instants", () => {
    const read = readElapsed(lib, presetState(ELAPSED_PRESETS[0]!));
    expect(read.clockCalls.map((c) => [c.fn, c.args])).toEqual([
      ["spanNs", ["2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z"]],
    ]);
    expect(read.elapsedCalls.map((c) => [c.fn, c.args, c.result])).toEqual([
      ["toTAI", ["2016-12-31T23:59:59Z"], "2017-01-01T00:00:35 TAI"],
      ["toTAI", ["2017-01-01T00:00:01Z"], "2017-01-01T00:00:38 TAI"],
      [
        "spanNs",
        ["2017-01-01T00:00:35Z", "2017-01-01T00:00:38Z"],
        3_000_000_000n,
      ],
    ]);
    expect(read.countCalls.map((c) => [c.fn, c.args])).toEqual([
      ["leapSecondsBetween", ["2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z"]],
    ]);
  });

  it("makes no call when a field is blank", () => {
    for (const state of [
      { start: "", end: "" },
      { start: "2020-01-01T00:00:00Z", end: "" },
      { start: " ", end: "2020-01-01T00:00:00Z" },
    ]) {
      const read = readElapsed(lib, state);
      expect(read.clockCalls).toEqual([]);
      expect(read.elapsedCalls).toEqual([]);
      expect(read.countCalls).toEqual([]);
      expect(read.clock).toBeNull();
    }
  });
});

describe("reasons", () => {
  it("names text that is not an instant on all three", () => {
    const read = readElapsed(lib, {
      start: "garbage",
      end: "2024-01-01T00:00:00Z",
    });
    expect(read.clockReason).toBe(NOT_INSTANT_TEXT);
    expect(read.elapsedReason).toBe(NOT_INSTANT_TEXT);
    expect(read.countReason).toBe(NOT_INSTANT_TEXT);
  });

  it("prefers the bad instant over a second 60 on the other end", () => {
    const read = readElapsed(lib, {
      start: "2016-12-31T23:59:60Z",
      end: "garbage",
    });
    expect(read.clockReason).toBe(NOT_INSTANT_TEXT);
  });

  it("reads a listed second 60 at the end through TAI too", () => {
    const read = readElapsed(lib, {
      start: "2016-12-31T23:59:59Z",
      end: "2016-12-31T23:59:60Z",
    });
    expect(read.clock).toBeNull();
    expect(read.clockReason).toBe(CLOCK_REFUSES_TEXT);
    expect(read.elapsed).toBe(NS);
    expect(read.count).toBe(0);
  });
});

describe("seeds and permalinks", () => {
  it("opens on the args and not a preset", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ end: "x" })).toBe(true);
    expect(readArgs({ start: " a ", end: undefined })).toEqual({
      start: "a",
      end: "",
    });
  });

  it("round-trips every preset as strings and leaves a blank out", () => {
    for (const p of ELAPSED_PRESETS) {
      const link = permalinkOf(presetState(p));
      expect(link).toEqual({ start: p.start, end: p.end });
      expect(matchPreset(readArgs(link))).toBe(p.id);
    }
    expect(permalinkOf({ start: "a", end: " " })).toEqual({ start: "a" });
    expect(matchPreset({ start: "a", end: "b" })).toBe(CUSTOM_PRESET_ID);
  });
});

describe("plates and sentences", () => {
  it("holds three plates with their lines in every state", () => {
    for (const plates of [
      blankPlates(),
      ...ELAPSED_PRESETS.map((p) =>
        elapsedPlates(readElapsed(lib, presetState(p)), presetState(p)),
      ),
    ]) {
      expect(plates.map((x) => x.role)).toEqual([
        "hero-clock",
        "hero-elapsed",
        "hero-count",
      ]);
      expect(plates.every((x) => x.lines.length === 2)).toBe(true);
    }
  });

  it("writes the first preset's numbers in words", () => {
    const state = presetState(ELAPSED_PRESETS[0]!);
    const plates = elapsedPlates(readElapsed(lib, state), state);
    expect(plates.map((x) => x.value)).toEqual(["2 s", "3 s", "1"]);
    expect(plates[2]!.lines).toEqual(["from 2016-12-31", "to 2017-01-01"]);
  });

  it("says a no signal in the summary with its reason", () => {
    const state = presetState(ELAPSED_PRESETS[5]!);
    const text = summaryText(state, readElapsed(lib, state));
    expect(text).toContain("no signal");
    expect(text).toContain(NOT_INSERTED_TEXT);
    expect(
      summaryText(
        { start: "", end: "" },
        readElapsed(lib, { start: "", end: "" }),
      ),
    ).toBe("Give a start and an end to compare.");
  });

  it("writes results with the n of a bigint", () => {
    const read = readElapsed(lib, presetState(ELAPSED_PRESETS[0]!));
    expect(resultsText(read.clockCalls)).toBe("2000000000n");
    expect(resultsText(read.elapsedCalls)).toBe(
      '"2017-01-01T00:00:35 TAI"\n"2017-01-01T00:00:38 TAI"\n3000000000n',
    );
    expect(resultsText(read.countCalls)).toBe("1");
  });
});

describe("the rulers", () => {
  it("places each counted second between the earlier and the later end", () => {
    const state = presetState(ELAPSED_PRESETS[0]!);
    const marks = rulerMarks(lib, state, readElapsed(lib, state));
    expect(marks).toHaveLength(1);
    expect(marks[0]!.insertion).toBe("2016-12-31T23:59:60Z");
    // The span runs 23:59:59 to 00:00:01, and the mark is at 00:00:00.
    expect(marks[0]!.pct).toBe(50);
  });

  it("draws a backwards span the same way round", () => {
    const fwd = presetState(ELAPSED_PRESETS[2]!);
    const back = presetState(ELAPSED_PRESETS[4]!);
    expect(rulerMarks(lib, back, readElapsed(lib, back))).toEqual(
      rulerMarks(lib, fwd, readElapsed(lib, fwd)),
    );
  });

  it("draws nothing for an end it cannot place", () => {
    const state = { start: "garbage", end: "2024-01-01T00:00:00Z" };
    expect(canDrawRulers(state)).toBe(false);
    expect(rulerMarks(lib, state, readElapsed(lib, state))).toEqual([]);
  });
});
