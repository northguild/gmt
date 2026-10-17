import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatJson } from "../../../../scripts/lib/format-json.mjs";
import {
  UNTAGGED_ROWS_IN_VERDICT,
  VERDICT_FILES,
  compatCheckVerdict,
  couldNotRunVerdict,
  oracleVerdict,
  writeVerdict,
} from "../../../../scripts/lib/canary-verdict.mjs";

/**
 * The JSON the `check` and `oracle` commands write for the canary reporter (CORE-81).
 * Inputs are built by hand; expected values come from the verdict schema (source, status,
 * runtime, counts), not from running the builders.
 */
const runtime = { polyfill: "0.5.1", node: "v24.11.0", icu: "77.1" };

const guard = {
  package: "@js-temporal/polyfill",
  through: "0.5.1",
  reason: "reason text",
};

interface GroupInput {
  defects: string[];
  state: "still-needed" | "removable" | "guard";
  guardLapsed?: boolean;
  withGuard?: boolean;
  probes?: number;
  failing?: number;
}

/** One group as `check` holds it after `withStates`. */
function group({
  defects,
  state,
  guardLapsed = false,
  withGuard = false,
  probes = 2,
  failing = 0,
}: GroupInput) {
  const id = defects.join("+");
  return {
    workaround: {
      defects,
      title: `${id} — title`,
      trigger: `${id} trigger`,
      steps: [`${id} step one`, `${id} step two`],
      ...(withGuard ? { guard } : {}),
    },
    results: Array.from({ length: probes }, () => ({})),
    passing: probes - failing,
    state,
    guardLapsed,
  };
}

describe("compatCheckVerdict", () => {
  const groups = [
    group({ defects: ["D1"], state: "still-needed", probes: 3, failing: 2 }),
    group({ defects: ["D3", "D4"], state: "removable" }),
    group({ defects: ["D10"], state: "guard", withGuard: true }),
  ];
  const verdict = compatCheckVerdict({
    runtime,
    groups,
    snapshotCurrent: true,
  });

  it("names its source and says it ran", () => {
    expect(verdict.source).toBe("temporal-compat-check");
    expect(verdict.status).toBe("ran");
    expect(verdict.runtime).toEqual(runtime);
  });

  it("counts a still-needed, a removable and a guard group", () => {
    expect(verdict.counts).toEqual({
      workarounds: 3,
      stillNeeded: 1,
      removable: 1,
      guard: 1,
    });
  });

  it("joins a group's defects with + for its id, in script order", () => {
    expect(verdict.workarounds.map((w: { id: string }) => w.id)).toEqual([
      "D1",
      "D3+D4",
      "D10",
    ]);
    expect(verdict.workarounds[1].defects).toEqual(["D3", "D4"]);
  });

  it("carries probes, failing, title, trigger and state per group", () => {
    expect(verdict.workarounds[0]).toEqual({
      id: "D1",
      defects: ["D1"],
      title: "D1 — title",
      trigger: "D1 trigger",
      state: "still-needed",
      probes: 3,
      failing: 2,
      steps: ["D1 step one", "D1 step two"],
    });
  });

  it("keeps the steps of every group, whatever its state", () => {
    expect(
      verdict.workarounds.map((w: { steps: string[] }) => w.steps),
    ).toEqual(groups.map((g) => g.workaround.steps));
  });

  it("carries a guard that holds with lapsed false", () => {
    expect(verdict.workarounds[2].state).toBe("guard");
    expect(verdict.workarounds[2].guard).toEqual({ ...guard, lapsed: false });
  });

  it("carries a lapsed guard on a removable group", () => {
    const lapsed = compatCheckVerdict({
      runtime,
      groups: [
        group({
          defects: ["D10"],
          state: "removable",
          guardLapsed: true,
          withGuard: true,
        }),
      ],
      snapshotCurrent: true,
    });
    expect(lapsed.workarounds[0].state).toBe("removable");
    expect(lapsed.workarounds[0].guard?.lapsed).toBe(true);
  });

  it("has no guard property on a group without one", () => {
    expect("guard" in verdict.workarounds[0]).toBe(false);
    expect("guard" in verdict.workarounds[1]).toBe(false);
  });

  it.each`
    snapshotCurrent
    ${true}
    ${false}
  `(
    "records snapshot.current $snapshotCurrent with the committed path",
    ({ snapshotCurrent }) => {
      expect(
        compatCheckVerdict({ runtime, groups, snapshotCurrent }).snapshot,
      ).toEqual({
        path: "apps/dox/src/data/temporal-compat.json",
        current: snapshotCurrent,
      });
    },
  );
});

