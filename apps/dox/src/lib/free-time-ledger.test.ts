/// <reference types="vitest/globals" />
import type { DayCell } from "./dwell-ledger";
import {
  CUSTOM_PRESET_ID,
  FREE_TIME_PRESETS,
  LEDGER_ZONES,
  cellState,
  explainExpiryNull,
  explainNull,
  formatCharges,
  formatFreeTime,
  freeDaysOf,
  isClosedDate,
  matchPreset,
  normaliseWeekend,
  parseNumberList,
  readArgs,
  splitList,
  summaryText,
  termsOf,
  tierEnds,
  tiersOf,
  type ChargesResult,
  type LedgerState,
} from "./free-time-ledger";

const base: LedgerState = { ...FREE_TIME_PRESETS[0]! };

const cell = (date: string, touched = true): DayCell => ({
  startMs: 0,
  endMs: 1,
  date,
  hours: 24,
  touched,
});

const freeTime = {
  freeTimeStart: "2024-06-14",
  lastFreeDay: "2024-06-16",
  expiresAt: "2024-06-17T04:00:00Z",
};

const charges: ChargesResult = {
  freeDaysUsed: 3,
  chargeableDays: 12,
  expiresAt: "2024-06-17T04:00:00Z",
  chargedDates: [
    "2024-06-17",
    "2024-06-18",
    "2024-06-19",
    "2024-06-20",
    "2024-06-21",
    "2024-06-22",
    "2024-06-23",
    "2024-06-24",
    "2024-06-25",
    "2024-06-26",
    "2024-06-27",
    "2024-06-28",
  ],
  byTier: [
    { from: 1, to: 5, days: 5 },
    { from: 6, to: 10, days: 5 },
    { from: 11, to: null, days: 2 },
  ],
};

/** Validators that agree with the library for the strings these tests use. */
const validators = {
  isValidInstant: (v: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})(?:\[[^\]]+\])?$/.test(
      v,
    ),
  isValidTimeZone: (v: string) => LEDGER_ZONES.includes(v) || v === "UTC",
  isValidBusinessCalendar: (v: unknown) => {
    const c = v as { weekend: number[]; holidays: string[] };
    return (
      c.weekend.length < 7 &&
      c.holidays.every((h) => /^\d{4}-\d{2}-\d{2}$/.test(h))
    );
  },
};

describe("presets", () => {
  it("have unique ids, zones the picker offers, and are recognised from their controls", () => {
    const ids = FREE_TIME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of FREE_TIME_PRESETS) {
      expect(LEDGER_ZONES).toContain(preset.zone);
      expect(matchPreset(preset)).toBe(preset.id);
    }
  });

  it("fall back to custom when any term differs", () => {
    expect(matchPreset({ ...base, freeDays: "4" })).toBe(CUSTOM_PRESET_ID);
    expect(matchPreset({ ...base, firstDay: "nextDay" })).toBe(
      "read-as-next-day",
    );
    expect(matchPreset({ ...base, tiers: "5,10" })).toBe(CUSTOM_PRESET_ID);
  });

  it("ignores the weekend and holidays on the calendar basis when matching", () => {
    expect(
      matchPreset({ ...base, weekend: [5, 6], holidays: "2024-06-19" }),
    ).toBe(FREE_TIME_PRESETS[0]!.id);
  });
});

describe("reading text and arguments", () => {
  it("splits lists on commas and newlines", () => {
    expect(splitList(" 5, 10\n15 ,, ")).toEqual(["5", "10", "15"]);
    expect(parseNumberList("5, 10")).toEqual([5, 10]);
    expect(parseNumberList("5, ten")).toBeNull();
    expect(normaliseWeekend([7, 6, 6, 2.5])).toEqual([6, 7]);
  });

  it("reads typed chat arguments and string permalink arguments alike", () => {
    const typed = readArgs({
      clockStart: "a",
      clockEnd: "b",
      freeDays: 3,
      firstDay: "nextDay",
      basis: "working",
      zone: "America/New_York",
      weekend: [7, 6],
      holidays: ["2024-06-19", "2024-07-04"],
      tiers: [5, 10],
    });
    const text = readArgs({
      clockStart: "a",
      clockEnd: "b",
      freeDays: "3",
      firstDay: "nextDay",
      basis: "working",
      zone: "America/New_York",
      weekend: "6,7",
      holidays: "2024-06-19,2024-07-04",
      tiers: "5,10",
    });
    expect(typed).toEqual(text);
    expect(typed.weekend).toEqual([6, 7]);
    expect(typed.holidays).toBe("2024-06-19\n2024-07-04");
    expect(typed.tiers).toBe("5, 10");
  });

  it("falls back to the first preset's terms, never to a guess, for unusable values", () => {
    const s = readArgs({
      clockStart: "a",
      firstDay: "someDay",
      basis: "lunar",
    });
    expect(s.firstDay).toBe("eventDay");
    expect(s.basis).toBe("calendar");
    expect(s.freeDays).toBe(base.freeDays);
    expect(s.weekend).toEqual([6, 7]);
    expect(s.clockEnd).toBe("");
  });
});

describe("the library's arguments", () => {
  it("adds the calendar only on the working basis", () => {
    expect(termsOf(base)).toEqual({
      basis: "calendar",
      timeZone: "America/New_York",
      firstDay: "eventDay",
    });
    expect(
      termsOf({ ...base, basis: "working", holidays: "2024-06-19\n" }),
    ).toEqual({
      basis: "working",
      timeZone: "America/New_York",
      firstDay: "eventDay",
      calendar: {
        weekend: [6, 7],
        holidays: ["2024-06-19"],
        timeZone: "America/New_York",
      },
    });
  });

  it("reads free days and tiers as the library will see them", () => {
    expect(freeDaysOf(base)).toBe(3);
    expect(freeDaysOf({ ...base, freeDays: "" })).toBeNaN();
    expect(tiersOf(base)).toBeUndefined();
    expect(tiersOf({ ...base, tiers: "5, 10" })).toEqual([5, 10]);
    expect(tiersOf({ ...base, tiers: "five" })).toBeNull();
  });
});

