import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ensureLabels,
  issueHistories,
  listOpenCanaryIssues,
  main,
  parseArgs,
  realGh,
  runActions,
} from "../../../../scripts/canary-report.mjs";

/**
 * CORE-81: the reporter CLI and its `gh` adapter. A fake `gh` records each call and returns
 * canned stdout; nothing here touches the network (the one exception, `realGh`, runs a stand-in
 * `gh` script from a temporary folder). Expected argument lists are written out from the GitHub CLI
 * manual, never read back from the script.
 */

type Call = { args: string[]; input?: string };

/** A `gh` runner that records calls; `reply` maps one call to stdout or throws. */
function fakeGh(reply: (args: string[], input?: string) => string = () => "") {
  const calls: Call[] = [];
  const gh = (args: string[], input?: string) => {
    calls.push({ args, input });
    return reply(args, input);
  };
  return { gh, calls };
}

describe("ensureLabels", () => {
  const labelList = (...names: string[]) =>
    JSON.stringify(names.map((name) => ({ name })));

  it("creates a missing canary label and leaves an existing temporal-compat label alone", () => {
    const { gh, calls } = fakeGh(() => labelList("temporal-compat"));
    ensureLabels(gh, ["canary", "temporal-compat"]);
    expect(calls.map((c) => c.args)).toEqual([
      ["label", "list", "--json", "name", "--limit", "1000"],
      [
        "label",
        "create",
        "canary",
        "--description",
        "Opened by a weekly canary workflow",
        "--color",
        "0e8a16",
      ],
    ]);
    expect(calls.flatMap((c) => c.args)).not.toContain("--force");
  });

  it("creates the dry-run label with its own description and colour", () => {
    const { gh, calls } = fakeGh(() => labelList("canary", "temporal-compat"));
    ensureLabels(gh, ["canary", "canary-dry-run"]);
    expect(calls.map((c) => c.args)).toEqual([
      ["label", "list", "--json", "name", "--limit", "1000"],
      [
        "label",
        "create",
        "canary-dry-run",
        "--description",
        "Opened by a forced dry run of a canary workflow; close once checked",
        "--color",
        "c5def5",
      ],
    ]);
  });

  it("makes only the list call when every label exists", () => {
    const { gh, calls } = fakeGh(() => labelList("canary", "temporal-compat"));
    ensureLabels(gh, ["canary", "temporal-compat"]);
    expect(calls.map((c) => c.args)).toEqual([
      ["label", "list", "--json", "name", "--limit", "1000"],
    ]);
  });

  it.each`
    existingName         | needed
    ${"Canary"}          | ${"canary"}
    ${"TEMPORAL-COMPAT"} | ${"temporal-compat"}
    ${"canary"}          | ${"CANARY"}
  `(
    "an existing $existingName label counts as $needed (GitHub names ignore case): no create call",
    ({ existingName, needed }: { existingName: string; needed: string }) => {
      const { gh, calls } = fakeGh(() => labelList(existingName));
      ensureLabels(gh, [needed]);
      expect(calls.map((c) => c.args)).toEqual([
        ["label", "list", "--json", "name", "--limit", "1000"],
      ]);
    },
  );

  it("creates a missing temporal-compat label with its description and colour", () => {
    const { gh, calls } = fakeGh(() => labelList("canary"));
    ensureLabels(gh, ["canary", "temporal-compat"]);
    expect(calls[1].args).toEqual([
      "label",
      "create",
      "temporal-compat",
      "--description",
      "GMT, a native Temporal engine and runtime data disagree; found by a canary",
      "--color",
      "5319e7",
    ]);
  });
});

describe("listOpenCanaryIssues", () => {
  it("asks for open canary issues and parses the JSON", () => {
    const rows = [{ number: 41, body: "b", labels: [{ name: "canary" }] }];
    const { gh, calls } = fakeGh(() => JSON.stringify(rows));
    expect(listOpenCanaryIssues(gh)).toEqual(rows);
    expect(calls.map((c) => c.args)).toEqual([
      [
        "issue",
        "list",
        "--label",
        "canary",
        "--state",
        "open",
        "--limit",
        "1000",
        "--json",
        "number,url,body,labels",
      ],
    ]);
  });
});

