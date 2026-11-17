/**
 * Sentences the zone tools say and their pages never show: what a call that leaves a value out,
 * reads the clock, names a zone the planner cannot place or a preset the inspector lacks is told.
 */
import { seedNote } from "./seed-note";

const clock = vi.hoisted(() => ({ unreadable: false }));
vi.mock("@northguild/gmt/unix/get", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@northguild/gmt/unix/get")>();
  return {
    ...real,
    getUnixNow: () => (clock.unreadable ? null : real.getUnixNow()),
  };
});
import converter, {
  fromIgnoredNote,
  unzonedNote as converterUnzoned,
} from "./tools/converter-bench";
import dst, {
  noProbeNote,
  OFFSET_IGNORED,
  unknownPresetNote,
} from "./tools/dst-inspector";
import interval, {
  invalidIntervalNote,
  unzonedNote as intervalUnzoned,
} from "./tools/interval-visualizer";
import planner, {
  NO_INSTANT,
  NO_PLACEABLE_ZONES,
  unplacedNote,
} from "./tools/zone-planner";
import earth, { unknownZoneNote } from "./tools/zoned-earth";

// A tool answers with its page's link as a full URL, resolved against the page's address, and
// Node has none. The setup file restores the global after each test.
beforeEach(() => {
  vi.stubGlobal("location", new URL("https://northguild.dev/gmt/tools/"));
});

async function notesOf(
  tool: { execute(input: object, options?: object): Promise<unknown> },
  args: object,
): Promise<string[]> {
  const result = (await tool.execute(args, {})) as {
    ok: boolean;
    notes?: string[];
  };
  if (!result.ok || result.notes === undefined) {
    throw new Error(`the call was refused: ${JSON.stringify(result)}`);
  }
  return result.notes;
}

describe("the converter's notes", () => {
  it("names the locale a call that sent none took", async () => {
    const notes = await notesOf(converter, {
      value: "2024-03-15T14:30:00Z",
      from: "UTC",
      to: "Asia/Tokyo",
    });
    expect(notes).toContain(seedNote(["locale"]));
  });

  it("says a value with no zone was read as UTC", async () => {
    const notes = await notesOf(converter, {
      value: "2024-03-15T14:30:00",
      from: "UTC",
      to: "Asia/Tokyo",
      locale: "en",
    });
    expect(notes).toContain(
      converterUnzoned("2024-03-15T14:30:00", "2024-03-15T14:30:00+00:00[UTC]"),
    );
    expect(converterUnzoned("a", "b")).toBe(
      "a is not a date-time with a bracketed zone, so it was rewritten as b.",
    );
  });

  it("does not call a Z or an offset value UTC-by-default", async () => {
    const notes = await notesOf(converter, {
      value: "2024-03-15T14:30:00-04:00",
      from: "UTC",
      to: "Asia/Tokyo",
      locale: "en",
    });
    expect(notes).toContain(
      converterUnzoned(
        "2024-03-15T14:30:00-04:00",
        "2024-03-15T14:30:00-04:00[-04:00]",
      ),
    );
    expect(notes.join(" ")).not.toMatch(/read as UTC/);
  });

  it("says nothing about from when the value could not be converted", async () => {
    const notes = await notesOf(converter, {
      value: "garbage",
      from: "Europe/London",
      to: "Asia/Tokyo",
      locale: "en",
    });
    expect(notes.some((n) => n.startsWith("from is "))).toBe(false);
  });

  it("says the from zone is not used when it differs from the value's zone", async () => {
    const notes = await notesOf(converter, {
      value: "2024-03-15T14:30:00+00:00[Europe/London]",
      from: "Asia/Tokyo",
      to: "UTC",
      locale: "en",
    });
    expect(
      notes.some((n) => n === fromIgnoredNote("Asia/Tokyo", "Europe/London")),
    ).toBe(true);
  });
});

