/** @vitest-environment jsdom */
/// <reference types="vitest/globals" />
/// <reference types="vitest/jsdom" />

import { describe, expect, it } from "vitest";
import {
  evaluateArg,
  renderResult,
  sentinelFor,
} from "../lib/playground-client";
import {
  buildCall,
  type CallField,
  formatArg,
  isEmptyField,
  parseCallArgs,
} from "../lib/playground-parsers";

// ---------------------------------------------------------------------------
// formatArg — one field, by kind
// ---------------------------------------------------------------------------

describe("formatArg", () => {
  it("quotes strings and enums", () => {
    expect(formatArg({ name: "v", kind: "string", value: "P1DT2H30M" })).toBe(
      '"P1DT2H30M"',
    );
    expect(formatArg({ name: "u", kind: "enum", value: "hours" })).toBe('"hours"');
  });
  it("passes numbers through, defaulting blank to 0", () => {
    expect(formatArg({ name: "n", kind: "number", value: "42" })).toBe("42");
    expect(formatArg({ name: "n", kind: "number", value: "  " })).toBe("0");
  });
  it("normalises booleans", () => {
    expect(formatArg({ name: "b", kind: "boolean", value: "true" })).toBe("true");
    expect(formatArg({ name: "b", kind: "boolean", value: "nope" })).toBe("false");
  });
  it("builds a units object from the amount + unit", () => {
    expect(formatArg({ name: "d", kind: "units", value: "5", unit: "days" })).toBe(
      "{ days: 5 }",
    );
  });
  it("builds a string list, dropping blank rows", () => {
    expect(
      formatArg({
        name: "dates",
        kind: "list",
        value: "",
        element: "string",
        items: ["2024-01-01", "", "2024-02-01"],
      }),
    ).toBe('["2024-01-01", "2024-02-01"]');
  });
  it("builds a number list bare", () => {
    expect(
      formatArg({
        name: "ns",
        kind: "list",
        value: "",
        element: "number",
        items: ["1", "2", "3"],
      }),
    ).toBe("[1, 2, 3]");
  });
  it("builds an intervals list", () => {
    expect(
      formatArg({
        name: "iv",
        kind: "intervals",
        value: "",
        pairs: [
          ["2024-01-01", "2024-01-10"],
          ["2024-01-05", "2024-01-15"],
        ],
      }),
    ).toBe(
      '[{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }]',
    );
  });
});

// ---------------------------------------------------------------------------
// isEmptyField
// ---------------------------------------------------------------------------

