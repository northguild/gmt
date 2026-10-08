/// <reference types="vitest/globals" />
/**
 * `edi-shape.ts` against the real formatters. The codes are found by probing the
 * validators, not listed here: every code `isValidEdifactDtmFormat` and
 * `isValidX12DateTimePeriodFormat` accepts must have a shape that fits the
 * values the formatter writes under it.
 */
import { formatEdifactDtm, formatX12DateTimePeriod } from "@northguild/gmt/intermodal/format";
import {
  isValidEdifactDtmFormat,
  isValidX12DateTimePeriodFormat,
} from "@northguild/gmt/intermodal/validate";
import {
  cutValue,
  maskOf,
  shapeOf,
  shapeWidth,
  type Shape,
  type ShapeField,
} from "./edi-shape";

const masks = (fields: readonly ShapeField[] | undefined): string[] =>
  (fields ?? []).map((f) => maskOf(f.part));

/** Every code a validator accepts, found by trying each candidate text. */
function acceptedCodes(isValid: (code: unknown) => boolean, candidates: string[]): string[] {
  return candidates.filter((code) => isValid(code));
}

const NUMERIC = Array.from({ length: 1000 }, (_, n) => String(n)).concat(
  Array.from({ length: 1000 }, (_, n) => String(n).padStart(3, "0")),
);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const UPPER = [
  ...LETTERS.flatMap((a) => LETTERS.map((b) => a + b)),
  ...LETTERS.flatMap((a) => LETTERS.flatMap((b) => LETTERS.map((c) => a + b + c))),
];

const EDIFACT = [...new Set(acceptedCodes(isValidEdifactDtmFormat, NUMERIC))];
const X12 = [...new Set(acceptedCodes(isValidX12DateTimePeriodFormat, UPPER))];

/** Values unlike the probes, written under a code to check the shape's widths. */
const OTHER_VALUES = [
  "2031-12-09T23:45:12-05:30",
  "2031-12-09T23:45:12+01:00",
  "2031-12-09T23:45+01:00",
  "2031-12-09T23:45:12",
  "2031-12-09T23:45",
  "2031-12-09",
  "23:45:12+01:00",
  "23:45:12",
  "23:45",
  "+01:30",
  "2031-12-09T23:45:12/2032-01-02T04:05:06",
  "2031-12-09T23:45/2032-01-02T04:05",
  "2031-12-09/2032-01-02",
  "2031-12-09/2032-01-02T04:05",
  "2031-12-09T23:45/2032-01-02",
  "23:45/04:05",
];

describe("the codes found by probing", () => {
  it("finds the UN/EDIFACT codes and the X12 qualifiers the library accepts", () => {
    expect(EDIFACT.length).toBeGreaterThan(15);
    expect(X12.length).toBeGreaterThan(15);
  });

  it.each(EDIFACT)("2379 code %s has a shape that fits what is written under it", (code) => {
    const shape = shapeOf(formatEdifactDtm, code);
    expect(shape, code).not.toBeNull();
    fits(shape!, formatEdifactDtm, code);
  });

  it.each(X12.filter((code) => code !== "UN"))(
    "1250 qualifier %s has a shape that fits what is written under it",
    (code) => {
      const shape = shapeOf(formatX12DateTimePeriod, code);
      expect(shape, code).not.toBeNull();
      fits(shape!, formatX12DateTimePeriod, code);
    },
  );
});

function fits(
  shape: Shape,
  format: typeof formatEdifactDtm,
  code: string,
): void {
  let written = 0;
  for (const options of [undefined, { yearWindow: 2000 }]) {
    for (const value of OTHER_VALUES) {
      const out = options === undefined ? format(value, code) : format(value, code, options);
      if (out === "") continue;
      written++;
      expect(out.length, `${code} ← ${value}`).toBe(shapeWidth(shape));
      expect(cutValue(out, shape), `${code} ← ${value}`).not.toBeNull();
    }
  }
  expect(written, code).toBeGreaterThan(0);
}

