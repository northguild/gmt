import { describe, expect, it } from "vitest";
import { PLANET_ZONES } from "./places";
import { clockLabel, nearestZones, WALL_PINS } from "./clocks";

describe("nearestZones", () => {
  it("returns the nearest zones first", () => {
    expect(nearestZones(PLANET_ZONES, [139.69, 35.69], 2)).toEqual([
      "Asia/Tokyo",
      "Asia/Shanghai",
    ]);
  });

  it("has twelve to give for the wall", () => {
    expect(nearestZones(PLANET_ZONES, [0, 0], WALL_PINS)).toHaveLength(
      WALL_PINS,
    );
    expect(new Set(PLANET_ZONES).size).toBe(PLANET_ZONES.length);
  });
});

describe("clockLabel", () => {
  it("is the city and the local time to the minute", () => {
    expect(
      clockLabel("Asia/Tokyo", () => "2024-02-29T23:30+09:00[Asia/Tokyo]"),
    ).toBe("Tokyo 23:30");
    expect(
      clockLabel(
        "America/Sao_Paulo",
        () => "2024-02-29T11:05-03:00[America/Sao_Paulo]",
      ),
    ).toBe("Sao Paulo 11:05");
  });

  it("names the city alone when the time cannot be read", () => {
    expect(clockLabel("Asia/Tokyo", () => "")).toBe("Tokyo");
  });
});
