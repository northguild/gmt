import { describe, expect, it } from "vitest";
import { dwellTime } from "@northguild/gmt/transport/calculate";
import {
  isValidInstant,
} from "@northguild/gmt/precision/validate";
import {
  isValidTimeZone,
  isValidZonedDateTime,
} from "@northguild/gmt/zoned/validate";
import {
  CUSTOM_PRESET_ID,
  DWELL_PRESETS,
  LEDGER_ZONES,
  MAX_CELLS,
  NO_ZONE,
  createLedgerCanvas,
  dayCells,
  dayCountText,
  explainNull,
  fitLedgerCanvas,
  formatDwell,
  formatHandleValue,
  gridZone,
  matchPreset,
  resolveWallTime,
  toEpochMs,
} from "./dwell-ledger";

const validators = { isValidInstant, isValidTimeZone, isValidZonedDateTime };
const ms = (iso: string) => toEpochMs(iso);

describe("toEpochMs", () => {
  it("reads Z, offset and bracketed forms, and NaN otherwise", () => {
    const z = ms("2024-06-16T03:00:00Z");
    expect(ms("2024-06-15T23:00:00-04:00")).toBe(z);
    expect(ms("2024-06-15T23:00:00-04:00[America/New_York]")).toBe(z);
    expect(ms("2024-06-15T23:00:00[America/New_York]")).toBe(z);
    expect(ms("2024-06-15T23:00:00")).toBeNaN();
    expect(ms("nonsense")).toBeNaN();
  });
});

describe("gridZone", () => {
  it("prefers the chosen zone, then the entry's bracket, else none", () => {
    expect(gridZone("2024-06-15T22:30:00Z", "Europe/London")).toBe("Europe/London");
    expect(
      gridZone("2024-06-15T23:00:00-04:00[America/New_York]", NO_ZONE),
    ).toBe("America/New_York");
    expect(gridZone("2024-06-15T22:30:00Z", NO_ZONE)).toBeNull();
    expect(gridZone("2024-06-15T22:30:00Z[u-ca=gregory]", NO_ZONE)).toBeNull();
    expect(gridZone("2024-06-15T22:30:00Z", "Mars/Olympus_Mons")).toBeNull();
  });
});

describe("resolveWallTime", () => {
  it("reads a zoneless wall time in the zone", () => {
    expect(resolveWallTime("2024-06-15T23:00:00", "America/New_York")).toBe(
      "2024-06-15T23:00:00-04:00[America/New_York]",
    );
  });
  it("leaves instants, empty zones and skipped wall times alone", () => {
    expect(resolveWallTime("2024-06-15T23:00:00Z", "America/New_York")).toBe(
      "2024-06-15T23:00:00Z",
    );
    expect(resolveWallTime("2024-06-15T23:00:00-04:00", "Asia/Tokyo")).toBe(
      "2024-06-15T23:00:00-04:00",
    );
    expect(resolveWallTime("2024-06-15T23:00:00", NO_ZONE)).toBe(
      "2024-06-15T23:00:00",
    );
    // 02:30 did not exist in New York on 10 March 2024: never moved silently.
    expect(resolveWallTime("2024-03-10T02:30:00", "America/New_York")).toBe(
      "2024-03-10T02:30:00",
    );
  });
});

describe("createLedgerCanvas", () => {
  it("snaps to 15 minutes up to a week and hours beyond", () => {
    const day = ms("2024-06-15T00:00:00Z");
    expect(createLedgerCanvas(day, day + 2 * 86_400_000).snapMinutes).toBe(15);
    expect(createLedgerCanvas(day, day + 10 * 86_400_000).snapMinutes).toBe(60);
  });
  it("maps, snaps, steps and clamps", () => {
    const start = ms("2024-06-15T00:00:00Z");
    const c = createLedgerCanvas(start, start + 4 * 3_600_000);
    expect(c.toPercent(start + 3_600_000)).toBe(25);
    expect(c.fromPercent(26)).toBe(start + 3_600_000); // 62.4 min snaps to 60
    expect(c.step(start, 1)).toBe(start + 15 * 60_000);
    expect(c.step(start, -1)).toBe(start);
    expect(c.fromPercent(150)).toBe(c.endMs);
  });
});

