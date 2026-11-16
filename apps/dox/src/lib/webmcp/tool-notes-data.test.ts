/**
 * Sentences the database, identifier, cron, expiry, duration, holiday and date tools say and their
 * pages never show: what a call that leaves a value out, reads the clock, or is cut short is told.
 */
import { describe, expect, it } from "vitest";
import { CLAMP_NOTE, holidayNoteOf, MAX_YEARS } from "../observance-comparator";
import {
  HOST_NOTE_TEXT,
  NOT_STORED_TEXT,
  parseAuditLines,
  truncatedText,
} from "../stored-time-audit";
import { HINT_NOW_NULL } from "../expiry-calculator";
import { NO_SIGNAL_TEXT } from "../holiday-rule-builder";
import { seedNote } from "./seed-note";
import bridge from "./tools/column-timestamp-bridge";
import cron, { defaultZoneNote, listCapNote } from "./tools/cron-in-a-zone";
import database from "./tools/database-timestamp-reader";
import duration, {
  defaultLocaleNote,
  noWordsNote,
} from "./tools/duration-parser-bench";
import expiry, {
  currentTimeNote,
  invalidStartNote,
} from "./tools/expiry-calculator";
import holiday, { zoneNote } from "./tools/holiday-rule-builder";
import id from "./tools/id-timestamp-decoder";
import leap, { defaultYearNote, noLocaleNote } from "./tools/leap-day-birthday";
import feasts from "./tools/moving-feasts";
import observance, { columnReasonNote } from "./tools/observance-comparator";
import stored from "./tools/stored-time-audit";

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

describe("seedNote", () => {
  it("names one value the page started with", () => {
    expect(seedNote(["year"])).toBe(
      "year was not given, so the page's starting value was used.",
    );
  });

  it("names several, in the order given", () => {
    expect(seedNote(["rules", "weekend", "year"])).toBe(
      "rules, weekend, year were not given, so the page's starting values were used.",
    );
  });
});