describe("shapeOf, representative codes", () => {
  it("203 is a local date-time to the minute, with a four-digit year", () => {
    const shape = shapeOf(formatEdifactDtm, "203")!;
    expect(masks(shape.start)).toEqual(["CCYY", "MM", "DD", "HH", "MM"]);
    expect(shape.start.map((f) => f.width)).toEqual([4, 2, 2, 2, 2]);
    expect(shape.window).toBe(false);
    expect(shape.end).toBeUndefined();
  });

  it("205 and 208 end in a signed hours-and-minutes offset", () => {
    const s205 = shapeOf(formatEdifactDtm, "205")!;
    expect(masks(s205.start)).toEqual(["CCYY", "MM", "DD", "HH", "MM", "ZHHMM"]);
    const s208 = shapeOf(formatEdifactDtm, "208")!;
    expect(masks(s208.start)).toEqual(["CCYY", "MM", "DD", "HH", "MM", "SS", "ZHHMM"]);
    expect(s208.start.at(-1)).toEqual({ part: "ZHHMM", width: 5, group: "offset" });
  });

  it("303 ends in the three-character zone field", () => {
    const shape = shapeOf(formatEdifactDtm, "303")!;
    expect(masks(shape.start)).toEqual(["CCYY", "MM", "DD", "HH", "MM", "ZZZ"]);
    expect(shape.start.at(-1)).toEqual({ part: "ZZZ", width: 3, group: "offset" });
  });

  it("101 has a two-digit year, which needs a window", () => {
    const shape = shapeOf(formatEdifactDtm, "101")!;
    expect(masks(shape.start)).toEqual(["YY", "MM", "DD"]);
    expect(shape.window).toBe(true);
  });

  it("406 is an offset alone and 401 a time alone", () => {
    expect(masks(shapeOf(formatEdifactDtm, "406")!.start)).toEqual(["ZHHMM"]);
    expect(masks(shapeOf(formatEdifactDtm, "401")!.start)).toEqual(["HH", "MM"]);
  });

  it("718 is two dates run together, with no separator", () => {
    const shape = shapeOf(formatEdifactDtm, "718")!;
    expect(masks(shape.start)).toEqual(["CCYY", "MM", "DD"]);
    expect(masks(shape.end)).toEqual(["CCYY", "MM", "DD"]);
    expect(shape.separator).toBe("");
    const cut = cutValue("2024061520240620", shape)!;
    expect(cut.halves.map((h) => h.map((c) => c.text))).toEqual([
      ["2024", "06", "15"],
      ["2024", "06", "20"],
    ]);
  });

  it("719 is two date-times to the minute", () => {
    const shape = shapeOf(formatEdifactDtm, "719")!;
    expect(masks(shape.start)).toEqual(["CCYY", "MM", "DD", "HH", "MM"]);
    expect(masks(shape.end)).toEqual(["CCYY", "MM", "DD", "HH", "MM"]);
  });

  it("finds the other field orders X12 uses", () => {
    expect(masks(shapeOf(formatX12DateTimePeriod, "DB")!.start)).toEqual(["MM", "DD", "CCYY"]);
    expect(masks(shapeOf(formatX12DateTimePeriod, "TT")!.start)).toEqual(["MM", "DD", "YY"]);
    expect(masks(shapeOf(formatX12DateTimePeriod, "TR")!.start)).toEqual(["DD", "MM", "YY", "HH", "MM"]);
    expect(masks(shapeOf(formatX12DateTimePeriod, "TU")!.start)).toEqual(["YY", "DDD"]);
    expect(masks(shapeOf(formatX12DateTimePeriod, "EH")!.start)).toEqual(["Y", "DDD"]);
    expect(masks(shapeOf(formatX12DateTimePeriod, "TC")!.start)).toEqual(["DDD"]);
  });

  it("finds a range's hyphen and its two halves, which may differ", () => {
    const rd = shapeOf(formatX12DateTimePeriod, "RD")!;
    expect(rd.separator).toBe("-");
    expect(masks(rd.start)).toEqual(["MM", "DD", "CCYY"]);
    expect(masks(rd.end)).toEqual(["MM", "DD", "CCYY"]);
    const ddt = shapeOf(formatX12DateTimePeriod, "DDT")!;
    expect(masks(ddt.start)).toEqual(["CCYY", "MM", "DD"]);
    expect(masks(ddt.end)).toEqual(["CCYY", "MM", "DD", "HH", "MM"]);
    const rtm = shapeOf(formatX12DateTimePeriod, "RTM")!;
    expect(masks(rtm.start)).toEqual(["HH", "MM"]);
    expect(masks(rtm.end)).toEqual(["HH", "MM"]);
  });

  it("has no shape for an unsupported code, an unstructured one, or no code", () => {
    expect(shapeOf(formatEdifactDtm, "999")).toBeNull();
    expect(shapeOf(formatEdifactDtm, "")).toBeNull();
    expect(shapeOf(formatX12DateTimePeriod, "UN")).toBeNull();
    expect(shapeOf(formatX12DateTimePeriod, "CM")).toBeNull();
  });

  it("caches a shape per formatter and code", () => {
    expect(shapeOf(formatEdifactDtm, "203")).toBe(shapeOf(formatEdifactDtm, "203"));
    // The same text names different codes under the two formatters.
    expect(shapeOf(formatX12DateTimePeriod, "203")).toBeNull();
  });

  it("calls the formatter only until a probe is written, once per code", () => {
    const calls: string[] = [];
    const counting: typeof formatEdifactDtm = (value, code, options) => {
      calls.push(value);
      return formatEdifactDtm(value, code, options);
    };
    shapeOf(counting, "102");
    const first = calls.length;
    shapeOf(counting, "102");
    expect(calls.length).toBe(first);
    expect(first).toBeLessThan(18);
  });
});

describe("cutValue", () => {
  it("cuts a value along its shape, and refuses a length the shape does not take", () => {
    const shape = shapeOf(formatEdifactDtm, "203")!;
    const cut = cutValue("202406151430", shape)!;
    expect(cut.halves[0]!.map((c) => c.text)).toEqual(["2024", "06", "15", "14", "30"]);
    expect(cutValue("20240615143", shape)).toBeNull();
    expect(cutValue("202406151430?+00", shape)).toBeNull();
  });

  it("keeps zone text whole in a three-character field", () => {
    const shape = shapeOf(formatEdifactDtm, "303")!;
    const cut = cutValue("202406151430CET", shape)!;
    expect(cut.halves[0]!.at(-1)!.text).toBe("CET");
  });

  it("refuses a period whose separator is not the standard's", () => {
    const shape = shapeOf(formatX12DateTimePeriod, "RD8")!;
    expect(cutValue("20240615-20240620", shape)).not.toBeNull();
    expect(cutValue("20240615/20240620", shape)).toBeNull();
  });
});