describe("fitLedgerCanvas", () => {
  it("widens to whole local days in the zone", () => {
    const c = fitLedgerCanvas(
      ms("2024-06-15T23:00:00-04:00"),
      ms("2024-06-16T01:00:00-04:00"),
      ["America/New_York"],
    )!;
    expect(formatHandleValue(c.startMs, "America/New_York")).toBe(
      "2024-06-15T00:00:00-04:00[America/New_York]",
    );
    expect(formatHandleValue(c.endMs, "America/New_York")).toBe(
      "2024-06-17T00:00:00-04:00[America/New_York]",
    );
  });
  it("covers both zones' days when comparing", () => {
    const c = fitLedgerCanvas(
      ms("2024-06-15T22:30:00Z"),
      ms("2024-06-16T01:00:00Z"),
      ["Europe/London", "Europe/Amsterdam"],
    )!;
    // The dwell starts at 00:30 in Amsterdam but 23:30 in London, so London's
    // 15 June opens the canvas and its 17 June midnight closes it.
    expect(c.startMs).toBe(ms("2024-06-15T00:00:00+01:00"));
    expect(c.endMs).toBe(ms("2024-06-17T00:00:00+01:00"));
    // Amsterdam's grid is drawn on the same canvas, an hour ahead: the last
    // hour of 15 June, 16 June whole, the first hour of 17 June.
    const cells = dayCells(
      c,
      "Europe/Amsterdam",
      ms("2024-06-15T22:30:00Z"),
      ms("2024-06-16T01:00:00Z"),
    );
    expect(cells.map((d) => [d.date, d.touched])).toEqual([
      ["2024-06-15", false],
      ["2024-06-16", true],
      ["2024-06-17", false],
    ]);
  });
  it("pads only, with no zone", () => {
    const entry = ms("2024-06-15T22:30:00Z");
    const exit = ms("2024-06-16T01:00:00Z");
    const c = fitLedgerCanvas(entry, exit, [])!;
    expect(c.startMs).toBe(entry - 30 * 60_000);
    expect(c.endMs).toBe(exit + 30 * 60_000);
  });
  it("is null for an unparseable end", () => {
    expect(fitLedgerCanvas(Number.NaN, 0, [])).toBeNull();
  });
});

describe("dayCells", () => {
  const cellsFor = (entry: string, exit: string, zone: string) => {
    const e = ms(entry);
    const x = ms(exit);
    return dayCells(fitLedgerCanvas(e, x, [zone])!, zone, e, x);
  };

  it("draws spring-forward as 23 hours and fall-back as 25", () => {
    const spring = cellsFor(
      "2024-03-10T05:00:00Z",
      "2024-03-10T12:00:00Z",
      "America/New_York",
    );
    expect(spring.map((c) => [c.date, c.hours])).toContainEqual([
      "2024-03-10",
      23,
    ]);
    const fall = cellsFor(
      "2024-11-03T04:00:00Z",
      "2024-11-03T12:00:00Z",
      "America/New_York",
    );
    expect(fall.map((c) => [c.date, c.hours])).toContainEqual([
      "2024-11-03",
      25,
    ]);
    expect(fall.every((c) => c.date === "2024-11-03" || c.hours === 24)).toBe(
      true,
    );
  });

  it("does not touch the new day when the exit is exactly local midnight", () => {
    const cells = cellsFor(
      "2024-06-15T22:00:00Z",
      "2024-06-16T04:00:00Z",
      "America/New_York",
    );
    expect(cells.filter((c) => c.touched).map((c) => c.date)).toEqual([
      "2024-06-15",
    ]);
  });

  it("touches the one day a zero-length dwell sits on", () => {
    const at = "2024-06-16T04:00:00Z"; // local midnight in New York
    const cells = cellsFor(at, at, "America/New_York");
    expect(cells.filter((c) => c.touched).map((c) => c.date)).toEqual([
      "2024-06-16",
    ]);
  });

  it("returns no cells past the cap rather than slivers", () => {
    const start = ms("2020-01-01T00:00:00Z");
    const c = createLedgerCanvas(start, start + (MAX_CELLS + 5) * 86_400_000);
    expect(dayCells(c, "UTC", start, start)).toEqual([]);
  });

  /* The shading is drawing, not arithmetic the widget reports, but a picture
     that disagrees with the number beside it would teach the wrong rule. */
  it.each(DWELL_PRESETS.filter((p) => p.zone !== NO_ZONE))(
    "agrees with dwellTime's calendarDays for $id",
    (preset) => {
      for (const zone of [preset.zone, preset.compareZone].filter(
        (z): z is string => !!z,
      )) {
        const result = dwellTime(preset.entry, preset.exit, zone);
        expect(result).not.toBeNull();
        const touched = cellsFor(preset.entry, preset.exit, zone).filter(
          (c) => c.touched,
        ).length;
        expect(touched).toBe(result!.calendarDays);
      }
    },
  );
});

