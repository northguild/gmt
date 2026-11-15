/**
 * `loadIotLib` against the real gmt modules.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadIotLib } from "./iot-lib";
import { WidgetLoadError } from "./widget-mount";

const NAMES = ["ptpToUtc", "utcToPtp", "isValidPtpTimestamp", "taiMinusUtc"];

describe("loadIotLib", () => {
  it("hands back every function the tools call, and nothing else", async () => {
    const lib = await loadIotLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadIotLib();
    expect(lib.ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 37)).toBe(
      "2024-01-01T00:00:00Z",
    );
    expect(lib.taiMinusUtc("2024-01-01T00:00:00Z")).toBe(37);
  });

  it.each(["iot/convert", "iot/validate", "timescale/calculate"] as const)(
    "turns a rejected %s import into a WidgetLoadError",
    async (key) => {
      const original = GMT_MODULES[key];
      GMT_MODULES[key] = () => Promise.reject(new Error("offline"));
      try {
        await expect(loadIotLib()).rejects.toBeInstanceOf(WidgetLoadError);
      } finally {
        GMT_MODULES[key] = original;
      }
    },
  );

  it("turns a module that no longer exports a function into a WidgetLoadError", async () => {
    const original = GMT_MODULES["iot/validate"];
    GMT_MODULES["iot/validate"] = () => Promise.resolve({});
    try {
      await expect(loadIotLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["iot/validate"] = original;
    }
  });
});
