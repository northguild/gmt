import {
  CANARY_LABEL,
  DRY_RUN_LABEL,
  WORKFLOW_SOURCES,
  applyForce,
  compatStates,
  findings,
  marker,
  planIssueActions,
  removableEverywhere,
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

type State = "still-needed" | "removable" | "guard" | "out-of-scope";

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

type Workaround = ReturnType<typeof workaround>;

const countsOf = (workarounds: Workaround[]) => ({
  workarounds: workarounds.length,
  stillNeeded: workarounds.filter((w) => w.state === "still-needed").length,
  removable: workarounds.filter((w) => w.state === "removable").length,
  guard: workarounds.filter((w) => w.state === "guard").length,
  outOfScope: workarounds.filter((w) => w.state === "out-of-scope").length,
});

/** The Node check: the probes on V8, plus whether the committed snapshot is current. */
const check = (workarounds: Workaround[], current = true) => ({
  source: "temporal-compat-check" as const,
  status: "ran" as const,
  engineId: "v8",
  runtime: RUNTIME,
  counts: countsOf(workarounds),
  snapshot: { path: "apps/dox/src/data/temporal-compat.json", current },
  workarounds,
});

const BROWSER_LEGS = ["chromium", "firefox", "webkit"] as const;
type BrowserLeg = (typeof BROWSER_LEGS)[number];
const BROWSER_ENGINE_IDS: Record<BrowserLeg, string> = {
  chromium: "v8",
  firefox: "firefox",
  webkit: "webkit",
};
const BROWSER_ENGINES: Record<BrowserLeg, string> = {
  chromium: "Chromium 153.0.8010.12",
  firefox: "Firefox 155.0",
  webkit: "WebKit 26.6",
};

/** The same probes run in one browser of the native suite: no snapshot, the browser's engine. */
const browserCompat = (leg: BrowserLeg, workarounds: Workaround[]) => ({
  source: `temporal-compat-${leg}` as const,
  status: "ran" as const,
  leg,
  engine: BROWSER_ENGINES[leg],
  engineId: BROWSER_ENGINE_IDS[leg],
  runtime: { polyfill: "0.5.1", node: "v24.11.0", playwright: "1.63.0" },
  counts: countsOf(workarounds),
  workarounds,
});

/** Every compat source, Node and the three browsers, reporting the same rows. */
const everywhere = (workarounds: Workaround[], current = true) => ({
  "temporal-compat-check": check(workarounds, current),
  ...Object.fromEntries(
    BROWSER_LEGS.map((leg) => [
      `temporal-compat-${leg}`,
      browserCompat(leg, workarounds),
    ]),
  ),
});

/** The four engines' names in the order the compat sources run, as the bodies list them. */
const EVERY_ENGINE =
  "Node v24.11.0, Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6";

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

const NATIVE_LEGS = ["node", "chromium", "firefox", "webkit"] as const;
const ENGINES = {
  node: "Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c",
  chromium: "Chromium 153.0.8010.12",
  firefox: "Firefox 155.0",
  webkit: "WebKit 26.6",
};

interface NativeOptions {
  untagged?: number;
  hostUntagged?: number;
  controlOnly?: number;
  staleTags?: unknown[];
  hostTagged?: { group: string; count: number; reason: string }[];
  untaggedTruncated?: boolean;
  message?: string;
}

const nativeRow = (leg: string, n: number, message = `message ${n}`) => ({
  file: `src/${leg}/file${n}.test.ts`,
  test: `${leg} test ${n}`,
  message,
});

/** A native-suite verdict that ran; every count is derived from the rows given. */
const native = (
  leg: (typeof NATIVE_LEGS)[number],
  {
    untagged = 0,
    hostUntagged = 0,
    controlOnly = 0,
    staleTags = [],
    hostTagged = [],
    untaggedTruncated = false,
    message,
  }: NativeOptions = {},
) => ({
  source: `native-suite-${leg}`,
  status: "ran" as const,
  leg,
  engine: ENGINES[leg],
  runtime: { node: "26.10.0", vitest: "4.1.4", playwright: null },
  counts: {
    files: 828,
    tests: 61613,
    passed: 61000,
    tagged: 0,
    untagged,
    hostTagged: hostTagged.reduce((n, g) => n + g.count, 0),
    hostUntagged,
    controlOnly,
    staleTags: staleTags.length,
  },
  tagged: [],
  untagged: Array.from({ length: Math.min(untagged, 50) }, (_, i) =>
    nativeRow(leg, i + 1, message),
  ),
  untaggedTruncated: untaggedTruncated || untagged > 50,
  hostTagged,
  hostUntagged: Array.from({ length: Math.min(hostUntagged, 50) }, (_, i) =>
    nativeRow(leg, i + 1, message),
  ),
  hostUntaggedTruncated: hostUntagged > 50,
  controlOnly: Array.from({ length: Math.min(controlOnly, 50) }, (_, i) =>
    nativeRow(leg, i + 1, message),
  ),
  controlOnlyTruncated: controlOnly > 50,
  staleTags,
});

/** The four legs, all clean. */
const cleanNative = () =>
  Object.fromEntries(
    NATIVE_LEGS.map((leg) => [`native-suite-${leg}`, native(leg)]),
  );

/**
 * `verdicts` with four clean native legs added when it names no native leg at all, and with the
 * three browser compat verdicts mirroring the Node check's rows when it names no browser compat
 * source: a fixture that gives the check alone means "the same everywhere".
 */
const withNative = (verdicts: unknown) => {
  const given = verdicts as Record<string, unknown>;
  const legs = Object.keys(given).some((k) => k.startsWith("native-suite-"))
    ? {}
    : cleanNative();
  const checkVerdict = given["temporal-compat-check"] as
    | ReturnType<typeof check>
    | null
    | undefined;
  const browsers =
    Object.keys(given).some(
      (k) => k.startsWith("temporal-compat-") && k !== "temporal-compat-check",
    ) || checkVerdict?.status !== "ran"
      ? {}
      : Object.fromEntries(
          BROWSER_LEGS.map((leg) => [
            `temporal-compat-${leg}`,
            browserCompat(leg, checkVerdict.workarounds),
          ]),
        );
  return { ...browsers, ...given, ...legs } as never;
};

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
  planIssueActions(withNative(verdicts), open, ORACLE_CONTEXT);

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
      "temporal-oracle": [
        "temporal-compat-check",
        "temporal-compat-chromium",
        "temporal-compat-firefox",
        "temporal-compat-webkit",
        "temporal-oracle",
        "native-suite-node",
        "native-suite-chromium",
        "native-suite-firefox",
        "native-suite-webkit",
      ],
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
      issue(41, `${D2_MARKER}\nbody`, ["temporal-compat"]),
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

  it("states the polyfill, the engines in scope, the trigger and the scope", () => {
    expect(body()).toContain(
      `Every probe for **D2** returns the spec value on @js-temporal/polyfill 0.5.1 on every engine in its scope (${EVERY_ENGINE}), so the workaround can go.`,
    );
    expect(body()).toContain("**Trigger:** trigger for D2");
    expect(body()).toContain("**Scope:** every engine.");
    expect(body()).not.toContain("**Probes:**");
  });

  it("the Engines table has one row per compat source, in source order, with its state and probes", () => {
    expect(body()).toContain(
      "### Engines\n\n" +
        "| Source | Engine | State | Probes |\n" +
        "| --- | --- | --- | --- |\n" +
        "| temporal-compat-check | Node v24.11.0 | removable | 2 of 2 pass |\n" +
        "| temporal-compat-chromium | Chromium 153.0.8010.12 | removable | 2 of 2 pass |\n" +
        "| temporal-compat-firefox | Firefox 155.0 | removable | 2 of 2 pass |\n" +
        "| temporal-compat-webkit | WebKit 26.6 | removable | 2 of 2 pass |\n\n" +
        "### Removal steps",
    );
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
      `Still removable on this run on every engine in its scope (${EVERY_ENGINE}; @js-temporal/polyfill 0.5.1).\n\n` +
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

describe("removable on every engine in scope", () => {
  const d2 = (state: State) => workaround("D2", state);
  const d17 = (state: State) =>
    workaround("D17", state, { engines: ["firefox"] });

  it("removable on the Node check but still needed in Firefox: no finding, and the state says which engine blocks", () => {
    const verdicts = {
      ...everywhere([d2("removable")]),
      "temporal-compat-firefox": browserCompat("firefox", [d2("still-needed")]),
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts)).toEqual([]);
    const [state] = compatStates(verdicts as never);
    expect(state.everywhere).toBe(false);
    expect(
      state.engines.map((e) => [e.source, e.inScope, e.row?.state]),
    ).toEqual([
      ["temporal-compat-check", true, "removable"],
      ["temporal-compat-chromium", true, "removable"],
      ["temporal-compat-firefox", true, "still-needed"],
      ["temporal-compat-webkit", true, "removable"],
    ]);
  });

  it("a browser verdict missing blocks the group and is a could-not-run finding, never a removable one", () => {
    const verdicts = {
      ...everywhere([d2("removable")]),
      "temporal-compat-webkit": null,
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts).map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
    expect(removableEverywhere(verdicts as never)).toEqual([]);
  });

  it("a verdict that does not know the group blocks it", () => {
    const verdicts = {
      ...everywhere([d2("removable")]),
      "temporal-compat-webkit": browserCompat("webkit", [
        workaround("D1", "still-needed"),
      ]),
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts)).toEqual([]);
    const [state] = compatStates(verdicts as never);
    expect(state.engines[3]).toMatchObject({
      source: "temporal-compat-webkit",
      row: null,
      message: "this run's verdict has no such workaround",
    });
  });

  it("a Firefox-only group removable in Firefox and out of scope elsewhere opens, naming Firefox alone", () => {
    const verdicts = {
      ...everywhere([d17("out-of-scope")]),
      "temporal-compat-firefox": browserCompat("firefox", [d17("removable")]),
      "temporal-oracle": oracle(),
    };
    const [action] = plan(verdicts);
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("temporal-compat/removable/D17");
    expect(action.body).toContain(
      "Every probe for **D17** returns the spec value on @js-temporal/polyfill 0.5.1 on every engine in its scope (Firefox 155.0), so the workaround can go.",
    );
    expect(action.body).toContain(
      "**Scope:** only firefox: only that engine's Intl shows the defect, so the other rows are out of scope and count for nothing.",
    );
    expect(action.body).toContain(
      "| temporal-compat-check | Node v24.11.0 | out of scope | 2 of 2 pass |\n" +
        "| temporal-compat-chromium | Chromium 153.0.8010.12 | out of scope | 2 of 2 pass |\n" +
        "| temporal-compat-firefox | Firefox 155.0 | removable | 2 of 2 pass |\n" +
        "| temporal-compat-webkit | WebKit 26.6 | out of scope | 2 of 2 pass |",
    );
    const [, comment] = [
      action,
      plan(verdicts, [issue(7, `${action.body.split("\n")[0]}\nbody`)])[0],
    ];
    expect(comment.body).toContain(
      "Still removable on this run on every engine in its scope (Firefox 155.0; @js-temporal/polyfill 0.5.1).",
    );
  });

  it("a Firefox-only group removable in Firefox but failing in WebKit stays closed: a failing probe counts on any engine", () => {
    const verdicts = {
      ...everywhere([d17("out-of-scope")]),
      "temporal-compat-firefox": browserCompat("firefox", [d17("removable")]),
      "temporal-compat-webkit": browserCompat("webkit", [d17("still-needed")]),
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts)).toEqual([]);
    const [state] = compatStates(verdicts as never);
    expect(state.everywhere).toBe(false);
    expect(
      state.engines.map((e) => [e.source, e.inScope, e.row?.state]),
    ).toEqual([
      ["temporal-compat-check", false, "out-of-scope"],
      ["temporal-compat-chromium", false, "out-of-scope"],
      ["temporal-compat-firefox", true, "removable"],
      ["temporal-compat-webkit", false, "still-needed"],
    ]);
  });

  it("a Firefox-only group still needed in Firefox stays closed however the others read", () => {
    const verdicts = {
      ...everywhere([d17("out-of-scope")]),
      "temporal-compat-firefox": browserCompat("firefox", [
        d17("still-needed"),
      ]),
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts)).toEqual([]);
  });

  it("a Firefox-only group with the Node check missing still opens, and the snapshot sentence says the check did not run", () => {
    const verdicts = {
      ...everywhere([d17("out-of-scope")]),
      "temporal-compat-check": null,
      "temporal-compat-firefox": browserCompat("firefox", [d17("removable")]),
      "temporal-oracle": oracle(),
    };
    const actions = plan(verdicts);
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-compat/removable/D17",
      "temporal-oracle/could-not-run",
    ]);
    expect(actions[0].body).toContain(
      "### Snapshot\n\npnpm compat:snapshot is due in the removal PR: the Node check did not run this time, so whether the committed apps/dox/src/data/temporal-compat.json is current is unknown. Once the group's repros are deleted, run it and commit the file; validate (snapshot --check) fails until you do.",
    );
    expect(actions[0].body).toContain(
      "| temporal-compat-check | — | no verdict (no verdict file: an earlier step or job failed) | — |",
    );
  });

  it("an every-engine group with the Node check missing is blocked: Node is in its scope", () => {
    const verdicts = {
      ...everywhere([d2("removable")]),
      "temporal-compat-check": null,
      "temporal-oracle": oracle(),
    };
    expect(plan(verdicts).map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
  });

  it("compatStates lists every group any source knows, in first-seen order, with the polyfill of the first source that ran", () => {
    const verdicts = {
      "temporal-compat-check": null,
      "temporal-compat-chromium": browserCompat("chromium", [
        d2("still-needed"),
        workaround("D8", "removable"),
      ]),
      "temporal-compat-firefox": browserCompat("firefox", [d2("removable")]),
      "temporal-compat-webkit": null,
    };
    const states = compatStates(verdicts as never);
    expect(states.map((s) => [s.id, s.polyfill, s.everywhere])).toEqual([
      ["D2", "0.5.1", false],
      ["D8", "0.5.1", false],
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

  it("9: untagged 3 opens one temporal-compat issue with a 3-row rows table", () => {
    const action = open(withOracle(oracle(3)));
    expect(action.key).toBe("temporal-oracle/untagged-mismatch");
    expect(action.labels).toEqual(["canary", "temporal-compat"]);
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
      "- **temporal-compat-check**: packages/gmt/dist is missing: run pnpm build first\n" +
        "- **temporal-compat-chromium**: no verdict file: an earlier step or job failed\n" +
        "- **temporal-compat-firefox**: no verdict file: an earlier step or job failed\n" +
        "- **temporal-compat-webkit**: no verdict file: an earlier step or job failed\n" +
        "- **temporal-oracle**: no Temporal\n",
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
      withNative({
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": null,
      }),
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
      "Forced removable for a dry run. Real state on this run: still needed (2 of 2 probes fail) on Node v24.11.0; still needed (2 of 2 probes fail) on Chromium 153.0.8010.12; still needed (2 of 2 probes fail) on Firefox 155.0; still needed (2 of 2 probes fail) on WebKit 26.6.",
    );
    expect(action.body).toContain(
      "| temporal-compat-check | Node v24.11.0 | still needed (2 of 2 probes fail) | 0 of 2 pass |",
    );
    expect(action.body).not.toContain("**Probes:**");
  });

  it("17c: a forced group whose engines disagree states each engine's real state", () => {
    const { verdicts } = applyForce(
      {
        ...everywhere([workaround("D2", "removable")]),
        "temporal-compat-check": check([workaround("D2", "still-needed")]),
        "temporal-compat-firefox": couldNotRun(
          "temporal-compat-firefox",
          "the compat page failed in firefox: boom",
        ),
        "temporal-oracle": oracle(),
      } as never,
      { removable: "D2" },
    );
    const actions = forcedOpen(verdicts);
    expect(actions.map((a) => a.key)).toEqual([
      "dry-run/temporal-compat/removable/D2",
      "temporal-oracle/could-not-run",
    ]);
    expect(actions[0].body).toContain(
      "Real state on this run: still needed (2 of 2 probes fail) on Node v24.11.0; removable on Chromium 153.0.8010.12; no verdict (the compat page failed in firefox: boom) on temporal-compat-firefox; removable on WebKit 26.6.",
    );
    expect(actions[0].body).toContain(
      "| temporal-compat-firefox | — | no verdict (the compat page failed in firefox: boom) | — |",
    );
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
    expect(action.body).toContain(
      "Real state on this run: guard on Node v24.11.0; guard on Chromium 153.0.8010.12; guard on Firefox 155.0; guard on WebKit 26.6.",
    );
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
      "Forced removable for a dry run. Real state on this run: still needed (2 of 2 probes fail) on Node v24.11.0;",
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

  it("22: forcing a mismatch on a clean oracle opens one dry-run temporal-compat issue with the synthetic row", () => {
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
    expect(action.labels).toEqual([
      "canary",
      "temporal-compat",
      "canary-dry-run",
    ]);
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
  it("orders removable, mismatch, native, then could-not-run", () => {
    const verdicts = {
      ...everywhere([workaround("D2", "removable")]),
      "temporal-oracle": oracle(1),
      "native-suite-node": native("node", {
        untagged: 1,
        hostUntagged: 1,
        controlOnly: 1,
        staleTags: [
          { kind: "host", group: "old-group", reason: "Old reason." },
        ],
      }),
      "native-suite-chromium": native("chromium"),
      "native-suite-firefox": null,
    };
    expect(
      findings(verdicts as never, ORACLE_CONTEXT).map((f) => f.key),
    ).toEqual([
      D2_KEY,
      "temporal-oracle/untagged-mismatch",
      "native-suite/untagged-failure",
      "native-suite/untagged-host-failure",
      "native-suite/control-only-failure",
      "native-suite/stale-tag",
      "temporal-oracle/could-not-run",
    ]);
  });

  it("reads only the sources of its own workflow", () => {
    expect(
      findings({ "leap-seconds": leap(["x"]) } as never, ORACLE_CONTEXT).map(
        (f) => f.key,
      ),
    ).toEqual(["temporal-oracle/could-not-run"]);
  });
});

/** The three fixed paragraphs, written out here word for word. */
const TRIAGE =
  "Each row failed on the native engine and passed on @js-temporal/polyfill in the same runtime. Decide which it is: a GMT defect (fix it), a polyfill defect or an engine or specification defect (record it in context/domination/js-temporal-polyfill-bugs.md and tag the test in scripts/lib/native-suite-tags.mjs). Never skip the test.";
const HOST =
  "Each row failed on the native engine and on @js-temporal/polyfill in the same runtime, so the cause is the runtime (its locale or time zone data, or its setup), not Temporal. Find what the runtime lacks, then add or widen a group in KNOWN_HOST_FAILURES in scripts/lib/native-suite-tags.mjs with that reason — one group per cause, never one entry per test — or fix the test if it depends on the host by mistake. Never skip the test.";

const CONTROL =
  "Each row failed on @js-temporal/polyfill and passed on the native engine in the same runtime. GMT ships the polyfill, so this is a wrong answer GMT gives users of that runtime. Find the polyfill defect, record it in context/domination/js-temporal-polyfill-bugs.md and fix GMT's answer with a temporalCompat workaround, or fix GMT if the defect is its own. There is no tag for these rows. Never skip the test.";

const FAILURE_KEY = "native-suite/untagged-failure";
const HOST_KEY = "native-suite/untagged-host-failure";
const CONTROL_KEY = "native-suite/control-only-failure";
const STALE_KEY = "native-suite/stale-tag";

/** An oracle-clean verdict set, every compat source clean, with the given native legs (the others clean). */
const withLegs = (legs: Partial<Record<string, unknown>>) =>
  ({
    ...everywhere(cleanCheck().workarounds),
    "temporal-oracle": oracle(),
    ...cleanNative(),
    ...Object.fromEntries(
      Object.entries(legs).map(([leg, v]) => [`native-suite-${leg}`, v]),
    ),
  }) as never;

/** 60 rows of the kind a finding key tables, each with `message`. */
const optionsOf = (key: string, message: string): NativeOptions =>
  ({
    [FAILURE_KEY]: { untagged: 60, message },
    [HOST_KEY]: { hostUntagged: 60, message },
    [CONTROL_KEY]: { controlOnly: 60, message },
  })[key] ?? {};

const only = (verdicts: unknown, key: string) =>
  findings(verdicts as never, ORACLE_CONTEXT).filter((f) => f.key === key);

describe("native suite findings", () => {
  it("all four legs ran with nothing untagged and nothing stale: no native finding", () => {
    expect(plan(withLegs({}))).toEqual([]);
  });

  it("Chromium with 2 untagged rows: one finding naming Chromium only, one section", () => {
    const actions = plan(
      withLegs({ chromium: native("chromium", { untagged: 2 }) }),
    );
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe(FAILURE_KEY);
    expect(action.title).toBe(
      "Native Temporal: GMT tests fail on Chromium 153",
    );
    expect(action.labels).toEqual(["canary", "temporal-compat"]);
    expect(action.body.split("\n")[0]).toBe(
      `<!-- gmt-canary key="${FAILURE_KEY}" -->`,
    );
    expect(action.body.match(/^### /gm)).toHaveLength(1);
    expect(action.body).toContain(
      "### Chromium 153.0.8010.12\n\n| file | test | message |",
    );
    expect(action.body).toContain(
      "| `src/chromium/file1.test.ts` | `chromium test 1` | `message 1` |",
    );
    expect(action.body).toContain(
      "| `src/chromium/file2.test.ts` | `chromium test 2` | `message 2` |",
    );
    expect(action.body).toContain(`\n\n${TRIAGE}\n\nRun: ${RUN}`);
  });

  it("two legs untagged: both sections, titled in leg order, one finding", () => {
    const [finding] = findings(
      withLegs({
        chromium: native("chromium", { untagged: 1 }),
        node: native("node", { untagged: 1 }),
      }),
      ORACLE_CONTEXT,
    );
    expect(finding.title).toBe(
      "Native Temporal: GMT tests fail on Node 26, Chromium 153",
    );
    expect(finding.body.match(/^### /gm)).toHaveLength(2);
    expect(finding.body.indexOf(`### ${ENGINES.node}`)).toBeLessThan(
      finding.body.indexOf(`### ${ENGINES.chromium}`),
    );
  });

  it("a truncated leg says first N of M", () => {
    const [finding] = findings(
      withLegs({ node: native("node", { untagged: 60 }) }),
      ORACLE_CONTEXT,
    );
    expect(finding.body).toContain(`### ${ENGINES.node} (first 50 of 60)`);
    expect(finding.body.match(/chromium test|node test \d+/g)).toHaveLength(50);
  });

  it("the comment holds the same tables and not the paragraph", () => {
    const [finding] = findings(
      withLegs({ firefox: native("firefox", { untagged: 1 }) }),
      ORACLE_CONTEXT,
    );
    expect(finding.comment).toBe(
      `### Firefox 155.0\n\n| file | test | message |\n| --- | --- | --- |\n| \`src/firefox/file1.test.ts\` | \`firefox test 1\` | \`message 1\` |\n\nRun: ${RUN}`,
    );
  });

  it("a message with a pipe, a newline and a backtick stays inside its cell", () => {
    const [finding] = findings(
      withLegs({ node: native("node", { untagged: 1, message: "a|b\nc`d" }) }),
      ORACLE_CONTEXT,
    );
    expect(finding.body).toContain("| `a\\|b c'd` |");
  });

  it("Firefox verdict missing: could-not-run lists native-suite-firefox with the no-verdict message", () => {
    const verdicts = withLegs({}) as Record<string, unknown>;
    delete verdicts["native-suite-firefox"];
    const [finding] = findings(verdicts as never, ORACLE_CONTEXT);
    expect(finding.key).toBe("temporal-oracle/could-not-run");
    expect(finding.body).toContain(
      "- **native-suite-firefox**: no verdict file: an earlier step or job failed",
    );
  });

  it("Node leg could-not-run: could-not-run lists it with its message", () => {
    const [finding] = findings(
      withLegs({ node: couldNotRun("native-suite-node", "needs Node 26") }),
      ORACLE_CONTEXT,
    );
    expect(finding.key).toBe("temporal-oracle/could-not-run");
    expect(finding.body).toContain("- **native-suite-node**: needs Node 26");
  });

  it("an open issue carrying the marker gets a comment, not a new issue", () => {
    const verdicts = withLegs({ node: native("node", { untagged: 1 }) });
    const [action] = plan(verdicts, [
      issue(70, `<!-- gmt-canary key="${FAILURE_KEY}" -->\nold`),
    ]);
    expect(action.kind).toBe("comment");
    if (action.kind !== "comment") return;
    expect(action.issue).toBe(70);
    expect(action.key).toBe(FAILURE_KEY);
  });

  it("--force-native-failure with node ran: a dry-run finding on node with the synthetic row", () => {
    const { verdicts, skipped } = applyForce(withLegs({}), {
      nativeFailure: true,
    });
    expect(skipped).toEqual([]);
    expect(
      (verdicts["native-suite-node"] as { forced?: unknown }).forced,
    ).toEqual({
      nativeFailure: true,
    });
    const [finding] = findings(verdicts, ORACLE_CONTEXT);
    expect(finding.key).toBe(`dry-run/${FAILURE_KEY}`);
    expect(finding.title).toBe(
      "[dry run] Native Temporal: GMT tests fail on Node 26",
    );
    expect(finding.labels).toEqual([
      "canary",
      "temporal-compat",
      "canary-dry-run",
    ]);
    expect(finding.body).toContain(
      "**Dry run.** Forced by a manual dispatch (--force-native-failure); nothing here is a real finding. Close this issue once checked.",
    );
    expect(finding.body).toContain(
      `### ${ENGINES.node}\n\n| file | test | message |\n| --- | --- | --- |\n| \`src/dry-run.test.ts\` | \`dry run: forced failure (no real test failed)\` | \`forced\` |`,
    );
    expect(finding.body).toContain(TRIAGE);
  });

  it("--force-native-failure forces the first leg that ran, in leg order", () => {
    const { verdicts } = applyForce(
      withLegs({ node: couldNotRun("native-suite-node", "x") }),
      { nativeFailure: true },
    );
    expect(
      (verdicts["native-suite-chromium"] as { forced?: unknown }).forced,
    ).toEqual({
      nativeFailure: true,
    });
    expect(
      (verdicts["native-suite-node"] as { forced?: unknown }).forced,
    ).toBeUndefined();
  });

  it("a forced run comes after a real untagged finding and never touches its key", () => {
    const { verdicts } = applyForce(
      withLegs({ chromium: native("chromium", { untagged: 1 }) }),
      { nativeFailure: true },
    );
    expect(findings(verdicts, ORACLE_CONTEXT).map((f) => f.key)).toEqual([
      FAILURE_KEY,
      `dry-run/${FAILURE_KEY}`,
    ]);
  });

  it("--force-native-failure with no leg run: skipped with the reason, could-not-run still filed", () => {
    const input = {
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": oracle(),
      "native-suite-node": couldNotRun("native-suite-node", "Node 24"),
      "native-suite-chromium": null,
      "native-suite-firefox": null,
    };
    const { verdicts, skipped } = applyForce(input as never, {
      nativeFailure: true,
    });
    expect(skipped).toEqual([
      {
        flag: "--force-native-failure",
        reason:
          "no native-suite verdict ran, so there is nothing to force against",
      },
    ]);
    expect(findings(verdicts, ORACLE_CONTEXT).map((f) => f.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
  });

  it("applyForce leaves the input untouched when forcing a native failure", () => {
    const input = withLegs({}) as Record<string, any>;
    applyForce(input as never, { nativeFailure: true });
    expect(input["native-suite-node"].forced).toBeUndefined();
  });

  it("a stale tag on node: the stale-tag finding with label canary only", () => {
    const [finding] = findings(
      withLegs({
        node: native("node", {
          staleTags: [
            {
              kind: "divergence",
              file: "src/a.test.ts",
              test: "a > b",
              defect: "d14-day-rounding",
            },
          ],
        }),
      }),
      ORACLE_CONTEXT,
    );
    expect(finding.key).toBe(STALE_KEY);
    expect(finding.title).toBe("Native suite: known failures no longer fail");
    expect(finding.labels).toEqual(["canary"]);
    expect(finding.body).toContain(
      "### Divergence rows\n\n| leg | file | test | defect |\n| --- | --- | --- | --- |\n| node | `src/a.test.ts` | `a > b` | d14-day-rounding |",
    );
    expect(finding.body).toContain(
      "Remove each row from KNOWN_NATIVE_FAILURES and update its record in context/domination/js-temporal-polyfill-bugs.md.",
    );
    expect(finding.body).not.toContain("### Host groups");
  });

  it("a stale divergence row and a stale host group: one finding, both tables", () => {
    const [finding, ...rest] = findings(
      withLegs({
        node: native("node", {
          staleTags: [
            {
              kind: "divergence",
              file: "src/a.test.ts",
              test: "a > b",
              defect: "d1",
            },
          ],
        }),
        chromium: native("chromium", {
          staleTags: [
            {
              kind: "host",
              group: "chromium-icelandic-locale-data",
              reason: "Chromium ships no Icelandic data.",
            },
          ],
        }),
      }),
      ORACLE_CONTEXT,
    );
    expect(rest).toEqual([]);
    expect(finding.body).toContain("### Divergence rows");
    expect(finding.body).toContain(
      "### Host groups\n\n| leg | group | reason |\n| --- | --- | --- |\n| chromium | chromium-icelandic-locale-data | Chromium ships no Icelandic data. |",
    );
    expect(finding.body).toContain(
      "Remove the group from KNOWN_HOST_FAILURES, or narrow its legs.",
    );
  });

  it("Chromium with 3 host-untagged rows and none untagged: one host finding, labels canary, no divergence finding", () => {
    const actions = plan(
      withLegs({ chromium: native("chromium", { hostUntagged: 3 }) }),
    );
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe(HOST_KEY);
    expect(action.title).toBe(
      "Native suite: tests fail on both engines in Chromium 153",
    );
    expect(action.labels).toEqual(["canary"]);
    expect(action.body).toContain(
      `### ${ENGINES.chromium}\n\n| file | test | message |`,
    );
    expect(action.body).toContain(`\n\n${HOST}\n\nRun: ${RUN}`);
    expect(action.body).not.toContain(TRIAGE);
  });

  it("WebKit with 4 control-only rows and nothing else: one control-only finding, labels canary and temporal-compat", () => {
    const actions = plan(
      withLegs({ webkit: native("webkit", { controlOnly: 4 }) }),
    );
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe(CONTROL_KEY);
    expect(action.title).toBe(
      "Native suite: tests fail only on the polyfill in WebKit 26",
    );
    expect(action.labels).toEqual(["canary", "temporal-compat"]);
    expect(action.body.match(/^### /gm)).toHaveLength(1);
    expect(action.body).toContain(
      `### ${ENGINES.webkit}\n\n| file | test | message |`,
    );
    expect(action.body).toContain("`src/webkit/file4.test.ts`");
    expect(action.body).toContain(`\n\n${CONTROL}\n\nRun: ${RUN}`);
    expect(action.body).not.toContain(TRIAGE);
    expect(action.body).not.toContain(HOST);
  });

  it("the three kinds on one leg: three findings, three keys", () => {
    const keys = findings(
      withLegs({
        node: native("node", { untagged: 1, hostUntagged: 1, controlOnly: 1 }),
      }),
      ORACLE_CONTEXT,
    ).map((f) => f.key);
    expect(keys).toEqual([FAILURE_KEY, HOST_KEY, CONTROL_KEY]);
  });

  it("control-only rows appear in neither the divergence nor the host finding", () => {
    const verdicts = withLegs({
      node: native("node", { untagged: 1, hostUntagged: 1, controlOnly: 3 }),
    });
    for (const key of [FAILURE_KEY, HOST_KEY]) {
      const [finding] = only(verdicts, key);
      expect(finding.body).not.toContain("`src/node/file3.test.ts`");
    }
  });

  it("host-untagged rows never appear in the divergence finding", () => {
    const [failure] = only(
      withLegs({ node: native("node", { untagged: 1, hostUntagged: 2 }) }),
      FAILURE_KEY,
    );
    expect(failure.body).not.toContain("`src/node/file2.test.ts`");
  });

  it.each`
    key
    ${FAILURE_KEY}
    ${HOST_KEY}
    ${CONTROL_KEY}
  `(
    "body size: 4 legs of 50 rows with 300-character messages stay under 65,536 for $key, every leg cut to the same count",
    ({ key }) => {
      const message = "m".repeat(300);
      const options = optionsOf(key, message);
      const [finding] = only(
        withLegs({
          node: native("node", options),
          chromium: native("chromium", options),
          firefox: native("firefox", options),
          webkit: native("webkit", options),
        }),
        key,
      );
      const shown = finding.body.match(/m{300}/g)?.length ?? 0;
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(200);
      expect(shown % 4).toBe(0);
      const perLeg = shown / 4;
      for (const engine of Object.values(ENGINES)) {
        expect(finding.body).toContain(`### ${engine} (first ${perLeg} of 60)`);
      }
      expect(finding.body.length).toBeLessThan(65_536);
      expect(finding.comment.length).toBeLessThan(65_536);
    },
  );

  it.each`
    key
    ${FAILURE_KEY}
    ${HOST_KEY}
    ${CONTROL_KEY}
  `(
    "body size: 4 legs of 60 rows with 365-character names and 300-character messages stay under 65,536 for $key",
    ({ key }) => {
      const longName = (
        leg: (typeof NATIVE_LEGS)[number],
        options: NativeOptions,
      ) => {
        const v = native(leg, options);
        const name = (r: { file: string; test: string }, i: number) => ({
          ...r,
          file: `src/${leg}/${"d".repeat(120)}${i}.test.ts`,
          test: `${i} ${"t".repeat(365 - String(i).length - 1)}`,
        });
        return {
          ...v,
          untagged: v.untagged.map(name),
          hostUntagged: v.hostUntagged.map(name),
          controlOnly: v.controlOnly.map(name),
        };
      };
      const message = "m".repeat(300);
      const options = optionsOf(key, message);
      const [finding] = only(
        withLegs({
          node: longName("node", options),
          chromium: longName("chromium", options),
          firefox: longName("firefox", options),
          webkit: longName("webkit", options),
        }),
        key,
      );
      expect(finding.body.length).toBeLessThan(65_536);
      expect(finding.comment.length).toBeLessThan(65_536);
      expect(finding.body).toMatch(
        /### Node v26.10.0[^\n]* \(first \d+ of 60\)/,
      );
      expect(finding.body).toMatch(/### Firefox 155.0 \(first \d+ of 60\)/);
      expect(finding.body).toMatch(/### WebKit 26.6 \(first \d+ of 60\)/);
    },
  );

  it("body size: stale tags with 365-character names stay under 65,536 and say how many rows were left out", () => {
    const stale = (leg: (typeof NATIVE_LEGS)[number]) =>
      native(leg, {
        staleTags: Array.from({ length: 200 }, (_, i) => ({
          kind: "divergence",
          file: `src/${leg}/${"d".repeat(120)}${i}.test.ts`,
          test: `${i} ${"t".repeat(360)}`,
          defect: "d14-day-rounding",
        })),
      });
    const [finding] = only(
      withLegs({
        node: stale("node"),
        chromium: stale("chromium"),
        firefox: stale("firefox"),
      }),
      STALE_KEY,
    );
    expect(finding.body.length).toBeLessThan(65_536);
    expect(finding.comment.length).toBeLessThan(65_536);
    expect(finding.body).toMatch(/### Divergence rows \(first \d+ of 600\)/);
    expect(finding.body).toContain(
      "Remove each row from KNOWN_NATIVE_FAILURES",
    );
  });

  it("a test name with a mention and an issue reference renders as code, not as a link", () => {
    const v = native("node", { untagged: 1 });
    const tricky = {
      ...v,
      untagged: [
        {
          file: "src/a@example.test.ts",
          test: "see @example and UTS #35 | x",
          message: "m",
        },
      ],
    };
    const [finding] = only(withLegs({ node: tricky }), FAILURE_KEY);
    expect(finding.body).toContain(
      "| `src/a@example.test.ts` | `see @example and UTS #35 \\| x` | `m` |",
    );
    const stale = native("node", {
      staleTags: [
        {
          kind: "divergence",
          file: "src/a.test.ts",
          test: "see @example #35",
          defect: "d1",
        },
      ],
    });
    const [staleFinding] = only(withLegs({ node: stale }), STALE_KEY);
    expect(staleFinding.body).toContain("`src/a.test.ts` | `see @example #35`");
  });
});
