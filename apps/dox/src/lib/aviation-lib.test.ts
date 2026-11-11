/**
 * `loadAviationLib` against the real gmt modules.
 */
import { loadAviationLib } from "./aviation-lib";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

const NAMES = [
  "parseSsimDate",
  "formatSsimDate",
  "isValidSsimDate",
  "parseDateWithPattern",
  "getLocaleMonthNames",
  "isValidDate",
];

describe("loadAviationLib", () => {
  it("hands back every function the tools call, and nothing else", async () => {
    const lib = await loadAviationLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadAviationLib();
    expect(lib.parseSsimDate("01JAN26", { yearWindow: 2000 })).toBe(
      "2026-01-01",
    );
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["aviation/parse"];
    GMT_MODULES["aviation/parse"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadAviationLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["aviation/parse"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["plain/locale"];
    GMT_MODULES["plain/locale"] = () => Promise.resolve({});
    try {
      await expect(loadAviationLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["plain/locale"] = original;
    }
  });
});