describe("oracleVerdict", () => {
  const counts = { comparisons: 100, mismatches: 0, tagged: 0, untagged: 0 };
  const base = {
    runtime,
    chromium: "152.0.7444.0",
    calendars: ["hebrew", "persian"],
    counts,
    groups: [],
    untagged: [],
    report: "artifacts/temporal-oracle-2026-10-19.json",
  };
  const row = (n: number, tag?: string) => ({
    scan: "grid",
    calendar: "hebrew",
    op: "addMonth",
    row: n,
    iso: "2026-01-01",
    input: "i",
    native: "n",
    expected: "e",
    gmt: "g",
    ...(tag ? { tag } : {}),
  });

  it("is a clean ran verdict when nothing mismatched", () => {
    expect(oracleVerdict(base)).toEqual({
      source: "temporal-oracle",
      status: "ran",
      runtime,
      chromium: "152.0.7444.0",
      calendars: ["hebrew", "persian"],
      counts,
      untaggedGroups: [],
      untagged: [],
      untaggedTruncated: false,
      report: "artifacts/temporal-oracle-2026-10-19.json",
    });
  });

  it("leaves tagged groups out of untaggedGroups", () => {
    const tagged = {
      key: "grid hebrew addYear [tagged]",
      count: 2,
      example: {},
    };
    const untagged = { key: "grid hebrew addMonth", count: 3, example: row(4) };
    const verdict = oracleVerdict({
      ...base,
      counts: { comparisons: 100, mismatches: 5, tagged: 2, untagged: 3 },
      groups: [tagged, untagged],
    });
    expect(verdict.untaggedGroups).toEqual([untagged]);
  });

  it("writes the untagged rows it is given, in tally order", () => {
    const untagged = [row(1), row(3), row(7)];
    const verdict = oracleVerdict({
      ...base,
      counts: { comparisons: 100, mismatches: 5, tagged: 2, untagged: 3 },
      untagged,
    });
    expect(verdict.untagged.map((r) => r.row)).toEqual([1, 3, 7]);
    expect(verdict.untaggedTruncated).toBe(false);
  });

  it("caps the untagged rows at UNTAGGED_ROWS_IN_VERDICT and says so", () => {
    expect(UNTAGGED_ROWS_IN_VERDICT).toBe(50);
    const untagged = Array.from({ length: 51 }, (_, n) => row(n));
    const verdict = oracleVerdict({
      ...base,
      counts: { comparisons: 100, mismatches: 51, tagged: 0, untagged: 51 },
      untagged,
    });
    expect(verdict.untagged).toHaveLength(50);
    expect(verdict.untagged[49].row).toBe(49);
    expect(verdict.untaggedTruncated).toBe(true);
  });

  it("is not truncated at exactly 50 untagged rows", () => {
    const untagged = Array.from({ length: 50 }, (_, n) => row(n));
    const verdict = oracleVerdict({
      ...base,
      counts: { comparisons: 100, mismatches: 50, tagged: 0, untagged: 50 },
      untagged,
    });
    expect(verdict.untagged).toHaveLength(50);
    expect(verdict.untaggedTruncated).toBe(false);
  });

  it("is truncated when the tally counted more untagged mismatches than it kept", () => {
    const untagged = Array.from({ length: 3 }, (_, n) => row(n));
    const verdict = oracleVerdict({
      ...base,
      counts: { comparisons: 100, mismatches: 9, tagged: 0, untagged: 9 },
      untagged,
    });
    expect(verdict.untagged).toHaveLength(3);
    expect(verdict.untaggedTruncated).toBe(true);
  });
});

describe("couldNotRunVerdict", () => {
  it("is the source, the status and the message", () => {
    expect(couldNotRunVerdict("temporal-oracle", "no Temporal")).toEqual({
      source: "temporal-oracle",
      status: "could-not-run",
      message: "no Temporal",
    });
  });
});

describe("VERDICT_FILES", () => {
  it("names one fixed file per source", () => {
    expect(VERDICT_FILES).toEqual({
      "temporal-compat-check": "artifacts/temporal-compat-check.json",
      "temporal-oracle": "artifacts/temporal-oracle-verdict.json",
      "leap-seconds": "artifacts/leap-seconds.json",
    });
  });
});

describe("writeVerdict", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "canary-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes formatJson(verdict) to the source's file, creating the folder", () => {
    const verdict = compatCheckVerdict({
      runtime,
      groups: [group({ defects: ["D1"], state: "still-needed", failing: 1 })],
      snapshotCurrent: true,
    });
    writeVerdict(root, verdict);
    expect(
      readFileSync(join(root, "artifacts/temporal-compat-check.json"), "utf8"),
    ).toBe(formatJson(verdict));
  });

  it("writes a could-not-run verdict to the same file as a ran one", () => {
    const verdict = couldNotRunVerdict("temporal-oracle", "no dist");
    writeVerdict(root, verdict);
    expect(
      readFileSync(
        join(root, "artifacts/temporal-oracle-verdict.json"),
        "utf8",
      ),
    ).toBe(formatJson(verdict));
  });
});
