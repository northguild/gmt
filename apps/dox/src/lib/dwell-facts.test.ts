import { dwellLib as lib } from "~/test/ledger-lib";
import {
  DWELL_PRESETS,
  MAX_LISTED_DAYS,
  NO_ZONE,
  dwellFacts,
  dwellNotes,
  touchedDates,
  toEpochMs,
  type DwellInput,
} from "./dwell-ledger";

const stateOf = (id: string): DwellInput => {
  const p = DWELL_PRESETS.find((preset) => preset.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return {
    entry: p.entry,
    exit: p.exit,
    zone: p.zone,
    compareZone: p.compareZone ?? NO_ZONE,
  };
};

describe("dwellFacts", () => {
  it("holds the dwell dwellTime reads and the local days it touched", () => {
    const state = stateOf("two-hours-two-days");
    const facts = dwellFacts(state, lib);
    expect(facts.result).toEqual(
      lib.dwellTime(state.entry, state.exit, state.zone),
    );
    expect(facts.reason).toBeNull();
    expect(facts.touchedDays).toEqual(["2024-06-15", "2024-06-16"]);
    expect(facts.compare).toBeNull();
  });

  it("does not touch the new day when the exit is exactly at midnight", () => {
    const facts = dwellFacts(
      {
        entry: "2024-06-15T00:00:00Z",
        exit: "2024-06-16T00:00:00Z",
        zone: "UTC",
        compareZone: NO_ZONE,
      },
      lib,
    );
    expect(facts.touchedDays).toEqual(["2024-06-15"]);
  });

  it("counts the same instants in a second zone", () => {
    const state = stateOf("london-vs-amsterdam");
    const facts = dwellFacts(state, lib);
    expect(facts.compare?.zone).toBe("Europe/Amsterdam");
    expect(facts.compare?.result).toEqual(
      lib.dwellTime(state.entry, state.exit, "Europe/Amsterdam"),
    );
    expect(facts.result).not.toEqual(facts.compare?.result);
  });

  it("explains a dwell with no zone to count in", () => {
    const facts = dwellFacts(stateOf("no-zone"), lib);
    expect(facts.result).toBeNull();
    expect(facts.reason).toBe("no-zone");
    expect(facts.touchedDays).toBeNull();
  });

  it("explains an exit before the entry", () => {
    const facts = dwellFacts(
      {
        entry: "2024-06-16T00:00:00Z",
        exit: "2024-06-15T00:00:00Z",
        zone: "UTC",
        compareZone: NO_ZONE,
      },
      lib,
    );
    expect(facts.reason).toBe("inverted");
    expect(facts.touchedDays).toBeNull();
  });

  it("names the days an in-range dwell touched but not those of a dwell too long to list", () => {
    const entry = "2024-01-01T00:00:00Z";
    const long = `${2024 + 2}-01-01T00:00:00Z`;
    const facts = dwellFacts(
      { entry, exit: long, zone: "UTC", compareZone: NO_ZONE },
      lib,
    );
    expect(facts.result).not.toBeNull();
    expect(facts.touchedDays).toBeNull();
    expect(
      touchedDates(toEpochMs(entry), toEpochMs("2024-01-04T00:00:00Z"), "UTC"),
    ).toHaveLength(3);
    expect(MAX_LISTED_DAYS).toBe(366);
  });
});

describe("touchedDates", () => {
  const at = (iso: string) => toEpochMs(iso);

  it("lists the day of a dwell of no length", () => {
    expect(
      touchedDates(
        at("2024-06-15T10:00:00Z"),
        at("2024-06-15T10:00:00Z"),
        "UTC",
      ),
    ).toEqual(["2024-06-15"]);
  });

  it("reads days on the zone's own clock across a spring-forward", () => {
    expect(
      touchedDates(
        at("2024-03-31T00:00:00Z"),
        at("2024-03-31T07:00:00Z"),
        "Europe/London",
      ),
    ).toEqual(["2024-03-31"]);
  });

  it("is null for an unreadable instant, an inverted dwell or a zone Temporal does not read", () => {
    expect(touchedDates(Number.NaN, 0, "UTC")).toBeNull();
    expect(touchedDates(10, 5, "UTC")).toBeNull();
    expect(touchedDates(0, 1, "Not/AZone")).toBeNull();
  });
});

describe("dwellNotes", () => {
  const long: DwellInput = {
    entry: "2024-01-01T00:00:00Z",
    exit: "2026-01-01T00:00:00Z",
    zone: "UTC",
    compareZone: NO_ZONE,
  };

  it("says the dates are not listed for a dwell over the cap", () => {
    expect(dwellNotes(long, dwellFacts(long, lib))).toEqual([
      `The dwell is longer than ${MAX_LISTED_DAYS} days, so its dates are not listed.`,
    ]);
  });

  it("says nothing for a dwell whose dates are listed", () => {
    const state = stateOf("two-hours-two-days");
    expect(dwellNotes(state, dwellFacts(state, lib))).toEqual([]);
  });

  it("gives only the reason, never the too-long note, when there is no zone", () => {
    const state = { ...stateOf("no-zone"), exit: "2030-01-01T00:00:00Z" };
    const notes = dwellNotes(state, dwellFacts(state, lib));
    expect(notes).toHaveLength(1);
    expect(notes[0]).not.toMatch(/longer than/);
  });
});
