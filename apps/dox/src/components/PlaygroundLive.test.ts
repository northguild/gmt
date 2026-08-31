/** @vitest-environment jsdom */
/// <reference types="vitest/globals" />
/// <reference types="vitest/jsdom" />

import { describe, expect, it } from "vitest";
import { evaluateArg, renderResult, sentinelFor } from "../lib/playground-client";
import { parseCallArgs, argToValue } from "../lib/playground-parsers";

// ---------------------------------------------------------------------------
// playground-parsers (shared module)
// ---------------------------------------------------------------------------

describe("playground-parsers", () => {
  describe("splitTopLevel", () => {
    it("splits on top-level commas", () => {
      expect(parseCallArgs("f(a, b, c)")).toEqual(["a", "b", "c"]);
    });
    it("ignores commas inside brackets and strings", () => {
      expect(parseCallArgs('f("a,b", "x[y,z]", c)')).toEqual(['"a,b"', '"x[y,z]"', "c"]);
    });
  });

  describe("parseCallArgs", () => {
    it("extracts args from a call", () => {
      expect(parseCallArgs('durationAs("P1DT2H30M", "hours")')).toEqual([
        '"P1DT2H30M"',
        '"hours"',
      ]);
    });
    it("returns [] when no parentheses", () => {
      expect(parseCallArgs("not a call")).toEqual([]);
    });
  });

  describe("argToValue", () => {
    it("strips quotes", () => {
      expect(argToValue('"hours"')).toBe("hours");
    });
    it("leaves primitives untouched", () => {
      expect(argToValue("2")).toBe("2");
      expect(argToValue("true")).toBe("true");
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateArg
// ---------------------------------------------------------------------------

describe("evaluateArg", () => {
  it("evaluates numeric literals", () => {
    expect(evaluateArg("42")).toBe(42);
  });
  it("evaluates string literals", () => {
    expect(evaluateArg('"hello"')).toBe("hello");
  });
  it("evaluates arrays", () => {
    expect(evaluateArg("[1, 2, 3]")).toEqual([1, 2, 3]);
  });
  it("returns empty string for blank input", () => {
    expect(evaluateArg("  ")).toBe("");
  });
  it("returns undefined on syntax error", () => {
    expect(evaluateArg("{ invalid")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sentinelFor
// ---------------------------------------------------------------------------

describe("sentinelFor", () => {
  it("returns null for number", () => {
    expect(sentinelFor("number", false)).toBeNull();
  });
  it("returns false for boolean", () => {
    expect(sentinelFor("boolean", false)).toBe(false);
  });
  it("returns [] for array when allowEmptyArray is false", () => {
    expect(sentinelFor("array", false)).toEqual([]);
  });
  it("returns \"\" for array when allowEmptyArray is true", () => {
    expect(sentinelFor("array", true)).toBe("");
  });
  it("returns empty string for string", () => {
    expect(sentinelFor("string", false)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// renderResult
// ---------------------------------------------------------------------------

describe("renderResult", () => {
  it("renders a live value", () => {
    const el = document.createElement("output");
    renderResult(el, "hello", false);
    expect(el.classList.contains("gmt-playground-live")).toBe(true);
    expect(el.textContent).toBe("hello");
  });

  it("renders NO SIGNAL on error", () => {
    const el = document.createElement("output");
    renderResult(el, "", true);
    expect(el.classList.contains("gmt-playground-sentinel")).toBe(true);
    expect(el.textContent).toBe("NO SIGNAL");
  });

  it("stringifies objects", () => {
    const el = document.createElement("output");
    renderResult(el, [1, 2, 3], false);
    expect(el.textContent).toBe("[1,2,3]");
  });
});

// ---------------------------------------------------------------------------
// run() flow
// ---------------------------------------------------------------------------

describe("run() flow", () => {
  it("calls the mocked GMT function and renders the result", async () => {
    const container = document.createElement("div");
    container.className = "gmt-live-playground";
    container.innerHTML = `
      <textarea class="gmt-live-playground-textarea"
        data-module="plain/calculate"
        data-fn="addDays"
        data-return-type="string">"2024-01-01", 5</textarea>
      <button class="gmt-live-playground-run"></button>
      <output class="gmt-live-playground-result" data-allow-empty-array=""></output>
    `;
    document.body.appendChild(container);

    const mockMod = { addDays: (_v: string, _d: number) => "2024-01-06" };
    const mockModules: Record<string, () => Promise<Record<string, unknown>>> = {
      "plain/calculate": () => Promise.resolve(mockMod),
    };

    const textarea = container.querySelector(".gmt-live-playground-textarea") as HTMLTextAreaElement;
    const outputEl = container.querySelector(".gmt-live-playground-result") as HTMLElement;

    const modKey = textarea.dataset.module!;
    const fnName = textarea.dataset.fn!;
    const returnType = textarea.dataset.returnType!;
    const allowEmptyArray = outputEl.dataset.allowEmptyArray === "true";

    const mod = await mockModules[modKey]?.();
    const fn = mod?.[fnName] as ((...args: unknown[]) => unknown) | undefined;
    if (!fn) throw new Error("export not found: " + fnName);
    const call = fnName + "(" + textarea.value + ")";
    const args = parseCallArgs(call).map(evaluateArg);
    const result = fn(...args);

    const sentinel = sentinelFor(returnType, allowEmptyArray);
    const isSentinel =
      result === sentinel &&
      result !== 0 &&
      result !== false;
    renderResult(outputEl, result, isSentinel);

    expect(outputEl.textContent).toBe("2024-01-06");
    expect(outputEl.classList.contains("gmt-playground-live")).toBe(true);

    document.body.removeChild(container);
  });

  it("renders NO SIGNAL for an error", async () => {
    const container = document.createElement("div");
    container.className = "gmt-live-playground";
    container.innerHTML = `
      <textarea class="gmt-live-playground-textarea"
        data-module="plain/calculate"
        data-fn="addDays"
        data-return-type="string">"2024-01-01", 5</textarea>
      <button class="gmt-live-playground-run"></button>
      <output class="gmt-live-playground-result" data-allow-empty-array=""></output>
    `;
    document.body.appendChild(container);

    const outputEl = container.querySelector(".gmt-live-playground-result") as HTMLElement;
    renderResult(outputEl, "", true);
    expect(outputEl.textContent).toBe("NO SIGNAL");

    document.body.removeChild(container);
  });
});
