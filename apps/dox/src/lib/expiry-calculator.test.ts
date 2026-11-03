import { expiryLib as lib } from "~/test/expiry-lib";
import { showExpiryCalculatorInput } from "./dox-tools";
import {
  CALL_LINES,
  CUSTOM_PRESET_ID,
  EXPIRY_PRESETS,
  ROW_COUNT,
  callsOf,
  callsSizerLine,
  compare,
  compareWord,
  handWritten,
  isSeeded,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readTtl,
  sentenceOf,
  startAt,
  stripRows,
  takeSnapshot,
  unitsOf,
  verdictText,
  type ExpiryState,
} from "./expiry-calculator";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

afterEach(() => {
  vi.useRealTimers();
});

const state = (over: Partial<ExpiryState> = {}): ExpiryState => ({
  ...presetState(EXPIRY_PRESETS[0]!),
  ...over,
});
const byId = (id: string) => EXPIRY_PRESETS.find((p) => p.id === id)!;

/** What each preset teaches, run through the pure route. */
const EXPECTED: Record<string, [number, string, number, string]> = {
  "year-across-leap": [
    31622400,
    "Thu, 15 Jun 2028 12:00:00 GMT",
    0,
    "2028-06-15T12:00:00Z",
  ],
  "year-common": [
    31536000,
    "Tue, 15 Jun 2027 12:00:00 GMT",
    0,
    "2027-06-15T12:00:00Z",
  ],
  "year-from-leap-day": [
    31536000,
    "Wed, 28 Feb 2029 12:00:00 GMT",
    0,
    "2029-02-28T12:00:00Z",
  ],
  "month-february": [
    2419200,
    "Wed, 10 Mar 2027 12:00:00 GMT",
    0,
    "2027-03-10T12:00:00Z",
  ],
  "month-end": [
    2419200,
    "Sun, 28 Feb 2027 12:00:00 GMT",
    0,
    "2027-02-28T12:00:00Z",
  ],
  "signed-url-90": [
    7776000,
    "Mon, 13 Sep 2027 12:00:00 GMT",
    0,
    "2027-09-13T12:00:00Z",
  ],
  "delete-cookie": [
    -86400,
    "Mon, 14 Jun 2027 12:00:00 GMT",
    0,
    "2027-06-14T12:00:00Z",
  ],
};

describe("the presets", () => {
  it("each matches itself, is pinned at noon UTC and has a description", () => {
    for (const p of EXPIRY_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
      expect(p.start).toMatch(/T12:00:00Z$/);
      expect(p.description.length).toBeGreaterThan(0);
    }
    expect(EXPIRY_PRESETS[0]!.id).toBe("year-across-leap");
  });

  it.each(EXPIRY_PRESETS.map((p) => [p.id]))(
    "%s gives the documented four forms by the pure route",
    (id) => {
      const p = byId(id!);
      const got = platesOf(lib, presetState(p), undefined);
      const [maxAge, expires, exp, signed] = EXPECTED[id!]!;
      expect(got.maxAge).toBe(maxAge);
      expect(got.expires).toBe(expires);
      if (exp !== 0) expect(got.exp).toBe(exp);
      else expect(got.exp).toEqual(expect.any(Number));
      expect(got.signed).toBe(signed);
    },
  );

  it("agrees with the unix epoch of the signed-URL time", () => {
    for (const p of EXPIRY_PRESETS) {
      const got = platesOf(lib, presetState(p), undefined);
      expect(got.exp).toBe(
        lib.convertUtcToUnix(got.signed!, { epochUnit: "seconds" }),
      );
    }
  });
});

describe("parity between the pure route and ttlFromNow", () => {
  it.each(EXPIRY_PRESETS.map((p) => [p.id]))(
    "%s: every field of ttlFromNow equals its pure plate",
    (id) => {
      const p = byId(id!);
      vi.useFakeTimers();
      vi.setSystemTime(
        lib.convertUtcToUnix(p.start, { epochUnit: "seconds" })! * 1000,
      );
      const pure = platesOf(lib, presetState(p), undefined);
      const now = { ...presetState(p), mode: "now" as const };
      const ttl = readTtl(lib, now);
      if (id === "delete-cookie") {
        expect(ttl).toBeNull();
        expect(pure.maxAge).toBe(-86400);
        return;
      }
      expect(ttl?.seconds).toBe(pure.maxAge);
      expect(ttl?.httpDate).toBe(pure.expires);
      expect(ttl?.epochSeconds).toBe(pure.exp);
      expect(ttl?.iso).toBe(pure.signed);
      expect(platesOf(lib, now, ttl)).toEqual(pure);
    },
  );
});

