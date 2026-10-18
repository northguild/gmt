import {
  CANARY_LABEL,
  DRY_RUN_LABEL,
  WORKFLOW_SOURCES,
  applyForce,
  findings,
  marker,
  planIssueActions,
} from "../../../../scripts/lib/canary-issues.mjs";

/**
 * CORE-81: which issues the canaries open or comment on. The fixtures are hand-written verdicts in
 * the verdict-file schemas; every expected string is written out here, never read back
 * from the module.
 */

const RUN = "https://github.com/northguild/gmt/actions/runs/123";
const ORACLE_CONTEXT = { workflow: "temporal-oracle", runUrl: RUN } as const;
const LEAP_CONTEXT = { workflow: "leap-seconds", runUrl: RUN } as const;
const RUNTIME = { polyfill: "0.5.1", node: "v24.11.0", icu: "77.1" };

type State = "still-needed" | "removable" | "guard";

const workaround = (
  id: string,
  state: State,
  extra: Record<string, unknown> = {},
) => ({
  id,
  defects: id.split("+"),
  title: `${id} — summary of ${id}`,
  trigger: `trigger for ${id}`,
  state,
  probes: 2,
  failing: state === "still-needed" ? 2 : 0,
  steps: [`Delete the ${id} repros`, `Drop the ${id} compat module`],
  ...extra,
});

const GUARD = {
  package: "@js-temporal/polyfill",
  through: "0.5.1",
  reason: "no probe can tell a pre-fix polyfill from a fixed one",
};

const check = (
  workarounds: ReturnType<typeof workaround>[],
  current = true,
) => ({
  source: "temporal-compat-check" as const,
  status: "ran" as const,
  runtime: RUNTIME,
  counts: {
    workarounds: workarounds.length,
    stillNeeded: workarounds.filter((w) => w.state === "still-needed").length,
    removable: workarounds.filter((w) => w.state === "removable").length,
    guard: workarounds.filter((w) => w.state === "guard").length,
  },
  snapshot: { path: "apps/dox/src/data/temporal-compat.json", current },
  workarounds,
});

const mismatchRow = (n: number, over: Record<string, unknown> = {}) => ({
  scan: "grid",
  calendar: "hebrew",
  op: "addMonth",
  row: n,
  iso: "2024-03-10",
  input: `input ${n}`,
  native: `native ${n}`,
  expected: `expected ${n}`,
  gmt: `gmt ${n}`,
  ...over,
});

const oracle = (
  untagged = 0,
  rows = Array.from({ length: untagged }, (_, i) => mismatchRow(i + 1)),
  truncated = false,
) => ({
  source: "temporal-oracle" as const,
  status: "ran" as const,
  runtime: RUNTIME,
  chromium: "152.0.7444.0",
  calendars: ["hebrew"],
  counts: {
    comparisons: 410000,
    mismatches: untagged,
    tagged: 0,
    untagged,
  },
  untaggedGroups:
    untagged === 0
      ? []
      : [
          {
            key: "grid hebrew addMonth",
            count: untagged,
            example: mismatchRow(1),
          },
        ],
  untagged: rows,
  untaggedTruncated: truncated,
  report: "artifacts/temporal-oracle-2026-10-19.json",
});

const leap = (differences: string[] = []) => ({
  source: "leap-seconds" as const,
  status: "ran" as const,
  header: "Updated through IERS Bulletin C 72",
  rows: { gmt: 28, iers: 28 + differences.length },
  differences,
});

const couldNotRun = (source: string, message: string) => ({
  source,
  status: "could-not-run" as const,
  message,
});

const cleanCheck = () =>
  check([
    workaround("D1", "still-needed"),
    workaround("D10", "guard", { guard: { ...GUARD, lapsed: false } }),
  ]);

const issue = (number: number, body: string, labels = [CANARY_LABEL]) => ({
  number,
  body,
  labels: labels.map((name) => ({ name })),
});

/** The synthetic row a forced mismatch carries (marked `dry-run` so it cannot pass for a real mismatch), as the groups table shows it. */
const FORCED_EXAMPLE = {
  scan: "dry-run",
  calendar: "iso8601",
  op: "forced",
  row: 0,
  iso: "1970-01-01",
  input: "dry run",
  native: "dry run",
  expected: "dry run",
  gmt: "forced mismatch",
};

const D2_KEY = "temporal-compat/removable/D2";
const D2_MARKER = `<!-- gmt-canary key="${D2_KEY}" -->`;

const removableD2 = () =>
  ({
    "temporal-compat-check": check([workaround("D2", "removable")]),
    "temporal-oracle": oracle(),
  }) as never;

