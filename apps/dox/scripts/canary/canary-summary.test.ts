import { summaryMarkdown } from "../../../../scripts/lib/canary-summary.mjs";

/**
 * CORE-81 job summary. Every expected string is written out here, never read back from the
 * module. Fixtures are hand-written verdicts in the verdict-file schemas.
 */

const RUNTIME = { polyfill: "1.0.8", node: "v24.11.0", icu: "77.1" };

const stillNeededWorkaround = {
  id: "D16",
  defects: ["D16"],
  title: "D16 — range drops zone-name widths",
  trigger: "trigger",
  state: "still-needed",
  probes: 2,
  failing: 1,
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
  engineId: "v8",
  runtime: RUNTIME,
  counts: { workarounds: 16, outOfScope: 0, ...counts },
  snapshot: { path: "apps/dox/src/data/temporal-compat.json", current },
  workarounds,
});

const cleanCheck = () =>
  check([stillNeededWorkaround], { stillNeeded: 15, removable: 0 });

const BROWSER_ENGINE_IDS: Record<string, string> = {
  chromium: "v8",
  firefox: "firefox",
  webkit: "webkit",
};

/** The compat check's verdict in one browser: the same probes, no snapshot. */
const compat = (
  leg: string,
  workarounds: unknown[],
  counts: Record<string, number>,
) => ({
  source: `temporal-compat-${leg}`,
  status: "ran",
  leg,
  engine: ENGINES[leg],
  engineId: BROWSER_ENGINE_IDS[leg],
  runtime: { polyfill: "1.0.8", node: "v26.10.0", playwright: "1.63.0" },
  counts: { workarounds: 16, outOfScope: 0, ...counts },
  workarounds,
});

const cleanCompat = () =>
  Object.fromEntries(
    ["chromium", "firefox", "webkit"].map((leg) => [
      `temporal-compat-${leg}`,
      compat(leg, [stillNeededWorkaround], {
        stillNeeded: 15,
        removable: 0,
      }),
    ]),
  );

/** Every compat source, Node and the three browsers, with the same workaround rows. */
const compatEverywhere = (
  workarounds: unknown[],
  counts: Record<string, number>,
) => ({
  "temporal-compat-check": check(workarounds, counts),
  ...Object.fromEntries(
    ["chromium", "firefox", "webkit"].map((leg) => [
      `temporal-compat-${leg}`,
      compat(leg, workarounds, counts),
    ]),
  ),
});

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
  from: "IERS Leap_Second.dat",
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
  webkit: "WebKit 26.6",
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
    controlOnly: 0,
    staleTags: 0,
  },
  tagged: [],
  untagged: [],
  untaggedTruncated: false,
  hostTagged: [],
  hostUntagged: [],
  hostUntaggedTruncated: false,
  controlOnly: [],
  controlOnlyTruncated: false,
  staleTags: [],
  ...over,
});

const cleanNative = () => ({
  "native-suite-node": native("node"),
  "native-suite-chromium": native("chromium"),
  "native-suite-firefox": native("firefox"),
  "native-suite-webkit": native("webkit"),
});

