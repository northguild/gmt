/**
 * The GTFS Time Reader's pure half, against the real library in `dist`: every preset's read,
 * fold and write, the order of the reason probes, the round trip and the permalink both ways.
 * Every expected value is the library's own (`railLib`), never a literal the site computed.
 */
import { railLib } from "~/test/rail-lib";
import {
  CLOCK_NOTE_TEXT,
  CUSTOM_PRESET_ID,
  READ_PRESETS,
  READ_REASONS,
  READING_SAMPLE,
  RECORD_SAMPLE,
  WRITE_PRESETS,
  WRITE_REASONS,
  callsSizerText,
  daysText,
  foldGtfs,
  foldMeaning,
  foldVerdictText,
  isSeeded,
  matchReadPreset,
  matchWritePreset,
  permalinkOf,
  presetState,
  readArgs,
  readGtfs,
  readingText,
  recordText,
  writeGtfs,
} from "./gtfs-time-reader";

const readPreset = (id: string) => {
  const found = READ_PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
};
const writePreset = (id: string) => {
  const found = WRITE_PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
};

describe("the read presets, against the library", () => {
  it.each(READ_PRESETS.map((p) => [p.id, p.value] as const))(
    "%s reads as the library reads it",
    (_id, value) => {
      const r = readGtfs(railLib, value);
      const expected = railLib.parseGtfsTime(value);
      expect(r.record).toEqual(expected);
      expect(r.valid).toBe(railLib.isValidGtfsTime(value));
      expect(r.kind).toBe(expected === null ? "refused" : "read");
      if (expected !== null) {
        expect(r.lessDays).toBe(
          railLib.formatGtfsTime({ seconds: expected.seconds, dayOverflow: 0 }),
        );
        expect(r.writtenBack).toBe(railLib.formatGtfsTime(expected));
      } else {
        expect(r.lessDays).toBeNull();
        expect(r.writtenBack).toBeNull();
      }
    },
  );

  it("reads the opening preset as one day past the service day", () => {
    const r = readGtfs(railLib, readPreset("next-day").value);
    expect(r.record).toEqual({ seconds: 5700, dayOverflow: 1 });
    expect(r.lessDays).toBe("01:35:00");
    expect(r.writtenBack).toBe("25:35:00");
    expect(readingText(1, r.lessDays!)).toBe(
      "1 day past the service day, 01:35:00",
    );
  });

  it("writes one and three hour digits back as two and three", () => {
    expect(readGtfs(railLib, "8:05:00").writtenBack).toBe("08:05:00");
    expect(readGtfs(railLib, "008:05:00").writtenBack).toBe("08:05:00");
    expect(readGtfs(railLib, "110:29:00").writtenBack).toBe("110:29:00");
  });

  it("makes an empty box no call", () => {
    const r = readGtfs(railLib, "");
    expect(r.kind).toBe("empty");
    expect(r.calls).toEqual([]);
    expect(r.valid).toBeNull();
  });

  it("prints the calls with their results", () => {
    const r = readGtfs(railLib, "25:35:00");
    expect(r.calls).toEqual([
      'parseGtfsTime("25:35:00"); // { seconds: 5700, dayOverflow: 1 }',
      'isValidGtfsTime("25:35:00"); // true',
      'formatGtfsTime({ seconds: 5700, dayOverflow: 0 }); // "01:35:00"',
      'formatGtfsTime({ seconds: 5700, dayOverflow: 1 }); // "25:35:00"',
    ]);
  });
});

describe("the read reasons, in probe order", () => {
  it.each([
    ["bad-minute", "badMinute"],
    ["four-digits", "fourDigitHour"],
    ["no-seconds", "noSeconds"],
    ["sign", "sign"],
    ["fraction", "fraction"],
  ] as const)("%s names its own reason", (id, reason) => {
    const r = readGtfs(railLib, readPreset(id).value);
    expect(r.kind).toBe("refused");
    expect(r.reason).toBe(reason);
  });

  it("asks the library about the trimmed text first", () => {
    for (const text of [" 25:35:00", "25:35:00\n", "\t25:35:00", "﻿25:35:00"]) {
      const r = readGtfs(railLib, text);
      expect(r.kind).toBe("refused");
      expect(r.reason).toBe("trimmed");
      expect(r.calls[r.calls.length - 1]).toBe(
        'parseGtfsTime("25:35:00"); // { seconds: 5700, dayOverflow: 1 }',
      );
    }
  });

  it("gives a preset's reason only to that exact text", () => {
    expect(readGtfs(railLib, "25:61:00").reason).toBe("shape");
    expect(readGtfs(railLib, "1001:00:00").reason).toBe("shape");
    expect(readGtfs(railLib, "25:60:01").reason).toBe("shape");
  });

  it("gives every other refusal the generic shape reason", () => {
    for (const text of ["abc", "25:35:0", "25-35-00", "٢٥:٣٥:٠٠"]) {
      const r = readGtfs(railLib, text);
      expect(r.kind).toBe("refused");
      expect(r.reason).toBe("shape");
    }
  });

  it("does not trim a text that the library reads", () => {
    const r = readGtfs(railLib, "25:35:59");
    expect(r.kind).toBe("read");
    expect(r.calls[0]).toContain('"25:35:59"');
  });
});