const plan = (verdicts: unknown, open: ReturnType<typeof issue>[] = []) =>
  planIssueActions(verdicts as never, open, ORACLE_CONTEXT);

const rowsSection = (body: string) => {
  const start = body.indexOf("### Rows");
  const rest = body.slice(start).split("\n\n");
  return rest[1].split("\n");
};

describe("constants and marker", () => {
  it("names the labels and the sources each workflow reads", () => {
    expect(CANARY_LABEL).toBe("canary");
    expect(DRY_RUN_LABEL).toBe("canary-dry-run");
    expect(WORKFLOW_SOURCES).toEqual({
      "temporal-oracle": ["temporal-compat-check", "temporal-oracle"],
      "leap-seconds": ["leap-seconds"],
    });
  });
  it("writes the hidden marker line", () => {
    expect(marker("a/b")).toBe('<!-- gmt-canary key="a/b" -->');
  });
});

describe("planIssueActions: open, comment, no-op", () => {
  it("1: no-op when every group is still needed or guarded and the oracle is clean", () => {
    expect(
      plan({
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": oracle(),
      }),
    ).toEqual([]);
  });

  it("2: opens one issue for a removable group with no open issue", () => {
    const actions = plan(removableD2());
    expect(actions).toHaveLength(1);
    const [action] = actions;
    expect(action.kind).toBe("open");
    if (action.kind !== "open") return;
    expect(action.key).toBe(D2_KEY);
    expect(action.labels).toEqual(["canary"]);
    expect(action.title).toBe("Remove workaround D2: summary of D2");
    expect(action.body.split("\n")[0]).toBe(D2_MARKER);
  });

  it("3: comments on the open issue that carries the marker", () => {
    const actions = plan(removableD2(), [issue(41, `${D2_MARKER}\nbody`)]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "comment",
      key: D2_KEY,
      issue: 41,
    });
  });

  it("4: opens when the marker is on line 2, not line 1", () => {
    const actions = plan(removableD2(), [issue(41, `intro\n${D2_MARKER}`)]);
    expect(actions.map((a) => a.kind)).toEqual(["open"]);
  });

  it("5: matches a CRLF body", () => {
    const actions = plan(removableD2(), [issue(41, `${D2_MARKER}\r\nrest`)]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "comment", issue: 41 });
  });

  it("6: opens when the issue lacks the canary label", () => {
    const actions = plan(removableD2(), [
      issue(41, `${D2_MARKER}\nbody`, ["bug"]),
    ]);
    expect(actions.map((a) => a.kind)).toEqual(["open"]);
  });

  it("7: a marker for D1 does not match a finding for D10", () => {
    const verdicts = {
      "temporal-compat-check": check([workaround("D10", "removable")]),
      "temporal-oracle": oracle(),
    };
    const d1 = '<!-- gmt-canary key="temporal-compat/removable/D1" -->';
    const actions = plan(verdicts, [issue(41, `${d1}\nbody`)]);
    expect(actions.map((a) => a.kind)).toEqual(["open"]);
  });

  it("8: with two matches, comments on the lowest number", () => {
    const actions = plan(removableD2(), [
      issue(50, `${D2_MARKER}\nnewer`),
      issue(41, `${D2_MARKER}\nolder`),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "comment", issue: 41 });
  });

  it("25: planning twice with the same input gives equal output", () => {
    const verdicts = removableD2();
    const open = [issue(41, `${D2_MARKER}\nbody`)];
    expect(plan(verdicts, open)).toEqual(plan(verdicts, open));
  });
});