describe("issueHistories", () => {
  const comment = (issue: number) => ({
    kind: "comment" as const,
    key: "k",
    issue,
    body: "b",
  });
  const open = [
    {
      number: 12,
      url: "https://github.com/northguild/gmt/issues/12",
      body: "x",
    },
  ];

  it("reads every page of an issue's comments, once per issue", () => {
    const { gh, calls } = fakeGh(
      () =>
        '{"url":"https://github.com/northguild/gmt/issues/12#issuecomment-1","body":"one"}\n' +
        '{"url":"https://github.com/northguild/gmt/issues/12#issuecomment-2","body":"two\\nlines"}\n',
    );
    const histories = issueHistories(gh, [comment(12), comment(12)], open);
    expect(calls.map((c) => c.args)).toEqual([
      [
        "api",
        "--paginate",
        "repos/{owner}/{repo}/issues/12/comments",
        "--jq",
        ".[] | {url: .html_url, body: .body}",
      ],
    ]);
    expect(histories.get(12)).toEqual({
      url: "https://github.com/northguild/gmt/issues/12",
      body: "x",
      comments: [
        {
          url: "https://github.com/northguild/gmt/issues/12#issuecomment-1",
          body: "one",
        },
        {
          url: "https://github.com/northguild/gmt/issues/12#issuecomment-2",
          body: "two\nlines",
        },
      ],
    });
  });

  it("leaves out an issue whose comments cannot be read, and skips open actions", () => {
    const { gh, calls } = fakeGh(() => {
      throw new Error("HTTP 502");
    });
    const histories = issueHistories(
      gh,
      [
        comment(12),
        { kind: "open", key: "k", title: "t", labels: [], body: "b" },
      ],
      open,
    );
    expect(calls).toHaveLength(1);
    expect(histories.size).toBe(0);
  });
});

describe("runActions", () => {
  type Action = Parameters<typeof runActions>[1][number];
  const open: Action = {
    kind: "open",
    key: "k",
    title: "T",
    labels: ["canary", "temporal-compat"],
    body: "BODY",
  };
  const comment: Action = {
    kind: "comment",
    key: "k",
    issue: 41,
    body: "NOTE",
  };

  it("opens an issue with repeated labels and the body on stdin", () => {
    const { gh, calls } = fakeGh(
      () => "https://github.com/northguild/gmt/issues/88\n",
    );
    const results = runActions(gh, [open]);
    expect(calls).toEqual([
      {
        args: [
          "issue",
          "create",
          "--title",
          "T",
          "--type",
          "Task",
          "--label",
          "canary",
          "--label",
          "temporal-compat",
          "--body-file",
          "-",
        ],
        input: "BODY",
      },
    ]);
    expect(results).toEqual([{ action: open, ok: true, issue: 88 }]);
  });

  it("comments on the numbered issue with the body on stdin", () => {
    const { gh, calls } = fakeGh();
    const results = runActions(gh, [comment]);
    expect(calls).toEqual([
      {
        args: ["issue", "comment", "41", "--body-file", "-"],
        input: "NOTE",
      },
    ]);
    expect(results).toEqual([{ action: comment, ok: true, issue: 41 }]);
  });

  it("keeps going after a failed call and reports each result", () => {
    let n = 0;
    const { gh, calls } = fakeGh(() => {
      n += 1;
      if (n === 2) throw new Error("HTTP 502");
      return "https://github.com/northguild/gmt/issues/9";
    });
    const results = runActions(gh, [open, comment, open]);
    expect(calls).toHaveLength(3);
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results[1]).toEqual({
      action: comment,
      ok: false,
      error: "HTTP 502",
    });
  });

  it("fails an open whose output holds no issue number", () => {
    const { gh } = fakeGh(() => "created\n");
    const [result] = runActions(gh, [open]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("created");
  });
});

describe("realGh", () => {
  let folder = "";
  let savedPath: string | undefined;
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "canary-gh-"));
    savedPath = process.env.PATH;
    process.env.PATH = `${folder}:${savedPath ?? ""}`;
  });
  afterEach(() => {
    process.env.PATH = savedPath;
    rmSync(folder, { recursive: true, force: true });
  });

  const fakeBinary = (script: string) => {
    const file = join(folder, "gh");
    writeFileSync(file, `#!/bin/sh\n${script}\n`);
    chmodSync(file, 0o755);
  };

  it("returns stdout larger than Node's 1 MiB default buffer (issue list --limit 1000)", () => {
    // 2 MiB of output: a 1 MiB maxBuffer would fail this call with ENOBUFS.
    fakeBinary(`head -c 2097152 /dev/zero | tr '\\0' 'x'`);
    expect(realGh(["issue", "list"]).length).toBe(2_097_152);
  });

  it("passes the body on stdin and returns stdout", () => {
    fakeBinary("cat");
    expect(realGh(["issue", "comment"], "BODY")).toBe("BODY");
  });

  it("throws gh's stderr as the message", () => {
    fakeBinary("echo 'HTTP 403: Forbidden' >&2; exit 1");
    expect(() => realGh(["issue", "list"])).toThrow("HTTP 403: Forbidden");
  });
});

