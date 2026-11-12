/**
 * `loadFhirLib` against the real gmt modules, and `FhirLib` against the library's own signatures.
 */
import type { formatFHIR } from "@northguild/gmt/healthcare/format";
import type { parseFHIR } from "@northguild/gmt/healthcare/parse";
import type { isValidFHIR } from "@northguild/gmt/healthcare/validate";
import type { isLeapSecond } from "@northguild/gmt/timescale/validate";
import { fhirLib } from "~/test/fhir-lib";
import { loadFhirLib, type FhirLib } from "./fhir-lib";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

describe("FhirLib", () => {
  it("is the library's own parse, validate, format and leap-second functions", () => {
    expectTypeOf<FhirLib["parseFHIR"]>().toEqualTypeOf<typeof parseFHIR>();
    // `isValidFHIR` is overloaded, so the lib type is the call the Checker makes.
    expectTypeOf<typeof isValidFHIR>().toExtend<FhirLib["isValidFHIR"]>();
    expectTypeOf<FhirLib["formatFHIR"]>().toEqualTypeOf<typeof formatFHIR>();
    expectTypeOf<FhirLib["isLeapSecond"]>().toEqualTypeOf<
      typeof isLeapSecond
    >();
  });
});

describe("loadFhirLib", () => {
  it("hands back the functions and patterns the Checker uses, and nothing else", async () => {
    const lib = await loadFhirLib();
    expect(Object.keys(lib).sort()).toEqual(Object.keys(fhirLib).sort());
    for (const [name, value] of Object.entries(lib)) {
      if (name.startsWith("fhir")) expect(value).toBeInstanceOf(RegExp);
      else expect(typeof value).toBe("function");
    }
  });

  it("answers a real call", async () => {
    const lib = await loadFhirLib();
    expect(lib.parseFHIR("2024-06")).toEqual({
      value: "2024-06",
      precision: "month",
      offset: "",
    });
    expect(lib.fhirDate.test("2024-06")).toBe(true);
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["healthcare/parse"];
    GMT_MODULES["healthcare/parse"] = () =>
      Promise.reject(new Error("offline"));
    try {
      await expect(loadFhirLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["healthcare/parse"] = original;
    }
  });

  it("turns a module that lacks a function into a WidgetLoadError", async () => {
    const original = GMT_MODULES["healthcare/format"];
    GMT_MODULES["healthcare/format"] = () => Promise.resolve({});
    try {
      await expect(loadFhirLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["healthcare/format"] = original;
    }
  });

  it("turns a module whose pattern is not a RegExp into a WidgetLoadError", async () => {
    const original = GMT_MODULES["regex"];
    GMT_MODULES["regex"] = () =>
      Promise.resolve({ fhirDate: "x", fhirDateTime: /x/, fhirInstant: /x/ });
    try {
      await expect(loadFhirLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["regex"] = original;
    }
  });
});
