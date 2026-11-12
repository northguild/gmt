import { fhirLib } from "~/test/fhir-lib";
import {
  CUSTOM_PRESET_ID,
  FHIR_PRESETS,
  NOTE_SPAN,
  OFFSET_NONE,
  REASON_FRACTION,
  REASON_LEAP,
  REASON_NO_DAY,
  REASON_SHAPE,
  REASON_VALID,
  STRIP_LEAP,
  fhirTexts,
  isSeeded,
  matchPreset,
  memberReadout,
  permalinkOf,
  readArgs,
  readFhir,
  stripNote,
  stripOf,
  verdictOf,
  writerOf,
} from "./fhir-date-checker";

const read = (v: string) => readFhir(fhirLib, v);
const preset = (id: string) => FHIR_PRESETS.find((p) => p.id === id)!.value;
const cell = (
  v: string,
  label: string,
  type: "date" | "dateTime" | "instant",
) =>
  writerOf(fhirLib, v, read(v).allowed).find((r) => r.label === label)!.cells[
    type
  ].text;

describe("readFhir", () => {
  it("makes no call for a blank value", () => {
    const r = read("");
    expect(r.blank).toBe(true);
    expect(r.calls).toEqual([]);
    expect(verdictOf(r).title).toBe("Nothing to read");
    expect(stripOf(fhirLib, r).kind).toBe("empty");
  });

  it("finds the allowed precisions by probing", () => {
    expect(read("2024").allowed).toEqual({
      date: ["year", "month", "day"],
      dateTime: ["year", "month", "day", "second", "fraction"],
      instant: ["second", "fraction"],
    });
  });

  it("reads a month as valid for date and dateTime, with a precision reason for instant", () => {
    const r = read(preset("month"));
    expect(r.rows.map((x) => x.valid)).toEqual([true, true, false]);
    expect(r.rows[0]!.reason).toBe(REASON_VALID);
    expect(r.rows[2]!.reason).toBe(
      "A month value. instant takes a second or a fraction.",
    );
    expect(verdictOf(r)).toMatchObject({ tone: "good", title: "A month" });
    expect(verdictOf(r).detail).toBe("Valid as date and dateTime.");
  });

  it("flags a shape-only match for a day that does not exist", () => {
    const r = read(preset("feb-30"));
    expect(r.rows.map((x) => x.shapeOnly)).toEqual([true, true, false]);
    expect(r.rows[0]!.reason).toBe(REASON_NO_DAY);
    expect(r.rows[2]!.reason).toBe(REASON_SHAPE);
    expect(verdictOf(r).tone).toBe("bad");
  });

  it("explains a leap second that was and was not inserted", () => {
    expect(read(preset("leap-2016")).rows[1]!.valid).toBe(true);
    expect(read(preset("leap-2017")).rows[1]!.reason).toBe(REASON_LEAP);
  });

  it("reads the fraction reason for a combined fault", () => {
    expect(read("2016-12-31T23:59:60.1234567890Z").rows[1]!.reason).toBe(
      REASON_FRACTION,
    );
  });

  it("says the pattern does not match a zone-less time", () => {
    const r = read(preset("no-zone"));
    expect(r.rows.every((x) => !x.pattern && !x.valid)).toBe(true);
    expect(r.rows[0]!.reason).toBe(REASON_SHAPE);
  });

  it("prints the real calls in order", () => {
    const fns = read(preset("feb-30")).calls.map((c) => c.fn);
    expect(fns.slice(0, 7)).toEqual([
      "parseFHIR",
      "isValidFHIR",
      "isValidFHIR",
      "isValidFHIR",
      "fhirDate.test",
      "fhirDateTime.test",
      "fhirInstant.test",
    ]);
  });
});

describe("members", () => {
  it("shows no result for the sentinel and names an absent offset", () => {
    expect(memberReadout(read("nope"), "value").text).toBe("no result");
    expect(memberReadout(read("2024-06"), "offset").text).toBe(OFFSET_NONE);
    expect(memberReadout(read("2024-06"), "precision").text).toBe("month");
  });
});

describe("stripOf", () => {
  it("draws a month as a span with the padded moment as reference", () => {
    const spec = stripOf(fhirLib, read("2024-06"));
    expect(spec).toMatchObject({
      kind: "span",
      from: "2024-06-01",
      to: "2024-07-01",
      unit: "month",
      label: "2024-06-01 to 2024-06-30",
    });
    expect(stripNote(read("2024-06"))).toBe(NOTE_SPAN);
  });

  it("draws a moment as stated, and a leap second as empty", () => {
    expect(stripOf(fhirLib, read(preset("second-offset"))).kind).toBe("stated");
    expect(stripOf(fhirLib, read(preset("leap-2016")))).toMatchObject({
      kind: "empty",
      text: STRIP_LEAP,
    });
  });
});

describe("writerOf", () => {
  it("fills only year to day when the value is a minute with an offset", () => {
    const v = preset("minute");
    for (const type of ["date", "dateTime"] as const) {
      expect(cell(v, "year", type)).toBe("2024");
      expect(cell(v, "day", type)).toBe("2024-06-15");
      expect(cell(v, "second", type)).toBe("no result");
    }
    expect(cell(v, "year", "instant")).toBe("no result");
  });

  it("writes no result everywhere for an inserted leap second", () => {
    const rows = writerOf(
      fhirLib,
      preset("leap-2016"),
      read(preset("leap-2016")).allowed,
    );
    for (const row of rows)
      for (const c of Object.values(row.cells))
        expect(c.text).toBe("no result");
  });

  it("keeps -00:00", () => {
    expect(
      cell("2024-06-15T10:30:00-00:00", "Default (no precision)", "dateTime"),
    ).toContain("-00:00");
  });
});

describe("presets and permalinks", () => {
  it("round-trips every preset", () => {
    for (const p of FHIR_PRESETS) {
      const state = readArgs({ preset: p.id });
      expect(matchPreset(state)).toBe(p.id);
      expect(permalinkOf(state)).toEqual({ preset: p.id });
    }
    expect(matchPreset({ value: "x" })).toBe(CUSTOM_PRESET_ID);
    expect(permalinkOf({ value: " 2024 " })).toEqual({ value: " 2024 " });
    expect(permalinkOf({ value: "" })).toEqual({});
    expect(isSeeded({ value: "" })).toBe(true);
    expect(isSeeded({})).toBe(false);
  });

  it("holds every text without GMT or null", () => {
    const t = JSON.stringify(fhirTexts());
    expect(t).not.toMatch(/GMT|null/);
  });
});
