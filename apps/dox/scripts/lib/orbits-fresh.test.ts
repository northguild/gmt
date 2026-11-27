import {
  changedSolutions,
  endedPasses,
  solutionId,
  staleSmallBodies,
  WARN_DAYS,
} from "./orbits-fresh.mjs";

const DAY = 86_400_000;
/** A row whose elements are valid until 2027-11-11 00:00 UTC (epoch 2025-11-21, 720 days). */
const EPOCH = 2_461_000.5;
const small = { vesta: { epoch: EPOCH, days: 720 } };
/** The end of validity as a Unix instant. */
const END = (EPOCH + 720 - 2_440_587.5) * DAY;

describe("staleSmallBodies", () => {
  it("passes a row more than 90 days from the end of its validity", () => {
    expect(staleSmallBodies(small, END - (WARN_DAYS + 1) * DAY)).toEqual([]);
  });

  it("fails a row 90 days from the end, naming how many days are left", () => {
    expect(staleSmallBodies(small, END - WARN_DAYS * DAY)).toEqual([
      { id: "vesta", daysLeft: 90 },
    ]);
  });

  it("fails a row that has ended, with a negative count", () => {
    expect(staleSmallBodies(small, END + 5 * DAY)).toEqual([
      { id: "vesta", daysLeft: -5 },
    ]);
  });

  it("judges each row by its own epoch and days", () => {
    const rows = {
      vesta: { epoch: EPOCH, days: 720 },
      later: { epoch: EPOCH + 400, days: 720 },
    };
    const found = staleSmallBodies(rows, END - 10 * DAY);
    expect(found.map((row) => row.id)).toEqual(["vesta"]);
  });

  it("passes when there are no small bodies", () => {
    expect(staleSmallBodies({}, END)).toEqual([]);
  });
});

/** Apophis's pass as shipped: its window from 2029-04-13T08:40Z to 00:10Z on the 14th. */
const PASS_END = 1_870_764_000_000 + 93 * 600_000;
const apophis = {
  startMs: 1_870_764_000_000,
  endMs: PASS_END,
};
const passes = { apophis };

describe("endedPasses", () => {
  it("passes a window that has not ended, to its last row", () => {
    expect(endedPasses(passes, PASS_END - 1)).toEqual([]);
  });

  it("fails a window from its last row on, counting whole days", () => {
    expect(endedPasses(passes, PASS_END)).toEqual([
      { id: "apophis", daysAgo: 0 },
    ]);
    expect(endedPasses(passes, PASS_END + 3 * DAY)).toEqual([
      { id: "apophis", daysAgo: 3 },
    ]);
  });

  it("passes when no pass ships", () => {
    expect(endedPasses({}, PASS_END)).toEqual([]);
  });
});

describe("changedSolutions", () => {
  it("passes the same solution id", () => {
    expect(changedSolutions({ apophis: "220" }, { apophis: "220" })).toEqual(
      [],
    );
  });

  it("fails a changed id, naming both", () => {
    expect(changedSolutions({ apophis: "220" }, { apophis: "221" })).toEqual([
      { id: "apophis", recorded: "220", current: "221" },
    ]);
  });

  it("fails a body JPL no longer answers for", () => {
    expect(changedSolutions({ apophis: "220" }, { apophis: null })).toEqual([
      { id: "apophis", recorded: "220", current: null },
    ]);
  });
});

describe("solutionId", () => {
  it("reads the orbit id of an SBDB reply, null when it has none", () => {
    expect(solutionId({ orbit: { orbit_id: "220" } })).toBe("220");
    expect(solutionId({})).toBeNull();
  });
});