describe("removable body", () => {
  const body = () => {
    const [action] = plan(removableD2());
    if (action.kind !== "open") throw new Error("expected open");
    return action.body;
  };

  it("states the probes, runtime and trigger", () => {
    expect(body()).toContain(
      "Every probe for **D2** returns the spec value on @js-temporal/polyfill 0.5.1 (Node v24.11.0, ICU 77.1), so the workaround can go.",
    );
    expect(body()).toContain("**Trigger:** trigger for D2");
    expect(body()).toContain("**Probes:** 2 of 2 pass.");
  });

  it("14: a lapsed guard adds the Guard lapsed paragraph", () => {
    const verdicts = {
      "temporal-compat-check": check([
        workaround("D10", "removable", {
          guard: { ...GUARD, lapsed: true },
        }),
      ]),
      "temporal-oracle": oracle(),
    };
    const [action] = plan(verdicts);
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "**Guard lapsed:** it held through @js-temporal/polyfill 0.5.1 (no probe can tell a pre-fix polyfill from a fixed one). Before removing, confirm the installed release is the trigger; if it is not, raise guard.through to it and close this issue.",
    );
  });

  it("14c: a guard reason that ends with a period loses it inside the parentheses", () => {
    const verdicts = {
      "temporal-compat-check": check([
        workaround("D10", "removable", {
          guard: {
            ...GUARD,
            reason: "no probe can tell a pre-fix polyfill from a fixed one.",
            lapsed: true,
          },
        }),
      ]),
      "temporal-oracle": oracle(),
    };
    const [action] = plan(verdicts);
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "(no probe can tell a pre-fix polyfill from a fixed one). Before removing",
    );
    expect(action.body).not.toContain(".). Before removing");
  });

  it("14b: no Guard lapsed paragraph for a group without a guard", () => {
    expect(body()).not.toContain("Guard lapsed");
  });

  it("15: a stale snapshot says the snapshot is due now", () => {
    const verdicts = {
      "temporal-compat-check": check([workaround("D2", "removable")], false),
      "temporal-oracle": oracle(),
    };
    const [action] = plan(verdicts);
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "pnpm compat:snapshot is due now: the committed apps/dox/src/data/temporal-compat.json no longer matches this run's probes. Run it again in the removal PR after deleting the repros.",
    );
  });

  it("15b: a current snapshot says it is due in the removal PR", () => {
    expect(body()).toContain(
      "pnpm compat:snapshot is due in the removal PR: once the group's repros are deleted, run it and commit apps/dox/src/data/temporal-compat.json; validate (snapshot --check) fails until you do.",
    );
  });

  it("16: the numbered steps end with the polyfill floor bump", () => {
    expect(body()).toContain(
      "### Removal steps\n\n1. Delete the D2 repros\n2. Drop the D2 compat module\n3. Raise the @js-temporal/polyfill floor in packages/gmt/package.json to the release that made this removable, so no install resolves one with the defect.",
    );
  });

  it("ends with the person-removes line and the run link", () => {
    expect(body()).toContain(
      "A person removes the workaround; CI opens issues, never pull requests.\n\nRun: " +
        RUN,
    );
    expect(body().endsWith(`Run: ${RUN}`)).toBe(true);
  });

  it("the comment says still removable, gives the snapshot sentence and the run link", () => {
    const [action] = plan(removableD2(), [issue(41, `${D2_MARKER}\nbody`)]);
    expect(action.kind).toBe("comment");
    expect(action.body).toBe(
      "Still removable on this run (@js-temporal/polyfill 0.5.1, Node v24.11.0, ICU 77.1).\n\n" +
        "pnpm compat:snapshot is due in the removal PR: once the group's repros are deleted, run it and commit apps/dox/src/data/temporal-compat.json; validate (snapshot --check) fails until you do.\n\n" +
        `Run: ${RUN}`,
    );
  });

  it("a group with no dash in its title uses the whole title as the summary", () => {
    const verdicts = {
      "temporal-compat-check": check([
        workaround("D2", "removable", { title: "plain title" }),
      ]),
      "temporal-oracle": oracle(),
    };
    const [action] = plan(verdicts);
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.title).toBe("Remove workaround D2: plain title");
  });

  it("a joined id keys the group by its defects", () => {
    const verdicts = {
      "temporal-compat-check": check([workaround("D3+D4", "removable")]),
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts)[0].key).toBe("temporal-compat/removable/D3+D4");
  });

  it("opens one issue per removable group, in script order", () => {
    const verdicts = {
      "temporal-compat-check": check([
        workaround("D8", "removable"),
        workaround("D1", "still-needed"),
        workaround("D2", "removable"),
      ]),
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts).map((a) => a.key)).toEqual([
      "temporal-compat/removable/D8",
      "temporal-compat/removable/D2",
    ]);
  });
});

