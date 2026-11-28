import { snapshotRow } from "../../../../scripts/lib/workaround-state.mjs";

/**
 * One row of `apps/dox/src/data/temporal-compat.json`: a workaround group, its probe counts and
 * its state on the engine the snapshot ran on.
 */
const plain = {
  defects: ["D16"],
  title: "D16 — title",
  trigger: "D16 trigger",
};

describe("snapshotRow", () => {
  it("keeps the first five fields in order and adds state last for a plain group", () => {
    const row = snapshotRow(plain, { probes: 3, failing: 3 });
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

  it("is removable when every probe passes", () => {
    expect(snapshotRow(plain, { probes: 2, failing: 0 }).state).toBe(
      "removable",
    );
  });

  it("is out of scope on V8 for an engine-scoped group, and records its engines", () => {
    const scoped = { ...plain, engines: ["firefox"] };
    const row = snapshotRow(scoped, { probes: 1, failing: 0 });
    expect(row.state).toBe("out-of-scope");
    expect(row.engines).toEqual(["firefox"]);
    expect(
      snapshotRow(scoped, { probes: 1, failing: 0 }, "firefox").state,
    ).toBe("removable");
  });

  it("is still needed when the group has no probes", () => {
    expect(snapshotRow(plain, { probes: 0, failing: 0 }).state).toBe(
      "still-needed",
    );
  });

  it("copies the engines rather than sharing the entry's array", () => {
    const scoped = { ...plain, engines: ["webkit"] };
    const row = snapshotRow(scoped, { probes: 1, failing: 0 });
    expect(row.engines).not.toBe(scoped.engines);
  });
});
