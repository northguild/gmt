import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import {
  CLOCK_ZONES,
  NODE_PROBE_COMMAND,
  PROBE_EPOCH_MS,
  PROBE_INSTANT,
  PROBE_ZONES,
  STORED_ZONES,
  TRANSITION_ZONES,
  changeText,
  mapKindLabel,
  offsetFromIntl,
} from "./canada-clock-change";

describe("offsetFromIntl", () => {
  it.each([
    ["GMT-07:00", "-07:00"],
    ["GMT+05:30", "+05:30"],
    ["GMT", "+00:00"],
    ["GMT+00:00", "+00:00"],
    ["GMT−03:30", "-03:30"],
    ["GMT-00:44:30", "-00:44:30"],
  ])("reads %s as %s", (text, offset) => {
    expect(offsetFromIntl(text)).toBe(offset);
  });

  it.each(["", "UTC", "GMT-7", "-07:00", "PST"])(
    "returns an empty string for %j",
    (text) => {
      expect(offsetFromIntl(text)).toBe("");
    },
  );
});

describe("mapKindLabel", () => {
  it("has a distinct phrase for each of the three kinds", () => {
    const labels = [
      mapKindLabel("stopped-2026"),
      mapKindLabel("changes-2027"),
      mapKindLabel("none-2026-2027"),
    ];
    expect(new Set(labels).size).toBe(3);
    expect(labels).toEqual([
      "Stops changing clocks in 2026",
      "Still changes clocks",
      "Never changes clocks",
    ]);
  });
});

describe("changeText", () => {
  it("says none for the years given when there is no change", () => {
    expect(changeText(null, "2025 or 2026")).toBe("none in 2025 or 2026");
  });

  it("prints the UTC date and time and the offsets either side", () => {
    expect(
      changeText(
        {
          instant: "2026-11-01T09:00:00Z",
          offsetBefore: "-06:00",
          offsetAfter: "-07:00",
        },
        "2026 or 2027",
      ),
    ).toBe("2026-11-01 09:00 UTC, -06:00 → -07:00");
  });
});

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