describe("untagged mismatch", () => {
  const open = (verdicts: unknown) => {
    const [action] = plan(verdicts);
    if (action.kind !== "open") throw new Error("expected open");
    return action;
  };
  const withOracle = (o: ReturnType<typeof oracle>) => ({
    "temporal-compat-check": cleanCheck(),
    "temporal-oracle": o,
  });

  it("9: untagged 3 opens one bug issue with a 3-row rows table", () => {
    const action = open(withOracle(oracle(3)));
    expect(action.key).toBe("temporal-oracle/untagged-mismatch");
    expect(action.labels).toEqual(["canary", "bug"]);
    expect(action.title).toBe(
      "Oracle: GMT differs from native Temporal on untagged rows",
    );
    const rows = rowsSection(action.body);
    expect(rows).toHaveLength(2 + 3);
    expect(rows[0]).toBe(
      "| scan | calendar | op | row | iso | input | native | expected | gmt |",
    );
    expect(rows[2]).toBe(
      "| grid | hebrew | addMonth | 1 | `2024-03-10` | `input 1` | `native 1` | `expected 1` | `gmt 1` |",
    );
    expect(action.body).toContain("### Rows\n");
  });

  it("states the counts, Chromium, runtime, groups and report", () => {
    const { body } = open(withOracle(oracle(3)));
    expect(body).toContain(
      "3 of 410000 comparisons differ from Chromium 152.0.7444.0's native Temporal and no entry in TAGGED_MISMATCHES explains them. Each is a GMT bug unless test262 disagrees with Chromium; then tag it with its test262 file.",
    );
    expect(body).toContain(
      "@js-temporal/polyfill 0.5.1 · Node v24.11.0 · ICU 77.1 · Chromium 152.0.7444.0",
    );
    expect(body).toContain(
      "### Groups\n\n| Scan, calendar, op | Rows | Example |\n| --- | --- | --- |\n| grid hebrew addMonth | 3 | `{",
    );
    expect(body).toContain(
      "Full list: artifacts/temporal-oracle-2026-10-19.json in the run's artifact.",
    );
    expect(body.endsWith(`Run: ${RUN}`)).toBe(true);
  });

  it("10: a truncated list says first 50 of 51", () => {
    const rows = Array.from({ length: 50 }, (_, i) => mismatchRow(i + 1));
    const { body } = open(withOracle(oracle(51, rows, true)));
    expect(body).toContain("### Rows (first 50 of 51)");
    expect(rowsSection(body)).toHaveLength(2 + 50);
  });

  it("11: a cell with a pipe and a newline is escaped, flattened and in a code span", () => {
    const rows = [mismatchRow(1, { input: "a|b\nc" })];
    const { body } = open(withOracle(oracle(1, rows)));
    expect(body).toContain("| `a\\|b c` |");
  });

  it("11b: a lone CR is a line ending (GFM 0.29-gfm 2.1) and is flattened", () => {
    const rows = [mismatchRow(1, { input: "a\rb\r\nc\nd" })];
    const { body } = open(withOracle(oracle(1, rows)));
    expect(body).toContain("| `a b c d` |");
    expect(body).not.toContain("\r");
  });

  it("11c: markdown characters and backticks in data cells stay literal inside a code span", () => {
    const rows = [
      mismatchRow(1, {
        native: "*a* _b_ <i>",
        expected: "x`y",
        gmt: "THREW RangeError: <bad>",
      }),
    ];
    const { body } = open(withOracle(oracle(1, rows)));
    expect(body).toContain(
      "| `*a* _b_ <i>` | `x'y` | `THREW RangeError: <bad>` |",
    );
  });

  it("26: 300 groups with 50 rows show the first 50 groups and keep body and comment under 65536 characters", () => {
    const example = mismatchRow(1, { input: "x".repeat(400) });
    const groups = Array.from({ length: 300 }, (_, i) => ({
      key: `grid hebrew op${i}`,
      count: 3,
      example,
    }));
    const rows = Array.from({ length: 50 }, (_, i) =>
      mismatchRow(i + 1, { input: "y".repeat(400) }),
    );
    const o = { ...oracle(900, rows, true), untaggedGroups: groups };
    const { body } = open(withOracle(o));
    expect(body).toContain("### Groups (first 50 of 300)");
    expect(body).toContain("| grid hebrew op49 |");
    expect(body).not.toContain("| grid hebrew op50 |");
    expect(body.length).toBeLessThan(65536);

    const marked = `<!-- gmt-canary key="temporal-oracle/untagged-mismatch" -->\nbody`;
    const [action] = planIssueActions(
      withOracle(o) as never,
      [issue(9, marked)],
      ORACLE_CONTEXT,
    );
    expect(action.kind).toBe("comment");
    expect(action.body).toContain("### Groups (first 50 of 300)");
    expect(action.body).not.toContain("| grid hebrew op50 |");
    expect(action.body.length).toBeLessThan(65536);
  });

  it("26b: exactly 50 groups keep the plain Groups heading", () => {
    const groups = Array.from({ length: 50 }, (_, i) => ({
      key: `grid hebrew op${i}`,
      count: 1,
      example: mismatchRow(1),
    }));
    const o = { ...oracle(50), untaggedGroups: groups };
    const { body } = open(withOracle(o));
    expect(body).toContain("### Groups\n");
    expect(body).toContain("| grid hebrew op49 |");
  });

  it("the comment gives the count and the groups table", () => {
    const marked = `<!-- gmt-canary key="temporal-oracle/untagged-mismatch" -->\nbody`;
    const [action] = planIssueActions(
      withOracle(oracle(3)) as never,
      [issue(9, marked)],
      ORACLE_CONTEXT,
    );
    expect(action.kind).toBe("comment");
    expect(action.body).toContain("Seen again on this run: 3 untagged.\n\n");
    expect(action.body).toContain("| grid hebrew addMonth | 3 |");
    expect(action.body.endsWith(`Run: ${RUN}`)).toBe(true);
  });
});

