/**
 * `gnss-widgets.ts`'s pure helpers, against the real gmt modules through
 * `~/test/gnss-lib`. Every library result a test states was read from a run
 * against the built `dist`; where a test can ask the library instead of
 * stating a value, it does.
 */
import {
  GNSS_SYSTEMS,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
} from "./gnss-names";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import { GMT_MODULES } from "./gmt-modules";
import {
  BEFORE_FIRST_WEEK_NOTE,
  NO_RESULT_TEXT,
  beforeFirstWeekText,
  counterSystem,
  durationSecondsText,
  eraAt,
  eraStart,
  firstRefusedWeek,
  labelParts,
  leadOverUtc,
  systemFirstInstant,
  weeksBelowText,
} from "./gnss-widgets";
import { WidgetLoadError } from "./widget-mount";
import { lib } from "~/test/gnss-lib";

describe("counterSystem", () => {
  it("is the token before the dash", () => {
    expect(counterSystem("QZS-CNAV")).toBe("QZS");
    expect(counterSystem("GPS-LNAV")).toBe("GPS");
    expect(counterSystem("IRN-L1NV")).toBe("IRN");
  });

  it("is the whole name when there is no dash", () => {
    expect(counterSystem("GAL")).toBe("GAL");
    expect(counterSystem("BDT")).toBe("BDT");
  });

  it("gives every counter a system the library reads, and every system a counter", () => {
    for (const counter of GNSS_WEEK_COUNTERS) {
      const system = counterSystem(counter);
      expect(RINEX_WEEK_SYSTEMS).toContain(system);
      expect(GNSS_SYSTEMS).toContain(system);
      expect(lib.utcToGnss(system, eraStart(lib, counter, 0))).not.toBe("");
    }
    for (const system of RINEX_WEEK_SYSTEMS) {
      expect(GNSS_WEEK_COUNTERS.map(counterSystem)).toContain(system);
    }
  });
});

describe("labelParts", () => {
  it("splits a scale string at its one space", () => {
    expect(labelParts("2024-01-01T00:00:04 BDT")).toEqual({
      dateTime: "2024-01-01T00:00:04",
      token: "BDT",
    });
    expect(labelParts("2016-12-31T23:59:60 GLO")).toEqual({
      dateTime: "2016-12-31T23:59:60",
      token: "GLO",
    });
  });

  it("splits what the library wrote", () => {
    expect(labelParts(lib.utcToGnss("GPS", "2024-01-01T00:00:00Z"))).toEqual({
      dateTime: "2024-01-01T00:00:18",
      token: "GPS",
    });
    expect(labelParts(lib.toTAI("2026-01-01T00:00:00Z"))?.token).toBe("TAI");
  });

  it("gives null for no space, two spaces or an empty side", () => {
    expect(labelParts("")).toBeNull();
    expect(labelParts("2024-01-01T00:00:04")).toBeNull();
    expect(labelParts("2024-01-01T00:00:04 BDT extra")).toBeNull();
    expect(labelParts(" BDT")).toBeNull();
    expect(labelParts("2024-01-01T00:00:04 ")).toBeNull();
  });
});

