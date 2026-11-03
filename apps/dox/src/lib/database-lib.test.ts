/**
 * `loadDatabaseLib` against the real gmt modules.
 */
import { databaseLib } from "~/test/database-lib";
import { loadDatabaseLib } from "./database-lib";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

describe("loadDatabaseLib", () => {
  it("hands back the functions the tool calls, and nothing else", async () => {
    const lib = await loadDatabaseLib();
    expect(Object.keys(lib).sort()).toEqual(Object.keys(databaseLib).sort());
    for (const value of Object.values(lib)) {
      expect(typeof value).toBe("function");
    }
  });

  it("answers a real call", async () => {
    const lib = await loadDatabaseLib();
    expect(lib.parseSqlOffsetDateTime("2024-03-15 14:30:00-08")).toBe(
      "2024-03-15T14:30:00-08:00",
    );
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["instant/parse"];
    GMT_MODULES["instant/parse"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadDatabaseLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["instant/parse"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["zoned/parse"];
    GMT_MODULES["zoned/parse"] = () => Promise.resolve({});
    try {
      await expect(loadDatabaseLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["zoned/parse"] = original;
    }
  });
});