describe("could not run", () => {
  it("12: a null oracle verdict is one could-not-run finding", () => {
    const actions = plan({
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": null,
    });
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("temporal-oracle/could-not-run");
    expect(action.title).toBe("Canary temporal-oracle could not run");
    expect(action.labels).toEqual(["canary"]);
    expect(action.body).toBe(
      `<!-- gmt-canary key="temporal-oracle/could-not-run" -->\n` +
        "- **temporal-oracle**: no verdict file: an earlier step or job failed\n\n" +
        "This canary reported nothing on this run; the run log says why.\n\n" +
        `Run: ${RUN}`,
    );
  });

  it("13: both sources could-not-run give one finding listing both", () => {
    const actions = plan({
      "temporal-compat-check": couldNotRun(
        "temporal-compat-check",
        "packages/gmt/dist is missing: run pnpm build first",
      ),
      "temporal-oracle": couldNotRun("temporal-oracle", "no Temporal"),
    });
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "- **temporal-compat-check**: packages/gmt/dist is missing: run pnpm build first\n- **temporal-oracle**: no Temporal\n",
    );
  });

  it("a missing key counts as no verdict file", () => {
    const actions = plan({ "temporal-compat-check": cleanCheck() });
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
  });

  it("comments with the same list while the finding persists", () => {
    const key = "temporal-oracle/could-not-run";
    const [action] = planIssueActions(
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": null,
      } as never,
      [issue(12, `<!-- gmt-canary key="${key}" -->\nold`)],
      ORACLE_CONTEXT,
    );
    expect(action).toEqual({
      kind: "comment",
      key,
      issue: 12,
      body: `- **temporal-oracle**: no verdict file: an earlier step or job failed\n\nRun: ${RUN}`,
    });
  });

  it("a could-not-run source gives no other finding of its kind", () => {
    const actions = plan({
      "temporal-compat-check": couldNotRun("temporal-compat-check", "boom"),
      "temporal-oracle": oracle(2),
    });
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-oracle/untagged-mismatch",
      "temporal-oracle/could-not-run",
    ]);
  });
});

describe("leap-second findings", () => {
  const leapPlan = (verdict: unknown, open: ReturnType<typeof issue>[] = []) =>
    planIssueActions({ "leap-seconds": verdict } as never, open, LEAP_CONTEXT);
  const KEY = "leap-seconds/table-difference";
  const DIFFERENCE = "row 29: fixture difference";

  it("a leap verdict with one difference and no open issue opens one issue", () => {
    const actions = leapPlan(leap([DIFFERENCE]));
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe(KEY);
    expect(action.title).toBe(
      "Leap-second table differs from IERS Leap_Second.dat",
    );
    expect(action.labels).toEqual(["canary"]);
    expect(action.body.split("\n")[0]).toBe(`<!-- gmt-canary key="${KEY}" -->`);
    expect(action.body).toContain(
      "packages/gmt/src/internal/leapSeconds.ts no longer matches IERS Leap_Second.dat (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat).",
    );
    expect(action.body).toContain(
      "**IERS:** Updated through IERS Bulletin C 72",
    );
    expect(action.body).toContain(`### Differences\n\n- ${DIFFERENCE}`);
    expect(action.body).toContain(
      "A new row is a data edit in leapSeconds.ts plus a patch changeset; leapSeconds.test.ts checks the edit.",
    );
    expect(action.body.endsWith(`Run: ${RUN}`)).toBe(true);
  });

  it("the same finding with the issue open as #77 comments on 77", () => {
    const actions = leapPlan(leap([DIFFERENCE]), [
      issue(77, `<!-- gmt-canary key="${KEY}" -->\nbody`),
    ]);
    expect(actions).toEqual([
      {
        kind: "comment",
        key: KEY,
        issue: 77,
        body: `Still differs on this run (Updated through IERS Bulletin C 72):\n\n- ${DIFFERENCE}\n\nRun: ${RUN}`,
      },
    ]);
  });

  it("a null leap verdict opens one leap-seconds could-not-run issue", () => {
    const actions = leapPlan(null);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "open",
      key: "leap-seconds/could-not-run",
      title: "Canary leap-seconds could not run",
    });
  });

  it("a matching table files nothing", () => {
    expect(leapPlan(leap())).toEqual([]);
  });

  it("a verdict with no header names the missing line", () => {
    const verdict = {
      ...leap(['IERS: no "Updated through" line']),
      header: null,
    };
    const [action] = leapPlan(verdict);
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain('**IERS:** no "Updated through" line');
  });
});

