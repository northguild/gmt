import { snapshotRow } from "../../../../scripts/lib/workaround-state.mjs";

/**
 * One row of `apps/dox/src/data/temporal-compat.json` (CORE-81): a workaround group, its probe
 * counts and its state on the installed polyfill. Expected states follow the guard rule: a guard
 * holds while the installed version is at or before `through` (SemVer 2.0.0 §11 precedence).
 */
const plain = {
  defects: ["D1"],
  title: "D1 — title",
  trigger: "D1 trigger",
};

const d10 = {
  defects: ["D10"],
  title: "D10 — title",
  trigger: "D10 trigger",
  guard: {
    package: "@js-temporal/polyfill",
    through: "0.5.1",
    reason: "Polyfill 0.5.1 is older than the change.",
  },
};

describe("snapshotRow", () => {
  it("keeps the first five fields in order and adds state last for a plain group", () => {
    const row = snapshotRow(plain, { probes: 3, failing: 3 }, "0.5.1");
    expect(Object.keys(row)).toEqual([
      "defects",
      "title",
      "trigger",
      "probes",
      "failing",
      "state",
    ]);
    expect(row).toEqual({
      ...plain,
      probes: 3,
      failing: 3,
      state: "still-needed",
    });
  });

  it("is removable when every probe passes and there is no guard", () => {
    const row = snapshotRow(plain, { probes: 2, failing: 0 }, "0.5.1");
    expect(row.state).toBe("removable");
    expect("guard" in row).toBe(false);
  });

  it("is still needed when the group has no probes", () => {
    expect(snapshotRow(plain, { probes: 0, failing: 0 }, "0.5.1").state).toBe(
      "still-needed",
    );
  });

  it("is a guard on the guarded version, carrying the entry's guard keys in order", () => {
    const row = snapshotRow(d10, { probes: 2, failing: 0 }, "0.5.1");
    expect(row.state).toBe("guard");
    expect(row.guard).toEqual(d10.guard);
    expect(Object.keys(row.guard!)).toEqual(["package", "through", "reason"]);
    expect(Object.keys(row)).toEqual([
      "defects",
      "title",
      "trigger",
      "probes",
      "failing",
      "state",
      "guard",
    ]);
  });

  it("copies the guard rather than sharing the entry's object", () => {
    const row = snapshotRow(d10, { probes: 2, failing: 0 }, "0.5.1");
    expect(row.guard).not.toBe(d10.guard);
  });

  it("is a guard on a pre-release of the guarded version (SemVer §11.3)", () => {
    expect(
      snapshotRow(d10, { probes: 2, failing: 0 }, "0.5.1-rc.1").state,
    ).toBe("guard");
  });

  it("is removable with its guard still present once the guard has lapsed", () => {
    const row = snapshotRow(d10, { probes: 2, failing: 0 }, "0.6.0");
    expect(row.state).toBe("removable");
    expect(row.guard).toEqual(d10.guard);
  });

  it("is still needed, guard present and no throw, when a probe fails on an unreadable version", () => {
    const row = snapshotRow(d10, { probes: 2, failing: 1 }, "unknown");
    expect(row.state).toBe("still-needed");
    expect(row.guard).toEqual(d10.guard);
  });

  it("throws, naming the package and the version, when a guarded group cannot be compared", () => {
    expect(() =>
      snapshotRow(d10, { probes: 2, failing: 0 }, "unknown"),
    ).toThrow(/@js-temporal\/polyfill.*unknown.*0\.5\.1/);
  });

  it("does not throw on an unreadable version when the group has no guard", () => {
    expect(snapshotRow(plain, { probes: 2, failing: 0 }, "unknown").state).toBe(
      "removable",
    );
  });
});
