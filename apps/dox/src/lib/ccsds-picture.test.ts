/**
 * The Decoder's picture and its reasons, against the real library. Each probe is reached by its
 * own input, so a probe that stops naming its reason fails here.
 */
import { lib } from "~/test/ccsds-lib";
import {
  REASON_CASE,
  REASON_COARSE,
  REASON_DAY_366,
  REASON_FALSE_60,
  REASON_GENERAL,
  REASON_WRONG_MINUTE,
  droppedDigits,
  fractionDigits,
  pictureOf,
  reasonOf,
} from "./ccsds-picture";

describe("fractionDigits", () => {
  it("counts the digits after the period", () => {
    expect(fractionDigits("2024-06-15T14:30:00.123456Z")).toBe(6);
    expect(fractionDigits("2024-06-15T14:30:00Z")).toBe(0);
  });
});

describe("pictureOf", () => {
  it("cuts a Code A text at its fields with the standard's masks", () => {
    const { halves, aria } = pictureOf("A", "1988-01-18T17:20:43.123456Z");
    const masks = halves[0]!.fields.map((f) => f.mask).filter((m) => m !== "");
    expect(masks).toEqual(["YYYY", "MM", "DD", "hh", "mm", "ss", "ddd", "ddd"]);
    expect(aria).toContain("MM 01");
  });

  it("cuts a Code B text and captions its day field", () => {
    const { halves } = pictureOf(
      "B",
      "2024-061T00:00:00Z",
      "day 061 = 1 March",
    );
    const day = halves[0]!.fields.find((f) => f.mask === "DDD");
    expect(day?.text).toBe("061");
    expect(day?.bracket).toBe("day 061 = 1 March");
  });

  it("draws a fraction in groups of three", () => {
    const { halves } = pictureOf("A", "2024-06-15T14:30:00.1234Z");
    const runs = halves[0]!.fields.filter((f) => f.run !== undefined);
    expect(runs.map((f) => f.text)).toEqual(["123", "4"]);
  });
});

describe("reasonOf", () => {
  it("names the case", () => {
    expect(reasonOf(lib, "2024-06-15t10:30:00z").text).toBe(REASON_CASE);
  });

  it("names a second 60 on a day UTC inserted none", () => {
    expect(reasonOf(lib, "2017-365T23:59:60Z").text).toBe(REASON_FALSE_60);
  });

  it("tells a wrong minute from a wrong day", () => {
    expect(reasonOf(lib, "2016-366T12:30:60Z").text).toBe(REASON_WRONG_MINUTE);
  });

  it("names day 366 in a common year", () => {
    expect(reasonOf(lib, "2023-366T00:00:00Z").text).toBe(REASON_DAY_366);
  });

  it("names a coarse span", () => {
    expect(reasonOf(lib, "2024-06-15T10:30Z").text).toBe(REASON_COARSE);
  });

  it("falls back to the general sentence", () => {
    expect(reasonOf(lib, "not a code").text).toBe(REASON_GENERAL);
  });

  it("returns the probe calls it made", () => {
    const r = reasonOf(lib, "2024-06-15t10:30:00z");
    expect(r.calls.length).toBeGreaterThan(0);
    expect(r.calls.at(-1)?.fn).toBe("parseCcsdsAsciiB");
  });
});

describe("droppedDigits", () => {
  it("is 3 for twelve digits and 0 otherwise", () => {
    const text = "2024-06-15T10:30:00.123456789012Z";
    const kept = lib.parseCcsdsAsciiA(text);
    expect(droppedDigits(lib, "A", text, kept)).toBe(3);
    const six = "2024-06-15T10:30:00.123456Z";
    expect(droppedDigits(lib, "A", six, lib.parseCcsdsAsciiA(six))).toBe(0);
    const nine = "2024-06-15T10:30:00.123456789Z";
    expect(droppedDigits(lib, "A", nine, lib.parseCcsdsAsciiA(nine))).toBe(0);
  });
});