describe("applyForce and forced findings", () => {
  const forcedOpen = (
    verdicts: unknown,
    open: ReturnType<typeof issue>[] = [],
  ) => plan(verdicts, open);

  const stillNeededD2 = () => ({
    "temporal-compat-check": check([workaround("D2", "still-needed")]),
    "temporal-oracle": oracle(),
  });

  it("17: forcing removable D2 on a still-needed D2 opens a dry-run issue stating the real state", () => {
    const { verdicts } = applyForce(stillNeededD2() as never, {
      removable: "D2",
    });
    const actions = forcedOpen(verdicts);
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("dry-run/temporal-compat/removable/D2");
    expect(action.title).toBe("[dry run] Remove workaround D2: summary of D2");
    expect(action.labels).toEqual(["canary", "canary-dry-run"]);
    const lines = action.body.split("\n");
    expect(lines[0]).toBe(
      '<!-- gmt-canary key="dry-run/temporal-compat/removable/D2" -->',
    );
    expect(lines[1]).toBe(
      "**Dry run.** Forced by a manual dispatch (--force-removable=D2); nothing here is a real finding. Close this issue once checked.",
    );
    expect(action.body).toContain(
      "Forced removable for a dry run. Real state on this run: still needed (2 of 2 probes fail).",
    );
    expect(action.body).toContain("**Probes:** 0 of 2 pass.");
  });

  it("17b: a forced guard group states guard as its real state", () => {
    const { verdicts } = applyForce(
      {
        "temporal-compat-check": check([
          workaround("D10", "guard", { guard: { ...GUARD, lapsed: false } }),
        ]),
        "temporal-oracle": oracle(),
      } as never,
      { removable: "D10" },
    );
    const [action] = forcedOpen(verdicts);
    expect(action.body).toContain("Real state on this run: guard.");
  });

  it("18: an open dry-run issue #60 gets the comment", () => {
    const { verdicts } = applyForce(stillNeededD2() as never, {
      removable: "D2",
    });
    const actions = forcedOpen(verdicts, [
      issue(
        60,
        '<!-- gmt-canary key="dry-run/temporal-compat/removable/D2" -->\nbody',
        ["canary", "canary-dry-run"],
      ),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "comment", issue: 60 });
    expect(actions[0].body).toContain(
      "Forced removable for a dry run. Real state on this run: still needed (2 of 2 probes fail).",
    );
  });

  it("19: an open real D2 issue never takes the dry-run comment", () => {
    const { verdicts } = applyForce(stillNeededD2() as never, {
      removable: "D2",
    });
    const actions = forcedOpen(verdicts, [issue(41, `${D2_MARKER}\nbody`)]);
    expect(actions.map((a) => a.kind)).toEqual(["open"]);
  });

  it("19b: a real removable D2 and a forced D2 give two findings, real first", () => {
    const { verdicts } = applyForce(removableD2(), { removable: "D2" });
    expect(forcedOpen(verdicts).map((a) => a.key)).toEqual([
      D2_KEY,
      `dry-run/${D2_KEY}`,
    ]);
  });

  it("20: forcing an unknown id throws naming the flag and listing the valid ids", () => {
    const verdicts = {
      "temporal-compat-check": check([
        workaround("D1", "still-needed"),
        workaround("D3+D4", "still-needed"),
      ]),
      "temporal-oracle": oracle(),
    };
    expect(() => applyForce(verdicts as never, { removable: "D99" })).toThrow(
      "--force-removable=D99: no workaround has that id; valid ids: D1, D3+D4",
    );
  });

  it("20b: forcing removable with no check verdict is skipped, naming the flag and the source", () => {
    const input = {
      "temporal-compat-check": null,
      "temporal-oracle": oracle(),
    };
    const { verdicts, skipped } = applyForce(input as never, {
      removable: "D2",
    });
    expect(skipped).toEqual([
      {
        flag: "--force-removable=D2",
        reason:
          "the temporal-compat-check verdict is missing or did not run, so there is nothing to force against",
      },
    ]);
    expect(verdicts).toEqual(input);
  });

  it("20c: forcing removable when the check could not run is skipped and leaves the verdict as it was", () => {
    const input = {
      "temporal-compat-check": couldNotRun("temporal-compat-check", "no build"),
      "temporal-oracle": oracle(),
    };
    const { verdicts, skipped } = applyForce(input as never, {
      removable: "D2",
    });
    expect(skipped.map((s) => s.flag)).toEqual(["--force-removable=D2"]);
    expect(verdicts).toEqual(input);
  });

  it("20d: an unknown id against a check that ran still throws, even when the oracle did not run", () => {
    const verdicts = {
      "temporal-compat-check": check([workaround("D1", "still-needed")]),
      "temporal-oracle": null,
    };
    expect(() =>
      applyForce(verdicts as never, { removable: "D99", mismatch: true }),
    ).toThrow(
      "--force-removable=D99: no workaround has that id; valid ids: D1",
    );
  });

  it("21: forcing a mismatch when the oracle could not run is skipped, naming the flag and the source", () => {
    const input = {
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": couldNotRun("temporal-oracle", "no Temporal"),
    };
    const { verdicts, skipped } = applyForce(input as never, {
      mismatch: true,
    });
    expect(skipped).toEqual([
      {
        flag: "--force-mismatch",
        reason:
          "the temporal-oracle verdict is missing or did not run, so there is nothing to force against",
      },
    ]);
    expect(verdicts).toEqual(input);
  });

  it("21b: forcing a mismatch with no oracle verdict is skipped", () => {
    const { skipped } = applyForce(
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": null,
      } as never,
      { mismatch: true },
    );
    expect(skipped.map((s) => s.flag)).toEqual(["--force-mismatch"]);
  });

  it("21c: a skipped flag does not stop the other flag from being applied", () => {
    const { verdicts, skipped } = applyForce(
      {
        "temporal-compat-check": check([workaround("D2", "still-needed")]),
        "temporal-oracle": null,
      } as never,
      { removable: "D2", mismatch: true },
    );
    expect(skipped.map((s) => s.flag)).toEqual(["--force-mismatch"]);
    expect(
      (verdicts["temporal-compat-check"] as { forced?: unknown }).forced,
    ).toEqual({ removable: "D2" });
  });

  it("21d: a skipped force leaves the real could-not-run finding to be filed", () => {
    const { verdicts } = applyForce(
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": null,
      } as never,
      { mismatch: true },
    );
    const actions = plan(verdicts, []);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "open",
      key: "temporal-oracle/could-not-run",
    });
  });

  it("no flag skipped when every forced source ran", () => {
    expect(
      applyForce(stillNeededD2() as never, { removable: "D2", mismatch: true })
        .skipped,
    ).toEqual([]);
  });

  it("22: forcing a mismatch on a clean oracle opens one dry-run bug with the synthetic row", () => {
    const original = {
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": oracle(),
    };
    const { verdicts } = applyForce(original as never, { mismatch: true });
    expect(
      (verdicts["temporal-oracle"] as unknown as ReturnType<typeof oracle>)
        .counts,
    ).toEqual({ comparisons: 410000, mismatches: 0, tagged: 0, untagged: 0 });
    const actions = forcedOpen(verdicts);
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("dry-run/temporal-oracle/untagged-mismatch");
    expect(action.title).toBe(
      "[dry run] Oracle: GMT differs from native Temporal on untagged rows",
    );
    expect(action.labels).toEqual(["canary", "bug", "canary-dry-run"]);
    expect(action.body.split("\n")[1]).toBe(
      "**Dry run.** Forced by a manual dispatch (--force-mismatch); nothing here is a real finding. Close this issue once checked.",
    );
    expect(action.body).toContain(
      "| dry-run | iso8601 | forced | 0 | `1970-01-01` | `dry run` | `dry run` | `dry run` | `forced mismatch` |",
    );
    expect(rowsSection(action.body)).toHaveLength(2 + 1);
    expect(action.body).toContain(
      "Forced mismatch for a dry run. Real counts on this run: 0 untagged of 410000 comparisons.",
    );
  });

  it("22c: a second forced mismatch run comments with the dry-run opening, not an unreal count", () => {
    const { verdicts } = applyForce(
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": oracle(),
      } as never,
      { mismatch: true },
    );
    const marked = `<!-- gmt-canary key="dry-run/temporal-oracle/untagged-mismatch" -->\nbody`;
    const [action] = planIssueActions(
      verdicts,
      [issue(60, marked, [CANARY_LABEL, DRY_RUN_LABEL])],
      ORACLE_CONTEXT,
    );
    expect(action.kind).toBe("comment");
    expect(action.body).toBe(
      "Forced mismatch for a dry run. Real counts on this run: 0 untagged of 410000 comparisons.\n\n" +
        "| Scan, calendar, op | Rows | Example |\n| --- | --- | --- |\n" +
        `| dry-run iso8601 forced | 1 | \`${JSON.stringify(FORCED_EXAMPLE)}\` |\n\n` +
        `Run: ${RUN}`,
    );
    expect(action.body).not.toContain("Seen again");
  });

  it("22b: a forced mismatch comes after a real one", () => {
    const { verdicts } = applyForce(
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": oracle(2),
      } as never,
      { mismatch: true },
    );
    expect(forcedOpen(verdicts).map((a) => a.key)).toEqual([
      "temporal-oracle/untagged-mismatch",
      "dry-run/temporal-oracle/untagged-mismatch",
    ]);
  });

  it("23: forcing a leap difference on a matching table opens a dry-run issue", () => {
    const { verdicts } = applyForce({ "leap-seconds": leap() } as never, {
      leapDifference: true,
    });
    const actions = planIssueActions(verdicts, [], LEAP_CONTEXT);
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("dry-run/leap-seconds/table-difference");
    expect(action.title).toBe(
      "[dry run] Leap-second table differs from IERS Leap_Second.dat",
    );
    expect(action.labels).toEqual(["canary", "canary-dry-run"]);
    expect(action.body).toContain(
      "- dry run: forced difference (no real row differs)",
    );
    expect(action.body.split("\n")[1]).toBe(
      "**Dry run.** Forced by a manual dispatch (--force-leap-difference); nothing here is a real finding. Close this issue once checked.",
    );
  });

  it("23c: a second forced leap run comments with the forced line and the run link", () => {
    const { verdicts } = applyForce({ "leap-seconds": leap() } as never, {
      leapDifference: true,
    });
    const marked = `<!-- gmt-canary key="dry-run/leap-seconds/table-difference" -->\nbody`;
    const [action] = planIssueActions(
      verdicts,
      [issue(61, marked, [CANARY_LABEL, DRY_RUN_LABEL])],
      LEAP_CONTEXT,
    );
    expect(action.kind).toBe("comment");
    expect(action.body).toBe(
      "Still differs on this run (Updated through IERS Bulletin C 72):\n\n" +
        "- dry run: forced difference (no real row differs)\n\n" +
        `Run: ${RUN}`,
    );
  });

  it("23b: forcing a leap difference when the leap check could not run is skipped and the real finding stays", () => {
    const input = {
      "leap-seconds": couldNotRun("leap-seconds", "cannot run: HTTP 503"),
    };
    const { verdicts, skipped } = applyForce(input as never, {
      leapDifference: true,
    });
    expect(skipped).toEqual([
      {
        flag: "--force-leap-difference",
        reason:
          "the leap-seconds verdict is missing or did not run, so there is nothing to force against",
      },
    ]);
    expect(verdicts).toEqual(input);
    const actions = planIssueActions(verdicts as never, [], LEAP_CONTEXT);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "open",
      key: "leap-seconds/could-not-run",
    });
  });

  it("24: applyForce leaves its input deep-equal to a copy taken before", () => {
    const input = {
      "temporal-compat-check": check([workaround("D2", "still-needed")]),
      "temporal-oracle": oracle(),
    };
    const before = structuredClone(input);
    applyForce(input as never, { removable: "D2", mismatch: true });
    expect(input).toEqual(before);
  });

  it("applyForce with no flags returns an equal copy that is not the same object", () => {
    const input = {
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": oracle(),
    };
    const { verdicts: copy } = applyForce(input as never, {});
    expect(copy).toEqual(input);
    expect(copy["temporal-oracle"]).not.toBe(input["temporal-oracle"]);
  });
});

describe("findings", () => {
  it("orders removable, mismatch, then could-not-run", () => {
    const verdicts = {
      "temporal-compat-check": check([workaround("D2", "removable")]),
      "temporal-oracle": oracle(1),
    };
    expect(
      findings(verdicts as never, ORACLE_CONTEXT).map((f) => f.key),
    ).toEqual([D2_KEY, "temporal-oracle/untagged-mismatch"]);
  });

  it("reads only the sources of its own workflow", () => {
    expect(
      findings({ "leap-seconds": leap(["x"]) } as never, ORACLE_CONTEXT).map(
        (f) => f.key,
      ),
    ).toEqual(["temporal-oracle/could-not-run"]);
  });
});
