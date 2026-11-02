/**
 * `loadExpiryLib` against the real gmt modules.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadExpiryLib } from "./expiry-lib";
import { WidgetLoadError } from "./widget-mount";

const NAMES = [
  "durationFromUnits",
  "totalDuration",
  "ttlFromNow",
  "addUnix",
  "addUtc",
  "convertUtcToUnix",
  "convertUtcToZoned",
  "formatHttpDate",
  "getUtcIn",
  "isValidUtc",
];

describe("loadExpiryLib", () => {
  it("hands back every function the tool calls, and nothing else", async () => {
    const lib = await loadExpiryLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadExpiryLib();
    expect(lib.addUtc("2027-06-15T12:00:00Z", { years: 1 })).toBe(
      "2028-06-15T12:00:00Z",
    );
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["utc/get"];
    GMT_MODULES["utc/get"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadExpiryLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["utc/get"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["utc/format"];
    GMT_MODULES["utc/format"] = () => Promise.resolve({});
    try {
      await expect(loadExpiryLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["utc/format"] = original;
    }
  });
});
