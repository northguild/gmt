import { clockLabel, nearestZones, WALL_PINS } from "./clocks";

/** Eighteen zones spread round the planet: more than the wall has shards for. */
const ZONES = [
  "Pacific/Niue",
  "America/New_York",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Shanghai",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
  "Pacific/Apia",
  "Europe/Helsinki",
  "Europe/Madrid",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Manila",
  "America/Sao_Paulo",
  "America/Mexico_City",
];

describe("nearestZones", () => {
  it("returns the nearest zones first", () => {
    expect(nearestZones(ZONES, [139.69, 35.69], 2)).toEqual([
      "Asia/Tokyo",
      "Asia/Shanghai",
    ]);
  });

  it("has twelve to give for the wall", () => {
    expect(nearestZones(ZONES, [0, 0], WALL_PINS)).toHaveLength(WALL_PINS);
    expect(new Set(ZONES).size).toBe(ZONES.length);
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
