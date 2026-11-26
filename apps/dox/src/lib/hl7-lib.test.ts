/**
 * `loadHl7Lib` against the real gmt modules, and `Hl7Lib` against the library's own signatures.
 */
import type { formatHL7 } from "@northguild/gmt/healthcare/format";
import type { parseHL7 } from "@northguild/gmt/healthcare/parse";
import { hl7Lib } from "~/test/hl7-lib";
import { GMT_MODULES } from "./gmt-modules";
import { loadHl7Lib, type Hl7Lib } from "./hl7-lib";
import { WidgetLoadError } from "./widget-mount";

describe("Hl7Lib", () => {
  it("is the library's own parseHL7 and formatHL7", () => {
    expectTypeOf<Hl7Lib["parseHL7"]>().toEqualTypeOf<typeof parseHL7>();
    expectTypeOf<Hl7Lib["formatHL7"]>().toEqualTypeOf<typeof formatHL7>();
  });
});

describe("loadHl7Lib", () => {
  it("hands back the functions the Reader calls, and nothing else", async () => {
    const lib = await loadHl7Lib();
    expect(Object.keys(lib).sort()).toEqual(Object.keys(hl7Lib).sort());
    for (const value of Object.values(lib)) {
      expect(typeof value).toBe("function");
    }
  });

  it("answers a real call", async () => {
    const lib = await loadHl7Lib();
    expect(lib.parseHL7("20240615103000+0200")).toMatchObject({
      kind: "instant",
      instant: "2024-06-15T08:30:00Z",
    });
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["healthcare/parse"];
    GMT_MODULES["healthcare/parse"] = () =>
      Promise.reject(new Error("offline"));
    try {
      await expect(loadHl7Lib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["healthcare/parse"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["healthcare/format"];
    GMT_MODULES["healthcare/format"] = () => Promise.resolve({});
    try {
      await expect(loadHl7Lib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["healthcare/format"] = original;
    }
  });
});