describe("leadOverUtc", () => {
  const utc = "2024-01-01T00:00:00Z";

  it("reads each system's lead over UTC from the library", () => {
    const leads = Object.fromEntries(
      GNSS_SYSTEMS.map((system) => [
        system,
        leadOverUtc(lib, utc, lib.utcToGnss(system, utc)),
      ]),
    );
    expect(leads).toEqual({
      GPS: { kind: "lead", duration: "PT18S" },
      GAL: { kind: "lead", duration: "PT18S" },
      BDT: { kind: "lead", duration: "PT4S" },
      QZS: { kind: "lead", duration: "PT18S" },
      GLO: { kind: "lead", duration: "PT0S" },
      IRN: { kind: "lead", duration: "PT18S" },
    });
  });

  it("is the library's diffUtcAsDuration of the date-time read as Z", () => {
    const label = lib.utcToGnss("BDT", utc);
    expect(leadOverUtc(lib, utc, label)).toEqual({
      kind: "lead",
      duration: lib.diffUtcAsDuration(utc, "2024-01-01T00:00:04Z", "seconds"),
    });
  });

  it("says inside an inserted second when the instant holds second 60", () => {
    const leap = "2016-12-31T23:59:60Z";
    expect(leadOverUtc(lib, leap, lib.utcToGnss("GPS", leap))).toEqual({
      kind: "inside-inserted-second",
    });
  });

  it("says inside an inserted second when the label holds second 60", () => {
    const leap = "2016-12-31T23:59:60Z";
    const label = lib.utcToGnss("GLO", leap);
    expect(label).toBe("2016-12-31T23:59:60 GLO");
    expect(leadOverUtc(lib, leap, label)).toEqual({
      kind: "inside-inserted-second",
    });
    // Only the label holds it.
    expect(
      leadOverUtc(lib, "2016-12-31T23:59:59Z", "2016-12-31T23:59:60 GLO"),
    ).toEqual({ kind: "inside-inserted-second" });
  });

  it("decides second 60 with the library's test, in any spelling", () => {
    expect(lib.hasSecond60("2017-12-31T23:59:60Z")).toBe(true);
    expect(
      leadOverUtc(lib, "2017-12-31T23:59:60Z", "2018-01-01T00:00:17 GPS"),
    ).toEqual({ kind: "inside-inserted-second" });
    expect(
      leadOverUtc(lib, "2009-01-01T08:59:60+09:00", "2009-01-01T00:00:15 GPS"),
    ).toEqual({ kind: "inside-inserted-second" });
  });

  it("says none for a label the library did not write and an instant it cannot read", () => {
    expect(leadOverUtc(lib, utc, "")).toEqual({ kind: "none" });
    expect(leadOverUtc(lib, utc, "2024-01-01T00:00:18")).toEqual({
      kind: "none",
    });
    expect(leadOverUtc(lib, "invalid", "2024-01-01T00:00:18 GPS")).toEqual({
      kind: "none",
    });
    expect(
      leadOverUtc(lib, utc, lib.utcToGnss("BDT", "2005-12-31T23:59:59Z")),
    ).toEqual({ kind: "none" });
  });
});

describe("durationSecondsText", () => {
  it("reads the seconds of a duration the library wrote", () => {
    expect(durationSecondsText("PT18S")).toBe("18");
    expect(durationSecondsText("PT0S")).toBe("0");
    expect(
      durationSecondsText(
        lib.diffUtcAsDuration(
          "2024-01-01T00:00:04Z",
          "2024-01-01T00:00:00Z",
          "seconds",
        ),
      ),
    ).toBe("-4");
    expect(
      durationSecondsText(
        lib.diffUtcAsDuration(
          "2024-01-01T00:00:00Z",
          "2024-01-01T00:00:00.5Z",
          "seconds",
        ),
      ),
    ).toBe("0.5");
  });

  it("gives null for anything else", () => {
    expect(durationSecondsText("")).toBeNull();
    expect(durationSecondsText("PT1M")).toBeNull();
    expect(durationSecondsText("18")).toBeNull();
  });
});