describe("the DST inspector's notes", () => {
  it("names the preset and the disambiguation a call that sent none took", async () => {
    const notes = await notesOf(dst, { zone: "America/New_York", year: 2024 });
    expect(notes).toContain(seedNote(["preset", "disambiguation"]));
  });

  it("says a preset the inspector lacks was replaced", async () => {
    const notes = await notesOf(dst, {
      zone: "America/New_York",
      year: 2024,
      preset: "fixed",
      disambiguation: "compatible",
    });
    expect(notes).toContain(unknownPresetNote("fixed", "normal"));
  });

  it("says the offset rule is not read", async () => {
    const notes = await notesOf(dst, {
      zone: "America/New_York",
      year: 2024,
      preset: "gap",
      disambiguation: "compatible",
      offset: "prefer",
    });
    expect(notes).toContain(OFFSET_IGNORED);
  });

  it("says nothing was probed for a zone with no change that year", async () => {
    const notes = await notesOf(dst, {
      zone: "Asia/Tokyo",
      year: 2024,
      preset: "gap",
      disambiguation: "compatible",
    });
    expect(notes).toContain(noProbeNote("Asia/Tokyo", 2024, "gap"));
  });
});

describe("the interval visualizer's notes", () => {
  it("names the interval that is not valid", async () => {
    const notes = await notesOf(interval, {
      aStart: "2024-06-30T00:00:00+00:00[UTC]",
      aEnd: "2024-01-01T00:00:00+00:00[UTC]",
      bStart: "2024-04-01T00:00:00+00:00[UTC]",
      bEnd: "2024-12-31T00:00:00+00:00[UTC]",
    });
    expect(notes).toContain(invalidIntervalNote("A"));
    expect(notes).not.toContain(invalidIntervalNote("B"));
  });

  it("says a value with no zone was read as UTC", async () => {
    const notes = await notesOf(interval, {
      aStart: "2024-01-01T00:00:00",
      aEnd: "2024-06-30T00:00:00+00:00[UTC]",
      bStart: "2024-04-01T00:00:00+00:00[UTC]",
      bEnd: "2024-12-31T00:00:00+00:00[UTC]",
    });
    expect(
      notes.some((n) =>
        n.startsWith("aStart 2024-01-01T00:00:00 names no zone"),
      ),
    ).toBe(true);
    expect(intervalUnzoned("aStart", "a", "b")).toContain("aStart a");
  });

  it("has no note for four zoned values", async () => {
    const notes = await notesOf(interval, {
      aStart: "2024-01-01T00:00:00+00:00[UTC]",
      aEnd: "2024-06-30T00:00:00+00:00[UTC]",
      bStart: "2024-04-01T00:00:00+00:00[UTC]",
      bEnd: "2024-12-31T00:00:00+00:00[UTC]",
    });
    expect(notes).toEqual([]);
  });
});

describe("the zone planner's notes", () => {
  it("says which zones it could not place", async () => {
    const notes = await notesOf(planner, {
      zones: ["Europe/London", "Mars/Olympus_Mons"],
      time: "2024-03-10T12:00:00Z",
    });
    expect(notes).toContain(unplacedNote(["Mars/Olympus_Mons"]));
    expect(notes).not.toContain(NO_PLACEABLE_ZONES);
  });

  it("says when none can be placed", async () => {
    const notes = await notesOf(planner, {
      zones: ["Mars/Olympus_Mons"],
      time: "2024-03-10T12:00:00Z",
    });
    expect(notes).toContain(NO_PLACEABLE_ZONES);
  });

  it("says the clock was used when no usable time was given", async () => {
    const notes = await notesOf(planner, {
      zones: ["Europe/London"],
      time: "not a time at all",
    });
    expect(
      notes.some((n) => n.startsWith("No usable UTC instant was given")),
    ).toBe(true);
  });
});

describe("the zone planner's notes without a clock", () => {
  afterEach(() => {
    clock.unreadable = false;
  });

  it("says no zone was read when there is no time and no clock", async () => {
    clock.unreadable = true;
    const notes = await notesOf(planner, { zones: ["Europe/London"] });
    expect(notes).toContain(NO_INSTANT);
    expect(
      notes.some((n) => n.startsWith("No usable UTC instant was given")),
    ).toBe(false);
  });
});

describe("the globe's notes", () => {
  it("says the clock was read", async () => {
    const notes = await notesOf(earth, { zone: "Europe/London" });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^The current time, /);
  });

  it("says the library does not know the zone", async () => {
    const notes = await notesOf(earth, { zone: "Mars/Olympus_Mons" });
    expect(notes).toContain(unknownZoneNote("Mars/Olympus_Mons"));
  });
});
