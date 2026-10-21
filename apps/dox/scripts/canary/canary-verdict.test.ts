import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatJson } from "../../../../scripts/lib/format-json.mjs";
import {
  UNTAGGED_ROWS_IN_VERDICT,
  VERDICT_FILES,
  compatCheckVerdict,
  couldNotRunVerdict,
  nativeSuiteVerdict,
  oracleVerdict,
  saveVerdict,
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

describe("nativeSuiteVerdict", () => {
  const failure = (n: number, message = `message ${n}`) => ({
    file: "src/a.test.ts",
    test: `test ${n}`,
    message,
  });
  const base = {
    leg: "chromium" as const,
    engine: "Chromium 153.0.8010.12",
    runtime: { node: "26.10.0", vitest: "4.1.4", playwright: "1.63.0" },
    counts: {
      files: 828,
      tests: 61613,
      passed: 61600,
      tagged: 3,
      untagged: 2,
      hostTagged: 5,
      hostUntagged: 3,
      staleTags: 1,
    },
    tagged: [{ file: "src/a.test.ts", test: "t", defect: "a-defect" }],
    untagged: [failure(1), failure(2)],
    hostTagged: [
      {
        group: "chromium-icelandic-locale-data",
        count: 5,
        reason: "Chromium ships no Icelandic locale data.",
      },
    ],
    hostUntagged: [failure(3), failure(4), failure(5)],
    staleTags: [
      { kind: "host" as const, group: "old-group", reason: "Old reason." },
    ],
  };

  it("names its per-leg source, the leg and the engine line, and says it ran", () => {
    const v = nativeSuiteVerdict(base);
    expect(v.source).toBe("native-suite-chromium");
    expect(v.status).toBe("ran");
    expect(v.leg).toBe("chromium");
    expect(v.engine).toBe("Chromium 153.0.8010.12");
    expect(v.runtime).toEqual(base.runtime);
  });

  it("carries counts, tags, host groups and stale tags unchanged and has no timestamp", () => {
    const v = nativeSuiteVerdict(base);
    expect(v.counts).toEqual(base.counts);
    expect(v.tagged).toEqual(base.tagged);
    expect(v.hostTagged).toEqual(base.hostTagged);
    expect(v.staleTags).toEqual(base.staleTags);
    expect(Object.keys(v).sort()).toEqual([
      "counts",
      "engine",
      "hostTagged",
      "hostUntagged",
      "hostUntaggedTruncated",
      "leg",
      "runtime",
      "source",
      "staleTags",
      "status",
      "tagged",
      "untagged",
      "untaggedTruncated",
    ]);
  });

  it("keeps every row and flags no truncation at or under 50", () => {
    const rows = Array.from({ length: UNTAGGED_ROWS_IN_VERDICT }, (_, i) =>
      failure(i),
    );
    const v = nativeSuiteVerdict({
      ...base,
      untagged: rows,
      hostUntagged: rows,
    });
    expect(v.untagged).toHaveLength(50);
    expect(v.hostUntagged).toHaveLength(50);
    expect(v.untaggedTruncated).toBe(false);
    expect(v.hostUntaggedTruncated).toBe(false);
  });

  it("keeps the first 50 of 60 rows of each kind, in order, and flags the cut", () => {
    const rows = Array.from({ length: 60 }, (_, i) => failure(i));
    const v = nativeSuiteVerdict({
      ...base,
      counts: { ...base.counts, untagged: 60, hostUntagged: 60 },
      untagged: rows,
      hostUntagged: rows,
    });
    expect(v.untagged.map((r) => r.test)).toEqual(
      rows.slice(0, 50).map((r) => r.test),
    );
    expect(v.hostUntagged).toHaveLength(50);
    expect(v.untaggedTruncated).toBe(true);
    expect(v.hostUntaggedTruncated).toBe(true);
    expect(v.counts.untagged).toBe(60);
    expect(v.counts.hostUntagged).toBe(60);
  });

  it("flags only the kind that was cut", () => {
    const v = nativeSuiteVerdict({
      ...base,
      untagged: Array.from({ length: 51 }, (_, i) => failure(i)),
    });
    expect(v.untaggedTruncated).toBe(true);
    expect(v.hostUntaggedTruncated).toBe(false);
  });

  it("cuts a message to 300 characters and leaves a shorter one alone", () => {
    const v = nativeSuiteVerdict({
      ...base,
      untagged: [failure(1, "x".repeat(301)), failure(2, "y".repeat(300))],
      hostUntagged: [failure(3, "z".repeat(1000))],
    });
    expect(v.untagged[0].message).toBe("x".repeat(300));
    expect(v.untagged[1].message).toBe("y".repeat(300));
    expect(v.hostUntagged[0].message).toBe("z".repeat(300));
  });

  it("is written to artifacts/native-suite-<leg>.json by writeVerdict", () => {
    const root = mkdtempSync(join(tmpdir(), "canary-"));
    try {
      const v = nativeSuiteVerdict({ ...base, leg: "firefox" });
      writeVerdict(root, v);
      expect(
        readFileSync(join(root, "artifacts/native-suite-firefox.json"), "utf8"),
      ).toBe(formatJson(v));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a could-not-run verdict for a leg goes to the same file", () => {
    const root = mkdtempSync(join(tmpdir(), "canary-"));
    try {
      writeVerdict(root, couldNotRunVerdict("native-suite-node", "Node 24"));
      expect(
        readFileSync(join(root, "artifacts/native-suite-node.json"), "utf8"),
      ).toBe(formatJson(couldNotRunVerdict("native-suite-node", "Node 24")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("VERDICT_FILES", () => {
  it("names one fixed file per source", () => {
    expect(VERDICT_FILES).toEqual({
      "temporal-compat-check": "artifacts/temporal-compat-check.json",
      "temporal-oracle": "artifacts/temporal-oracle-verdict.json",
      "leap-seconds": "artifacts/leap-seconds.json",
      "native-suite-node": "artifacts/native-suite-node.json",
      "native-suite-chromium": "artifacts/native-suite-chromium.json",
      "native-suite-firefox": "artifacts/native-suite-firefox.json",
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

describe("saveVerdict", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "canary-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes the verdict like writeVerdict and says nothing on stderr", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const verdict = couldNotRunVerdict("temporal-oracle", "no dist");
    saveVerdict(root, verdict, "temporal-compat");
    expect(
      readFileSync(
        join(root, "artifacts/temporal-oracle-verdict.json"),
        "utf8",
      ),
    ).toBe(formatJson(verdict));
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns instead of throwing when `artifacts` is a plain file, and names the prefix on stderr", () => {
    writeFileSync(join(root, "artifacts"), "not a folder");
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      saveVerdict(
        root,
        couldNotRunVerdict("leap-seconds", "no file"),
        "leap-seconds",
      ),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(
      /^leap-seconds: cannot write verdict: .*EEXIST/,
    );
  });
});