describe("firstRefusedWeek", () => {
  /** What the library says about a counter's weeks at era 0. */
  const accepts = (
    counter: (typeof GNSS_WEEK_COUNTERS)[number],
    week: number,
  ) => lib.gnssWeekToUtc(counter, week, 0, 0) !== "";

  it.each(GNSS_WEEK_COUNTERS)(
    "%s: the week before is accepted and the week itself is refused",
    (counter) => {
      const first = firstRefusedWeek(lib, counter);
      expect(first).toBeGreaterThan(1);
      expect(accepts(counter, first - 1)).toBe(true);
      expect(accepts(counter, first)).toBe(false);
    },
  );

  it("reads 1024 for the three LNAV counters, 4096 for GAL and 8192 for the rest", () => {
    expect(
      Object.fromEntries(
        GNSS_WEEK_COUNTERS.map((c) => [c, firstRefusedWeek(lib, c)]),
      ),
    ).toEqual({
      "GPS-LNAV": 1024,
      "GPS-CNAV": 8192,
      GAL: 4096,
      BDT: 8192,
      "QZS-LNAV": 1024,
      "QZS-CNAV": 8192,
      "IRN-LNAV": 1024,
      "IRN-L1NV": 8192,
    });
  });

  it("asks the library a few dozen times, and once per counter", () => {
    let calls = 0;
    const counting: GnssLib = {
      ...lib,
      gnssWeekToUtc: (...args) => {
        calls += 1;
        return lib.gnssWeekToUtc(...args);
      },
    };
    expect(firstRefusedWeek(counting, "GAL")).toBe(4096);
    const first = calls;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(40);
    expect(firstRefusedWeek(counting, "GAL")).toBe(4096);
    expect(calls).toBe(first);
  });

  it("finds a refused week that is not a power of two", () => {
    const narrow: GnssLib = {
      ...lib,
      gnssWeekToUtc: (counter, week, tow, era) =>
        week < 700 ? lib.gnssWeekToUtc(counter, week, tow, era) : "",
    };
    expect(firstRefusedWeek(narrow, "GPS-LNAV")).toBe(700);
  });

  it("answers 0 when even week 0 is refused", () => {
    const refusing: GnssLib = { ...lib, gnssWeekToUtc: () => "" };
    expect(firstRefusedWeek(refusing, "BDT")).toBe(0);
  });
});

describe("eraStart", () => {
  it("is gnssWeekToUtc(counter, 0, 0, era)", () => {
    expect(eraStart(lib, "GPS-LNAV", 0)).toBe("1980-01-06T00:00:00Z");
    expect(eraStart(lib, "GPS-LNAV", 1)).toBe("1999-08-21T23:59:47Z");
    expect(eraStart(lib, "GPS-LNAV", 2)).toBe("2019-04-06T23:59:42Z");
    expect(eraStart(lib, "GAL", 1)).toBe("2078-02-19T23:59:42Z");
    expect(eraStart(lib, "IRN-L1NV", 1)).toBe("2156-08-21T23:59:42Z");
    expect(eraStart(lib, "BDT", 0)).toBe("2006-01-01T00:00:00Z");
  });

  it("reads back as week 0, time of week 0 of that era, and the second before as the last of the era before", () => {
    for (const counter of GNSS_WEEK_COUNTERS) {
      const last = firstRefusedWeek(lib, counter) - 1;
      for (const era of [0, 1, 2]) {
        const start = eraStart(lib, counter, era);
        expect(lib.utcToGnssWeek(counter, start)).toEqual({
          week: 0,
          timeOfWeekSeconds: 0,
          era,
        });
        const before = lib.utcToGnssWeek(
          counter,
          lib.addUtc(start, { seconds: -1 }),
        );
        if (era === 0) {
          expect(before).toBeNull();
        } else {
          expect(before).toEqual({
            week: last,
            timeOfWeekSeconds: 604799,
            era: era - 1,
          });
        }
      }
    }
  });

  it("is the sentinel for an era the library refuses", () => {
    expect(eraStart(lib, "GPS-LNAV", -1)).toBe("");
  });
});

describe("eraAt", () => {
  it("is the era utcToGnssWeek reports", () => {
    expect(eraAt(lib, "GPS-LNAV", "2024-01-01T00:00:00Z")).toBe(2);
    expect(eraAt(lib, "IRN-LNAV", "2024-01-01T00:00:00Z")).toBe(1);
    expect(eraAt(lib, "GAL", "2024-01-01T00:00:00Z")).toBe(0);
    expect(eraAt(lib, "GPS-LNAV", "2024-01-01T00:00:00Z")).toBe(
      lib.utcToGnssWeek("GPS-LNAV", "2024-01-01T00:00:00Z")?.era,
    );
  });

  it("is null before the counter's first week and for an invalid instant", () => {
    expect(eraAt(lib, "GAL", "1999-08-21T23:59:46Z")).toBeNull();
    expect(eraAt(lib, "GPS-LNAV", "invalid")).toBeNull();
  });
});