describe("the fold", () => {
  it("shows the clock-time check refusing a stop after midnight", () => {
    const r = readGtfs(railLib, "25:35:00");
    const f = foldGtfs(railLib, "25:35:00", r);
    expect(f.clockValid).toBe(railLib.isValidTime("25:35:00"));
    expect(f.clockValid).toBe(false);
    expect(f.folded).toBe("01:35:00");
    expect(f.foldedBack).toEqual({ seconds: 5700, dayOverflow: 0 });
    expect(f.lost).toBe(1);
    expect(foldVerdictText(f.lost)).toBe("loses the service day: 1 day");
  });

  it("loses nothing for a daytime time", () => {
    const r = readGtfs(railLib, "14:30:00");
    const f = foldGtfs(railLib, "14:30:00", r);
    expect(f.clockValid).toBe(true);
    expect(f.lost).toBe(0);
    expect(foldVerdictText(0)).toBe("nothing lost below midnight");
  });

  it("shows whatever the library says about 8:05:00", () => {
    const f = foldGtfs(railLib, "8:05:00", readGtfs(railLib, "8:05:00"));
    expect(f.clockValid).toBe(railLib.isValidTime("8:05:00"));
  });

  it("counts every whole day lost", () => {
    const f = foldGtfs(railLib, "110:29:00", readGtfs(railLib, "110:29:00"));
    expect(f.lost).toBe(4);
    expect(foldVerdictText(f.lost)).toBe("loses the service day: 4 days");
  });

  it("does not run for an empty or refused read", () => {
    expect(foldGtfs(railLib, "", readGtfs(railLib, "")).kind).toBe("empty");
    const refused = foldGtfs(
      railLib,
      "25:60:00",
      readGtfs(railLib, "25:60:00"),
    );
    expect(refused.kind).toBe("notRead");
    expect(refused.calls).toEqual([]);
  });

  it("explains the fold without naming a date", () => {
    const f = foldGtfs(railLib, "25:35:00", readGtfs(railLib, "25:35:00"));
    expect(foldMeaning(f)).toBe(
      "Folded, 01:35:00 sits at the start of the service day, not after its midnight.",
    );
  });
});

describe("the write presets, against the library", () => {
  it.each(WRITE_PRESETS.map((p) => [p.id, p.seconds, p.dayOverflow] as const))(
    "%s writes what the library writes",
    (_id, seconds, dayOverflow) => {
      const w = writeGtfs(railLib, seconds, dayOverflow);
      const expected = railLib.formatGtfsTime({
        seconds: Number(seconds),
        dayOverflow: Number(dayOverflow),
      });
      expect(w.written).toBe(expected === "" ? null : expected);
      expect(w.kind).toBe(expected === "" ? "refused" : "written");
    },
  );

  it("round-trips the opening preset", () => {
    const w = writeGtfs(railLib, "5700", "1");
    expect(w.written).toBe("25:35:00");
    expect(w.back).toEqual({ seconds: 5700, dayOverflow: 1 });
    expect(w.same).toBe(true);
  });

  it("writes 120 hours with three digits", () => {
    const w = writeGtfs(railLib, "0", "5");
    expect(w.written).toBe("120:00:00");
    expect(w.same).toBe(true);
  });

  it("writes 999:59:59 and refuses 1000 hours", () => {
    expect(writeGtfs(railLib, "57599", "41").written).toBe("999:59:59");
    const w = writeGtfs(railLib, "57600", "41");
    expect(w.kind).toBe("refused");
    expect(w.reason).toBe("hours");
  });

  it("names the days, then the seconds, then the hours", () => {
    expect(writeGtfs(railLib, "0", "-1").reason).toBe("days");
    expect(writeGtfs(railLib, "0", "1.5").reason).toBe("days");
    expect(writeGtfs(railLib, "86400", "0").reason).toBe("seconds");
    expect(writeGtfs(railLib, "1.5", "0").reason).toBe("seconds");
    expect(writeGtfs(railLib, "-1", "0").reason).toBe("seconds");
    expect(writeGtfs(railLib, "57600", "41").reason).toBe("hours");
  });

  it("makes no call for an empty or non-numeric box", () => {
    for (const [s, d, kind] of [
      ["", "1", "empty"],
      ["5700", "", "empty"],
      ["abc", "1", "notNumber"],
      ["5700", "1e3", "notNumber"],
      [" 5", "1", "notNumber"],
      ["5700", "1 ", "notNumber"],
      ["+5", "1", "notNumber"],
      ["5.", "1", "notNumber"],
    ] as const) {
      const w = writeGtfs(railLib, s, d);
      expect(w.kind).toBe(kind);
      expect(w.calls).toEqual([]);
    }
  });

  it("sends a number the library refuses straight to the library", () => {
    const w = writeGtfs(railLib, "-1", "5");
    expect(w.kind).toBe("refused");
    expect(w.calls[0]).toBe(
      'formatGtfsTime({ seconds: -1, dayOverflow: 5 }); // ""',
    );
  });
});

