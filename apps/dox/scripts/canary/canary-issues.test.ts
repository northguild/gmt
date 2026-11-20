import {
  BODY_LIMIT,
  CANARY_LABEL,
  DRY_RUN_LABEL,
  NATIVE_LEGS as DERIVED_NATIVE_LEGS,
  SWAP_LEGS as DERIVED_SWAP_LEGS,
  SWAP_SOURCES,
  WORKFLOW_SOURCES,
  applyForce,
  d33SwapState,
  compatStates,
  findings,
  foldedComment,
  marker,
  planIssueActions,
  removableEverywhere,
  rollingMarker,
  swapReady,
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

/** The macOS WebKit leg's engine line, as its verdicts print it. */
const MACOS_ENGINE = "macOS WebKit 26.6 \u00b7 macOS 15.7.2";
const BROWSER_LEGS = ["chromium", "firefox", "webkit", "webkit-macos"] as const;
type BrowserLeg = (typeof BROWSER_LEGS)[number];
const BROWSER_ENGINE_IDS: Record<BrowserLeg, string> = {
  chromium: "v8",
  firefox: "firefox",
  webkit: "webkit",
  "webkit-macos": "webkit",
};
const BROWSER_ENGINES: Record<BrowserLeg, string> = {
  chromium: "Chromium 153.0.8010.12",
  firefox: "Firefox 155.0",
  webkit: "WebKit 26.6",
  "webkit-macos": "macOS WebKit 26.6 \u00b7 macOS 15.7.2",
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

/** The five engines' names in the order the compat sources run, as the bodies list them. */
const EVERY_ENGINE =
  "Node v24.11.0, Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6, macOS WebKit 26.6 \u00b7 macOS 15.7.2";

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

const leap = (differences: string[] = [], from = "IERS Leap_Second.dat") => ({
  source: "leap-seconds" as const,
  status: "ran" as const,
  from,
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

const NATIVE_LEGS = [
  "node",
  "chromium",
  "firefox",
  "webkit",
  "webkit-macos",
] as const;
const ENGINES = {
  node: "Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c",
  chromium: "Chromium 153.0.8010.12",
  firefox: "Firefox 155.0",
  webkit: "WebKit 26.6",
  "webkit-macos": "macOS WebKit 26.6 \u00b7 macOS 15.7.2",
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

/** Every native-suite leg, all clean. */
const cleanNative = () =>
  Object.fromEntries(
    NATIVE_LEGS.map((leg) => [`native-suite-${leg}`, native(leg)]),
  );

const SWAP_LEGS = ["node", "chromium", "firefox", "webkit"] as const;
type SwapLeg = (typeof SWAP_LEGS)[number];
const SWAP_BROWSERS: Record<SwapLeg, string | null> = {
  node: null,
  chromium: "chromium 153.0.8010.12",
  firefox: "firefox 155.0",
  webkit: "webkit 26.6",
};

const swapSweep = (differingZones = 0) => ({
  status: "ran" as const,
  tz: "2026e",
  from: "1970-01-01",
  through: "2036-11-04",
  zones: 418,
  days: 24415,
  comparisons: 10205470,
  differingZones,
  differing: Array.from({ length: Math.min(differingZones, 50) }, (_, i) => ({
    zone: `Area/Zone${i + 1}`,
    days: i + 1,
    runs: [],
    runsTruncated: false,
  })),
  differingTruncated: differingZones > 50,
});

/** The calendar sweep: `differing` names calendars, each with its year count. */
const calendarSweep = (differingCalendars = 0) => ({
  status: "ran" as const,
  from: "-003000-01-01",
  through: "+005000-12-31",
  calendars: 16,
  years: 128762,
  differingCalendars,
  differing: Array.from({ length: differingCalendars }, (_, i) => ({
    calendar: `cal${i + 1}`,
    years: i + 1,
    first: 1502,
    example: "year 1502: candidate a; reference b",
  })),
  differingTruncated: false,
});

/** The sweep of Chinese and Dangi, kept apart from the calendar sweep while compat D33 holds. */
const d33Sweep = (differingCalendars = 0) => ({
  status: "ran" as const,
  from: "-003000-01-01",
  through: "+005000-12-31",
  calendars: 2,
  years: 16_000,
  differingCalendars,
  differing: [],
  differingTruncated: false,
});

interface SwapOptions {
  version?: string;
  failed?: number;
  both?: number;
  fixed?: number;
  sweep?: unknown;
  calendarSweep?: unknown;
  entryLoaded?: unknown;
  d33Check?: unknown;
  d33Sweep?: unknown;
}

/** A swap-leg verdict that ran. Only the Node leg carries a sweep. */
const swapLeg = (leg: SwapLeg, options: SwapOptions = {}) => {
  const { version = "1.0.7", failed = 0, both = 0, fixed = 0 } = options;
  const sweep = "sweep" in options ? options.sweep : swapSweep();
  const calendars =
    "calendarSweep" in options ? options.calendarSweep : calendarSweep();
  return {
    source: `temporal-polyfill-swap-${leg}`,
    status: "ran" as const,
    leg,
    version,
    entry: "temporal-polyfill/full/implementation",
    entryLoaded: options.entryLoaded ?? true,
    runtime: {
      node: "26.12.1",
      vitest: "5.0.5",
      playwright: leg === "node" ? null : "1.63.0",
      browser: SWAP_BROWSERS[leg],
    },
    counts: {
      files: 943,
      tests: 71337,
      passed: 71337 - failed - both,
      skipped: 0,
      failed,
      both,
      fixed,
    },
    failing: [],
    failingTruncated: false,
    sweep: leg === "node" ? sweep : null,
    calendarSweep: leg === "node" ? calendars : null,
    d33: {
      check: options.d33Check ?? "removable",
      sweep:
        leg === "node"
          ? "d33Sweep" in options
            ? options.d33Sweep
            : d33Sweep()
          : null,
    },
  };
};

/** The four swap legs, all passing, with per-leg changes. */
const cleanSwap = (over: Partial<Record<SwapLeg, SwapOptions>> = {}) =>
  Object.fromEntries(
    SWAP_LEGS.map((leg) => [
      `temporal-polyfill-swap-${leg}`,
      swapLeg(leg, over[leg]),
    ]),
  );

/** Four legs that ran and are not swap-ready (one zone differs): they file nothing. */
const quietSwap = () => cleanSwap({ node: { sweep: swapSweep(1) } });

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
  const swap = Object.keys(given).some((k) =>
    k.startsWith("temporal-polyfill-swap-"),
  )
    ? {}
    : quietSwap();
  return { ...browsers, ...swap, ...given, ...legs } as never;
};

const issue = (number: number, body: string, labels = [CANARY_LABEL]) => ({
  number,
  body,
  labels: labels.map((name) => ({ name })),
});

const D2_KEY = "temporal-compat/removable/D2";
const D2_MARKER = `<!-- gmt-canary key="${D2_KEY}" -->`;

const removableD2 = () =>
  ({
    "temporal-compat-check": check([workaround("D2", "removable")]),
    "temporal-oracle": oracle(),
  }) as never;

/**
 * One `open` action per finding, as the single-issue shape read before the rolling issue. The
 * finding tests below check each finding's own title, key, labels and body, which the rolling
 * issue carries unchanged as a section; the rolling shape has its own tests further down.
 */
const planWithoutReport = (
  verdicts: Parameters<typeof findings>[0],
  _open: unknown,
  context: Parameters<typeof findings>[1],
) =>
  findings(verdicts, context).map((f) => ({
    kind: "open" as const,
    key: f.key,
    title: f.title,
    labels: f.labels,
    body: `${marker(f.key)}\n${f.body}`,
  }));

const plan = (verdicts: unknown, open: ReturnType<typeof issue>[] = []) =>
  planWithoutReport(withNative(verdicts), open, ORACLE_CONTEXT);

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
        "temporal-compat-webkit-macos",
        "temporal-oracle",
        "native-suite-node",
        "native-suite-chromium",
        "native-suite-firefox",
        "native-suite-webkit",
        "native-suite-webkit-macos",
        "temporal-polyfill-swap-node",
        "temporal-polyfill-swap-chromium",
        "temporal-polyfill-swap-firefox",
        "temporal-polyfill-swap-webkit",
      ],
      "leap-seconds": ["leap-seconds"],
      "us-clock-watch": ["us-clock-watch"],
    });
  });
  it("names the four swap sources", () => {
    expect(SWAP_SOURCES).toEqual([
      "temporal-polyfill-swap-node",
      "temporal-polyfill-swap-chromium",
      "temporal-polyfill-swap-firefox",
      "temporal-polyfill-swap-webkit",
    ]);
  });
  it("writes the hidden marker line", () => {
    expect(marker("a/b")).toBe('<!-- gmt-canary key="a/b" -->');
  });
});