describe("systemFirstInstant", () => {
  it("reads each system's first instant from its counters", () => {
    expect(
      Object.fromEntries(
        RINEX_WEEK_SYSTEMS.map((s) => [s, systemFirstInstant(lib, s)]),
      ),
    ).toEqual({
      GPS: "1980-01-06T00:00:00Z",
      GAL: "1999-08-21T23:59:47Z",
      BDT: "2006-01-01T00:00:00Z",
      QZS: "1980-01-06T00:00:00Z",
      IRN: "1999-08-21T23:59:47Z",
    });
  });

  it("is why rinexWeekToUtc(system, 0, 0) cannot be asked", () => {
    // A RINEX week counts from 1980 (2006 for BDT), so week 0 of a clock that
    // starts in 1999 is before the clock.
    expect(lib.rinexWeekToUtc("GAL", 0, 0)).toBe("");
    expect(lib.rinexWeekToUtc("IRN", 0, 0)).toBe("");
  });

  it.each(RINEX_WEEK_SYSTEMS)(
    "%s: the first instant reads as a RINEX week and back",
    (system) => {
      const first = systemFirstInstant(lib, system);
      const week = lib.utcToRinexWeek(system, first);
      expect(week).not.toBeNull();
      expect(
        lib.rinexWeekToUtc(system, week!.week, week!.timeOfWeekSeconds),
      ).toBe(first);
    },
  );

  it.each(RINEX_WEEK_SYSTEMS)(
    "%s: the second before the first instant has no RINEX week",
    (system) => {
      const first = systemFirstInstant(lib, system);
      const before = lib.addUtc(first, { seconds: -1 });
      expect(lib.isValidInstant(before)).toBe(true);
      expect(lib.utcToRinexWeek(system, before)).toBeNull();
    },
  );

  it("GAL and IRN give null one second before 1999-08-21T23:59:47Z", () => {
    expect(lib.utcToRinexWeek("GAL", "1999-08-21T23:59:46Z")).toBeNull();
    expect(lib.utcToRinexWeek("IRN", "1999-08-21T23:59:46Z")).toBeNull();
  });
});

describe("shared sentences", () => {
  it("states the no-result words", () => {
    expect(NO_RESULT_TEXT).toBe("no result");
    expect(BEFORE_FIRST_WEEK_NOTE).toBe("before this system's first week");
  });

  it("names the first week's start from a library answer", () => {
    expect(beforeFirstWeekText(eraStart(lib, "GAL", 0))).toBe(
      "This is before the counter's first week, which starts at 1999-08-21T23:59:47Z.",
    );
  });

  it("names the first refused week from a library probe", () => {
    expect(weeksBelowText(firstRefusedWeek(lib, "GPS-LNAV"))).toBe(
      "This counter shows weeks below 1024.",
    );
  });

  it("does not call the library GMT or name a regional clock", () => {
    const text = [
      NO_RESULT_TEXT,
      BEFORE_FIRST_WEEK_NOTE,
      beforeFirstWeekText("1980-01-06T00:00:00Z"),
      weeksBelowText(1024),
    ].join(" ");
    expect(text).not.toMatch(/GMT|UTC\+3|Moscow|MSK/);
  });
});

describe("loadGnssLib", () => {
  it("hands back every function the test library holds, as the library's own", async () => {
    const loaded = await loadGnssLib();
    expect(Object.keys(loaded).sort()).toEqual(Object.keys(lib).sort());
    for (const name of Object.keys(lib) as (keyof GnssLib)[]) {
      expect(loaded[name], name).toBe(lib[name]);
    }
  });

  it("turns a rejected import into a WidgetLoadError", async () => {
    const original = GMT_MODULES["gnss/convert"];
    GMT_MODULES["gnss/convert"] = () => Promise.reject(new Error("offline"));
    try {
      await expect(loadGnssLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["gnss/convert"] = original;
    }
  });

  it("turns a module that lacks a name into a WidgetLoadError", async () => {
    const original = GMT_MODULES["timescale/validate"];
    GMT_MODULES["timescale/validate"] = () => Promise.resolve({});
    try {
      await expect(loadGnssLib()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      GMT_MODULES["timescale/validate"] = original;
    }
  });
});
