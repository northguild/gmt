import { summaryMarkdown } from "../../../../scripts/lib/canary-summary.mjs";

/**
 * CORE-81 job summary. Every expected string is written out here, never read back from the
 * module. Fixtures are hand-written verdicts in the verdict-file schemas.
 */

const RUNTIME = { polyfill: "0.5.1", node: "v24.11.0", icu: "77.1" };

const guardWorkaround = {
  id: "D10",
  defects: ["D10"],
  title: "D10 — fields to ISO skip a month",
  trigger: "trigger",
  state: "guard",
  probes: 2,
  failing: 0,
  guard: {
    package: "@js-temporal/polyfill",
    through: "0.5.1",
    reason: "no probe can tell",
    lapsed: false,
  },
  steps: ["step"],
};

const removableWorkaround = (id: string) => ({
  id,
  defects: [id],
  title: `${id} — summary`,
  trigger: "trigger",
  state: "removable",
  probes: 2,
  failing: 0,
  steps: ["step"],
});

const check = (
  workarounds: unknown[],
  counts: Record<string, number>,
  current = true,
) => ({
  source: "temporal-compat-check",
  status: "ran",
  runtime: RUNTIME,
  counts: { workarounds: 16, ...counts },
  snapshot: { path: "apps/dox/src/data/temporal-compat.json", current },
  workarounds,
});

const cleanCheck = () =>
  check([guardWorkaround], { stillNeeded: 15, removable: 0, guard: 1 });

const oracle = (untagged = 0) => ({
  source: "temporal-oracle",
  status: "ran",
  runtime: RUNTIME,
  chromium: "152.0.7444.0",
  calendars: ["hebrew"],
  counts: { comparisons: 410000, mismatches: untagged, tagged: 0, untagged },
  untaggedGroups: [],
  untagged: [],
  untaggedTruncated: false,
  report: "artifacts/temporal-oracle-2026-10-19.json",
});

const leap = (differences: string[] = []) => ({
  source: "leap-seconds",
  status: "ran",
  header: "Updated through IERS Bulletin C 72",
  rows: { gmt: 28, iers: 28 + differences.length },
  differences,
});

const oracleSummary = (
  verdicts: Record<string, unknown>,
  force = {},
  results: Parameters<typeof summaryMarkdown>[3] = [],
  reason?: string,
) =>
  summaryMarkdown("temporal-oracle", verdicts as never, force, results, reason);

const ENGINES: Record<string, string> = {
  node: "Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c",
  chromium: "Chromium 153.0.8010.12",
  firefox: "Firefox 155.0",
};

const native = (leg: string, over: Record<string, unknown> = {}) => ({
  source: `native-suite-${leg}`,
  status: "ran",
  leg,
  engine: ENGINES[leg],
  runtime: { node: "26.10.0", vitest: "4.1.4", playwright: null },
  counts: {
    files: 828,
    tests: 61613,
    passed: 61600,
    tagged: 3,
    untagged: 0,
    hostTagged: 0,
    hostUntagged: 0,
    staleTags: 0,
  },
  tagged: [],
  untagged: [],
  untaggedTruncated: false,
  hostTagged: [],
  hostUntagged: [],
  hostUntaggedTruncated: false,
  staleTags: [],
  ...over,
});

const cleanNative = () => ({
  "native-suite-node": native("node"),
  "native-suite-chromium": native("chromium"),
  "native-suite-firefox": native("firefox"),
});

const clean = () => ({
  "temporal-compat-check": cleanCheck(),
  "temporal-oracle": oracle(),
  ...cleanNative(),
});

const CLEAN_SUMMARY = [
  "## Temporal oracle",
  "",
  "@js-temporal/polyfill 0.5.1 · Node v24.11.0 · ICU 77.1 · Chromium 152.0.7444.0",
  "",
  "| Workarounds | Count |",
  "| --- | --- |",
  "| Still needed | 15 |",
  "| Removable | 0 |",
  "| Guard | 1 (D10, through @js-temporal/polyfill 0.5.1) |",
  "",
  "| Oracle | Count |",
  "| --- | --- |",
  "| Comparisons | 410000 |",
  "| Mismatches | 0 |",
  "| Tagged | 0 |",
  "| Untagged | 0 |",
  "",
  "Snapshot: current",
  "",
  "### Native Temporal suite",
  "",
  "| Leg | Engine | Tests | Passed | Tagged | Untagged | Host tagged | Host untagged | Stale tags |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  "| node | Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 |",
  "| chromium | Chromium 153.0.8010.12 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 |",
  "| firefox | Firefox 155.0 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 |",
  "",
  "**Issues:** No issues filed.",
  "",
].join("\n");

