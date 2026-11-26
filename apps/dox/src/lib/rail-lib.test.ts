/**
 * `loadRailLib` against the real gmt modules.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadRailLib } from "./rail-lib";
import { WidgetLoadError } from "./widget-mount";

const NAMES = [
  "parseGtfsTime",
  "formatGtfsTime",
  "isValidGtfsTime",
  "isValidTime",
];

describe("loadRailLib", () => {
  it("hands back every function the tools call, and nothing else", async () => {
    const lib = await loadRailLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadRailLib();
    expect(lib.parseGtfsTime("25:35:00")).toEqual({
      seconds: 5700,
      dayOverflow: 1,
    });
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["rail/parse"];
    GMT_MODULES["rail/parse"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadRailLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["rail/parse"] = original;
    }
  });

  it("names the module that no longer exports a function", async () => {
    const original = GMT_MODULES["rail/format"];
    GMT_MODULES["rail/format"] = () => Promise.resolve({});
    try {
      await expect(loadRailLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["rail/format"] = original;
    }
  });
});