describe("isEmptyField", () => {
  it("is true for a blank scalar and an all-blank list", () => {
    expect(isEmptyField({ name: "a", kind: "string", value: "" })).toBe(true);
    expect(
      isEmptyField({ name: "a", kind: "list", value: "", items: ["", "  "] }),
    ).toBe(true);
    expect(
      isEmptyField({ name: "a", kind: "intervals", value: "", pairs: [["", ""]] }),
    ).toBe(true);
  });
  it("is false once a value is present", () => {
    expect(isEmptyField({ name: "a", kind: "string", value: "x" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildCall
// ---------------------------------------------------------------------------

describe("buildCall", () => {
  it("assembles positional args in order", () => {
    const fields: CallField[] = [
      { name: "value", kind: "string", value: "P1DT2H30M" },
      { name: "unit", kind: "enum", value: "hours" },
    ];
    expect(buildCall("durationAs", fields)).toBe(
      'durationAs("P1DT2H30M", "hours")',
    );
  });

  it("drops trailing optional fields that are empty", () => {
    const fields: CallField[] = [
      { name: "dateStr", kind: "string", value: "2024-01-01" },
      { name: "weekStartsOn", kind: "enum", value: "", optional: true },
    ];
    expect(buildCall("getWeekNumber", fields)).toBe('getWeekNumber("2024-01-01")');
  });

  it("keeps an optional field once it has a value", () => {
    const fields: CallField[] = [
      { name: "dateStr", kind: "string", value: "2024-01-01" },
      { name: "weekStartsOn", kind: "enum", value: "sunday", optional: true },
    ];
    expect(buildCall("getWeekNumber", fields)).toBe(
      'getWeekNumber("2024-01-01", "sunday")',
    );
  });

  it("appends a baked options suffix verbatim", () => {
    expect(
      buildCall(
        "normalizeDuration",
        [{ name: "value", kind: "string", value: "PT90M" }],
        { optionsSuffix: '{ largestUnit: "hour" }' },
      ),
    ).toBe('normalizeDuration("PT90M", { largestUnit: "hour" })');
  });

  it("rebuilds an object-arg call from field names", () => {
    const fields: CallField[] = [
      { name: "value1", kind: "string", value: "2024-02-28" },
      { name: "value2", kind: "string", value: "2024-02-29" },
    ];
    expect(buildCall("isValidDateRange", fields, { objectArg: true })).toBe(
      'isValidDateRange({ value1: "2024-02-28", value2: "2024-02-29" })',
    );
  });

  it("emits an empty call for a no-arg function", () => {
    expect(buildCall("getUnixNow", [])).toBe("getUnixNow()");
  });

  it("round-trips a list call through parseCallArgs + evaluateArg", () => {
    const call = buildCall("maxDate", [
      {
        name: "dates",
        kind: "list",
        value: "",
        element: "string",
        items: ["2024-03-10", "2024-03-15"],
      },
    ]);
    expect(call).toBe('maxDate(["2024-03-10", "2024-03-15"])');
    expect(parseCallArgs(call).map((a) => a.trim()).map(evaluateArg)).toEqual([
      ["2024-03-10", "2024-03-15"],
    ]);
  });
});

// ---------------------------------------------------------------------------
// playground-client — evaluateArg / sentinelFor / renderResult
// ---------------------------------------------------------------------------

describe("evaluateArg", () => {
  it("evaluates literals", () => {
    expect(evaluateArg("42")).toBe(42);
    expect(evaluateArg('"hello"')).toBe("hello");
    expect(evaluateArg("[1, 2, 3]")).toEqual([1, 2, 3]);
    expect(evaluateArg("{ days: 5 }")).toEqual({ days: 5 });
  });
  it("returns empty string for blank and undefined for a syntax error", () => {
    expect(evaluateArg("   ")).toBe("");
    expect(evaluateArg("{ oops")).toBeUndefined();
  });
});

describe("sentinelFor", () => {
  it("maps return type → sentinel value", () => {
    expect(sentinelFor("number", false)).toBeNull();
    expect(sentinelFor("boolean", false)).toBe(false);
    expect(sentinelFor("array", false)).toEqual([]);
    expect(sentinelFor("array", true)).toBe("");
    expect(sentinelFor("string", false)).toBe("");
  });
});

describe("renderResult", () => {
  it("renders a live value and stringifies objects", () => {
    const el = document.createElement("output");
    renderResult(el, "hi", false);
    expect(el.textContent).toBe("hi");
    expect(el.classList.contains("gmt-playground-live")).toBe(true);
    renderResult(el, [1, 2, 3], false);
    expect(el.textContent).toBe("[1,2,3]");
  });
});

// ---------------------------------------------------------------------------
// run() flow — mocked gmt call → output
// ---------------------------------------------------------------------------

describe("PlaygroundForm run() flow", () => {
  it("calls the mocked fn and renders a live value", () => {
    const fields: CallField[] = [
      { name: "value", kind: "string", value: "P1DT2H30M" },
      { name: "unit", kind: "enum", value: "hours" },
    ];
    const call = buildCall("durationAs", fields);
    const mockMod = { durationAs: (_v: string, _u: string) => 26.5 };
    const args = parseCallArgs(call).map((a) => a.trim()).map(evaluateArg);
    const result = mockMod.durationAs(...(args as [string, string]));

    const outputEl = document.createElement("output");
    renderResult(outputEl, result as unknown as string, (result as unknown) === sentinelFor("number", false));

    expect(outputEl.textContent).toBe("26.5");
    expect(outputEl.classList.contains("gmt-playground-live")).toBe(true);
  });

  it("renders NO SIGNAL when the call throws", () => {
    const outputEl = document.createElement("output");
    renderResult(outputEl, "", true);
    expect(outputEl.textContent).toBe("NO SIGNAL");
    expect(outputEl.classList.contains("gmt-playground-sentinel")).toBe(true);
  });
});