describe("explainNull", () => {
  it("names the check dwellTime failed, in dwellTime's order", () => {
    expect(explainNull("x", "y", NO_ZONE, validators)).toBe("invalid-entry");
    expect(
      explainNull("2024-06-15T22:30:00Z", "y", "Mars/Olympus_Mons", validators),
    ).toBe("invalid-exit");
    expect(
      explainNull(
        "2024-06-15T22:30:00Z",
        "2024-06-16T01:00:00Z",
        "Mars/Olympus_Mons",
        validators,
      ),
    ).toBe("unknown-zone");
    expect(
      explainNull(
        "2024-06-15T22:30:00Z",
        "2024-06-16T01:00:00Z",
        NO_ZONE,
        validators,
      ),
    ).toBe("no-zone");
    expect(
      explainNull(
        "2024-06-16T01:00:00Z",
        "2024-06-15T22:30:00Z",
        "Europe/London",
        validators,
      ),
    ).toBe("inverted");
  });

  it("agrees with dwellTime: null exactly when a reason is found", () => {
    const cases: [string, string, string][] = [
      ["2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", NO_ZONE],
      ["2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/London"],
      ["2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London"],
      [
        "2024-06-15T23:00:00-04:00[America/New_York]",
        "2024-06-16T01:00:00-04:00[America/New_York]",
        NO_ZONE,
      ],
      ["2024-06-15T23:00:00", "2024-06-16T01:00:00Z", "UTC"],
    ];
    for (const [entry, exit, zone] of cases) {
      const result = dwellTime(entry, exit, zone === NO_ZONE ? undefined : zone);
      const reason = explainNull(entry, exit, zone, validators);
      expect(reason === null, `${entry} → ${exit} in "${zone}"`).toBe(
        result !== null,
      );
    }
  });
});

describe("presets", () => {
  it("have unique ids and zones the picker offers", () => {
    const ids = DWELL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(CUSTOM_PRESET_ID);
    for (const p of DWELL_PRESETS) {
      if (p.zone !== NO_ZONE) expect(LEDGER_ZONES).toContain(p.zone);
      if (p.compareZone) expect(LEDGER_ZONES).toContain(p.compareZone);
    }
  });

  it("are recognised from their inputs", () => {
    const p = DWELL_PRESETS[3]!;
    expect(matchPreset(p.entry, p.exit, p.zone, p.compareZone ?? "")).toBe(p.id);
    expect(matchPreset(p.entry, p.exit, p.zone, "")).toBe(CUSTOM_PRESET_ID);
  });
});

describe("formatHandleValue", () => {
  it("writes zoned in the grid zone, else Z, and round-trips", () => {
    const at = ms("2024-06-16T03:00:00Z");
    const zoned = formatHandleValue(at, "America/New_York");
    expect(zoned).toBe("2024-06-15T23:00:00-04:00[America/New_York]");
    expect(ms(zoned)).toBe(at);
    expect(formatHandleValue(at, null)).toBe("2024-06-16T03:00:00Z");
  });
});

describe("formatDwell", () => {
  it("prints the result the way the guide does, one key per line", () => {
    expect(
      formatDwell({
        duration: "PT2H",
        enter: "2024-06-15T23:00:00-04:00[America/New_York]",
        exit: "2024-06-16T01:00:00-04:00[America/New_York]",
        calendarDays: 2,
      }),
    ).toBe(
      '{ duration: "PT2H",\n' +
        '  enter: "2024-06-15T23:00:00-04:00[America/New_York]",\n' +
        '  exit: "2024-06-16T01:00:00-04:00[America/New_York]",\n' +
        "  calendarDays: 2 }",
    );
    expect(dayCountText(1)).toBe("1 local day");
    expect(dayCountText(2)).toBe("2 local days");
  });
});
