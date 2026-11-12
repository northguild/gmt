/**
 * `loadCcsdsLib` against the real gmt modules.
 */
import { CCSDS_DIGITS } from "./ccsds-widgets";
import { loadCcsdsLib } from "./ccsds-lib";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

const NAMES = [
  "parseCcsdsAsciiA",
  "parseCcsdsAsciiB",
  "formatCcsdsAsciiA",
  "formatCcsdsAsciiB",
  "getLocaleMonthNames",
];

describe("loadCcsdsLib", () => {
  it("hands back every function the tools call, and nothing else", async () => {
    const lib = await loadCcsdsLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadCcsdsLib();
    expect(lib.parseCcsdsAsciiB("2016-366T23:59:60.5Z")).toBe(
      "2016-12-31T23:59:60.5Z",
    );
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["timescale/parse"];
    GMT_MODULES["timescale/parse"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadCcsdsLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["timescale/parse"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["timescale/format"];
    GMT_MODULES["timescale/format"] = () => Promise.resolve({});
    try {
      await expect(loadCcsdsLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["timescale/format"] = original;
    }
  });
});

describe("CCSDS_DIGITS", () => {
  it("lists auto and 0 to 9, each once, in chip order", () => {
    expect([...CCSDS_DIGITS]).toEqual(["auto", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
