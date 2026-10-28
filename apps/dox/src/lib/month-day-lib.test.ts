/**
 * `loadMonthDayLib` against the real gmt modules.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadMonthDayLib } from "./month-day-lib";
import { WidgetLoadError } from "./widget-mount";

const NAMES = [
  "isValidMonthDay",
  "isValidDate",
  "parseMonthDay",
  "parseMonthDayFromDate",
  "parseMonthDayFromDateTime",
  "formatMonthDay",
  "compareMonthDays",
  "areMonthDaysEqual",
  "monthDayToDate",
  "addDate",
];

describe("loadMonthDayLib", () => {
  it("hands back every function the tool calls, and nothing else", async () => {
    const lib = await loadMonthDayLib();
    expect(Object.keys(lib).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(typeof (lib as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });

  it("answers a real call", async () => {
    const lib = await loadMonthDayLib();
    expect(lib.monthDayToDate("--02-29", 2023)).toBe("2023-02-28");
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["plain/convert"];
    GMT_MODULES["plain/convert"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadMonthDayLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["plain/convert"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["plain/compare"];
    GMT_MODULES["plain/compare"] = () => Promise.resolve({});
    try {
      await expect(loadMonthDayLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["plain/compare"] = original;
    }
  });
});