const swapSweep = (differingZones = 0) => ({
  status: "ran",
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

const swap = (leg: string, over: Record<string, unknown> = {}) => ({
  source: `temporal-polyfill-swap-${leg}`,
  status: "ran",
  leg,
  version: "1.0.7",
  pinned: "1.0.6",
  entry: "temporal-polyfill-candidate/full/implementation",
  entryLoaded: true,
  runtime: {
    node: "26.12.1",
    vitest: "5.0.5",
    playwright: leg === "node" ? null : "1.63.0",
    browser: leg === "node" ? null : `${leg} 1.0`,
  },
  counts: {
    files: 943,
    tests: 71337,
    passed: 71337,
    skipped: 0,
    failed: 0,
    both: 0,
    fixed: 0,
  },
  failing: [],
  failingTruncated: false,
  sweep: leg === "node" ? swapSweep() : null,
  ...over,
});

const cleanSwap = () => ({
  "temporal-polyfill-swap-node": swap("node"),
  "temporal-polyfill-swap-chromium": swap("chromium"),
  "temporal-polyfill-swap-firefox": swap("firefox"),
  "temporal-polyfill-swap-webkit": swap("webkit"),
});

const clean = () => ({
  "temporal-compat-check": cleanCheck(),
  ...cleanCompat(),
  "temporal-oracle": oracle(),
  ...cleanNative(),
  ...cleanSwap(),
});

const SWAP_BLOCK = [
  "### Temporal polyfill upgrade check",
  "",
  "temporal-polyfill 1.0.7 — Ready to raise the pin",
  "",
  "| Runtime | Tests | Fail on candidate only | Fail on both |",
  "| --- | --- | --- | --- |",
  "| node | 71337 | 0 | 0 |",
  "| chromium | 71337 | 0 | 0 |",
  "| firefox | 71337 | 0 | 0 |",
  "| webkit | 71337 | 0 | 0 |",
  "",
  "Offset sweep: 0 zones differ (418 zones, 1970-01-01 to 2036-11-04, tz 2026e).",
];

const CLEAN_SUMMARY = [
  "## Temporal oracle",
  "",
  "temporal-polyfill 1.0.8 · Node v24.11.0 · ICU 77.1 · Chromium 152.0.7444.0",
  "",
  "| Workarounds | Count |",
  "| --- | --- |",
  "| Still needed | 15 |",
  "| Removable | 0 |",
  "",
  "| Compat source | Engine | Still needed | Removable | Out of scope |",
  "| --- | --- | --- | --- | --- |",
  "| temporal-compat-check | Node v24.11.0 (v8) | 15 | 0 | 0 |",
  "| temporal-compat-chromium | Chromium 153.0.8010.12 (v8) | 15 | 0 | 0 |",
  "| temporal-compat-firefox | Firefox 155.0 (firefox) | 15 | 0 | 0 |",
  "| temporal-compat-webkit | WebKit 26.6 (webkit) | 15 | 0 | 0 |",
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
  "| Leg | Engine | Tests | Passed | Tagged | Untagged | Host tagged | Host untagged | Control only | Stale tags |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  "| node | Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 | 0 |",
  "| chromium | Chromium 153.0.8010.12 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 | 0 |",
  "| firefox | Firefox 155.0 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 | 0 |",
  "| webkit | WebKit 26.6 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 | 0 |",
  "",
  ...SWAP_BLOCK,
  "",
  "**Issues:** No issues filed.",
  "",
].join("\n");

describe("summaryMarkdown: temporal-oracle", () => {
  it("clean oracle run: the whole layout", () => {
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
      "| chromium | could not run — playwright is not installed \\| try pnpm install |  |  |  |  |  |  |  |  |",
    );
    expect(text.split("\n")).toContain(
      "| firefox | Firefox 155.0 | 61613 | 61600 | 3 | 0 | 0 | 0 | 0 | 0 |",
    );
  });

  it("a leg with no verdict file is a could-not-run row", () => {
    const verdicts: Record<string, unknown> = clean();
    verdicts["native-suite-firefox"] = null;
    expect(oracleSummary(verdicts).split("\n")).toContain(
      "| firefox | could not run — no verdict file: an earlier step or job failed |  |  |  |  |  |  |  |  |",
    );
  });

  it("untagged, host, control-only and stale counts print as the verdict holds them", () => {
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
          controlOnly: 6,
          staleTags: 1,
        },
      }),
    });
    expect(text.split("\n")).toContain(
      "| node | Node v26.10.0 · V8 14.6.202.34-node.34 · ICU 78.3 · tz 2026c | 61613 | 61590 | 3 | 2 | 4 | 5 | 6 | 1 |",
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

  it("two groups removable on every engine list their ids in script order", () => {
    const verdicts = {
      ...compatEverywhere(
        [
          removableWorkaround("D2"),
          stillNeededWorkaround,
          { ...removableWorkaround("D5"), state: "still-needed", failing: 2 },
          removableWorkaround("D8"),
        ],
        { stillNeeded: 13, removable: 2 },
      ),
      "temporal-oracle": oracle(),
    };
    const text = oracleSummary(verdicts);
    expect(text.split("\n")).toContain(
      "Removable on every engine in scope: D2, D8",
    );
    expect(text).not.toContain("Removable on some engines only");
    expect(text).toContain("| Removable | 2 |");
    expect(text).toContain("| Still needed | 13 |");
    expect(text).toContain(
      "| temporal-compat-webkit | WebKit 26.6 (webkit) | 13 | 2 | 0 |",
    );
  });

  it("a group removable on the Node check alone is removable on some engines only, and names each engine's state", () => {
    const verdicts = {
      "temporal-compat-check": check([removableWorkaround("D2")], {
        stillNeeded: 15,
        removable: 1,
      }),
      "temporal-compat-chromium": compat(
        "chromium",
        [{ ...removableWorkaround("D2"), state: "still-needed", failing: 2 }],
        { stillNeeded: 16, removable: 0 },
      ),
      "temporal-compat-firefox": {
        source: "temporal-compat-firefox",
        status: "could-not-run",
        message: "the compat page failed in firefox: boom",
      },
      "temporal-oracle": oracle(),
    };
    const lines = oracleSummary(verdicts).split("\n");
    expect(lines).not.toContain("Removable on every engine in scope: D2");
    expect(lines).toContain(
      "Removable on some engines only: D2 (Node v24.11.0: removable; Chromium 153.0.8010.12: still needed, 2 of 2 probes fail; temporal-compat-firefox: no verdict; temporal-compat-webkit: no verdict)",
    );
    expect(lines).toContain(
      "| temporal-compat-firefox | could not run — the compat page failed in firefox: boom | — | — | — |",
    );
    expect(lines).toContain(
      "| temporal-compat-webkit | could not run — no verdict file: an earlier step or job failed | — | — | — |",
    );
  });

  it("a Firefox-only group removable on Firefox and out of scope elsewhere is removable on every engine in scope", () => {
    const d17 = { ...removableWorkaround("D17"), engines: ["firefox"] };
    const elsewhere = { ...d17, state: "out-of-scope" };
    const verdicts = {
      "temporal-compat-check": check([elsewhere], {
        stillNeeded: 15,
        removable: 0,
        outOfScope: 1,
      }),
      "temporal-compat-chromium": compat("chromium", [elsewhere], {
        stillNeeded: 15,
        removable: 0,
        outOfScope: 1,
      }),
      "temporal-compat-firefox": compat("firefox", [d17], {
        stillNeeded: 15,
        removable: 1,
      }),
      "temporal-compat-webkit": compat("webkit", [elsewhere], {
        stillNeeded: 15,
        removable: 0,
        outOfScope: 1,
      }),
      "temporal-oracle": oracle(),
    };
    const lines = oracleSummary(verdicts).split("\n");
    expect(lines).toContain("Removable on every engine in scope: D17");
    expect(lines).toContain(
      "| temporal-compat-check | Node v24.11.0 (v8) | 15 | 0 | 1 |",
    );
    expect(lines).toContain(
      "| temporal-compat-firefox | Firefox 155.0 (firefox) | 15 | 1 | 0 |",
    );
  });

  it("a Firefox-only group removable on Firefox but failing on WebKit is removable on some engines only", () => {
    const d17 = { ...removableWorkaround("D17"), engines: ["firefox"] };
    const elsewhere = { ...d17, state: "out-of-scope" };
    const failing = { ...d17, state: "still-needed", failing: 2 };
    const verdicts = {
      "temporal-compat-check": check([elsewhere], {
        stillNeeded: 15,
        removable: 0,
        outOfScope: 1,
      }),
      "temporal-compat-chromium": compat("chromium", [elsewhere], {
        stillNeeded: 15,
        removable: 0,
        outOfScope: 1,
      }),
      "temporal-compat-firefox": compat("firefox", [d17], {
        stillNeeded: 15,
        removable: 1,
      }),
      "temporal-compat-webkit": compat("webkit", [failing], {
        stillNeeded: 16,
        removable: 0,
      }),
      "temporal-oracle": oracle(),
    };
    const lines = oracleSummary(verdicts).split("\n");
    expect(lines).not.toContain("Removable on every engine in scope: D17");
    expect(lines).toContain(
      "Removable on some engines only: D17 (Firefox 155.0: removable; WebKit 26.6: still needed, 2 of 2 probes fail)",
    );
  });

  it("a Firefox-only group with no Firefox verdict is not removable anywhere, and is not listed as removable on some engines", () => {
    const d17 = { ...removableWorkaround("D17"), engines: ["firefox"] };
    const elsewhere = { ...d17, state: "out-of-scope" };
    const text = oracleSummary({
      "temporal-compat-check": check([elsewhere], {
        stillNeeded: 15,
        removable: 0,
        outOfScope: 1,
      }),
      "temporal-oracle": oracle(),
    });
    expect(text).not.toContain("Removable on");
  });

  it("a stale snapshot says to run pnpm compat:snapshot", () => {
    const verdicts = {
      "temporal-compat-check": check(
        [stillNeededWorkaround],
        { stillNeeded: 15, removable: 0 },
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
      "temporal-polyfill 1.0.8 · Node v24.11.0 · ICU 77.1 · Chromium 152.0.7444.0",
    );
  });

  it("forced removable D2 on a clean run keeps the counts and names the flag", () => {
    const text = oracleSummary(clean(), { removable: "D2" });
    expect(text.split("\n")).toContain("**Dry run:** --force-removable=D2");
    expect(text).toContain("| Removable | 0 |");
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

describe("summaryMarkdown: temporal polyfill swap", () => {
  const block = (text: string) => {
    const start = text.indexOf("### Temporal polyfill upgrade check");
    const end = text.indexOf("\n\n**", start);
    return text.slice(start, end === -1 ? undefined : end);
  };
  const swapOnly = (over: Record<string, unknown>) =>
    block(oracleSummary({ ...clean(), ...over }));

  it("a ready run says Ready to raise the pin, with the version, a row per leg and the sweep line", () => {
    expect(block(oracleSummary(clean()))).toBe(SWAP_BLOCK.join("\n"));
  });

  it("swap legs skipped on purpose: the block says the pin is the newest release, with no Not ready line", () => {
    const {
      ["temporal-polyfill-swap-node"]: _n,
      ["temporal-polyfill-swap-chromium"]: _c,
      ["temporal-polyfill-swap-firefox"]: _f,
      ["temporal-polyfill-swap-webkit"]: _w,
      ...rest
    } = clean();
    const text = block(
      summaryMarkdown(
        "temporal-oracle",
        rest as never,
        {},
        [],
        undefined,
        [],
        true,
      ),
    );
    expect(text).toBe(
      "### Temporal polyfill upgrade check\n\nSkipped: the pinned temporal-polyfill is the newest release, so there is nothing to check.",
    );
  });

  it("a failing leg is not ready, with the reason, and its counts print", () => {
    const text = swapOnly({
      "temporal-polyfill-swap-webkit": swap("webkit", {
        counts: {
          files: 943,
          tests: 71337,
          passed: 71330,
          skipped: 0,
          failed: 5,
          both: 2,
          fixed: 0,
        },
      }),
    });
    expect(text).toContain(
      "temporal-polyfill 1.0.7 — Not ready: temporal-polyfill-swap-webkit: 5 tests fail on the candidate",
    );
    expect(text.split("\n")).toContain("| webkit | 71337 | 5 | 2 |");
  });

  it("a leg that could not run is a row with its message", () => {
    const text = swapOnly({
      "temporal-polyfill-swap-chromium": {
        source: "temporal-polyfill-swap-chromium",
        status: "could-not-run",
        message: "no browser |\n installed",
      },
    });
    expect(text.split("\n")).toContain(
      "| chromium | could not run: no browser \\| installed |  |  |",
    );
    expect(text).toContain(
      "— Not ready: temporal-polyfill-swap-chromium: did not run",
    );
  });

  it("a leg with no verdict is a no verdict row", () => {
    const text = swapOnly({ "temporal-polyfill-swap-firefox": null });
    expect(text.split("\n")).toContain("| firefox | no verdict |  |  |");
  });

  it("with no leg that ran, the version is left out", () => {
    const text = swapOnly(
      Object.fromEntries(
        ["node", "chromium", "firefox", "webkit"].map((leg) => [
          `temporal-polyfill-swap-${leg}`,
          null,
        ]),
      ),
    );
    expect(text).toContain(
      "temporal-polyfill — Not ready: temporal-polyfill-swap-node: did not run",
    );
    expect(text).toContain("Offset sweep: did not run.");
  });

  it("a differing sweep counts the zones and lists the first ten", () => {
    const text = swapOnly({
      "temporal-polyfill-swap-node": swap("node", { sweep: swapSweep(12) }),
    });
    expect(text).toContain(
      "Offset sweep: 12 zones differ (418 zones, 1970-01-01 to 2036-11-04, tz 2026e).",
    );
    expect(text).toContain(
      "Zones: Area/Zone1 (1 day), Area/Zone2 (2 days), Area/Zone3 (3 days), Area/Zone4 (4 days), Area/Zone5 (5 days), Area/Zone6 (6 days), Area/Zone7 (7 days), Area/Zone8 (8 days), Area/Zone9 (9 days), Area/Zone10 (10 days)",
    );
    expect(text).not.toContain("Area/Zone11");
    expect(text).toContain("— Not ready: offset sweep: 12 zones differ");
  });

  it("a node leg that could not run still prints the sweep it carries", () => {
    const text = swapOnly({
      "temporal-polyfill-swap-node": {
        source: "temporal-polyfill-swap-node",
        status: "could-not-run",
        message: "the control pass ran past its 18-minute limit",
        sweep: swapSweep(2),
      },
    });
    expect(text.split("\n")).toContain(
      "| node | could not run: the control pass ran past its 18-minute limit |  |  |",
    );
    expect(text).toContain(
      "Offset sweep: 2 zones differ (418 zones, 1970-01-01 to 2036-11-04, tz 2026e).",
    );
    expect(text).toContain("Zones: Area/Zone1 (1 day), Area/Zone2 (2 days)");
    expect(text).not.toContain("Offset sweep: did not run.");
  });

  it("a sweep that could not run says so", () => {
    const text = swapOnly({
      "temporal-polyfill-swap-node": swap("node", {
        sweep: { status: "could-not-run", message: "no longOffset" },
      }),
    });
    expect(text).toContain("Offset sweep: could not run: no longOffset");
  });

  it("the dry-run line lists --force-swap-ready", () => {
    const text = oracleSummary(clean(), { swapReady: true });
    expect(text.split("\n")).toContain("**Dry run:** --force-swap-ready");
  });

  it("the leap-seconds summary has no swap block", () => {
    expect(
      summaryMarkdown(
        "leap-seconds",
        { "leap-seconds": leap() } as never,
        {},
        [],
      ),
    ).not.toContain("Temporal polyfill swap");
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
        "Read from: IERS Leap_Second.dat",
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

  it("a run on the IANA fallback names IANA leap-seconds.list", () => {
    const text = leapSummary({ ...leap(), from: "IANA leap-seconds.list" });
    expect(text.split("\n")).toContain("Read from: IANA leap-seconds.list");
    expect(text).not.toContain("Read from: IERS");
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
    expect(text).not.toContain("Read from:");
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