describe("cellState", () => {
  it("colours each touched day the way the tariff reads it", () => {
    expect(cellState(cell("2024-06-17"), base, freeTime, charges)).toBe(
      "chargeable",
    );
    expect(cellState(cell("2024-06-15"), base, freeTime, charges)).toBe("free");
    expect(cellState(cell("2024-06-13", false), base, freeTime, charges)).toBe(
      "none",
    );
    expect(cellState(cell("2024-06-30", false), base, freeTime, charges)).toBe(
      "none",
    );
  });

  it("marks the uncounted event day and the closed days", () => {
    const nextDay: LedgerState = { ...base, firstDay: "nextDay" };
    const window = {
      ...freeTime,
      freeTimeStart: "2024-06-15",
      lastFreeDay: "2024-06-17",
    };
    expect(
      cellState(cell("2024-06-14"), nextDay, window, {
        ...charges,
        chargedDates: [],
      }),
    ).toBe("event");
    const working: LedgerState = {
      ...base,
      basis: "working",
      holidays: "2024-06-19",
    };
    expect(
      cellState(cell("2024-06-15"), working, freeTime, {
        ...charges,
        chargedDates: [],
      }),
    ).toBe("closed");
    expect(
      cellState(cell("2024-06-19"), working, freeTime, {
        ...charges,
        chargedDates: [],
      }),
    ).toBe("closed");
    expect(isClosedDate("2024-06-15", "calendar", [6, 7], [])).toBe(false);
    expect(isClosedDate("not a date", "working", [6, 7], [])).toBe(false);
  });

  it("treats every touched day as the event day when there is no free window and no charge", () => {
    const zero: LedgerState = { ...base, freeDays: "0", firstDay: "nextDay" };
    expect(
      cellState(cell("2024-06-14"), zero, null, {
        ...charges,
        chargedDates: ["2024-06-15"],
      }),
    ).toBe("event");
  });

  it("names the last charged date of each closed tier band", () => {
    expect([...tierEnds(charges)]).toEqual(["2024-06-21", "2024-06-26"]);
    expect([
      ...tierEnds({
        ...charges,
        chargedDates: charges.chargedDates.slice(0, 3),
      }),
    ]).toEqual([]);
    expect(tierEnds(null).size).toBe(0);
  });
});

describe("formatting", () => {
  it("prints the results the way the guide does, one key per line", () => {
    expect(formatFreeTime(freeTime)).toBe(
      '{ freeTimeStart: "2024-06-14",\n  lastFreeDay: "2024-06-16",\n  expiresAt: "2024-06-17T04:00:00Z" }',
    );
    expect(
      formatCharges({
        freeDaysUsed: 3,
        chargeableDays: 1,
        expiresAt: "2024-06-17T04:00:00Z",
        chargedDates: ["2024-06-17"],
        byTier: [{ from: 1, to: null, days: 1 }],
      }),
    ).toBe(
      '{ freeDaysUsed: 3,\n  chargeableDays: 1,\n  expiresAt: "2024-06-17T04:00:00Z",\n  chargedDates: ["2024-06-17"],\n  byTier: [{ from: 1, to: null, days: 1 }] }',
    );
    expect(
      summaryText({ ...charges, chargeableDays: 1, freeDaysUsed: 1 }),
    ).toBe("1 free day used · 1 chargeable day");
    expect(summaryText(charges)).toBe("3 free days used · 12 chargeable days");
  });
});

describe("explainNull", () => {
  it("names the check the library failed, in the library's order", () => {
    expect(explainNull(base, validators)).toBeNull();
    expect(explainNull({ ...base, clockStart: "2024-06-14" }, validators)).toBe(
      "invalid-start",
    );
    expect(explainNull({ ...base, clockEnd: "soon" }, validators)).toBe(
      "invalid-end",
    );
    expect(explainNull({ ...base, zone: "Mars/Olympus" }, validators)).toBe(
      "unknown-zone",
    );
    expect(
      explainNull(
        { ...base, basis: "working", weekend: [1, 2, 3, 4, 5, 6, 7] },
        validators,
      ),
    ).toBe("invalid-calendar");
    expect(explainNull({ ...base, freeDays: "2.5" }, validators)).toBe(
      "invalid-free-days",
    );
    expect(explainNull({ ...base, freeDays: "-1" }, validators)).toBe(
      "invalid-free-days",
    );
    expect(explainNull({ ...base, tiers: "10, 5" }, validators)).toBe(
      "invalid-tiers",
    );
    expect(explainNull({ ...base, tiers: "five" }, validators)).toBe(
      "invalid-tiers",
    );
    expect(
      explainNull(
        { ...base, clockStart: base.clockEnd, clockEnd: base.clockStart },
        validators,
      ),
    ).toBe("inverted");
  });

  it("explains freeTimeExpiry's extra case: zero free days is a note, not an error", () => {
    expect(explainExpiryNull({ ...base, freeDays: "0" }, validators)).toBe(
      "no-free-days",
    );
    expect(
      explainExpiryNull(
        { ...base, freeDays: "0", clockEnd: "soon" },
        validators,
      ),
    ).toBe("no-free-days");
    expect(
      explainExpiryNull({ ...base, clockEnd: "soon" }, validators),
    ).toBeNull();
    expect(
      explainExpiryNull({ ...base, zone: "Mars/Olympus" }, validators),
    ).toBe("unknown-zone");
  });
});
