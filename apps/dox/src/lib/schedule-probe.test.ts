/**
 * `probeScheduleParts` against the real library through `loadHoursLib`: nothing here is a
 * stand-in for the validator, so a rule the library changes shows up as a failing row.
 */
import { OPERATING_SCHEDULE_PRESETS } from "~/data/operating-schedule-presets";
import { loadHoursLib, type HoursLib } from "./hours-lib";
import { probeScheduleParts } from "./schedule-probe";

let lib: HoursLib;
beforeAll(async () => {
  lib = await loadHoursLib();
});

const probe = (value: unknown) =>
  probeScheduleParts(value, lib.isValidOperatingSchedule);
const WINDOW = { from: "09:00", to: "17:00" };
const UTC = "UTC";

describe("accepted exactly when the library accepts", () => {
  it.each(OPERATING_SCHEDULE_PRESETS.map((p) => [p.id, p.text] as const))(
    "preset %s",
    (_id, text) => {
      const value: unknown = JSON.parse(text);
      expect(probe(value).kind === "accepted").toBe(
        lib.isValidOperatingSchedule(value),
      );
    },
  );

  it.each([
    ["an empty week", { timeZone: UTC, weekly: {} }],
    ["a bad zone", { timeZone: "Mars/Olympus", weekly: {} }],
    ["a missing zone", { weekly: {} }],
    ["null", null],
    ["a number", 7],
    ["an array", []],
    ["weekly as a string", { timeZone: UTC, weekly: "no" }],
    ["a weekday 0", { timeZone: UTC, weekly: { 0: [WINDOW] } }],
    [
      "a bad window",
      { timeZone: UTC, weekly: { 1: [{ from: "9", to: "17" }] } },
    ],
  ])("%s", (_name, value) => {
    expect(probe(value).kind === "accepted").toBe(
      lib.isValidOperatingSchedule(value),
    );
  });
});

describe("naming the part", () => {
  it("names only weekly[8] for the London weekday preset", () => {
    const text = OPERATING_SCHEDULE_PRESETS.find(
      (p) => p.id === "london-weekday-8",
    )!.text;
    expect(probe(JSON.parse(text))).toEqual({
      kind: "parts-refused",
      parts: ['weekly["8"]'],
    });
  });

  it("names a bad window under a good key", () => {
    const value = {
      timeZone: UTC,
      weekly: { 1: [WINDOW, { from: "9", to: "17" }] },
    };
    expect(probe(value)).toEqual({
      kind: "parts-refused",
      parts: ['weekly["1"][1]'],
    });
  });

  it("names weekly when it is not an object", () => {
    expect(probe({ timeZone: UTC, weekly: "no" })).toEqual({
      kind: "parts-refused",
      parts: ["weekly"],
    });
  });

  it("names a holiday and an override by position", () => {
    const value = {
      timeZone: UTC,
      weekly: {},
      holidays: ["2024-01-01", "nope"],
      overrides: [{ date: "nope", windows: [] }],
    };
    const result = probe(value);
    expect(result).toEqual({
      kind: "parts-refused",
      parts: ["holidays[1]", "overrides[0]"],
    });
  });

  it("names each refused part by a one-part schedule the library also refuses", () => {
    const value = {
      timeZone: UTC,
      weekly: { 8: [], 1: [WINDOW] },
      holidays: ["nope"],
    };
    const result = probe(value);
    if (result.kind !== "parts-refused") throw new Error("expected parts");
    expect(
      lib.isValidOperatingSchedule({ timeZone: UTC, weekly: { 8: [] } }),
    ).toBe(false);
    expect(
      lib.isValidOperatingSchedule({
        timeZone: UTC,
        weekly: {},
        holidays: ["nope"],
      }),
    ).toBe(false);
    expect(result.parts).toEqual(['weekly["8"]', "holidays[0]"]);
  });
});

describe("the other kinds", () => {
  it("stops at the zone", () => {
    expect(probe({ timeZone: "Mars/Olympus", weekly: { 8: [] } })).toEqual({
      kind: "zone-refused",
    });
  });

  it("is refused together when no part is refused alone", () => {
    const text = OPERATING_SCHEDULE_PRESETS.find(
      (p) => p.id === "sao-paulo-two-overrides",
    )!.text;
    expect(probe(JSON.parse(text))).toEqual({ kind: "refused-together" });
  });

  it.each([null, 7, "text", []])("cannot read parts of %j", (value) => {
    expect(probe(value)).toEqual({ kind: "refused-together" });
  });
});