describe("refusals", () => {
  it("an empty amount is never 0: every plate has no result and no call is made", () => {
    const s = state({ amount: "" });
    expect(unitsOf(s)).toBeNull();
    expect(handWritten(s)).toBeNull();
    expect(platesOf(lib, s, undefined)).toEqual({
      maxAge: null,
      expires: null,
      exp: null,
      signed: null,
    });
    expect(callsOf(lib, s, undefined)).toEqual([
      "// Amount is empty: no call is made.",
    ]);
  });

  it("a word is not a number", () => {
    expect(unitsOf(state({ amount: "abc" }))).toBeNull();
    expect(callsOf(lib, state({ amount: "abc" }), undefined)[0]).toContain(
      "is not a number",
    );
  });

  it("1.5 years is refused on every plate, in both routes", () => {
    const s = state({ amount: "1.5" });
    expect(platesOf(lib, s, undefined)).toEqual({
      maxAge: null,
      expires: null,
      exp: null,
      signed: null,
    });
    expect(readTtl(lib, { ...s, mode: "now" })).toBeNull();
  });

  it("300000 years empties every plate in a date", () => {
    expect(platesOf(lib, state({ amount: "300000" }), undefined)).toEqual({
      maxAge: null,
      expires: null,
      exp: null,
      signed: null,
    });
  });

  it("8000 years empties only Expires in a date, and all four under Now", () => {
    const s = state({ amount: "8000" });
    const pure = platesOf(lib, s, undefined);
    expect(pure.expires).toBeNull();
    expect(pure.maxAge).not.toBeNull();
    expect(pure.exp).not.toBeNull();
    expect(pure.signed).not.toBeNull();
    const now = { ...s, mode: "now" as const };
    const ttl = readTtl(lib, now);
    expect(ttl).toBeNull();
    expect(platesOf(lib, now, ttl)).toEqual({
      maxAge: null,
      expires: null,
      exp: null,
      signed: null,
    });
  });

  it("an invalid start gives no plate, and prints the check that failed", () => {
    const s = state({ start: "2027-06-15" });
    expect(platesOf(lib, s, undefined).maxAge).toBeNull();
    expect(callsOf(lib, s, undefined)).toEqual([
      'isValidUtc("2027-06-15"); // false',
    ]);
  });

  it("a typed start is never rounded", () => {
    const s = state({ start: "2027-06-15T12:00:00.5Z" });
    expect(callsOf(lib, s, undefined).join("\n")).toContain(
      '"2027-06-15T12:00:00.5Z"',
    );
  });

  it("a negative length is a date result and a Now refusal", () => {
    const s = state({ amount: "-1", unit: "days" });
    expect(platesOf(lib, s, undefined).maxAge).toBe(-86400);
    expect(readTtl(lib, { ...s, mode: "now" })).toBeNull();
  });
});

describe("the printed calls", () => {
  it("a date prints four calls with their results", () => {
    const lines = callsOf(lib, state(), undefined);
    expect(lines.filter((l) => !l.startsWith("//"))).toHaveLength(4);
    expect(lines[0]).toContain("convertUtcToZoned");
    expect(lines[0]).toContain("// 31622400");
    expect(lines.join("\n")).toContain('{ epochUnit: "seconds" }');
  });

  it("Now prints the call and its five fields, milliseconds included", () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      lib.convertUtcToUnix("2027-06-15T12:00:00Z", { epochUnit: "seconds" })! *
        1000,
    );
    const s = state({ mode: "now" });
    const lines = callsOf(lib, s, readTtl(lib, s));
    expect(lines).toHaveLength(CALL_LINES);
    expect(lines[0]).toBe("ttlFromNow({ years: 1 });");
    expect(lines.join("\n")).toContain("// milliseconds: 31622400000");
  });

  it("Now prints the call and null when the library refuses", () => {
    const s = state({ mode: "now", amount: "-1", unit: "days" });
    expect(callsOf(lib, s, null)).toEqual([
      "ttlFromNow({ days: -1 }); // null",
    ]);
  });

  it("the sizer is at least as wide as every line it stands for", () => {
    const sizer = callsSizerLine();
    for (const p of EXPIRY_PRESETS) {
      for (const line of callsOf(lib, presetState(p), undefined)) {
        expect(line.length).toBeLessThanOrEqual(sizer.length);
      }
    }
  });
});