describe("the finding plan: no-op and open", () => {
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
        "| temporal-compat-webkit | WebKit 26.6 | removable | 2 of 2 pass |\n" +
        `| temporal-compat-webkit-macos | ${MACOS_ENGINE} | removable | 2 of 2 pass |\n\n` +
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
      ["temporal-compat-webkit-macos", true, "removable"],
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
      ["temporal-compat-webkit-macos", false, "out-of-scope"],
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

  it("26: 300 groups with 50 rows show the first 50 groups and keep the body under 65536 characters", () => {
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
        "- **temporal-compat-webkit-macos**: no verdict file: an earlier step or job failed\n" +
        "- **temporal-oracle**: no Temporal\n",
    );
  });

  it("a missing key counts as no verdict file", () => {
    const actions = plan({ "temporal-compat-check": cleanCheck() });
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
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
    planWithoutReport({ "leap-seconds": verdict } as never, open, LEAP_CONTEXT);
  const KEY = "leap-seconds/table-difference";
  const DIFFERENCE = "row 29: fixture difference";

  it("a leap verdict with one difference and no open issue opens one issue", () => {
    const actions = leapPlan(leap([DIFFERENCE]));
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe(KEY);
    expect(action.title).toBe("Leap-second table differs from the IERS table");
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

  it("a difference read from the IANA copy names that file and its URL", () => {
    const [action] = leapPlan(leap([DIFFERENCE], "IANA leap-seconds.list"));
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe(KEY);
    expect(action.body).toContain(
      "packages/gmt/src/internal/leapSeconds.ts no longer matches IANA leap-seconds.list (https://data.iana.org/time-zones/tzdb/leap-seconds.list).",
    );
    expect(action.body).not.toContain("Leap_Second.dat");
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
      "Forced removable for a dry run. Real state on this run: still needed (2 of 2 probes fail) on Node v24.11.0; still needed (2 of 2 probes fail) on Chromium 153.0.8010.12; still needed (2 of 2 probes fail) on Firefox 155.0; still needed (2 of 2 probes fail) on WebKit 26.6; still needed (2 of 2 probes fail) on macOS WebKit 26.6 \u00b7 macOS 15.7.2.",
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
      "Real state on this run: still needed (2 of 2 probes fail) on Node v24.11.0; removable on Chromium 153.0.8010.12; no verdict (the compat page failed in firefox: boom) on temporal-compat-firefox; removable on WebKit 26.6; removable on macOS WebKit 26.6 \u00b7 macOS 15.7.2.",
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
      "Real state on this run: guard on Node v24.11.0; guard on Chromium 153.0.8010.12; guard on Firefox 155.0; guard on WebKit 26.6; guard on macOS WebKit 26.6 \u00b7 macOS 15.7.2.",
    );
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
    const actions = planWithoutReport(verdicts, [], LEAP_CONTEXT);
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("dry-run/leap-seconds/table-difference");
    expect(action.title).toBe(
      "[dry run] Leap-second table differs from the IERS table",
    );
    expect(action.labels).toEqual(["canary", "canary-dry-run"]);
    expect(action.body).toContain(
      "- dry run: forced difference (no real row differs)",
    );
    expect(action.body.split("\n")[1]).toBe(
      "**Dry run.** Forced by a manual dispatch (--force-leap-difference); nothing here is a real finding. Close this issue once checked.",
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
    const actions = planWithoutReport(verdicts as never, [], LEAP_CONTEXT);
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
      "native-suite/untagged-failure/node",
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

/** The untagged-failure key of one engine: each engine gets its own issue. */
const failureKey = (leg: string) => `native-suite/untagged-failure/${leg}`;
const FAILURE_KEY = failureKey("node");
const HOST_KEY = "native-suite/untagged-host-failure";
const CONTROL_KEY = "native-suite/control-only-failure";
const STALE_KEY = "native-suite/stale-tag";

/** An oracle-clean verdict set, every compat source clean, with the given native legs (the others clean). */
const withLegs = (legs: Partial<Record<string, unknown>>) =>
  ({
    ...everywhere(cleanCheck().workarounds),
    "temporal-oracle": oracle(),
    ...cleanNative(),
    ...quietSwap(),
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
    expect(action.key).toBe(failureKey("chromium"));
    expect(action.title).toBe(
      "Native Temporal: GMT tests fail on Chromium 153",
    );
    expect(action.labels).toEqual(["canary", "temporal-compat"]);
    expect(action.body.split("\n")[0]).toBe(
      `<!-- gmt-canary key="${failureKey("chromium")}" -->`,
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

  it("two legs untagged: one finding per engine, in leg order, each with its own section", () => {
    const [node, chromium, ...rest] = findings(
      withLegs({
        chromium: native("chromium", { untagged: 1 }),
        node: native("node", { untagged: 1 }),
      }),
      ORACLE_CONTEXT,
    );
    expect(rest).toEqual([]);
    expect([node.key, chromium.key]).toEqual([
      failureKey("node"),
      failureKey("chromium"),
    ]);
    expect(node.title).toBe("Native Temporal: GMT tests fail on Node 26");
    expect(chromium.title).toBe(
      "Native Temporal: GMT tests fail on Chromium 153",
    );
    expect(node.body.match(/^### /gm)).toEqual(["### "]);
    expect(node.body).toContain(`### ${ENGINES.node}`);
    expect(chromium.body.match(/^### /gm)).toEqual(["### "]);
    expect(chromium.body).toContain(`### ${ENGINES.chromium}`);
  });

  it("a truncated leg says first N of M", () => {
    const [finding] = findings(
      withLegs({ node: native("node", { untagged: 60 }) }),
      ORACLE_CONTEXT,
    );
    expect(finding.body).toContain(`### ${ENGINES.node} (first 50 of 60)`);
    expect(finding.body.match(/chromium test|node test \d+/g)).toHaveLength(50);
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
      failureKey("chromium"),
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
    ${HOST_KEY}
    ${CONTROL_KEY}
  `(
    "body size: 5 legs of 50 rows with 300-character messages stay under 65,536 for $key, every leg cut to the same count",
    ({ key }) => {
      const message = "m".repeat(300);
      const options = optionsOf(key, message);
      const [finding] = only(
        withLegs({
          node: native("node", options),
          chromium: native("chromium", options),
          firefox: native("firefox", options),
          webkit: native("webkit", options),
          "webkit-macos": native("webkit-macos", options),
        }),
        key,
      );
      const shown = finding.body.match(/m{300}/g)?.length ?? 0;
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(200);
      expect(shown % NATIVE_LEGS.length).toBe(0);
      const perLeg = shown / NATIVE_LEGS.length;
      for (const engine of Object.values(ENGINES)) {
        expect(finding.body).toContain(`### ${engine} (first ${perLeg} of 60)`);
      }
      expect(finding.body.length).toBeLessThan(65_536);
    },
  );

  it.each`
    key
    ${HOST_KEY}
    ${CONTROL_KEY}
  `(
    "body size: 5 legs of 60 rows with 365-character names and 300-character messages stay under 65,536 for $key",
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
          "webkit-macos": longName("webkit-macos", options),
        }),
        key,
      );
      expect(finding.body.length).toBeLessThan(65_536);
      expect(finding.body).toMatch(
        /### Node v26.10.0[^\n]* \(first \d+ of 60\)/,
      );
      expect(finding.body).toMatch(/### Firefox 155.0 \(first \d+ of 60\)/);
      expect(finding.body).toMatch(/### WebKit 26.6 \(first \d+ of 60\)/);
      expect(finding.body).toMatch(
        /### macOS WebKit 26.6 \u00b7 macOS 15.7.2 \(first \d+ of 60\)/,
      );
    },
  );

  it("body size: 5 legs of 60 rows with 365-character names give five untagged findings, each under 65,536 with one section", () => {
    const longName = (leg: (typeof NATIVE_LEGS)[number]) => {
      const v = native(leg, { untagged: 60, message: "m".repeat(300) });
      return {
        ...v,
        untagged: v.untagged.map((r, i) => ({
          ...r,
          file: `src/${leg}/${"d".repeat(120)}${i}.test.ts`,
          test: `${i} ${"t".repeat(365 - String(i).length - 1)}`,
        })),
      };
    };
    const verdicts = withLegs({
      node: longName("node"),
      chromium: longName("chromium"),
      firefox: longName("firefox"),
      webkit: longName("webkit"),
      "webkit-macos": longName("webkit-macos"),
    });
    for (const leg of NATIVE_LEGS) {
      const [finding] = only(verdicts, failureKey(leg));
      expect(finding.body.length).toBeLessThan(65_536);
      expect(finding.body.match(/^### /gm)).toEqual(["### "]);
      expect(finding.body).toContain(`### ${ENGINES[leg]}`);
    }
  });

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

describe("swapReady", () => {
  it("is ready, with the version, when all four legs and the sweep pass", () => {
    expect(swapReady(cleanSwap() as never)).toEqual({
      ready: true,
      version: "1.0.7",
    });
  });

  it("a failure that also fails on the control does not block (failed counts swap-only failures)", () => {
    expect(swapReady(cleanSwap({ chromium: { both: 9 } }) as never)).toEqual({
      ready: true,
      version: "1.0.7",
    });
  });

  /** The clean four legs, with one leg's verdict changed by `change`. */
  const changed = (
    leg: SwapLeg,
    change: (verdict: Record<string, any>) => void,
  ) => {
    const verdicts = cleanSwap() as Record<string, any>;
    change(verdicts[`temporal-polyfill-swap-${leg}`]);
    return verdicts;
  };

  it.each`
    label                                      | verdicts                                                                       | reason
    ${"chromium entryLoaded is false"}         | ${cleanSwap({ chromium: { entryLoaded: false } })}                             | ${"temporal-polyfill-swap-chromium: the swap pass did not load temporal-polyfill"}
    ${"firefox entryLoaded is missing"}        | ${changed("firefox", (v) => delete v.entryLoaded)}                             | ${"temporal-polyfill-swap-firefox: the swap pass did not load temporal-polyfill"}
    ${"node entryLoaded is the string true"}   | ${cleanSwap({ node: { entryLoaded: "true" } })}                                | ${"temporal-polyfill-swap-node: the swap pass did not load temporal-polyfill"}
    ${"entry not loaded beats failing tests"}  | ${cleanSwap({ webkit: { entryLoaded: false, failed: 5 } })}                    | ${"temporal-polyfill-swap-webkit: the swap pass did not load temporal-polyfill"}
    ${"webkit failed count is missing"}        | ${changed("webkit", (v) => delete v.counts.failed)}                            | ${"temporal-polyfill-swap-webkit: the failed count is missing"}
    ${"node counts are missing"}               | ${changed("node", (v) => delete v.counts)}                                     | ${"temporal-polyfill-swap-node: the failed count is missing"}
    ${"chromium failed count is the string 0"} | ${changed("chromium", (v) => (v.counts.failed = "0"))}                         | ${"temporal-polyfill-swap-chromium: the failed count is missing"}
    ${"firefox failed count is null"}          | ${changed("firefox", (v) => (v.counts.failed = null))}                         | ${"temporal-polyfill-swap-firefox: the failed count is missing"}
    ${"sweep differingZones is missing"}       | ${changed("node", (v) => delete v.sweep.differingZones)}                       | ${"offset sweep: the differing zone count is missing"}
    ${"sweep differingZones is undefined"}     | ${changed("node", (v) => (v.sweep.differingZones = undefined))}                | ${"offset sweep: the differing zone count is missing"}
    ${"sweep differingZones is the string 0"}  | ${changed("node", (v) => (v.sweep.differingZones = "0"))}                      | ${"offset sweep: the differing zone count is missing"}
    ${"calendar count is missing"}             | ${changed("node", (v) => delete v.calendarSweep.differingCalendars)}           | ${"calendar sweep: the differing calendar count is missing"}
    ${"calendar count is the string 0"}        | ${changed("node", (v) => (v.calendarSweep.differingCalendars = "0"))}          | ${"calendar sweep: the differing calendar count is missing"}
    ${"the sweep compared no zone"}            | ${changed("node", (v) => (v.sweep.zones = 0))}                                 | ${"offset sweep: it compared no zone"}
    ${"the sweep lost its zone count"}         | ${changed("node", (v) => delete v.sweep.zones)}                                | ${"offset sweep: the zone count is missing"}
    ${"the sweep compared no calendar"}        | ${changed("node", (v) => (v.calendarSweep.calendars = 0))}                     | ${"calendar sweep: it compared no calendar"}
    ${"the sweep lost its calendar count"}     | ${changed("node", (v) => delete v.calendarSweep.calendars)}                    | ${"calendar sweep: the calendar count is missing"}
    ${"the sweep read no year"}                | ${changed("node", (v) => (v.calendarSweep.years = 0))}                         | ${"calendar sweep: it compared no year"}
    ${"the sweep lost its year count"}         | ${changed("node", (v) => delete v.calendarSweep.years)}                        | ${"calendar sweep: the year count is missing"}
    ${"no zone beats a differing zone count"}  | ${changed("node", (v) => ((v.sweep.zones = 0), (v.sweep.differingZones = 3)))} | ${"offset sweep: it compared no zone"}
  `("is not ready when $label", ({ verdicts, reason }) => {
    expect(swapReady(verdicts)).toEqual({ ready: false, reason });
  });

  it.each`
    label                                          | verdicts                                                                                                               | reason
    ${"node verdict missing"}                      | ${{ ...cleanSwap(), "temporal-polyfill-swap-node": null }}                                                             | ${"temporal-polyfill-swap-node: did not run"}
    ${"chromium could not run"}                    | ${{ ...cleanSwap(), "temporal-polyfill-swap-chromium": couldNotRun("temporal-polyfill-swap-chromium", "no browser") }} | ${"temporal-polyfill-swap-chromium: did not run"}
    ${"webkit key absent"}                         | ${Object.fromEntries(Object.entries(cleanSwap()).filter(([k]) => !k.endsWith("webkit")))}                              | ${"temporal-polyfill-swap-webkit: did not run"}
    ${"versions differ"}                           | ${cleanSwap({ firefox: { version: "1.0.8" } })}                                                                        | ${"legs ran different versions: 1.0.7, 1.0.8"}
    ${"three tests fail on webkit"}                | ${cleanSwap({ webkit: { failed: 3 } })}                                                                                | ${"temporal-polyfill-swap-webkit: 3 tests fail on the swap"}
    ${"one test fails on node"}                    | ${cleanSwap({ node: { failed: 1 } })}                                                                                  | ${"temporal-polyfill-swap-node: 1 test fails on the swap"}
    ${"sweep could not run"}                       | ${cleanSwap({ node: { sweep: { status: "could-not-run", message: "no Intl" } } })}                                     | ${"offset sweep: did not run"}
    ${"sweep is null on node"}                     | ${cleanSwap({ node: { sweep: null } })}                                                                                | ${"offset sweep: did not run"}
    ${"calendar sweep could not run"}              | ${cleanSwap({ node: { calendarSweep: { status: "could-not-run", message: "no Temporal" } } })}                         | ${"calendar sweep: did not run"}
    ${"calendar sweep is null on node"}            | ${cleanSwap({ node: { calendarSweep: null } })}                                                                        | ${"calendar sweep: did not run"}
    ${"one calendar differs"}                      | ${cleanSwap({ node: { calendarSweep: calendarSweep(1) } })}                                                            | ${"calendar sweep: 1 calendar differs (cal1)"}
    ${"two calendars differ"}                      | ${cleanSwap({ node: { calendarSweep: calendarSweep(2) } })}                                                            | ${"calendar sweep: 2 calendars differ (cal1, cal2)"}
    ${"the offset sweep beats the calendar sweep"} | ${cleanSwap({ node: { sweep: swapSweep(1), calendarSweep: calendarSweep(1) } })}                                       | ${"offset sweep: 1 zone differs"}
    ${"two zones differ"}                          | ${cleanSwap({ node: { sweep: swapSweep(2) } })}                                                                        | ${"offset sweep: 2 zones differ"}
    ${"one zone differs"}                          | ${cleanSwap({ node: { sweep: swapSweep(1) } })}                                                                        | ${"offset sweep: 1 zone differs"}
    ${"a missing leg beats a failing one"}         | ${{ ...cleanSwap({ node: { failed: 4 } }), "temporal-polyfill-swap-webkit": null }}                                    | ${"temporal-polyfill-swap-webkit: did not run"}
    ${"versions beat failures"}                    | ${cleanSwap({ node: { failed: 4 }, webkit: { version: "1.0.9" } })}                                                    | ${"legs ran different versions: 1.0.7, 1.0.9"}
    ${"failures beat the sweep"}                   | ${cleanSwap({ chromium: { failed: 2 }, node: { sweep: swapSweep(5) } })}                                               | ${"temporal-polyfill-swap-chromium: 2 tests fail on the swap"}
  `("is not ready when $label", ({ verdicts, reason }) => {
    expect(swapReady(verdicts)).toEqual({ ready: false, reason });
  });
});

describe("d33SwapState", () => {
  const state = (swap: unknown) => d33SwapState(swap as never).state;

  it("is removable when every leg passes and the Chinese and Dangi sweep finds no difference", () => {
    expect(d33SwapState(cleanSwap() as never)).toEqual({
      state: "removable",
      failing: 0,
      legs: 4,
      differing: 0,
      calendars: 2,
    });
  });

  it.each`
    label                                      | swap                                                                                      | expected
    ${"one leg's check is 'still needed'"}     | ${cleanSwap({ webkit: { d33Check: "still needed" } })}                                    | ${"still needed"}
    ${"one leg's check is 'missing'"}          | ${cleanSwap({ chromium: { d33Check: "missing" } })}                                       | ${"still needed"}
    ${"the Node sweep finds a difference"}     | ${cleanSwap({ node: { d33Sweep: d33Sweep(1) } })}                                         | ${"still needed"}
    ${"the Node sweep could not run"}          | ${cleanSwap({ node: { d33Sweep: { status: "could-not-run", message: "no Temporal" } } })} | ${"still needed"}
    ${"the Node sweep is null"}                | ${cleanSwap({ node: { d33Sweep: null } })}                                                | ${"still needed"}
    ${"the Node sweep counted no calendar"}    | ${cleanSwap({ node: { d33Sweep: { ...d33Sweep(), calendars: 0 } } })}                     | ${"still needed"}
    ${"the Node difference count is a string"} | ${cleanSwap({ node: { d33Sweep: { ...d33Sweep(), differingCalendars: "0" } } })}          | ${"still needed"}
  `("is '$expected' when $label", ({ swap, expected }) => {
    expect(state(swap)).toBe(expected);
  });

  it("is 'still needed' when a leg has no d33 field or did not run", () => {
    const missing = cleanSwap() as Record<string, Record<string, unknown>>;
    delete missing["temporal-polyfill-swap-firefox"].d33;
    expect(state(missing)).toBe("still needed");
    const gone = cleanSwap() as Record<string, unknown>;
    delete gone["temporal-polyfill-swap-webkit"];
    expect(state(gone)).toBe("still needed");
  });

  it("swapReady ignores d33: a swap with every check 'still needed' is ready", () => {
    expect(
      swapReady(
        cleanSwap({
          node: { d33Check: "still needed", d33Sweep: d33Sweep(2) },
          chromium: { d33Check: "still needed" },
          firefox: { d33Check: "still needed" },
          webkit: { d33Check: "missing" },
        }) as never,
      ),
    ).toEqual({ ready: true, version: "1.0.7" });
  });
});

describe("swap findings", () => {
  const READY_TITLE =
    "Swap to temporal-polyfill 1.0.7: it passes the GMT suite and both sweeps";
  const READY_MARKER = '<!-- gmt-canary key="temporal-polyfill-swap/ready" -->';
  const swapPlan = (swap: unknown, open: ReturnType<typeof issue>[] = []) =>
    plan(
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": oracle(),
        ...(swap as object),
      },
      open,
    );

  it("a ready run opens one issue with the key, title and label", () => {
    const actions = swapPlan(cleanSwap());
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("temporal-polyfill-swap/ready");
    expect(action.title).toBe(READY_TITLE);
    expect(action.labels).toEqual(["canary"]);
    expect(action.body.split("\n")[0]).toBe(READY_MARKER);
  });

  it("a run that ran but is not swap-ready files nothing", () => {
    expect(swapPlan(cleanSwap({ webkit: { failed: 2 } }))).toEqual([]);
  });

  it("a differing calendar sweep files nothing", () => {
    expect(
      swapPlan(cleanSwap({ node: { calendarSweep: calendarSweep(1) } })),
    ).toEqual([]);
  });

  it("a differing sweep files nothing", () => {
    expect(swapPlan(cleanSwap({ node: { sweep: swapSweep(3) } }))).toEqual([]);
  });

  it("a ready swap that leaves D33 on still opens the issue, and the body says D33 stays", () => {
    const [action] = swapPlan(
      cleanSwap({
        node: { d33Check: "still needed", d33Sweep: d33Sweep(2) },
        chromium: { d33Check: "still needed" },
      }),
    );
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body.split("\n")).toContain(
      "Chinese and Dangi: D33 stays. 2 of 4 legs fail a D33 repro; the calendar sweep finds 2 of 2 calendars differ from the built-in Temporal. GMT refuses both calendars on every host, so this does not block the swap.",
    );
  });

  it("opens a new issue when the open canary issue has another marker", () => {
    const actions = swapPlan(cleanSwap(), [
      issue(
        5,
        '<!-- gmt-canary key="temporal-oracle/untagged-mismatch" -->\nx',
      ),
    ]);
    expect(actions.map((a) => a.kind)).toEqual(["open"]);
  });

  it("writes the whole body", () => {
    const [action] = swapPlan(
      cleanSwap({ chromium: { both: 9 }, webkit: { fixed: 2, both: 1 } }),
    );
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toBe(
      [
        READY_MARKER,
        `temporal-polyfill 1.0.7, imported from \`temporal-polyfill/full/implementation\`, passed every check on this run.`,
        "",
        "| Runtime | Tests | Fail on swap only | Fail on both | Fail only on @js-temporal/polyfill |",
        "| --- | --- | --- | --- | --- |",
        "| Node 26.12.1 | 71337 | 0 | 0 | 0 |",
        "| Chromium 153.0.8010.12 | 71337 | 0 | 9 | 0 |",
        "| Firefox 155.0 | 71337 | 0 | 0 | 0 |",
        "| WebKit 26.6 | 71337 | 0 | 1 | 2 |",
        "",
        "Offset sweep: every one of 418 zones matches `Intl.DateTimeFormat` at 12:00 UTC each day from 1970-01-01 to ten years past the run date (tz 2026e).",
        "",
        "Calendar sweep: every one of 16 calendars matches the built-in Temporal on the first day, months and days of each year from -003000-01-01 to +005000-12-31.",
        "",
        "Chinese and Dangi: every leg passes the D33 repros and both calendars match the built-in Temporal from -003000-01-01 to +005000-12-31. D33 can be retired with this swap (README § Removal steps 33).",
        "",
        "What the swap involves is in [temporal-polyfill-swap.md § 5 and § 7](https://github.com/northguild/gmt/blob/main/context/domination/research/temporal-polyfill-swap.md). Type errors are not checked here; § 5 lists them.",
        "",
        "A person makes the swap. CI opens issues, never pull requests.",
        "",
        `Run: ${RUN}`,
      ].join("\n"),
    );
    expect(action.body.length).toBeLessThan(65_536);
  });
});

describe("swap could not run", () => {
  const MISSING = "no verdict file: an earlier step or job failed";
  const base = () => ({
    "temporal-compat-check": cleanCheck(),
    "temporal-oracle": oracle(),
  });

  it("a swap leg that could not run is one could-not-run finding and no swap finding", () => {
    const actions = plan({
      ...base(),
      ...cleanSwap(),
      "temporal-polyfill-swap-firefox": couldNotRun(
        "temporal-polyfill-swap-firefox",
        "Firefox is not installed",
      ),
    });
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "- **temporal-polyfill-swap-firefox**: Firefox is not installed\n",
    );
  });

  it("four missing swap verdicts list all four", () => {
    const actions = plan({
      ...base(),
      ...Object.fromEntries(
        SWAP_LEGS.map((leg) => [`temporal-polyfill-swap-${leg}`, null]),
      ),
    });
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      `- **temporal-polyfill-swap-node**: ${MISSING}\n` +
        `- **temporal-polyfill-swap-chromium**: ${MISSING}\n` +
        `- **temporal-polyfill-swap-firefox**: ${MISSING}\n` +
        `- **temporal-polyfill-swap-webkit**: ${MISSING}\n`,
    );
  });

  it("a swap leg and the oracle both failing give one finding listing both", () => {
    const actions = plan({
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": couldNotRun("temporal-oracle", "no Temporal"),
      ...cleanSwap(),
      "temporal-polyfill-swap-webkit": null,
    });
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      `- **temporal-oracle**: no Temporal\n` +
        `- **temporal-polyfill-swap-webkit**: ${MISSING}\n`,
    );
  });

  it("a Node leg that ran but whose calendar sweep could not run lists the sweep, with no swap finding", () => {
    const actions = plan({
      ...base(),
      ...cleanSwap({
        node: {
          calendarSweep: { status: "could-not-run", message: "no Temporal" },
        },
      }),
    });
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "- **temporal-polyfill-swap-node**: calendar sweep: no Temporal\n",
    );
  });

  it("a Node leg that ran but whose sweep could not run lists the sweep, with no swap finding", () => {
    const actions = plan({
      ...base(),
      ...cleanSwap({
        node: { sweep: { status: "could-not-run", message: "no longOffset" } },
      }),
    });
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-oracle/could-not-run",
    ]);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body).toContain(
      "- **temporal-polyfill-swap-node**: offset sweep: no longOffset\n",
    );
  });

  it.each`
    label                               | leg           | change
    ${"entryLoaded is false"}           | ${"chromium"} | ${(v: Record<string, any>) => (v.entryLoaded = false)}
    ${"entryLoaded is missing"}         | ${"firefox"}  | ${(v: Record<string, any>) => delete v.entryLoaded}
    ${"entryLoaded is the string true"} | ${"webkit"}   | ${(v: Record<string, any>) => (v.entryLoaded = "true")}
    ${"the Node leg did not load it"}   | ${"node"}     | ${(v: Record<string, any>) => (v.entryLoaded = false)}
  `(
    "a $leg leg that ran on the wrong entry is one could-not-run line, never a pass ($label)",
    ({ leg, change }) => {
      const actions = plan({
        ...base(),
        ...(() => {
          const verdicts = cleanSwap() as Record<string, any>;
          change(verdicts[`temporal-polyfill-swap-${leg}`]);
          return verdicts;
        })(),
      });
      expect(actions.map((a) => a.key)).toEqual([
        "temporal-oracle/could-not-run",
      ]);
      const [action] = actions;
      if (action.kind !== "open") throw new Error("expected open");
      expect(action.body).toContain(
        `- **temporal-polyfill-swap-${leg}**: swap entry not loaded\n`,
      );
    },
  );

  it("a leg whose verdict says could-not-run for the entry takes the same route", () => {
    const actions = plan({
      ...base(),
      ...cleanSwap(),
      "temporal-polyfill-swap-webkit": couldNotRun(
        "temporal-polyfill-swap-webkit",
        "swap entry not loaded",
      ),
    });
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("temporal-oracle/could-not-run");
    expect(action.body).toContain(
      "- **temporal-polyfill-swap-webkit**: swap entry not loaded\n",
    );
  });

  it("the leap-seconds workflow does not read swap sources", () => {
    expect(
      planWithoutReport({ "leap-seconds": leap() } as never, [], LEAP_CONTEXT),
    ).toEqual([]);
  });
});

describe("swap force", () => {
  const DRY_KEY = "dry-run/temporal-polyfill-swap/ready";
  const base = () => ({
    "temporal-compat-check": cleanCheck(),
    "temporal-oracle": oracle(),
  });
  const forcedPlan = (swap: unknown, open: unknown[] = []) => {
    const { verdicts } = applyForce(
      withNative({ ...base(), ...(swap as object) }),
      { swapReady: true },
    );
    return planWithoutReport(verdicts as never, open as never, ORACLE_CONTEXT);
  };

  it("marks the first swap leg that ran", () => {
    const { verdicts, skipped } = applyForce(
      withNative({
        ...base(),
        ...cleanSwap(),
        "temporal-polyfill-swap-node": null,
      }),
      { swapReady: true },
    );
    expect(skipped).toEqual([]);
    expect(
      (verdicts["temporal-polyfill-swap-chromium"] as { forced?: unknown })
        .forced,
    ).toEqual({ swapReady: true });
    expect(
      (verdicts["temporal-polyfill-swap-firefox"] as { forced?: unknown })
        .forced,
    ).toBeUndefined();
  });

  it("is skipped, with a reason, when no swap leg ran", () => {
    const { skipped } = applyForce(
      withNative({
        ...base(),
        ...Object.fromEntries(
          SWAP_LEGS.map((leg) => [`temporal-polyfill-swap-${leg}`, null]),
        ),
      }),
      { swapReady: true },
    );
    expect(skipped).toEqual([
      {
        flag: "--force-swap-ready",
        reason:
          "no temporal-polyfill-swap verdict ran, so there is nothing to force against",
      },
    ]);
  });

  it("forced on a passing run files the real issue and a dry-run twin", () => {
    const actions = forcedPlan(cleanSwap());
    expect(actions.map((a) => a.key)).toEqual([
      "temporal-polyfill-swap/ready",
      DRY_KEY,
    ]);
    const dry = actions[1];
    if (dry.kind !== "open") throw new Error("expected open");
    expect(dry.title).toBe(
      "[dry run] Swap to temporal-polyfill 1.0.7: it passes the GMT suite and both sweeps",
    );
    expect(dry.labels).toEqual(["canary", "canary-dry-run"]);
    expect(dry.body).toContain(
      "Forced for a dry run. Real result on this run: every check passed.",
    );
    expect(dry.body).toContain(
      `temporal-polyfill 1.0.7, imported from \`temporal-polyfill/full/implementation\`, passed every check on this run.`,
    );
  });

  it("forced with webkit failing files only the dry run and states the real reason", () => {
    const actions = forcedPlan(cleanSwap({ webkit: { failed: 2 } }));
    expect(actions.map((a) => a.key)).toEqual([DRY_KEY]);
    const [dry] = actions;
    if (dry.kind !== "open") throw new Error("expected open");
    expect(dry.body).toContain(
      "Forced for a dry run. Real result on this run: not ready to swap. The first check that blocks it: temporal-polyfill-swap-webkit: 2 tests fail on the swap.",
    );
    expect(dry.body).toContain(
      `temporal-polyfill 1.0.7, imported from \`temporal-polyfill/full/implementation\`, was checked on this run.`,
    );
    expect(dry.body).not.toContain("passed every check");
    expect(dry.body).toContain("| WebKit 26.6 | 71337 | 2 | 0 | 0 |");
    expect(dry.title).toBe(
      "[dry run] Swap to temporal-polyfill 1.0.7: not ready, forced to preview the ready issue",
    );
  });

  it("a forced run with differing zones does not claim the sweep matched", () => {
    const actions = forcedPlan(cleanSwap({ node: { sweep: swapSweep(2) } }));
    const dry = actions.find((a) => a.key === DRY_KEY);
    if (!dry || dry.kind !== "open") throw new Error("expected open");
    expect(dry.body).toContain(
      "Offset sweep: 2 of 418 zones differ from `Intl.DateTimeFormat` at 12:00 UTC on some day from 1970-01-01 to ten years past the run date (tz 2026e).",
    );
    expect(dry.body).not.toContain("every one of 418 zones matches");
  });

  it("a forced run with differing calendars does not claim the calendar sweep matched", () => {
    const actions = forcedPlan(
      cleanSwap({ node: { calendarSweep: calendarSweep(2) } }),
    );
    const dry = actions.find((a) => a.key === DRY_KEY);
    if (!dry || dry.kind !== "open") throw new Error("expected open");
    expect(dry.body).toContain(
      "Calendar sweep: 2 of 16 calendars differ from the built-in Temporal in some year from -003000-01-01 to +005000-12-31.",
    );
    expect(dry.body).not.toContain("every one of 16 calendars matches");
  });

  it("shows a leg that did not run as 'did not run' in the dry-run table", () => {
    const actions = forcedPlan({
      ...cleanSwap(),
      "temporal-polyfill-swap-firefox": null,
    });
    const dry = actions.find((a) => a.key === DRY_KEY);
    if (!dry || dry.kind !== "open") throw new Error("expected open");
    expect(dry.body).toContain("| Firefox | did not run |  |  |  |");
  });
});

describe("the macOS WebKit leg", () => {
  it("is one list of legs, with the swap check on four", () => {
    expect(DERIVED_NATIVE_LEGS).toEqual([
      "node",
      "chromium",
      "firefox",
      "webkit",
      "webkit-macos",
    ]);
    expect(DERIVED_SWAP_LEGS).toEqual([
      "node",
      "chromium",
      "firefox",
      "webkit",
    ]);
  });

  it.each`
    engine                                                              | label
    ${"Node v26.12.1 \u00b7 V8 14.6.1 \u00b7 ICU 78.3 \u00b7 tz 2026e"} | ${"Node 26"}
    ${"Chromium 153.0.8010.12"}                                         | ${"Chromium 153"}
    ${"WebKit 26.6"}                                                    | ${"WebKit 26"}
    ${"macOS WebKit 26.6 \u00b7 macOS 15.7.2"}                          | ${"macOS WebKit 26"}
  `(
    "the engine line '$engine' titles the issue '$label'",
    ({ engine, label }) => {
      const leg = engine.startsWith("macOS") ? "webkit-macos" : "webkit";
      const [f] = findings(
        withLegs({ [leg]: { ...native(leg, { untagged: 1 }), engine } }),
        ORACLE_CONTEXT,
      );
      expect(f.title).toBe(`Native Temporal: GMT tests fail on ${label}`);
    },
  );

  it("an engine line with no version titles the issue with the leg name", () => {
    const [f] = findings(
      withLegs({
        "webkit-macos": {
          ...native("webkit-macos", { untagged: 1 }),
          engine: "(no version)",
        },
      }),
      ORACLE_CONTEXT,
    );
    expect(f.title).toBe("Native Temporal: GMT tests fail on webkit-macos");
  });

  it("keys the two WebKit legs apart: separate issues, titled by their own label", () => {
    const found = findings(
      withLegs({
        webkit: native("webkit", { untagged: 1 }),
        "webkit-macos": native("webkit-macos", { untagged: 1 }),
      }),
      ORACLE_CONTEXT,
    ).filter((f) => f.key.startsWith("native-suite/untagged-failure/"));
    expect(found.map((f) => [f.key, f.title])).toEqual([
      [
        "native-suite/untagged-failure/webkit",
        "Native Temporal: GMT tests fail on WebKit 26",
      ],
      [
        "native-suite/untagged-failure/webkit-macos",
        "Native Temporal: GMT tests fail on macOS WebKit 26",
      ],
    ]);
  });

  it.each`
    key            | title
    ${HOST_KEY}    | ${"Native suite: tests fail on both engines in WebKit 26, macOS WebKit 26"}
    ${CONTROL_KEY} | ${"Native suite: tests fail only on the polyfill in WebKit 26, macOS WebKit 26"}
  `(
    "the $key title lists both WebKit labels when both legs have rows",
    ({ key, title }) => {
      const options = optionsOf(key, "m");
      const [f] = findings(
        withLegs({
          webkit: native("webkit", options),
          "webkit-macos": native("webkit-macos", options),
        }),
        ORACLE_CONTEXT,
      ).filter((x) => x.key === key);
      expect(f.title).toBe(title);
    },
  );

  it("a missing native-suite-webkit-macos verdict is a could-not-run line, and nothing else", () => {
    const verdicts = {
      ...(withLegs({}) as object),
      "native-suite-webkit-macos": null,
    };
    const [f] = findings(verdicts as never, ORACLE_CONTEXT);
    expect(f.key).toBe("temporal-oracle/could-not-run");
    expect(f.body).toContain(
      "- **native-suite-webkit-macos**: no verdict file: an earlier step or job failed\n",
    );
    expect(f.body).not.toContain("**native-suite-webkit**");
  });
});

describe("workarounds scoped to WebKit, with two WebKit legs", () => {
  const d18 = (state: State) =>
    workaround("D18", state, { engines: ["webkit"] });
  const states = (verdicts: unknown) =>
    compatStates(verdicts as never).map((s) => [s.everywhere]);

  it("D18 removable on webkit but no webkit-macos verdict: not removable", () => {
    const verdicts = {
      ...everywhere([d18("removable")]),
      "temporal-compat-webkit-macos": null,
      "temporal-oracle": oracle(),
    };
    expect(states(verdicts)).toEqual([[false]]);
    expect(plan(verdicts).map((a) => a.key)).not.toContain(
      "temporal-compat/removable/D18",
    );
  });

  it("D18 removable on webkit, still needed on webkit-macos: not removable", () => {
    const verdicts = {
      ...everywhere([d18("removable")]),
      "temporal-compat-webkit-macos": browserCompat("webkit-macos", [
        d18("still-needed"),
      ]),
      "temporal-oracle": oracle(),
    };
    expect(states(verdicts)).toEqual([[false]]);
  });

  it("D18 removable on both WebKit legs, out of scope elsewhere: removable everywhere", () => {
    const verdicts = {
      ...everywhere([d18("out-of-scope")]),
      "temporal-compat-webkit": browserCompat("webkit", [d18("removable")]),
      "temporal-compat-webkit-macos": browserCompat("webkit-macos", [
        d18("removable"),
      ]),
      "temporal-oracle": oracle(),
    };
    expect(states(verdicts)).toEqual([[true]]);
  });

  it("D16 with no engines needs all five compat sources", () => {
    const d16 = (state: State) => workaround("D16", state);
    const verdicts = {
      ...everywhere([d16("removable")]),
      "temporal-oracle": oracle(),
    };
    expect(states(verdicts)).toEqual([[true]]);
    const [row] = compatStates(verdicts as never);
    expect(row.engines.map((e) => e.source)).toEqual([
      "temporal-compat-check",
      "temporal-compat-chromium",
      "temporal-compat-firefox",
      "temporal-compat-webkit",
      "temporal-compat-webkit-macos",
    ]);
    expect(
      states({ ...verdicts, "temporal-compat-webkit-macos": null }),
    ).toEqual([[false]]);
  });
});

describe("US clock-change watch findings", () => {
  const WATCH_CONTEXT = { workflow: "us-clock-watch", runUrl: RUN } as const;
  const ran = (
    differences: string[] = [],
    extra: Record<string, unknown> = {},
  ) => ({
    status: "ran" as const,
    differences,
    ...extra,
  });
  const watch = (
    over: Partial<Record<"federal" | "state" | "tz", unknown>> = {},
    top: Record<string, unknown> = {},
  ) => ({
    source: "us-clock-watch" as const,
    status: "ran" as const,
    federal: ran([], { congress: 119 }),
    state: ran(),
    tz: ran([], { release: "2026f", snapshotRelease: "2026e" }),
    ...over,
    ...top,
  });
  const watchPlan = (verdict: unknown, open: ReturnType<typeof issue>[] = []) =>
    planWithoutReport(
      { "us-clock-watch": verdict } as never,
      open,
      WATCH_CONTEXT,
    );
  const opened = (verdict: unknown) =>
    watchPlan(verdict).map((a) => {
      if (a.kind !== "open") throw new Error("expected open");
      return a;
    });

  it("a clean run files nothing", () => {
    expect(watchPlan(watch())).toEqual([]);
  });

  it("each kind of difference opens its own issue", () => {
    const actions = opened(
      watch({
        federal: ran(["new: S 7: To adopt permanent standard time"]),
        state: ran(["new: Texas 2025 HB 9: Relating to standard time"]),
        tz: ran(["America/New_York"], {
          release: "2026f",
          snapshotRelease: "2026e",
        }),
      }),
    );
    expect(actions.map((a) => a.key)).toEqual([
      "us-clock-watch/federal",
      "us-clock-watch/state",
      "us-clock-watch/tz-us-zone",
    ]);
    expect(actions.map((a) => a.title)).toEqual([
      "Federal bills on the clock-change subject changed",
      "State bills on the clock-change subject changed",
      "A tz release changed the rules of a US zone",
    ]);
    for (const action of actions) {
      expect(action.labels).toEqual(["canary"]);
      expect(action.body.split("\n")[0]).toBe(
        `<!-- gmt-canary key="${action.key}" -->`,
      );
      expect(action.body.endsWith(`Run: ${RUN}`)).toBe(true);
    }
  });

  it("the bill issues list what changed since the carried snapshot and ask only for a review", () => {
    const [federal, state] = opened(
      watch({
        federal: ran(["new: S 7: To adopt permanent standard time"], {
          since: "2026-11-09T07:20:00Z",
        }),
        state: ran(["new: Texas 2025 HB 9: Relating to standard time"]),
      }),
    );
    expect(federal.body).toContain(
      "whose latest action changed since the snapshot of 2026-11-09.",
    );
    expect(state.body).toContain(
      "whose latest action changed since the last snapshot.",
    );
    expect(federal.body).toContain(
      "### Differences\n\n- new: S 7: To adopt permanent standard time",
    );
    expect(federal.body).toContain("Review the change.");
    expect(federal.body).toContain("Nothing else to run");
    expect(federal.body).not.toContain("refresh");
    expect(federal.body).not.toContain("CORE-90 phase 2");
  });

  it("the tz issue names the zones, both releases, and the phase-2 signal", () => {
    const [tz] = opened(
      watch({
        tz: ran(["America/Detroit", "America/New_York"], {
          release: "2026f",
          snapshotRelease: "2026e",
        }),
      }),
    );
    expect(tz.body).toContain(
      "A tz release changed a US zone's rules. This is the signal to build the US clock-change checker: CORE-90 phase 2, #341.",
    );
    expect(tz.body).toContain("Release 2026f; the snapshot has 2026e.");
    expect(tz.body).toContain("- America/Detroit\n- America/New_York");
    expect(tz.body).toContain("node scripts/us-clock-watch.mjs snapshot-tz");
  });

  it("a source that could not run files one could-not-run issue naming it", () => {
    const actions = opened(
      watch({
        federal: {
          status: "could-not-run",
          message: "secret `CONGRESS_GOV_API_KEY` is not set",
        },
        state: ran(["new: Texas 2025 HB 9: Relating to standard time"]),
      }),
    );
    expect(actions.map((a) => a.key)).toEqual([
      "us-clock-watch/state",
      "us-clock-watch/could-not-run",
    ]);
    expect(actions[1].body).toContain(
      "- **federal**: secret `CONGRESS_GOV_API_KEY` is not set",
    );
  });

  it("a whole-run could-not-run verdict files the could-not-run issue", () => {
    const actions = opened(couldNotRun("us-clock-watch", "cannot run: boom"));
    expect(actions.map((a) => a.key)).toEqual(["us-clock-watch/could-not-run"]);
  });

  it("a missing verdict files a could-not-run issue", () => {
    const actions = watchPlan(null);
    expect(actions.map((a) => a.key)).toEqual(["us-clock-watch/could-not-run"]);
  });

  it("forcing a difference opens a labelled dry-run issue and leaves real ones alone", () => {
    const { verdicts, skipped } = applyForce(
      { "us-clock-watch": watch() } as never,
      { usClockDifference: true },
    );
    expect(skipped).toEqual([]);
    const actions = planWithoutReport(verdicts, [], WATCH_CONTEXT);
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("dry-run/us-clock-watch/federal");
    expect(action.title.startsWith("[dry run] ")).toBe(true);
    expect(action.labels).toEqual(["canary", "canary-dry-run"]);
    expect(action.body).toContain("--force-us-clock-difference");
  });

  it("forcing a difference when the watch did not run says so and files nothing", () => {
    const { skipped } = applyForce(
      { "us-clock-watch": couldNotRun("us-clock-watch", "x") } as never,
      { usClockDifference: true },
    );
    expect(skipped.map((s) => s.flag)).toEqual(["--force-us-clock-difference"]);
  });
});

describe("the rolling issue", () => {
  const ROLL = rollingMarker("temporal-oracle");
  const D2_TITLE = "Remove workaround D2: summary of D2";
  const MISMATCH_TITLE =
    "Oracle: GMT differs from native Temporal on untagged rows";
  const LEAP_TITLE = "Leap-second table differs from the IERS table";
  const LEAP_ROLL = rollingMarker("leap-seconds");
  /** D2 removable and one oracle mismatch: two findings of one run. */
  const twoFindings = () =>
    withNative({
      "temporal-compat-check": check([workaround("D2", "removable")]),
      "temporal-oracle": oracle(1),
    });
  /** The findings marker an earlier run left, written out. */
  const findingsMarker = (pairs: [string, string][]) =>
    `<!-- gmt-canary findings=${JSON.stringify(pairs)} -->`;
  const rollingIssue = (
    number: number,
    pairs: [string, string][],
    marker_ = ROLL,
    labels = [CANARY_LABEL],
  ) => issue(number, `${marker_}\n${findingsMarker(pairs)}\nold`, labels);
  const bothPairs: [string, string][] = [
    [D2_KEY, D2_TITLE],
    ["temporal-oracle/untagged-mismatch", MISMATCH_TITLE],
  ];
  const run = (verdicts: unknown, open: ReturnType<typeof issue>[] = []) =>
    planIssueActions(verdicts as never, open, ORACLE_CONTEXT);

  it("writes the hidden markers", () => {
    expect(rollingMarker("leap-seconds")).toBe(
      '<!-- gmt-canary rolling="leap-seconds" -->',
    );
    expect(foldedComment(540)).toBe(
      "The canary now files one issue for each run. Its findings are in #540. Closing this issue.",
    );
  });

  it("a clean run with nothing open does nothing", () => {
    expect(
      run(
        withNative({
          "temporal-compat-check": cleanCheck(),
          "temporal-oracle": oracle(),
        }),
      ),
    ).toEqual([]);
  });

  it("opens one issue holding every finding of the run, in sections", () => {
    const actions = run(twoFindings());
    expect(actions).toHaveLength(1);
    const [action] = actions;
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.key).toBe("temporal-oracle");
    expect(action.title).toBe("Canary findings: temporal-oracle");
    expect(action.labels).toEqual(["canary", "temporal-compat"]);
    expect(action.findings).toEqual([
      D2_KEY,
      "temporal-oracle/untagged-mismatch",
    ]);
    const lines = action.body.split("\n");
    expect(lines[0]).toBe(ROLL);
    expect(lines[1]).toBe(findingsMarker(bothPairs));
    expect(lines[2]).toBe(
      "This issue lists every finding from the latest run of the `temporal-oracle` canary. A failing run rewrites it and adds a comment. A clean run closes it.",
    );
    expect(lines[4]).toBe(`Latest run: ${RUN}`);
    expect(action.body).toContain(`\n## ${D2_TITLE}\n\n`);
    expect(action.body).toContain(`\n## ${MISMATCH_TITLE}\n\n`);
    expect(action.body.indexOf(`## ${D2_TITLE}`)).toBeLessThan(
      action.body.indexOf(`## ${MISMATCH_TITLE}`),
    );
    expect(action.body).toContain("### Engines");
    expect(action.body).toContain("### Groups");
  });

  it("names the run once, not once per section", () => {
    const [action] = run(twoFindings());
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body.match(/Run: /g)).toBeNull();
    expect(action.body.match(new RegExp(RUN, "g"))).toHaveLength(1);
  });

  it("reads a title that was stored with its angle brackets escaped", () => {
    const stored = `${ROLL}\n<!-- gmt-canary findings=[["k/old","A --\\u003e B"]] -->\nold`;
    const [, comment] = run(twoFindings(), [issue(77, stored)]);
    expect(comment).toMatchObject({
      body: expect.stringContaining("1 gone (A --> B)"),
    });
    const [action] = run(twoFindings());
    if (action.kind !== "open") throw new Error("expected open");
    expect(action.body.split("\n")[1]).not.toMatch(/-->.+-->/);
  });

  it("rewrites the open rolling issue and comments with what changed", () => {
    const actions = run(twoFindings(), [rollingIssue(77, bothPairs)]);
    expect(actions.map((a) => a.kind)).toEqual(["edit", "comment"]);
    const [edit, comment] = actions;
    if (edit.kind !== "edit" || comment.kind !== "comment")
      throw new Error("x");
    expect(edit).toMatchObject({
      key: "temporal-oracle",
      issue: 77,
      title: "Canary findings: temporal-oracle",
      labels: ["canary", "temporal-compat"],
      removeLabels: [],
    });
    expect(edit.body.split("\n")[0]).toBe(ROLL);
    expect(edit.body).toContain(`## ${D2_TITLE}`);
    expect(comment).toEqual({
      kind: "comment",
      key: "temporal-oracle",
      issue: 77,
      body: `Since the last run: 2 still there.\n\nRun: ${RUN}`,
    });
  });

  it("removes a canary label no finding of this run carries, and keeps a person's label", () => {
    const [edit] = run(
      withNative({
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": couldNotRun("temporal-oracle", "no Temporal"),
      }),
      [
        rollingIssue(77, bothPairs, ROLL, [
          CANARY_LABEL,
          "temporal-compat",
          "priority",
        ]),
      ],
    );
    if (edit.kind !== "edit") throw new Error("expected edit");
    expect(edit.labels).toEqual(["canary"]);
    expect(edit.removeLabels).toEqual(["temporal-compat"]);
  });

  it("the comment names what is new, still there and gone", () => {
    const [, comment] = run(twoFindings(), [
      rollingIssue(77, [
        [D2_KEY, D2_TITLE],
        ["leap/old", "An old finding"],
        ["leap/older", "An older finding"],
      ]),
    ]);
    expect(comment).toMatchObject({
      kind: "comment",
      body: `Since the last run: 1 new (${MISMATCH_TITLE}), 1 still there, 2 gone (An old finding; An older finding).\n\nRun: ${RUN}`,
    });
  });

  it("the comment lists three titles at most", () => {
    const old: [string, string][] = ["a", "b", "c", "d", "e"].map((x) => [
      `k/${x}`,
      `Old ${x}`,
    ]);
    const [, comment] = run(twoFindings(), [rollingIssue(77, old)]);
    expect(comment).toMatchObject({
      body: `Since the last run: 2 new (${D2_TITLE}; ${MISMATCH_TITLE}), 5 gone (Old a; Old b; Old c; and 2 more).\n\nRun: ${RUN}`,
    });
  });

  it("an open rolling issue with no findings marker counts every finding as new", () => {
    const [, comment] = run(twoFindings(), [issue(77, `${ROLL}\nhand edited`)]);
    expect(comment).toMatchObject({
      body: `Since the last run: 2 new (${D2_TITLE}; ${MISMATCH_TITLE}).\n\nRun: ${RUN}`,
    });
  });

  it("an unreadable findings marker counts every finding as new", () => {
    const [, comment] = run(twoFindings(), [
      issue(77, `${ROLL}\n<!-- gmt-canary findings=[oops -->\nx`),
    ]);
    expect(comment).toMatchObject({
      body: expect.stringContaining("Since the last run: 2 new"),
    });
  });

  it("matches a CRLF body and the lowest number; ignores a marker on line 2 or without the canary label", () => {
    const crlf = issue(60, `${ROLL}\r\n${findingsMarker(bothPairs)}\r\nx`);
    expect(run(twoFindings(), [crlf]).map((a) => a.kind)).toEqual([
      "edit",
      "comment",
    ]);
    const two = run(twoFindings(), [
      rollingIssue(80, bothPairs),
      rollingIssue(50, bothPairs),
    ]);
    expect(
      two.map((a) => [
        a.kind,
        "issue" in a ? a.issue : 0,
        "reason" in a ? a.reason : "",
      ]),
    ).toEqual([
      ["edit", 50, ""],
      ["comment", 50, ""],
      ["close", 80, "folded"],
    ]);
    const late = issue(61, `intro\n${ROLL}`);
    expect(run(twoFindings(), [late]).map((a) => a.kind)).toEqual(["open"]);
    const unlabelled = rollingIssue(62, bothPairs, ROLL, ["temporal-compat"]);
    expect(run(twoFindings(), [unlabelled]).map((a) => a.kind)).toEqual([
      "open",
    ]);
  });

  it("another workflow's rolling issue is left alone", () => {
    const other = rollingIssue(90, [], LEAP_ROLL);
    expect(run(twoFindings(), [other]).map((a) => a.kind)).toEqual(["open"]);
  });

  it("a clean run comments that it was clean and closes the rolling issue", () => {
    const actions = run(
      withNative({
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": oracle(),
      }),
      [rollingIssue(77, bothPairs)],
    );
    expect(actions).toEqual([
      {
        kind: "close",
        key: "temporal-oracle",
        issue: 77,
        reason: "clean",
        body: `This run found nothing, so this issue is closed. A later run opens a new one if it finds something.\n\nRun: ${RUN}`,
      },
    ]);
  });

  describe("per-finding issues that are already open", () => {
    const legacy = (number: number, key: string) =>
      issue(number, `<!-- gmt-canary key="${key}" -->\nbody`);

    it("the first run opens the rolling issue, then closes each old issue as folded in", () => {
      const actions = run(twoFindings(), [
        legacy(539, D2_KEY),
        legacy(541, "native-suite/untagged-failure/node"),
        legacy(542, "temporal-polyfill-swap/ready"),
        legacy(543, "dry-run/temporal-oracle/could-not-run"),
      ]);
      expect(actions.map((a) => [a.kind, "issue" in a ? a.issue : 0])).toEqual([
        ["open", 0],
        ["close", 539],
        ["close", 541],
        ["close", 542],
      ]);
      expect(actions[1]).toEqual({
        kind: "close",
        key: "temporal-oracle",
        issue: 539,
        reason: "folded",
      });
    });

    it("an old issue is folded in beside an open rolling issue too", () => {
      const actions = run(twoFindings(), [
        rollingIssue(77, bothPairs),
        legacy(539, D2_KEY),
      ]);
      expect(actions.map((a) => a.kind)).toEqual(["edit", "comment", "close"]);
    });

    it("the old issues of another workflow stay open", () => {
      const actions = run(twoFindings(), [
        legacy(30, "leap-seconds/table-difference"),
        legacy(31, "us-clock-watch/federal"),
      ]);
      expect(actions.map((a) => a.kind)).toEqual(["open"]);
    });

    it("a clean run closes the old issues as clean", () => {
      const actions = run(
        withNative({
          "temporal-compat-check": cleanCheck(),
          "temporal-oracle": oracle(),
        }),
        [legacy(539, D2_KEY)],
      );
      expect(actions).toEqual([
        {
          kind: "close",
          key: "temporal-oracle",
          issue: 539,
          reason: "clean",
          body: `This run found nothing, so this issue is closed. A later run opens a new one if it finds something.\n\nRun: ${RUN}`,
        },
      ]);
    });

    it("a per-finding issue without the canary label is not touched", () => {
      const other = issue(40, `<!-- gmt-canary key="${D2_KEY}" -->\nx`, [
        "bug",
      ]);
      expect(run(twoFindings(), [other]).map((a) => a.kind)).toEqual(["open"]);
    });

    it("the leap-seconds and us-clock-watch workflows fold their own old issues", () => {
      const leapActions = planIssueActions(
        { "leap-seconds": leap(["row 29"]) } as never,
        [legacy(30, "leap-seconds/table-difference")],
        LEAP_CONTEXT,
      );
      expect(leapActions.map((a) => a.kind)).toEqual(["open", "close"]);
      const watch = planIssueActions(
        { "us-clock-watch": couldNotRun("us-clock-watch", "x") } as never,
        [
          legacy(31, "us-clock-watch/tz-us-zone"),
          legacy(32, "temporal-oracle/could-not-run"),
        ],
        { workflow: "us-clock-watch", runUrl: RUN },
      );
      expect(watch.map((a) => [a.kind, "issue" in a ? a.issue : 0])).toEqual([
        ["open", 0],
        ["close", 31],
      ]);
    });
  });

  describe("dry runs", () => {
    const forced = () =>
      applyForce(
        withNative({
          "temporal-compat-check": check([workaround("D2", "still-needed")]),
          "temporal-oracle": oracle(),
        }),
        { removable: "D2" },
      ).verdicts;
    const DRY_ROLL = rollingMarker("dry-run/temporal-oracle");

    it("a forced finding goes to its own rolling issue, apart from the real one", () => {
      const actions = run({
        ...forced(),
        "temporal-oracle": oracle(1),
      });
      expect(actions.map((a) => [a.kind, a.key])).toEqual([
        ["open", "temporal-oracle"],
        ["open", "dry-run/temporal-oracle"],
      ]);
      const dry = actions[1];
      if (dry.kind !== "open") throw new Error("expected open");
      expect(dry.title).toBe("[dry run] Canary findings: temporal-oracle");
      expect(dry.labels).toEqual(["canary", "canary-dry-run"]);
      expect(dry.body.split("\n")[0]).toBe(DRY_ROLL);
      expect(dry.body).toContain("--force-removable=D2");
    });

    it("a clean real run never closes an open dry-run issue", () => {
      const actions = run(
        withNative({
          "temporal-compat-check": cleanCheck(),
          "temporal-oracle": oracle(),
        }),
        [rollingIssue(70, [], DRY_ROLL, ["canary", "canary-dry-run"])],
      );
      expect(actions).toEqual([]);
    });

    it("an open dry-run issue is rewritten and commented on, while a clean real group closes its own issue", () => {
      const actions = run(forced(), [
        rollingIssue(70, [], DRY_ROLL, ["canary", "canary-dry-run"]),
        rollingIssue(71, bothPairs),
      ]);
      expect(actions.map((a) => [a.kind, "issue" in a ? a.issue : 0])).toEqual([
        ["close", 71],
        ["edit", 70],
        ["comment", 70],
      ]);
    });
  });

  describe("the 65,536-character limit", () => {
    const big = (n: number, size: number) =>
      withNative({
        "leap-seconds": leap(
          Array.from({ length: n }, (_, i) => `row ${i}: ${"x".repeat(size)}`),
        ),
      });

    it("a body that fits is kept whole", () => {
      const [action] = planIssueActions(big(3, 20), [], LEAP_CONTEXT);
      expect(action.body).not.toContain("Cut to fit");
    });

    it("cuts the section that does not fit and says so in the body", () => {
      const [action] = planIssueActions(big(2000, 100), [], LEAP_CONTEXT);
      if (action.kind !== "open") throw new Error("expected open");
      expect(action.body.length).toBeLessThanOrEqual(65_536);
      expect(action.body).toContain(
        `Cut to fit GitHub's 65,536-character limit: ${LEAP_TITLE}. The full result is in the run: ${RUN}`,
      );
      expect(action.body).toContain("- row 0: ");
      expect(action.body).not.toContain("- row 1999: ");
    });

    it("shares the room fairly: a short section stays whole beside a huge one", () => {
      const verdicts = withNative({
        "temporal-compat-check": check([workaround("D2", "removable")]),
        "temporal-oracle": couldNotRun("temporal-oracle", "x".repeat(200_000)),
      });
      const [small] = findings(verdicts, ORACLE_CONTEXT);
      const [action] = planIssueActions(verdicts, [], ORACLE_CONTEXT);
      if (action.kind !== "open") throw new Error("expected open");
      expect(action.body.length).toBeLessThanOrEqual(65_536);
      expect(action.body).toContain(small.body.replace(/\n\nRun: .*$/, ""));
      expect(action.body).toContain(
        `Cut to fit GitHub's 65,536-character limit: Canary temporal-oracle could not run.`,
      );
    });

    it("cuts the same way on every run", () => {
      const a = planIssueActions(big(2000, 100), [], LEAP_CONTEXT);
      const b = planIssueActions(big(2000, 100), [], LEAP_CONTEXT);
      expect(a).toEqual(b);
    });
  });
});

describe("event findings: a change reported once stays until a person closes the issue", () => {
  const CTX = { workflow: "us-clock-watch", runUrl: RUN } as const;
  const ROLL = rollingMarker("us-clock-watch");
  const ran = (differences: string[] = []) => ({
    status: "ran" as const,
    differences,
  });
  const watch = (federal: string[] = [], state: string[] = []) => ({
    source: "us-clock-watch" as const,
    status: "ran" as const,
    federal: ran(federal),
    state: ran(state),
    tz: { ...ran(), release: "2026f", snapshotRelease: "2026e" },
  });
  const plan = (verdict: unknown, open: ReturnType<typeof issue>[] = []) =>
    planIssueActions({ "us-clock-watch": verdict } as never, open, CTX);
  /** The issue the first run opens, as GitHub would hold it. */
  const openedBy = (verdict: unknown, number = 70) => {
    const [first] = plan(verdict);
    if (first?.kind !== "open") throw new Error("expected open");
    return issue(number, first.body, [CANARY_LABEL]);
  };
  const edited = (actions: ReturnType<typeof plan>) => {
    const edit = actions.find((a) => a.kind === "edit");
    if (edit?.kind !== "edit") throw new Error("expected edit");
    return edit;
  };

  it("the first run opens the issue and stores the lines in a hidden marker", () => {
    const [open] = plan(watch(["bill A advanced"]));
    if (open?.kind !== "open") throw new Error("expected open");
    expect(open.findings).toEqual(["us-clock-watch/federal"]);
    expect(open.body).toContain("<!-- gmt-canary events=");
    expect(open.body).toContain("- bill A advanced");
  });

  it("a clean run keeps an issue that lists an event: it rewrites the body and comments", () => {
    const open = openedBy(watch(["bill A advanced"]));
    const actions = plan(watch(), [open]);
    expect(actions.map((a) => a.kind)).toEqual(["edit", "comment"]);
    const edit = edited(actions);
    expect(edit.findings).toEqual(["us-clock-watch/federal"]);
    expect(edit.body).toContain("- bill A advanced");
    expect(edit.body).toContain("<!-- gmt-canary events=");
    expect(edit.body.split("\n")[0]).toBe(ROLL);
  });

  it("a run with a different new event adds it and keeps the earlier one", () => {
    const open = openedBy(watch(["bill A advanced"]));
    const actions = plan(watch(["bill B introduced"]), [open]);
    const edit = edited(actions);
    expect(edit.body).toContain("- bill A advanced\n- bill B introduced");
    const comment = actions.find((a) => a.kind === "comment");
    expect(comment?.body).toContain("1 new (Federal bills");
  });

  it("an event on another source joins the list; a line seen twice is kept once", () => {
    const open = openedBy(watch(["bill A advanced"]));
    const actions = plan(watch(["bill A advanced"], ["state bill C"]), [open]);
    const edit = edited(actions);
    expect(edit.findings).toEqual([
      "us-clock-watch/federal",
      "us-clock-watch/state",
    ]);
    expect(edit.body.match(/- bill A advanced/g)).toHaveLength(1);
    expect(edit.body).toContain("- state bill C");
  });

  it("a repeated line is still there, not new", () => {
    const open = openedBy(watch(["bill A advanced"]));
    const comment = plan(watch(["bill A advanced"]), [open]).find(
      (a) => a.kind === "comment",
    );
    expect(comment?.body).toContain("Since the last run: 1 still there.");
  });

  it("state findings still drop once gone, even beside a kept event", () => {
    const open = openedBy(watch(["bill A advanced"]));
    const withTz = {
      ...watch(),
      tz: {
        ...ran(["Rule changed"]),
        release: "2026f",
        snapshotRelease: "2026e",
      },
    };
    const first = plan(withTz, [open]);
    expect(edited(first).findings).toEqual([
      "us-clock-watch/tz-us-zone",
      "us-clock-watch/federal",
    ]);
    const tzIssue = issue(70, edited(first).body, [CANARY_LABEL]);
    const next = plan(watch(), [tzIssue]);
    expect(edited(next).findings).toEqual(["us-clock-watch/federal"]);
    expect(edited(next).body).not.toContain("Rule changed");
    const comment = next.find((a) => a.kind === "comment");
    expect(comment?.body).toContain("1 gone");
  });

  it("a clean run with no event on the issue closes it", () => {
    const stateOnly = {
      ...watch(),
      tz: {
        ...ran(["Rule changed"]),
        release: "2026f",
        snapshotRelease: "2026e",
      },
    };
    const open = openedBy(stateOnly);
    const actions = plan(watch(), [open]);
    expect(actions.map((a) => a.kind)).toEqual(["close"]);
  });

  it("a person closing the issue clears the events: the next run opens a fresh one", () => {
    expect(plan(watch(["bill D"])).map((a) => a.kind)).toEqual(["open"]);
    expect(plan(watch())).toEqual([]);
  });

  it("the old per-finding issue of an event key is left open", () => {
    const old = issue(
      31,
      '<!-- gmt-canary key="us-clock-watch/federal" -->\nold',
      [CANARY_LABEL],
    );
    expect(plan(watch(["bill A"]), [old]).map((a) => a.kind)).toEqual(["open"]);
    expect(plan(watch(), [old])).toEqual([]);
  });

  it("a duplicate rolling issue's events are merged in before it is folded", () => {
    const a = openedBy(watch(["bill A"]), 70);
    const b = openedBy(watch(["bill B"]), 71);
    const actions = plan(watch(), [a, b]);
    const edit = edited(actions);
    expect(edit.body).toContain("- bill A\n- bill B");
    expect(actions.map((x) => x.kind)).toEqual(["edit", "comment", "close"]);
  });

  it("lines that pass the stored budget drop oldest first, and the body says so", () => {
    let open = openedBy(watch(["line 0"]));
    for (let i = 1; i <= 40; i++) {
      const edit = edited(
        plan(watch([`line ${i} ${"x".repeat(1_900)}`]), [open]),
      );
      open = issue(70, edit.body, [CANARY_LABEL]);
    }
    const final = edited(plan(watch(), [open]));
    expect(final.body.length).toBeLessThanOrEqual(BODY_LIMIT);
    expect(final.body).toContain("Older lines dropped to fit GitHub's");
    expect(final.body).not.toContain("- line 0\n");
    expect(final.body).toContain("line 40 ");
  });

  it("an unreadable events marker is treated as no events", () => {
    const broken = issue(
      70,
      `${ROLL}\n<!-- gmt-canary events=[oops] -->\nold`,
      [CANARY_LABEL],
    );
    expect(plan(watch(), [broken]).map((a) => a.kind)).toEqual(["close"]);
  });
});
