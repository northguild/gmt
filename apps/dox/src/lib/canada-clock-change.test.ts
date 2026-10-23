import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import {
  CLOCK_ZONES,
  NODE_PROBE_COMMAND,
  PROBE_EPOCH_MS,
  PROBE_INSTANT,
  PROBE_ZONES,
  STORED_PRESET,
  STORED_ZONES,
  TRANSITION_ZONES,
} from "./canada-clock-change";

describe("the checker's facts", () => {
  it("probes five zones, one per tzdb release 2026b to 2026e, at one instant", () => {
    expect(PROBE_ZONES).toHaveLength(5);
    expect(PROBE_ZONES.map((fact) => fact.release).sort()).toEqual([
      "2026b",
      "2026c",
      "2026c",
      "2026d",
      "2026e",
    ]);
    expect(PROBE_INSTANT).toBe("2026-11-02T12:00:00Z");
    expect(
      Object.fromEntries(PROBE_ZONES.map((f) => [f.zone, f.offset])),
    ).toEqual({
      "America/Vancouver": "-07:00",
      "America/Edmonton": "-06:00",
      "Africa/Casablanca": "+00:00",
      "America/Inuvik": "-06:00",
      "America/Winnipeg": "-05:00",
    });
  });

  it("adds only America/Toronto to the probe zones for the transitions", () => {
    expect(
      TRANSITION_ZONES.filter((z) => !PROBE_ZONES.some((f) => f.zone === z)),
    ).toEqual(["America/Toronto"]);
  });

  it("uses the same five zones for the clocks and the stored-times picker", () => {
    expect(CLOCK_ZONES).toHaveLength(5);
    expect(STORED_ZONES).toEqual(CLOCK_ZONES);
  });

  it("gives a Node probe that reads Winnipeg at the probe instant", () => {
    expect(NODE_PROBE_COMMAND).toContain("America/Winnipeg");
    expect(NODE_PROBE_COMMAND).toContain(String(PROBE_EPOCH_MS));
    expect(NODE_PROBE_COMMAND).toContain(".format(1793620800000)");
  });

  it("states the probe instant in epoch milliseconds, as the library converts it", () => {
    expect(PROBE_EPOCH_MS).toBe(convertUtcToUnix(PROBE_INSTANT));
  });
});

describe("STORED_PRESET", () => {
  it("is eight literal lines, each with its own zone, all in the picker", () => {
    const rows = STORED_PRESET.split("\n");
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      const zone = /\[([^\]]+)\]$/.exec(row)?.[1];
      expect(STORED_ZONES).toContain(zone);
      expect(classifyStoredZoned(row)).not.toBeNull();
    }
  });
});