describe("the hand-written number and the verdict", () => {
  it("is the amount times a fixed length for the unit", () => {
    expect(handWritten(state({ amount: "1", unit: "years" }))).toBe(31536000);
    expect(handWritten(state({ amount: "2", unit: "months" }))).toBe(5184000);
    expect(handWritten(state({ amount: "3", unit: "weeks" }))).toBe(1814400);
    expect(handWritten(state({ amount: "3", unit: "days" }))).toBe(259200);
    expect(handWritten(state({ amount: "2", unit: "hours" }))).toBe(7200);
    expect(handWritten(state({ amount: "5", unit: "minutes" }))).toBe(300);
  });

  it("the three states: short across 29 February, same in a common year, no result", () => {
    const leap = platesOf(
      lib,
      presetState(byId("year-across-leap")),
      undefined,
    );
    const c1 = compare(leap.maxAge, 31536000);
    expect(c1).toEqual({ kind: "short", gap: 86400 });
    expect(compareWord(c1)).toBe("Short by 86400 s");
    expect(verdictText(c1, 31536000, "years").detail).toBe(
      "31536000 is 86400 seconds short from this start.",
    );

    const common = platesOf(lib, presetState(byId("year-common")), undefined);
    const c2 = compare(common.maxAge, 31536000);
    expect(c2.kind).toBe("same");
    expect(verdictText(c2, 31536000, "years").detail).toBe(
      "31536000 is right from this start. Try a start across 29 February.",
    );

    const c3 = compare(null, 31536000);
    expect(verdictText(c3, 31536000, "years").detail).toBe(
      "There is no result to compare.",
    );
    expect(compareWord(c3)).toBe("no result");
  });

  it("a number longer than the real length reads Long", () => {
    const c = compare(2419200, 2592000);
    expect(c).toEqual({ kind: "long", gap: 172800 });
    expect(compareWord(c)).toBe("Long by 172800 s");
  });

  it("a fixed unit never differs, whatever the start", () => {
    for (const unit of ["weeks", "days", "hours", "minutes"] as const) {
      for (const p of EXPIRY_PRESETS) {
        const s = state({ amount: "3", unit, start: p.start });
        const got = platesOf(lib, s, undefined);
        expect(compare(got.maxAge, handWritten(s)).kind).toBe("same");
      }
    }
  });

  it("a fixed unit's Same sentence says so", () => {
    expect(verdictText({ kind: "same", gap: 0 }, 259200, "days").detail).toBe(
      "259200 is right. A week, day, hour or minute is always the same length in UTC.",
    );
  });

  it("speaks the Max-Age and the verdict", () => {
    const s = presetState(byId("year-across-leap"));
    const values = platesOf(lib, s, undefined);
    const hand = handWritten(s);
    expect(sentenceOf(values, compare(values.maxAge, hand), hand, s.unit)).toBe(
      "Max-Age is 31622400 seconds. Short by 86400 s. 31536000 is 86400 seconds short from this start.",
    );
  });
});

describe("the next 12 starts", () => {
  it("has 12 rows", () => {
    expect(stripRows(lib, state(), false)).toHaveLength(ROW_COUNT);
  });

  it("from 31 January the starts show the clamp", () => {
    const rows = stripRows(lib, presetState(byId("month-end")), false);
    expect(rows.slice(0, 4).map((r) => r.start)).toEqual([
      "2027-01-31T12:00:00Z",
      "2027-02-28T12:00:00Z",
      "2027-03-31T12:00:00Z",
      "2027-04-30T12:00:00Z",
    ]);
  });

  it("from 2027-06-15 with 1 year, rows through 2028-02 read 31622400 and later ones 31536000", () => {
    const rows = stripRows(lib, presetState(byId("year-across-leap")), false);
    expect(rows[0]!.seconds).toBe(31622400);
    expect(rows[8]!.start).toBe("2028-02-15T12:00:00Z");
    expect(rows.slice(0, 9).every((r) => r.seconds === 31622400)).toBe(true);
    expect(rows.slice(9).every((r) => r.seconds === 31536000)).toBe(true);
    expect(rows[0]!.word).toBe("Short by 86400 s");
    expect(rows[11]!.word).toBe("Same");
  });

  it("a length in days is flat", () => {
    const rows = stripRows(lib, presetState(byId("signed-url-90")), false);
    expect(new Set(rows.map((r) => r.seconds))).toEqual(new Set([7776000]));
  });

  it("Now with a refused length keeps 12 rows with no result in Ends, Seconds and the verdict", () => {
    const s = state({
      mode: "now",
      amount: "-1",
      unit: "days",
      snapshot: "2027-06-15T12:00:00Z",
    });
    const rows = stripRows(lib, s, true);
    expect(rows).toHaveLength(ROW_COUNT);
    for (const r of rows) {
      expect(r.start).not.toBeNull();
      expect(r.ends).toBeNull();
      expect(r.seconds).toBeNull();
      expect(r.word).toBe("no result");
    }
  });

  it("Now counts from its snapshot, not from the typed start", () => {
    const s = state({ mode: "now", snapshot: "2030-01-01T00:00:00Z" });
    expect(stripRows(lib, s, false)[0]!.start).toBe("2030-01-01T00:00:00Z");
  });

  it("an invalid start has no result in any cell", () => {
    const rows = stripRows(lib, state({ start: "nope" }), false);
    expect(rows.every((r) => r.start === null && r.word === "no result")).toBe(
      true,
    );
  });

  it("the snapshot is whole seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      lib.convertUtcToUnix("2027-06-15T12:00:00Z", { epochUnit: "seconds" })! *
        1000 +
        750,
    );
    expect(takeSnapshot(lib)).toBe("2027-06-15T12:00:00Z");
  });
});

