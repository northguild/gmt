import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { libraryTotals } from "~/data/zone-probe";
import { WALL_PAGES } from "./wall";

const publicDir = resolve(import.meta.dirname, "../../../public");

describe("the wall's captures", () => {
  it("are the five Date-based libraries, each one the zone probe measured", () => {
    expect(WALL_PAGES.map((p) => p.id)).toEqual([
      "moment",
      "luxon",
      "date-fns",
      "dayjs",
      "spacetime",
    ]);
    const measured = libraryTotals().map((t) => t.id);
    for (const page of WALL_PAGES) expect(measured).toContain(page.id);
  });

  it("each has an https address, an instant and an image under budget", () => {
    for (const page of WALL_PAGES) {
      expect(page.url).toMatch(/^https:\/\//);
      expect(() => Temporal.Instant.from(page.capturedAt)).not.toThrow();
      const file = resolve(publicDir, page.image);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(90 * 1024);
    }
  });

  it("each has a distinct id, address and image", () => {
    for (const key of ["id", "url", "image"] as const)
      expect(new Set(WALL_PAGES.map((p) => p[key])).size).toBe(
        WALL_PAGES.length,
      );
  });

  it("each names its library", () => {
    expect(WALL_PAGES.map((p) => p.name)).toEqual([
      "Moment.js",
      "Luxon",
      "date-fns",
      "Day.js",
      "Spacetime",
    ]);
  });

  it("are not stand-ins", () => {
    expect(WALL_PAGES.filter((p) => p.placeholder)).toEqual([]);
  });
});