describe("the words", () => {
  it("counts days", () => {
    expect(daysText(0)).toBe("0 days");
    expect(daysText(1)).toBe("1 day");
    expect(daysText(41)).toBe("41 days");
  });

  it("holds the widest record and reading", () => {
    expect(READING_SAMPLE).toBe("41 days past the service day, 23:59:59");
    expect(RECORD_SAMPLE).toBe(recordText({ seconds: 86399, dayOverflow: 41 }));
    expect(RECORD_SAMPLE).toBe("{ seconds: 86399, dayOverflow: 41 }");
  });

  it("states the clock note once, naming gtfsToInstant as planned", () => {
    expect(CLOCK_NOTE_TEXT).toContain("noon minus 12 hours");
    expect(CLOCK_NOTE_TEXT).toContain(
      "gtfsToInstant, planned for a later release",
    );
  });

  it("never names a date, a weekday or midnight-since", () => {
    const all = [
      ...Object.values(READ_REASONS),
      ...Object.values(WRITE_REASONS),
      CLOCK_NOTE_TEXT,
    ].join(" ");
    expect(all).not.toMatch(/following date|since midnight|tomorrow/i);
  });
});

describe("the calls frames", () => {
  it("sizes each frame to its widest printing", () => {
    expect(callsSizerText("read").split("\n")).toHaveLength(4);
    expect(callsSizerText("fold").split("\n")).toHaveLength(2);
    expect(callsSizerText("write").split("\n")).toHaveLength(3);
  });
});

describe("the permalink and the seed", () => {
  it("matches presets by exact text", () => {
    expect(matchReadPreset("25:35:00")).toBe("next-day");
    expect(matchReadPreset("25:35:00 ")).toBe(CUSTOM_PRESET_ID);
    expect(matchWritePreset("5700", "1")).toBe("write-next-day");
    expect(matchWritePreset("5700", "2")).toBe(CUSTOM_PRESET_ID);
  });

  it("holds a preset's id while a box matches it", () => {
    expect(permalinkOf(presetState())).toEqual({
      preset: "next-day",
      writePreset: "write-next-day",
    });
  });

  it("holds the text of a box that matches none, blank included", () => {
    expect(permalinkOf({ value: "", seconds: "", dayOverflow: "" })).toEqual({
      value: "",
      seconds: "",
      dayOverflow: "",
    });
    expect(
      permalinkOf({ value: "26:00:00", seconds: "5700", dayOverflow: "1" }),
    ).toEqual({ value: "26:00:00", writePreset: "write-next-day" });
  });

  it("round-trips every state through readArgs", () => {
    for (const state of [
      presetState(),
      presetState(readPreset("sign"), writePreset("write-1000h")),
      { value: "", seconds: "", dayOverflow: "" },
      { value: "30:00:00", seconds: "12", dayOverflow: "3" },
    ]) {
      expect(readArgs(permalinkOf(state))).toEqual(state);
    }
  });

  it("opens a blank value as blank, not the default", () => {
    expect(readArgs({ value: "" }).value).toBe("");
    expect(readArgs({ value: "" }).seconds).toBe("5700");
  });

  it("knows a seed from none", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ value: "" })).toBe(true);
    expect(isSeeded({ dayOverflow: "0" })).toBe(true);
  });
});