describe("summaryMarkdown: temporal-oracle", () => {
  it("clean oracle run with D10 guard: the whole layout", () => {
    expect(oracleSummary(clean())).toBe(CLEAN_SUMMARY);
  });

  it("a leg that could not run is a row with the message and empty counts", () => {
    const text = oracleSummary({
      ...clean(),
      "native-suite-chromium": {
        source: "native-suite-chromium",
        status: "could-not-run",
        message: "playwright is not installed | try pnpm install",
      },
    });
    expect(text.split("\n")).toContain(
      "| chromium | could not run — playwright is not installed \\| try pnpm install |  |  |  |  |  |  |  |",
    );
    expect(text.split("\n")).toContain(
      "| firefox | Firefox 155.0 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 |",
    );
  });

  it("a leg with no verdict file is a could-not-run row", () => {
    const verdicts: Record<string, unknown> = clean();
    verdicts["native-suite-firefox"] = null;
    expect(oracleSummary(verdicts).split("\n")).toContain(
      "| firefox | could not run — no verdict file: an earlier step or job failed |  |  |  |  |  |  |  |",
    );
  });

  it("untagged, host and stale counts print as the verdict holds them", () => {
    const text = oracleSummary({
      ...clean(),
      "native-suite-node": native("node", {
        counts: {
          files: 828,
          tests: 61613,
          passed: 61590,
          tagged: 3,
          untagged: 2,
          hostTagged: 4,
          hostUntagged: 5,
          staleTags: 1,
        },
      }),
    });
    expect(text.split("\n")).toContain(
      "| node | Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c | 61613 | 61590 | 3 | 2 | 4 | 5 | 1 |",
    );
  });

  it("host groups that matched get one line each, with engine, count and reason", () => {
    const text = oracleSummary({
      ...clean(),
      "native-suite-chromium": native("chromium", {
        hostTagged: [
          {
            group: "chromium-icelandic-locale-data",
            count: 101,
            reason: "Chromium ships no Icelandic locale data.",
          },
          {
            group: "chromium-other",
            count: 9,
            reason: "Chromium lacks another thing.",
          },
        ],
      }),
    });
    const lines = text.split("\n");
    expect(lines).toContain(
      "Chromium 153.0.8010.12: chromium-icelandic-locale-data — 101 tests (Chromium ships no Icelandic locale data.)",
    );
    expect(lines).toContain(
      "Chromium 153.0.8010.12: chromium-other — 9 tests (Chromium lacks another thing.)",
    );
  });

  it("no host line when no group matched", () => {
    expect(oracleSummary(clean())).not.toContain(" tests (");
  });

  it("the dry-run line lists --force-native-failure", () => {
    const text = oracleSummary(clean(), { nativeFailure: true });
    expect(text.split("\n")).toContain("**Dry run:** --force-native-failure");
  });

  it("two removable groups list their ids in script order", () => {
    const verdicts = {
      "temporal-compat-check": check(
        [
          removableWorkaround("D2"),
          guardWorkaround,
          { ...removableWorkaround("D5"), state: "still-needed", failing: 2 },
          removableWorkaround("D8"),
        ],
        { stillNeeded: 13, removable: 2, guard: 1 },
      ),
      "temporal-oracle": oracle(),
    };
    const text = oracleSummary(verdicts);
    expect(text.split("\n")).toContain("Removable: D2, D8");
    expect(text).toContain("| Removable | 2 |");
    expect(text).toContain("| Still needed | 13 |");
  });

  it("no guard: the Guard row is 0 with no parenthesis", () => {
    const verdicts = {
      "temporal-compat-check": check([], {
        stillNeeded: 16,
        removable: 0,
        guard: 0,
      }),
      "temporal-oracle": oracle(),
    };
    expect(oracleSummary(verdicts).split("\n")).toContain("| Guard | 0 |");
  });

  it("two guards list each id with its through", () => {
    const second = {
      ...guardWorkaround,
      id: "D12",
      guard: {
        ...guardWorkaround.guard,
        package: "temporal-spec",
        through: "1.2.3",
      },
    };
    const verdicts = {
      "temporal-compat-check": check([guardWorkaround, second], {
        stillNeeded: 14,
        removable: 0,
        guard: 2,
      }),
      "temporal-oracle": oracle(),
    };
    expect(oracleSummary(verdicts).split("\n")).toContain(
      "| Guard | 2 (D10, through @js-temporal/polyfill 0.5.1; D12, through temporal-spec 1.2.3) |",
    );
  });

  it("a stale snapshot says to run pnpm compat:snapshot", () => {
    const verdicts = {
      "temporal-compat-check": check(
        [guardWorkaround],
        { stillNeeded: 15, removable: 0, guard: 1 },
        false,
      ),
      "temporal-oracle": oracle(),
    };
    expect(oracleSummary(verdicts).split("\n")).toContain(
      "Snapshot: stale: run pnpm compat:snapshot",
    );
  });

  it("a null oracle verdict replaces its table and keeps the workaround table", () => {
    const text = oracleSummary({
      "temporal-compat-check": cleanCheck(),
      "temporal-oracle": null,
    });
    expect(text.split("\n")).toContain(
      "Oracle: could not run — no verdict file: an earlier step or job failed",
    );
    expect(text).toContain("| Still needed | 15 |");
    expect(text).not.toContain("| Oracle | Count |");
    expect(text).not.toContain("Chromium");
  });

  it("a could-not-run check replaces the workaround table and keeps the oracle table", () => {
    const text = oracleSummary({
      "temporal-compat-check": {
        source: "temporal-compat-check",
        status: "could-not-run",
        message: "packages/gmt/dist is missing: run pnpm build first",
      },
      "temporal-oracle": oracle(),
    });
    expect(text.split("\n")).toContain(
      "Workarounds: could not run — packages/gmt/dist is missing: run pnpm build first",
    );
    expect(text).not.toContain("| Workarounds | Count |");
    expect(text).not.toContain("Snapshot:");
    expect(text).toContain("| Comparisons | 410000 |");
    expect(text).toContain(
      "@js-temporal/polyfill 0.5.1 · Node v24.11.0 · ICU 77.1 · Chromium 152.0.7444.0",
    );
  });

  it("forced removable D2 on a clean run keeps the counts and names the flag", () => {
    const text = oracleSummary(clean(), { removable: "D2" });
    expect(text.split("\n")).toContain("**Dry run:** --force-removable=D2");
    expect(text).toContain("| Removable | 0 |");
    expect(text).toContain(
      "| Guard | 1 (D10, through @js-temporal/polyfill 0.5.1) |",
    );
    expect(text).not.toContain("Removable: D2");
  });

  it("forced mismatch keeps Untagged at 0 and names the flag", () => {
    const text = oracleSummary(clean(), { mismatch: true });
    expect(text.split("\n")).toContain("| Untagged | 0 |");
    expect(text.split("\n")).toContain("**Dry run:** --force-mismatch");
  });

  it("both forced flags are named together", () => {
    const text = oracleSummary(clean(), { removable: "D2", mismatch: true });
    expect(text.split("\n")).toContain(
      "**Dry run:** --force-removable=D2, --force-mismatch",
    );
  });

  it("no dry-run line without a forced flag", () => {
    expect(oracleSummary(clean())).not.toContain("Dry run");
  });

  it("a skipped flag says it was not applied and why, in place of the plain flag line", () => {
    const reason =
      "the temporal-oracle verdict is missing or did not run, so there is nothing to force against";
    const lines = summaryMarkdown(
      "temporal-oracle",
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": null,
      } as never,
      { mismatch: true },
      [],
      undefined,
      [{ flag: "--force-mismatch", reason }],
    ).split("\n");
    expect(lines).toContain(
      `**Dry run:** --force-mismatch not applied: ${reason}`,
    );
    expect(lines).not.toContain("**Dry run:** --force-mismatch");
  });

  it("with one flag applied and one skipped, both lines appear and the applied line names only the applied flag", () => {
    const lines = summaryMarkdown(
      "temporal-oracle",
      {
        "temporal-compat-check": cleanCheck(),
        "temporal-oracle": null,
      } as never,
      { removable: "D2", mismatch: true },
      [],
      undefined,
      [{ flag: "--force-mismatch", reason: "fixture reason" }],
    ).split("\n");
    expect(lines).toContain("**Dry run:** --force-removable=D2");
    expect(lines).toContain(
      "**Dry run:** --force-mismatch not applied: fixture reason",
    );
  });

  it("an opened and a commented issue are listed", () => {
    const text = oracleSummary(clean(), {}, [
      {
        action: {
          kind: "open",
          key: "temporal-compat/removable/D2",
          title: "Remove workaround D2: summary",
          labels: ["canary"],
          body: "b",
        },
        ok: true,
        issue: 412,
      },
      {
        action: {
          kind: "comment",
          key: "temporal-oracle/untagged-mismatch",
          issue: 398,
          body: "b",
        },
        ok: true,
      },
    ]);
    expect(text.split("\n")).toContain(
      "**Issues:** opened #412 (Remove workaround D2: summary); commented on #398.",
    );
  });

  it("a failed comment names the issue and the error", () => {
    const text = oracleSummary(clean(), {}, [
      {
        action: { kind: "comment", key: "k", issue: 398, body: "b" },
        ok: false,
        error: "HTTP 502\nbad gateway",
      },
    ]);
    expect(text.split("\n")).toContain(
      "**Issues:** failed to comment on #398: HTTP 502 bad gateway.",
    );
  });

  it("a failed open names the title and the error", () => {
    const text = oracleSummary(clean(), {}, [
      {
        action: {
          kind: "open",
          key: "k",
          title: "Remove workaround D2: summary",
          labels: ["canary"],
          body: "b",
        },
        ok: false,
        error: "label missing",
      },
    ]);
    expect(text.split("\n")).toContain(
      "**Issues:** failed to open (Remove workaround D2: summary): label missing.",
    );
  });

  it("null results under --print say not filed", () => {
    expect(oracleSummary(clean(), {}, null).split("\n")).toContain(
      "**Issues:** Not filed (--print).",
    );
  });

  it("null results with an applyForce message give that message", () => {
    const message =
      "--force-removable=D99: no workaround has that id; valid ids: D1, D2";
    expect(oracleSummary(clean(), {}, null, message).split("\n")).toContain(
      `**Issues:** Not filed: ${message}`,
    );
  });
});