describe("the notes a tool adds beyond its page", () => {
  it("names the unit a column call took when it sent none", async () => {
    const notes = await notesOf(bridge, { value: "2024-01-01T00:00:00Z" });
    expect(notes).toContain(seedNote(["unit"]));
  });

  it("does not name the unit when the call sent one", async () => {
    const notes = await notesOf(bridge, {
      value: "2024-01-01T00:00:00Z",
      unit: "millisecond",
    });
    expect(notes).not.toContain(seedNote(["unit"]));
  });

  it("gives the reason for a database value the library refuses", async () => {
    const notes = await notesOf(database, {
      form: "postgresql-timestamptz",
      value: "not a time",
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).not.toBe("");
  });

  it("says nothing for a database value that reads", async () => {
    const notes = await notesOf(database, {
      form: "postgresql-timestamptz",
      value: "2024-03-15 14:30:00+00",
    });
    expect(notes).toEqual([]);
  });

  it("says the audit runs under this browser's rules, and what it could not read", async () => {
    const notes = await notesOf(stored, { values: "not a stored time" });
    expect(notes).toContain(HOST_NOTE_TEXT);
    expect(notes).toContain(NOT_STORED_TEXT);
  });

  it("says how many lines were cut", async () => {
    const values = Array.from(
      { length: 20 },
      () => "2024-03-31T02:30:00+01:00[Europe/Berlin]",
    ).join("\n");
    const cut = truncatedText(parseAuditLines(values));
    expect(cut).not.toBe("");
    expect(await notesOf(stored, { values })).toContain(cut);
  });

  it("says nothing was cut when nothing was", async () => {
    const values = "2024-03-31T02:30:00+01:00[Europe/Berlin]";
    expect(truncatedText(parseAuditLines(values))).toBe("");
    expect(await notesOf(stored, { values })).toEqual([HOST_NOTE_TEXT]);
  });

  it("says why a Snowflake was not tried, once", async () => {
    const notes = await notesOf(id, { id: "175928847299117063" });
    expect(notes.length).toBeGreaterThan(0);
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("names the zone a cron call took when it sent none, and the cap on each list", async () => {
    const notes = await notesOf(cron, { line: "30 1 * * *", year: 2024 });
    expect(
      notes.some((n) => n.startsWith(defaultZoneNote("").slice(0, 20))),
    ).toBe(true);
    expect(notes).toContain(listCapNote());
  });

  it("does not name a zone the call sent", async () => {
    const notes = await notesOf(cron, {
      line: "30 1 * * *",
      zone: "Europe/London",
      year: 2024,
    });
    expect(notes.some((n) => n.startsWith("No zone was given"))).toBe(false);
  });

  it("names the locale a duration call took when it sent none", async () => {
    const notes = await notesOf(duration, { text: "2h 30m" });
    expect(notes).toContain(defaultLocaleNote("en"));
  });

  it("says when formatDuration has no words for the locale", async () => {
    const notes = await notesOf(duration, { text: "2h 30m", locale: "!!" });
    expect(notes.some((n) => n === noWordsNote("!!"))).toBe(true);
  });

  it("names the start an expiry call took from the clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime("2026-11-16T12:00:00Z");
      const notes = await notesOf(expiry, { amount: 2, unit: "days" });
      expect(notes).toContain(currentTimeNote("2026-11-16T12:00:00Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("says ttlFromNow has no answer for a length it cannot take", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime("2026-11-16T12:00:00Z");
      const notes = await notesOf(expiry, { amount: 9999999, unit: "years" });
      expect(notes).toContain(HINT_NOW_NULL);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says isValidUtc refused a start", async () => {
    const notes = await notesOf(expiry, {
      amount: 1,
      unit: "years",
      start: "not a date",
    });
    expect(notes).toContain(invalidStartNote("not a date"));
  });

  it("names the year a leap-day call took from the clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime("2026-11-16T12:00:00Z");
      const notes = await notesOf(leap, { value: "2000-02-29" });
      expect(notes).toContain(defaultYearNote("2026"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when formatMonthDay has no text for the locale", async () => {
    const notes = await notesOf(leap, {
      value: "2000-02-29",
      year: 2024,
      locale: "en-US-US",
    });
    expect(notes).toContain(noLocaleNote("en-US-US"));
  });

  it("names every value an Easter call left out", async () => {
    const notes = await notesOf(feasts, {});
    expect(notes).toContain(
      seedNote(["year", "offsets", "month", "weekday", "n"]),
    );
  });

  it("names the values a holiday call left out, and the date a rule could not place", async () => {
    const notes = await notesOf(holiday, {
      rules: [{ kind: "fixed", name: "30 Feb", month: 2, day: 30 }],
    });
    expect(notes).toContain(seedNote(["weekend", "year", "zone"]));
    expect(notes.some((n) => n.startsWith(NO_SIGNAL_TEXT))).toBe(true);
  });

  it("says the zone, not a rule, is why no calendar was built", async () => {
    const notes = await notesOf(holiday, {
      rules: [{ kind: "fixed", name: "New Year", month: 1, day: 1 }],
      weekend: [6, 7],
      year: 2024,
      zone: "Not/AZone",
    });
    expect(notes).toEqual([zoneNote("Not/AZone")]);
  });

  it("names the values an observance call left out", async () => {
    const notes = await notesOf(observance, {
      holidays: [{ month: 12, day: 25 }],
    });
    expect(notes).toContain(seedNote(["years", "weekend", "policies"]));
  });

  it("says a span of more than twelve years was cut", async () => {
    const notes = await notesOf(observance, {
      holidays: [{ month: 12, day: 25 }],
      years: { from: 2000, to: 2000 + MAX_YEARS + 3 },
      weekend: [6, 7],
    });
    expect(notes).toContain(CLAMP_NOTE);
  });

  it("names a holiday that is not a date, and the column with no signal", async () => {
    const notes = await notesOf(observance, {
      holidays: [{ month: 2, day: 30 }],
      years: { from: 2020, to: 2024 },
      weekend: [6, 7],
    });
    expect(notes).toContain(holidayNoteOf([1]));
  });

  it("words a column's reason as a numbered sentence", () => {
    expect(columnReasonNote(2, "the policy is empty")).toBe(
      "Column 2 has no signal: the policy is empty.",
    );
  });
});
