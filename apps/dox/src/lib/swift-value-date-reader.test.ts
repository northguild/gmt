import { realFinanceLib as lib } from "~/test/finance-fixture";
import {
  CUSTOM_PRESET_ID,
  NOT_A_DATE_REASON,
  NOT_SIX_REASON,
  READ_PRESETS,
  T50,
  WRITE_PRESETS,
  deriveBands,
  isSeeded,
  matchReadPreset,
  matchWritePreset,
  permalinkOf,
  pictureOf,
  presetState,
  rangeText,
  readArgs,
  readValueDate,
  writeValueDate,
} from "./swift-value-date-reader";

const bands = deriveBands(lib);
const read = (text: string) => readValueDate(lib, text, bands);
const write = (text: string) => writeValueDate(lib, text, bands);
const preset = (id: string) => READ_PRESETS.find((p) => p.id === id)!.text;

describe("deriveBands", () => {
  it("gives three runs, ordered by year with the refused run last", () => {
    expect(
      bands.list.map((b) => [b.from, b.to, b.firstYear, b.lastYear]),
    ).toEqual([
      ["80", "99", 1980, 1999],
      ["00", "60", 2000, 2060],
      ["61", "79", null, null],
    ]);
    expect(rangeText(bands)).toBe("1980–2060");
  });

  it("finds the row of a two-digit year, and none for anything else", () => {
    expect(bands.indexOf("99")).toBe(0);
    expect(bands.indexOf("24")).toBe(1);
    expect(bands.indexOf("75")).toBe(2);
    expect(bands.indexOf("２４")).toBe(-1);
    expect(bands.indexOf(" 9")).toBe(-1);
  });
});

describe("readValueDate", () => {
  it.each([
    ["nineteen", "1999-06-15", null],
    ["twenty", "2024-06-15", null],
    ["first-year", "1980-01-01", null],
    ["last-day", "2060-12-31", null],
    ["leap-2000", "2000-02-29", null],
    ["past-limit", null, T50],
    ["no-leap-1985", null, T50],
    ["whole-subfield", null, null],
  ])("reads the %s preset as the library does", (id, iso, code) => {
    const r = read(preset(id));
    expect(r.iso).toBe(iso);
    expect(r.code).toBe(code);
    expect(r.kind).toBe(iso === null ? "refused" : "read");
    expect(r.valid).toBe(iso !== null);
    expect(r.calls.map((c) => c.fn)).toEqual([
      "parseSwiftDate",
      "isValidSwiftDate",
    ]);
  });

  it("names the band of an accepted year", () => {
    const r = read("990615");
    expect(r.year).toBe("1999");
    expect(r.reason).toBe(
      "YY 99 falls in 80–99, which SWIFT reads as 1980–1999.",
    );
    expect(r.band).toBe(0);
  });

  it("makes no call for an empty box", () => {
    const r = read("");
    expect(r.kind).toBe("empty");
    expect(r.calls).toEqual([]);
    expect(r.code).toBeNull();
  });

  it("fires each probe branch once", () => {
    expect(read("２４０６１５").reason).toBe(
      "The year digits are not two ASCII digits.",
    );
    expect(read("750101").reason).toBe(
      "YY 75 falls in 61–79. SWIFT's rule puts that year after 2060, so it is refused.",
    );
    expect(read("241301").reason).toBe("MM is not a month, 01 to 12.");
    expect(read("240632").reason).toBe("DD is not a day, 01 to 31.");
    expect(read("850229").reason).toBe(
      "29 February does not exist in 1985: 1985 is not a leap year.",
    );
    expect(read("240431").reason).toBe(
      "Day 31 does not exist in month 04 of 2024.",
    );
  });

  it("shows no code for any length but six, and says why", () => {
    for (const text of ["24061", "2406155", "240615EUR1000,00"]) {
      const r = read(text);
      expect(r.code).toBeNull();
      expect(r.reason).toBe(NOT_SIX_REASON);
      expect(r.band).toBe(-1);
    }
  });

  it("refuses a leading space as typed, never trimming it", () => {
    // Six characters with the space, so T50; seven would be "not six characters".
    const r = read(" 24061");
    expect(r.kind).toBe("refused");
    expect(r.code).toBe(T50);
    expect(read(" 240615").code).toBeNull();
  });

  it("marks no row for a refusal that names no band", () => {
    expect(read("２４０６１５").band).toBe(-1);
    expect(read("750101").band).toBe(2);
  });
});

describe("writeValueDate", () => {
  it("writes and reads back a date in range", () => {
    const w = write("2024-06-15");
    expect(w.kind).toBe("written");
    expect(w.written).toBe("240615");
    expect(w.back).toBe("2024-06-15");
    expect(w.same).toBe(true);
    expect(w.calls.map((c) => c.fn)).toEqual([
      "formatSwiftDate",
      "parseSwiftDate",
    ]);
  });

  it.each(["1979-12-31", "2061-01-01"])(
    "refuses %s as outside the range, from the bands",
    (text) => {
      const w = write(text);
      expect(w.kind).toBe("refused");
      expect(w.reason).toBe(
        "Outside 1980–2060, would read back as another year.",
      );
      expect(w.calls.map((c) => c.fn)).toEqual([
        "formatSwiftDate",
        "isValidDate",
      ]);
    },
  );

  it("sends a date-time back to the date", () => {
    expect(write("2024-06-15T10:00:00").reason).toBe(NOT_A_DATE_REASON);
  });

  it("makes no call for an empty box", () => {
    const w = write("");
    expect(w.kind).toBe("empty");
    expect(w.calls).toEqual([]);
  });
});

describe("presets and arguments", () => {
  it("opens on 990615 and 2024-06-15", () => {
    expect(presetState()).toEqual({ value: "990615", date: "2024-06-15" });
  });

  it("matches a preset by its exact text and anything else is custom", () => {
    expect(matchReadPreset("990615")).toBe("nineteen");
    expect(matchReadPreset("9906150")).toBe(CUSTOM_PRESET_ID);
    expect(matchWritePreset("1979-12-31")).toBe("before-first");
    expect(matchWritePreset("")).toBe(CUSTOM_PRESET_ID);
  });

  it("seeds from any string key, a blank one included", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ value: "" })).toBe(true);
    expect(readArgs({ value: "", writePreset: "after-last" })).toEqual({
      value: "",
      date: "2061-01-01",
    });
    expect(readArgs({ preset: "past-limit" }).value).toBe("750101");
  });

  it("makes a permalink from a preset id or from the text", () => {
    expect(permalinkOf({ value: "990615", date: "2024-06-15" })).toEqual({
      preset: "nineteen",
      writePreset: "round-trip",
    });
    expect(permalinkOf({ value: "", date: "x" })).toEqual({
      value: "",
      date: "x",
    });
    expect(WRITE_PRESETS.length).toBe(5);
  });
});

describe("pictureOf", () => {
  it("cuts six characters into year, month and day", () => {
    const p = pictureOf("990615", true);
    expect(p.halves[0]!.fields.map((f) => f.text)).toEqual(["99", "06", "15"]);
    expect(p.halves[0]!.fields.every((f) => f.group === "date")).toBe(true);
  });

  it("draws a refused text neutral and any other length as one box", () => {
    expect(pictureOf("750101", false).halves[0]!.fields[0]!.group).toBe(
      "neutral",
    );
    expect(pictureOf("24061", true).halves[0]!.fields).toHaveLength(1);
  });
});