describe("summaryMarkdown: leap-seconds", () => {
  const leapSummary = (
    verdict: unknown,
    force = {},
    results: Parameters<typeof summaryMarkdown>[3] = [],
  ) =>
    summaryMarkdown(
      "leap-seconds",
      { "leap-seconds": verdict } as never,
      force,
      results,
    );

  it("a clean run shows 28 / 28 / 0", () => {
    expect(leapSummary(leap())).toBe(
      [
        "## Leap-second canary",
        "",
        "IERS: Updated through IERS Bulletin C 72",
        "",
        "| Leap-second table | Count |",
        "| --- | --- |",
        "| GMT rows | 28 |",
        "| IERS rows | 28 |",
        "| Differences | 0 |",
        "",
        "**Issues:** No issues filed.",
        "",
      ].join("\n"),
    );
  });

  it("one difference gives Differences 1 and lists the difference after the table", () => {
    const text = leapSummary(leap(["row 29: fixture difference"]));
    expect(text).toContain("| IERS rows | 29 |");
    expect(text).toContain(
      "| Differences | 1 |\n\n- row 29: fixture difference\n\n**Issues:**",
    );
  });

  it("a null verdict says the table could not run", () => {
    expect(leapSummary(null).split("\n")).toContain(
      "Leap-second table: could not run — no verdict file: an earlier step or job failed",
    );
  });

  it("a could-not-run verdict keeps its message", () => {
    const text = leapSummary({
      source: "leap-seconds",
      status: "could-not-run",
      message: "cannot run: HTTP 503",
    });
    expect(text.split("\n")).toContain(
      "Leap-second table: could not run — cannot run: HTTP 503",
    );
    expect(text).not.toContain("IERS:");
  });

  it("a verdict without a header says the line is missing", () => {
    const text = leapSummary({
      ...leap(['IERS: no "Updated through" line']),
      header: null,
    });
    expect(text.split("\n")).toContain('IERS: no "Updated through" line');
  });

  it("a forced leap difference keeps the counts and names the flag", () => {
    const text = leapSummary(leap(), { leapDifference: true });
    expect(text.split("\n")).toContain("**Dry run:** --force-leap-difference");
    expect(text).toContain("| Differences | 0 |");
  });

  it("a skipped leap flag is reported as not applied beside the could-not-run line", () => {
    const text = summaryMarkdown(
      "leap-seconds",
      {
        "leap-seconds": {
          source: "leap-seconds",
          status: "could-not-run",
          message: "cannot run: HTTP 503",
        },
      } as never,
      { leapDifference: true },
      [],
      undefined,
      [{ flag: "--force-leap-difference", reason: "fixture reason" }],
    );
    expect(text.split("\n")).toContain(
      "**Dry run:** --force-leap-difference not applied: fixture reason",
    );
    expect(text).toContain(
      "Leap-second table: could not run — cannot run: HTTP 503",
    );
  });

  it("oracle flags are not shown on a leap summary", () => {
    const text = leapSummary(leap(), { mismatch: true, removable: "D2" });
    expect(text).not.toContain("Dry run");
  });
});
