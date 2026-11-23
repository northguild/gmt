/**
 * `loadHoursLib` against the real gmt modules.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadHoursLib } from "./hours-lib";
import { WidgetLoadError } from "./widget-mount";

const NAMES = [
  "operatingIntervals",
  "isOpenAt",
  "nextOpenAt",
  "nextCloseAt",
  "operatingTimeBetween",
  "addOperatingTime",
  "isValidOperatingSchedule",
  "isValidInterval",
  "isValidDuration",
];

describe("loadHoursLib", () => {
  it("hands back every function the tools call, and nothing else", async () => {
    const lib = await loadHoursLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadHoursLib();
    expect(lib.isValidOperatingSchedule({ timeZone: "UTC", weekly: {} })).toBe(
      true,
    );
    expect(
      lib.isValidOperatingSchedule({ timeZone: "UTC", weekly: { 8: [] } }),
    ).toBe(false);
  });

  it.each([
    "calendar/hours",
    "calendar/validate",
    "interval/validate",
    "duration/validate",
  ] as const)(
    "turns a rejected %s import into a WidgetLoadError",
    async (key) => {
      const original = GMT_MODULES[key];
      GMT_MODULES[key] = () => Promise.reject(new Error("offline"));
      try {
        await expect(loadHoursLib()).rejects.toBeInstanceOf(WidgetLoadError);
      } finally {
        GMT_MODULES[key] = original;
      }
    },
  );

  it("names the module that no longer exports a function", async () => {
    const original = GMT_MODULES["calendar/validate"];
    GMT_MODULES["calendar/validate"] = () => Promise.resolve({});
    try {
      await expect(loadHoursLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["calendar/validate"] = original;
    }
  });
});