describe("parseArgs", () => {
  it("reads the workflow and no flags", () => {
    expect(parseArgs(["temporal-oracle"])).toEqual({
      ok: true,
      workflow: "temporal-oracle",
      force: {},
      print: false,
    });
  });

  it("reads every oracle flag", () => {
    expect(
      parseArgs([
        "temporal-oracle",
        "--force-removable=D3+D4",
        "--force-mismatch",
        "--print",
      ]),
    ).toEqual({
      ok: true,
      workflow: "temporal-oracle",
      force: { removable: "D3+D4", mismatch: true },
      print: true,
    });
  });

  it("reads the native flag for the oracle workflow", () => {
    expect(
      parseArgs(["temporal-oracle", "--force-native-failure", "--print"]),
    ).toEqual({
      ok: true,
      workflow: "temporal-oracle",
      force: { nativeFailure: true },
      print: true,
    });
  });

  it("reads the swap flag for the oracle workflow", () => {
    expect(
      parseArgs(["temporal-oracle", "--force-swap-ready", "--print"]),
    ).toEqual({
      ok: true,
      workflow: "temporal-oracle",
      force: { swapReady: true },
      print: true,
    });
  });

  it("rejects the swap flag for the leap-seconds workflow", () => {
    const parsed = parseArgs(["leap-seconds", "--force-swap-ready"]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("expected a usage error");
    expect(parsed.error).toContain(
      "unknown flag for leap-seconds: --force-swap-ready",
    );
  });

  it("names the swap flag in the usage text", () => {
    const parsed = parseArgs([]);
    if (parsed.ok) throw new Error("expected a usage error");
    expect(parsed.error).toContain("[--force-swap-ready]");
  });

  it("reads the leap flag", () => {
    expect(parseArgs(["leap-seconds", "--force-leap-difference"])).toEqual({
      ok: true,
      workflow: "leap-seconds",
      force: { leapDifference: true },
      print: false,
    });
  });

  it("treats an empty --force-removable= as no force", () => {
    expect(parseArgs(["temporal-oracle", "--force-removable="])).toEqual({
      ok: true,
      workflow: "temporal-oracle",
      force: {},
      print: false,
    });
  });

  it.each`
    name                                 | argv
    ${"no arguments"}                    | ${[]}
    ${"an unknown workflow"}             | ${["nonsense"]}
    ${"an unknown flag"}                 | ${["temporal-oracle", "--force-everything"]}
    ${"a bare --force-removable"}        | ${["temporal-oracle", "--force-removable"]}
    ${"an oracle flag on leap-seconds"}  | ${["leap-seconds", "--force-mismatch"]}
    ${"a leap flag on the oracle"}       | ${["temporal-oracle", "--force-leap-difference"]}
    ${"the native flag on leap-seconds"} | ${["leap-seconds", "--force-native-failure"]}
    ${"a second positional"}             | ${["temporal-oracle", "leap-seconds"]}
  `("rejects $name with a usage message", ({ argv }) => {
    const parsed = parseArgs(argv);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain("Usage: node scripts/canary-report.mjs");
  });
});

describe("main", () => {
  const RUNTIME = { polyfill: "0.5.1", node: "v24.11.0", icu: "77.1" };
  const workaround = (id: string, state: string) => ({
    id,
    defects: id.split("+"),
    title: `${id} — summary of ${id}`,
    trigger: `trigger for ${id}`,
    state,
    probes: 2,
    failing: state === "still-needed" ? 2 : 0,
    steps: [`Delete the ${id} repros`],
  });
  const compatCounts = (workarounds: ReturnType<typeof workaround>[]) => ({
    workarounds: workarounds.length,
    stillNeeded: workarounds.filter((w) => w.state === "still-needed").length,
    removable: workarounds.filter((w) => w.state === "removable").length,
    guard: 0,
    outOfScope: 0,
  });
  const checkVerdict = (workarounds = [workaround("D2", "still-needed")]) => ({
    source: "temporal-compat-check",
    status: "ran",
    engineId: "v8",
    runtime: RUNTIME,
    counts: compatCounts(workarounds),
    snapshot: { path: "apps/dox/src/data/temporal-compat.json", current: true },
    workarounds,
  });
  const BROWSER_ENGINE_IDS: Record<string, string> = {
    chromium: "v8",
    firefox: "firefox",
    webkit: "webkit",
  };
  const browserCompatVerdict = (
    leg: string,
    workarounds = [workaround("D2", "still-needed")],
  ) => ({
    source: `temporal-compat-${leg}`,
    status: "ran",
    leg,
    engine: `${leg} 1.0`,
    engineId: BROWSER_ENGINE_IDS[leg],
    runtime: { polyfill: "0.5.1", node: "v24.11.0", playwright: "1.63.0" },
    counts: compatCounts(workarounds),
    workarounds,
  });
  const oracleVerdict = () => ({
    source: "temporal-oracle",
    status: "ran",
    runtime: RUNTIME,
    chromium: "152.0.7444.0",
    calendars: ["hebrew"],
    counts: { comparisons: 100, mismatches: 0, tagged: 0, untagged: 0 },
    untaggedGroups: [],
    untagged: [],
    untaggedTruncated: false,
    report: "artifacts/temporal-oracle-2026-10-19.json",
  });
  const leapVerdict = (differences: string[] = []) => ({
    source: "leap-seconds",
    status: "ran",
    header: "Updated through IERS Bulletin C 72",
    rows: { gmt: 28, iers: 28 + differences.length },
    differences,
  });

  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "canary-report-"));
    mkdirSync(join(root, "artifacts"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (file: string, value: unknown) =>
    writeFileSync(
      join(root, "artifacts", file),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  const nativeVerdict = (leg: string, over: Record<string, unknown> = {}) => ({
    source: `native-suite-${leg}`,
    status: "ran",
    leg,
    engine: leg === "node" ? "Node v26.10.0 · V8 14.6" : `${leg} 1.0`,
    runtime: { node: "26.10.0", vitest: "4.1.4", playwright: null },
    counts: {
      files: 828,
      tests: 100,
      passed: 100,
      tagged: 0,
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
  const swapVerdict = (leg: string, over: Record<string, unknown> = {}) => ({
    source: `temporal-polyfill-swap-${leg}`,
    status: "ran",
    leg,
    version: "1.0.7",
    entry: "temporal-polyfill/full/implementation",
    entryLoaded: true,
    runtime: {
      node: "26.12.1",
      vitest: "5.0.5",
      playwright: leg === "node" ? null : "1.63.0",
      browser: leg === "node" ? null : `${leg} 1.0`,
    },
    counts: {
      files: 943,
      tests: 100,
      passed: 100,
      skipped: 0,
      failed: 0,
      both: 0,
      fixed: 0,
    },
    failing: [],
    failingTruncated: false,
    sweep:
      leg === "node"
        ? {
            status: "ran",
            tz: "2026e",
            from: "1970-01-01",
            through: "2036-11-04",
            zones: 418,
            days: 24415,
            comparisons: 10205470,
            differingZones: 1,
            differing: [],
            differingTruncated: false,
          }
        : null,
    calendarSweep:
      leg === "node"
        ? {
            status: "ran",
            from: "-003000-01-01",
            through: "+005000-12-31",
            calendars: 16,
            years: 128762,
            differingCalendars: 0,
            differing: [],
            differingTruncated: false,
          }
        : null,
    ...over,
  });
  /** The four swap files: every leg ran, one zone differs, so nothing is swap-ready. */
  const writeSwapFiles = () => {
    for (const leg of ["node", "chromium", "firefox", "webkit"]) {
      write(`temporal-polyfill-swap-${leg}.json`, swapVerdict(leg));
    }
  };
  /** The four swap files, all passing. */
  const writeReadySwapFiles = () => {
    for (const leg of ["node", "chromium", "firefox", "webkit"]) {
      write(
        `temporal-polyfill-swap-${leg}.json`,
        swapVerdict(
          leg,
          leg === "node"
            ? {
                sweep: {
                  ...swapVerdict("node").sweep,
                  differingZones: 0,
                },
              }
            : {},
        ),
      );
    }
  };
  const writeNativeFiles = () => {
    for (const leg of ["node", "chromium", "firefox", "webkit"]) {
      write(`native-suite-${leg}.json`, nativeVerdict(leg));
    }
  };
  /** The three browsers' compat verdicts, the same rows as the Node check. */
  const writeCompatFiles = (workarounds?: ReturnType<typeof workaround>[]) => {
    for (const leg of ["chromium", "firefox", "webkit"]) {
      write(
        `temporal-compat-${leg}.json`,
        browserCompatVerdict(leg, workarounds),
      );
    }
  };
  const writeOracleFiles = (workarounds?: ReturnType<typeof workaround>[]) => {
    write("temporal-compat-check.json", checkVerdict(workarounds));
    writeCompatFiles(workarounds);
    write("temporal-oracle-verdict.json", oracleVerdict());
    writeNativeFiles();
    writeSwapFiles();
  };

  /** Runs `main` with captured streams and a summary file; returns what it produced. */
  const run = (
    argv: string[],
    gh = fakeGh(),
    env: Record<string, string> = {},
  ) => {
    const out: string[] = [];
    const err: string[] = [];
    const summaryPath = join(root, "summary.md");
    const code = main(argv, {
      root,
      env: { GITHUB_STEP_SUMMARY: summaryPath, ...env },
      gh: gh.gh,
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => err.push(text),
    });
    let summary = "";
    try {
      summary = readFileSync(summaryPath, "utf8");
    } catch {
      summary = "";
    }
    return { code, out: out.join(""), err: err.join(""), summary, gh };
  };

  it("--print prints the summary and one open action and calls no gh", () => {
    writeOracleFiles([workaround("D2", "still-needed")]);
    const { code, out, summary, gh } = run([
      "temporal-oracle",
      "--force-removable=D2",
      "--print",
    ]);
    expect(code).toBe(0);
    expect(gh.calls).toEqual([]);
    expect(summary).toBe("");
    expect(out).toContain("**Issues:** Not filed (--print).");
    const json = out.slice(out.indexOf("[\n"));
    const actions = JSON.parse(json);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "open",
      key: "dry-run/temporal-compat/removable/D2",
      labels: ["canary", "canary-dry-run"],
    });
    expect(actions[0].title.startsWith("[dry run] Remove workaround D2:")).toBe(
      true,
    );
  });

  it("--force-native-failure --print prints the native table and one dry-run action, and files nothing", () => {
    writeOracleFiles();
    const { code, out, summary, gh } = run([
      "temporal-oracle",
      "--force-native-failure",
      "--print",
    ]);
    expect(code).toBe(0);
    expect(gh.calls).toEqual([]);
    expect(summary).toBe("");
    expect(out).toContain("### Native Temporal suite");
    expect(out).toContain(
      "| node | Node v26.10.0 · V8 14.6 | 100 | 100 | 0 | 0 | 0 | 0 | 0 |",
    );
    expect(out).toContain("**Dry run:** --force-native-failure");
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "open",
      key: "dry-run/native-suite/untagged-failure/node",
      labels: ["canary", "temporal-compat", "canary-dry-run"],
    });
  });

  it("an unreadable native verdict reads as could-not-run and the others still count", () => {
    writeOracleFiles();
    write("native-suite-chromium.json", "{ not json");
    const { code, out } = run(["temporal-oracle", "--print"]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe("temporal-oracle/could-not-run");
    expect(actions[0].body).toContain(
      "- **native-suite-chromium**: unreadable verdict:",
    );
  });

  it("reads the four swap verdict files: a passing set plans the swap issue", () => {
    writeOracleFiles();
    writeReadySwapFiles();
    const { code, out } = run(["temporal-oracle", "--print"]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions.map((a: { key: string }) => a.key)).toEqual([
      "temporal-polyfill-swap/ready",
    ]);
  });

  it("an unreadable swap verdict reads as could-not-run and is listed in the could-not-run issue", () => {
    writeOracleFiles();
    writeReadySwapFiles();
    write("temporal-polyfill-swap-firefox.json", "{ not json");
    const { code, out } = run(["temporal-oracle", "--print"]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe("temporal-oracle/could-not-run");
    expect(actions[0].body).toContain(
      "- **temporal-polyfill-swap-firefox**: unreadable verdict:",
    );
  });

  it("a missing swap verdict file is listed as no verdict", () => {
    writeOracleFiles();
    rmSync(join(root, "artifacts", "temporal-polyfill-swap-webkit.json"));
    const { out } = run(["temporal-oracle", "--print"]);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions[0].body).toContain(
      "- **temporal-polyfill-swap-webkit**: no verdict file: an earlier step or job failed",
    );
  });

  it("--force-swap-ready --print on a run that is not swap-ready prints one dry-run action", () => {
    writeOracleFiles();
    const { code, out } = run([
      "temporal-oracle",
      "--force-swap-ready",
      "--print",
    ]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions.map((a: { key: string }) => a.key)).toEqual([
      "dry-run/temporal-polyfill-swap/ready",
    ]);
    expect(out).toContain("**Dry run:** --force-swap-ready");
  });

  it("--force-swap-ready with no swap verdict that ran exits 2 and says so", () => {
    writeOracleFiles();
    for (const leg of ["node", "chromium", "firefox", "webkit"]) {
      rmSync(join(root, "artifacts", `temporal-polyfill-swap-${leg}.json`));
    }
    const { code, err } = run([
      "temporal-oracle",
      "--force-swap-ready",
      "--print",
    ]);
    expect(code).toBe(2);
    expect(err).toContain(
      "canary-report: --force-swap-ready not applied: no temporal-polyfill-swap verdict ran, so there is nothing to force against",
    );
  });

  it("--force-native-failure with no native verdict at all exits 2 and still files the could-not-run issue", () => {
    write("temporal-compat-check.json", checkVerdict());
    write("temporal-oracle-verdict.json", oracleVerdict());
    const { code, err, out } = run([
      "temporal-oracle",
      "--force-native-failure",
      "--print",
    ]);
    expect(code).toBe(2);
    expect(err).toContain(
      "canary-report: --force-native-failure not applied: no native-suite verdict ran, so there is nothing to force against",
    );
    expect(out).toContain(
      "**Dry run:** --force-native-failure not applied: no native-suite verdict ran, so there is nothing to force against",
    );
  });

  it("--print with nothing to report prints the summary and []", () => {
    writeOracleFiles();
    const { code, out } = run(["temporal-oracle", "--print"]);
    expect(code).toBe(0);
    expect(out.trimEnd().endsWith("[]")).toBe(true);
  });

  it("files nothing and calls no gh when no finding exists", () => {
    writeOracleFiles();
    const { code, summary, gh } = run(["temporal-oracle"]);
    expect(code).toBe(0);
    expect(gh.calls).toEqual([]);
    expect(summary).toContain("**Issues:** No issues filed.");
  });

  it("opens a forced finding after ensuring its labels, and writes the summary", () => {
    writeOracleFiles();
    const gh = fakeGh((args) => {
      if (args[0] === "label" && args[1] === "list") {
        return JSON.stringify([{ name: "canary" }]);
      }
      if (args[0] === "issue" && args[1] === "list") return "[]";
      if (args[0] === "issue" && args[1] === "create") {
        return "https://github.com/northguild/gmt/issues/90";
      }
      return "";
    });
    const { code, summary } = run(
      ["temporal-oracle", "--force-removable=D2"],
      gh,
    );
    expect(code).toBe(0);
    const verbs = gh.calls.map((c) => c.args.slice(0, 2).join(" "));
    expect(verbs).toEqual([
      "label list",
      "label create",
      "issue list",
      "issue create",
    ]);
    expect(gh.calls[1].args[2]).toBe("canary-dry-run");
    expect(gh.calls[3].input?.split("\n")[0]).toBe(
      '<!-- gmt-canary key="dry-run/temporal-compat/removable/D2" -->',
    );
    expect(summary).toContain("**Dry run:** --force-removable=D2");
    expect(summary).toContain("opened #90 ([dry run] Remove workaround D2:");
    // The counts are the real ones: D2 is still needed.
    expect(summary).toContain("| Removable | 0 |");
  });

  it("comments when the dry-run issue is already open", () => {
    writeOracleFiles();
    const gh = fakeGh((args) => {
      if (args[0] === "label") {
        return JSON.stringify([{ name: "canary" }, { name: "canary-dry-run" }]);
      }
      if (args[0] === "issue" && args[1] === "list") {
        return JSON.stringify([
          {
            number: 12,
            body: '<!-- gmt-canary key="dry-run/temporal-compat/removable/D2" -->\nold',
            labels: [{ name: "canary" }, { name: "canary-dry-run" }],
          },
        ]);
      }
      return "";
    });
    const { code, summary } = run(
      ["temporal-oracle", "--force-removable=D2"],
      gh,
    );
    expect(code).toBe(0);
    const last = gh.calls[gh.calls.length - 1];
    expect(last.args).toEqual(["issue", "comment", "12", "--body-file", "-"]);
    expect(summary).toContain("commented on #12");
  });

  it("exits 2 on an unknown forced id, files nothing and still writes the summary", () => {
    writeOracleFiles();
    const { code, err, summary, gh } = run([
      "temporal-oracle",
      "--force-removable=D99",
    ]);
    expect(code).toBe(2);
    expect(gh.calls).toEqual([]);
    expect(err).toContain("--force-removable=D99");
    expect(summary).toContain("**Issues:** Not filed: --force-removable=D99");
  });

  it("exits 2 on a usage error and writes nothing", () => {
    const { code, err, summary, gh } = run(["nonsense"]);
    expect(code).toBe(2);
    expect(err).toContain("Usage: node scripts/canary-report.mjs");
    expect(summary).toBe("");
    expect(gh.calls).toEqual([]);
  });

  it("files a could-not-run issue for each missing verdict file", () => {
    const gh = fakeGh((args) => {
      if (args[0] === "label") return JSON.stringify([{ name: "canary" }]);
      if (args[1] === "list") return "[]";
      return "https://github.com/northguild/gmt/issues/5";
    });
    const { code } = run(["temporal-oracle"], gh);
    expect(code).toBe(0);
    const create = gh.calls.find((c) => c.args[1] === "create");
    expect(create?.input?.split("\n")[0]).toBe(
      '<!-- gmt-canary key="temporal-oracle/could-not-run" -->',
    );
    expect(create?.input).toContain(
      "- **temporal-compat-check**: no verdict file: an earlier step or job failed",
    );
  });

  it("reads an unreadable verdict file as a could-not-run source", () => {
    write("temporal-compat-check.json", "{ not json");
    write("temporal-oracle-verdict.json", oracleVerdict());
    const { out } = run(["temporal-oracle", "--print"]);
    expect(out).toContain("could not run — unreadable verdict:");
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions[0].key).toBe("temporal-oracle/could-not-run");
    expect(actions[0].body).toContain("unreadable verdict:");
  });

  it("exits 1 when a gh call fails, names the action, and still writes the counts", () => {
    writeOracleFiles();
    const gh = fakeGh((args) => {
      if (args[0] === "label") return JSON.stringify([{ name: "canary" }]);
      if (args[1] === "list") return "[]";
      if (args[1] === "create") throw new Error("HTTP 403: Forbidden");
      return "";
    });
    const { code, err, summary } = run(
      ["temporal-oracle", "--force-removable=D2"],
      gh,
    );
    expect(code).toBe(1);
    expect(err).toContain("open");
    expect(err).toContain("HTTP 403: Forbidden");
    expect(summary).toContain(
      "failed to open ([dry run] Remove workaround D2:",
    );
    expect(summary).toContain("| Removable | 0 |");
  });

  it("exits 1 when listing labels fails and says nothing was filed", () => {
    writeOracleFiles();
    const gh = fakeGh(() => {
      throw new Error("gh: not logged in");
    });
    const { code, err, summary } = run(
      ["temporal-oracle", "--force-removable=D2"],
      gh,
    );
    expect(code).toBe(1);
    expect(err).toContain("gh: not logged in");
    expect(summary).toContain("**Issues:** Not filed: ");
    expect(summary).toContain("gh: not logged in");
  });

  it("a verdict path that is a folder reads as a could-not-run source", () => {
    write("temporal-compat-check.json", checkVerdict());
    mkdirSync(join(root, "artifacts", "temporal-oracle-verdict.json"));
    const { code, out } = run(["temporal-oracle", "--print"]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe("temporal-oracle/could-not-run");
    expect(actions[0].body).toContain(
      "- **temporal-oracle**: unreadable verdict: EISDIR",
    );
  });

  it.each`
    name                 | text
    ${"JSON null"}       | ${"null"}
    ${"an empty array"}  | ${"[]"}
    ${"an empty object"} | ${"{}"}
  `("$name in the leap-seconds verdict reads as could-not-run", ({ text }) => {
    write("leap-seconds.json", text);
    const { code, out } = run(["leap-seconds", "--print"]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe("leap-seconds/could-not-run");
    expect(actions[0].body).toContain(
      "- **leap-seconds**: unreadable verdict: not a verdict object",
    );
  });

  it("a missing leap verdict with --force-leap-difference still files the real could-not-run issue, then exits 2", () => {
    const gh = fakeGh((args) => {
      if (args[0] === "label") return JSON.stringify([{ name: "canary" }]);
      if (args[0] === "issue" && args[1] === "list") return "[]";
      return "https://github.com/northguild/gmt/issues/6";
    });
    const { code, err, summary } = run(
      ["leap-seconds", "--force-leap-difference"],
      gh,
    );
    expect(code).toBe(2);
    const creates = gh.calls.filter(
      (c) => c.args[0] === "issue" && c.args[1] === "create",
    );
    expect(creates).toHaveLength(1);
    expect(creates[0].input?.split("\n")[0]).toBe(
      '<!-- gmt-canary key="leap-seconds/could-not-run" -->',
    );
    expect(creates[0].args).not.toContain("canary-dry-run");
    expect(err).toContain(
      "canary-report: --force-leap-difference not applied: the leap-seconds verdict is missing or did not run",
    );
    expect(summary).toContain(
      "**Dry run:** --force-leap-difference not applied: the leap-seconds verdict is missing or did not run, so there is nothing to force against",
    );
    expect(summary).toContain("opened #6 (");
  });

  it("a could-not-run oracle with --force-mismatch files the real could-not-run issue and the other force still applies", () => {
    write("temporal-compat-check.json", checkVerdict());
    write("temporal-oracle-verdict.json", {
      source: "temporal-oracle",
      status: "could-not-run",
      message: "no Chromium",
    });
    const { code, out, err } = run([
      "temporal-oracle",
      "--force-removable=D2",
      "--force-mismatch",
      "--print",
    ]);
    expect(code).toBe(2);
    expect(err).toContain("--force-mismatch not applied");
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions.map((a: { key: string }) => a.key)).toEqual([
      "dry-run/temporal-compat/removable/D2",
      "temporal-oracle/could-not-run",
    ]);
  });

  it("exits 1 and says nothing was filed when the issue list fails after the label list worked", () => {
    writeOracleFiles();
    const gh = fakeGh((args) => {
      if (args[0] === "label") return JSON.stringify([{ name: "canary" }]);
      if (args[0] === "issue" && args[1] === "list") {
        throw new Error("HTTP 502: Bad Gateway");
      }
      return "";
    });
    const { code, err, summary } = run(
      ["temporal-oracle", "--force-removable=D2"],
      gh,
    );
    expect(code).toBe(1);
    expect(
      gh.calls.filter((c) => c.args[0] === "issue" && c.args[1] === "create"),
    ).toEqual([]);
    expect(err).toContain("canary-report: gh failed: HTTP 502: Bad Gateway");
    expect(summary).toContain(
      "**Issues:** Not filed: gh failed: HTTP 502: Bad Gateway",
    );
  });

  it("leap-seconds --print with a difference prints one open action", () => {
    write("leap-seconds.json", leapVerdict(["row 29: fixture difference"]));
    const { code, out } = run(["leap-seconds", "--print"]);
    expect(code).toBe(0);
    const actions = JSON.parse(out.slice(out.indexOf("[\n")));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "open",
      key: "leap-seconds/table-difference",
    });
  });

  it("leap-seconds --print on a matching table prints []", () => {
    write("leap-seconds.json", leapVerdict());
    const { code, out } = run(["leap-seconds", "--print"]);
    expect(code).toBe(0);
    expect(out.trimEnd().endsWith("[]")).toBe(true);
    expect(out).toContain("| GMT rows | 28 |");
  });

  it("builds the run link from the GitHub environment", () => {
    write("leap-seconds.json", leapVerdict(["row 29: fixture difference"]));
    const { out } = run(["leap-seconds", "--print"], fakeGh(), {
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "northguild/gmt",
      GITHUB_RUN_ID: "555",
    });
    expect(out).toContain(
      "Run: https://github.com/northguild/gmt/actions/runs/555",
    );
  });

  it("uses (local run) when the GitHub environment is incomplete", () => {
    write("leap-seconds.json", leapVerdict(["row 29: fixture difference"]));
    const { out } = run(["leap-seconds", "--print"], fakeGh(), {
      GITHUB_SERVER_URL: "https://github.com",
    });
    expect(out).toContain("Run: (local run)");
  });

  it("on a branch other than main: files nothing, calls no gh and lists what it would have filed", () => {
    writeOracleFiles();
    const { code, out, summary, gh } = run(
      ["temporal-oracle", "--force-removable=D2"],
      fakeGh(),
      { GITHUB_REF_NAME: "core-108-move" },
    );
    expect(code).toBe(0);
    expect(gh.calls).toEqual([]);
    expect(summary).toContain(
      "**Issues:** Not filed: this run is on core-108-move; issues are filed only from main. It would have filed: [dry run] Remove workaround D2:",
    );
    expect(JSON.parse(out)).toMatchObject([
      { kind: "open", key: "dry-run/temporal-compat/removable/D2" },
    ]);
  });

  it("on a branch with nothing to report: says so and calls no gh", () => {
    writeOracleFiles();
    const { code, summary, gh } = run(["temporal-oracle"], fakeGh(), {
      GITHUB_REF_NAME: "core-108-move",
    });
    expect(code).toBe(0);
    expect(gh.calls).toEqual([]);
    expect(summary).toContain(
      "**Issues:** Not filed: this run is on core-108-move; issues are filed only from main, and there was nothing to file.",
    );
  });

  it("on main: files as usual", () => {
    writeOracleFiles();
    const gh = fakeGh((args) => {
      if (args[0] === "label") return JSON.stringify([{ name: "canary" }]);
      if (args[0] === "issue" && args[1] === "list") return "[]";
      return "https://github.com/northguild/gmt/issues/90";
    });
    const { code } = run(["temporal-oracle", "--force-removable=D2"], gh, {
      GITHUB_REF_NAME: "main",
    });
    expect(code).toBe(0);
    expect(gh.calls.map((c) => c.args.slice(0, 2).join(" "))).toContain(
      "issue create",
    );
  });

  it("a weekly run with the same rows as the open issue posts one line linking to it", () => {
    writeOracleFiles();
    // The body the first run opened the issue with, read back from the plan a branch run prints.
    const [first] = JSON.parse(
      run(["temporal-oracle", "--force-removable=D2"], fakeGh(), {
        GITHUB_REF_NAME: "branch",
      }).out,
    );
    const ISSUE_URL = "https://github.com/northguild/gmt/issues/12";
    const gh = fakeGh((args) => {
      if (args[0] === "label") {
        return JSON.stringify([{ name: "canary" }, { name: "canary-dry-run" }]);
      }
      if (args[0] === "issue" && args[1] === "list") {
        return JSON.stringify([
          {
            number: 12,
            url: ISSUE_URL,
            body: first.body,
            labels: [{ name: "canary" }, { name: "canary-dry-run" }],
          },
        ]);
      }
      if (args[0] === "api") {
        return `${JSON.stringify({ url: `${ISSUE_URL}#issuecomment-1`, body: "A person's note." })}\n`;
      }
      return "";
    });
    const { code } = run(["temporal-oracle", "--force-removable=D2"], gh, {
      GITHUB_REF_NAME: "main",
    });
    expect(code).toBe(0);
    const last = gh.calls[gh.calls.length - 1];
    expect(last.args).toEqual(["issue", "comment", "12", "--body-file", "-"]);
    expect(last.input).toBe(
      `Same as the [last full report](${ISSUE_URL}): nothing has changed.\n\nRun: (local run)`,
    );
  });

  it("prints the summary to stdout when GITHUB_STEP_SUMMARY is unset", () => {
    write("leap-seconds.json", leapVerdict());
    const out: string[] = [];
    const code = main(["leap-seconds"], {
      root,
      env: {},
      gh: fakeGh().gh,
      stdout: (text: string) => out.push(text),
      stderr: () => undefined,
    });
    expect(code).toBe(0);
    expect(out.join("")).toContain("**Issues:** No issues filed.");
  });
});
