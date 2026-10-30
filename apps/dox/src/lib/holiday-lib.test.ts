/**
 * `loadHolidayLib` against the real gmt modules through `~/test/holiday-lib`.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadHolidayLib, type HolidayLib } from "./holiday-lib";
import { WidgetLoadError } from "./widget-mount";
import { lib } from "~/test/holiday-lib";

describe("loadHolidayLib", () => {
  it("hands back every function the test library holds, as the library's own", async () => {
    const loaded = await loadHolidayLib();
    expect(Object.keys(loaded).sort()).toEqual(Object.keys(lib).sort());
    for (const name of Object.keys(lib) as (keyof HolidayLib)[]) {
      expect(loaded[name], name).toBe(lib[name]);
    }
  });

  it("is a module-granularity load: the rules module is in the registry", () => {
    expect(Object.keys(GMT_MODULES)).toContain("calendar/rules");
    expect(Object.keys(GMT_MODULES)).toContain("calendar/validate");
    expect(Object.keys(GMT_MODULES)).toContain("plain/compare");
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["calendar/rules"];
    GMT_MODULES["calendar/rules"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadHolidayLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["calendar/rules"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["calendar/validate"];
    GMT_MODULES["calendar/validate"] = () => Promise.resolve({});
    try {
      await expect(loadHolidayLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["calendar/validate"] = original;
    }
  });
});

describe("module-granularity imports", () => {
  it("no holiday source names the calendar barrel or a per-function path", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of [
      "holiday-lib.ts",
      "holiday-codec.ts",
      "holiday-widgets.ts",
      ["gmt", "modules.ts"].join("-"),
    ]) {
      const source = readFileSync(
        new URL(`./${file}`, import.meta.url),
        "utf8",
      );
      expect(source, file).not.toMatch(
        /["']@northguild\/gmt\/(calendar|plain|zoned)["']/,
      );
    }
  });
});