describe("the slider", () => {
  it("moves the start by whole days with the library, across 29 February", () => {
    expect(startAt(lib, "2027-06-15T12:00:00Z", 730)).toBe(
      "2029-06-14T12:00:00Z",
    );
    expect(startAt(lib, "2027-06-15T12:00:00Z", -730)).toBe(
      "2025-06-15T12:00:00Z",
    );
  });
});

describe("arguments and the permalink", () => {
  it("a preset id wins", () => {
    expect(readArgs({ preset: "month-end", amount: 9 })).toEqual(
      presetState(byId("month-end")),
    );
  });

  it("a bare seed is the default preset", () => {
    expect(readArgs({})).toEqual(presetState(EXPIRY_PRESETS[0]!));
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ preset: "x" })).toBe(true);
  });

  it("amount, unit and start seed a date; no start means Now", () => {
    expect(
      readArgs({ amount: 2, unit: "weeks", start: "2027-01-01T00:00:00Z" }),
    ).toMatchObject({
      amount: "2",
      unit: "weeks",
      start: "2027-01-01T00:00:00Z",
      mode: "date",
    });
    expect(readArgs({ amount: 2, unit: "weeks" }).mode).toBe("now");
  });

  it("an unknown unit falls back to the default unit", () => {
    expect(readArgs({ amount: 1, unit: "fortnights", start: "x" }).unit).toBe(
      "years",
    );
  });

  it("permalink: a preset alone while it matches, else three strings, Now with no start", () => {
    expect(permalinkOf(presetState(byId("year-common")))).toEqual({
      preset: "year-common",
    });
    expect(permalinkOf(state({ amount: "2" }))).toEqual({
      amount: "2",
      unit: "years",
      start: "2027-06-15T12:00:00Z",
    });
    expect(permalinkOf(state({ mode: "now" }))).toEqual({
      amount: "1",
      unit: "years",
    });
    expect(matchPreset(state({ amount: "2" }))).toBe(CUSTOM_PRESET_ID);
  });

  it("round-trips a cleared field and Now through a link", () => {
    for (const s of [
      state({ amount: "" }),
      state({ start: "" }),
      state({ mode: "now", amount: "3", unit: "days" }),
      state({ amount: "7", unit: "hours", start: "2028-02-29T12:00:00Z" }),
    ]) {
      const link = encodeWidgetPermalink("expiry", permalinkOf(s));
      const seed = seedFromLocation("expiry", link.slice(link.indexOf("?")));
      const back = readArgs(seed);
      expect({ ...back, snapshot: "" }).toEqual({ ...s, snapshot: "" });
    }
  });
});

describe("the chat tool", () => {
  it("takes an integer amount, a unit from the six, and an optional start", () => {
    const schema = showExpiryCalculatorInput;
    expect(
      schema.safeParse({
        amount: 1,
        unit: "years",
        start: "2027-06-15T12:00:00Z",
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ amount: 1, unit: "years" }).success).toBe(true);
    expect(schema.safeParse({ amount: 1.5, unit: "years" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ amount: 1, unit: "decades" }).success).toBe(
      false,
    );
  });
});
