import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Temporal as PolyfillTemporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ENTRY_CHECK,
  entryLoaded,
  main,
  runtime,
  sweep,
} from "../../../../scripts/polyfill-swap.mjs";
import { passSetup } from "../../../../scripts/native-suite.mjs";

/**
 * The swap runner's command (`main`) with the Vitest runs, the sweep and the package replaced.
 * Every expected value is written from the rule: a test that fails on the swap and passes on the
 * control blocks (`failed`); one that fails on both is `both`; one that fails on the control alone
 * is `fixed`; nothing is excused by a tag.
 */

const FILE = "src/zoned/calculate/roundZoned.test.ts";
const OTHER = "src/plain/format/formatDate.test.ts";
const ENTRY = "temporal-polyfill/full/implementation";
const RUN_DATE = PolyfillTemporal.PlainDate.from("2026-11-04");

type Status = "passed" | "failed";
const suite = (file: string, tests: [string, Status][]) => ({
  name: `/work/gmt/packages/gmt/${file}`,
  status: tests.some(([, s]) => s === "failed") ? "failed" : "passed",
  message: "",
  assertionResults: tests.map(([fullName, status]) => ({
    fullName,
    title: fullName,
    status,
    failureMessages: status === "failed" ? [`Error: ${fullName} differs`] : [],
  })),
});
const report = (...testResults: unknown[]) => ({ testResults });
const one = (status: Status) => report(suite(FILE, [["a", status]]));

type Call = { leg: string; pass: string };
type Spec = {
  control: unknown;
  swap: unknown;
  swapExit?: number;
  // Both default reports get a passing entry check; a test of that check turns it off.
  bare?: boolean;
};
const ENTRY_PASSES = {
  name: "/work/gmt/packages/gmt/src/test/swapEntry.test.ts",
  status: "passed",
  message: "",
  assertionResults: [
    {
      fullName: ENTRY_CHECK.test,
      title: ENTRY_CHECK.test,
      status: "passed",
      failureMessages: [],
    },
  ],
};
// Both passes get the check, so the file and test counts stay equal between them.
const withCheck = (spec: Spec, pass: unknown) => {
  const r = pass as { testResults: unknown[] };
  return spec.bare
    ? r
    : { ...r, testResults: [...r.testResults, ENTRY_PASSES] };
};

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function setup(installed: string | null = "1.0.7") {
  const root = mkdtempSync(join(tmpdir(), "polyfill-swap-"));
  roots.push(root);
  if (installed !== null) {
    const dir = join(root, "packages/gmt/node_modules/temporal-polyfill");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "temporal-polyfill", version: installed }),
    );
  }
  let out = "";
  let err = "";
  const calls: Call[] = [];
  let swept = 0;
  const io = (spec: Spec | null, extra: Record<string, unknown> = {}) => ({
    root,
    stdout: (t: string) => (out += t),
    stderr: (t: string) => (err += t),
    deps: {
      runPass: (
        leg: string,
        pass: "control" | "native" | "swap",
        r: string,
      ) => {
        calls.push({ leg, pass });
        if (spec === null) return 0;
        mkdirSync(join(r, "artifacts"), { recursive: true });
        writeFileSync(
          join(r, `artifacts/native-suite-${leg}.${pass}.vitest.json`),
          JSON.stringify(
            withCheck(spec, pass === "swap" ? spec.swap : spec.control),
          ),
        );
        writeFileSync(
          join(r, `artifacts/native-suite-${leg}.${pass}.errors.json`),
          "[]",
        );
        return pass === "swap" ? (spec.swapExit ?? 0) : 0;
      },
      shards: () => 1,
      runtime: async (leg: string) => ({
        node: "26.12.1",
        vitest: "4.1.4",
        playwright: leg === "node" ? null : "1.58.0",
        browser: leg === "node" ? null : `${leg} 140.0`,
      }),
      loadEntry: async () => ({ Temporal: { fake: true } }),
      sweep: () => {
        swept += 1;
        return {
          status: "ran",
          tz: "2026e",
          from: "1970-01-01",
          through: "2036-11-04",
          zones: 418,
          days: 24_410,
          comparisons: 10_203_380,
          differingZones: 0,
          differing: [],
          differingTruncated: false,
        };
      },
      today: () => RUN_DATE,
      ...extra,
    },
  });
  const verdictPath = (leg: string) =>
    join(root, `artifacts/temporal-polyfill-swap-${leg}.json`);
  return {
    root,
    io,
    calls,
    swept: () => swept,
    out: () => out,
    err: () => err,
    verdict: (leg: string) =>
      JSON.parse(readFileSync(verdictPath(leg), "utf8")),
    hasVerdict: (leg: string) => existsSync(verdictPath(leg)),
  };
}

describe("polyfill-swap arguments", () => {
  it.each`
    argv                                    | label
    ${[]}                                   | ${"no leg"}
    ${["deno", "--version=1.0.7"]}          | ${"unknown leg"}
    ${["node"]}                             | ${"no version"}
    ${["node", "--version=latest"]}         | ${"version latest"}
    ${["node", "--version=1.0"]}            | ${"two-part version"}
    ${["node", "--version=1.0.7", "extra"]} | ${"extra argument"}
    ${["summary"]}                          | ${"summary without a leg"}
    ${["summary", "deno"]}                  | ${"summary with an unknown leg"}
    ${["summary", "node", "extra"]}         | ${"summary with an extra argument"}
  `("$label exits 2 with usage and writes no verdict", async ({ argv }) => {
    const s = setup();
    const code = await main(argv, s.io(null));
    expect(code).toBe(2);
    expect(s.err()).toContain("Usage: node scripts/polyfill-swap.mjs");
    expect(s.hasVerdict("node")).toBe(false);
    expect(s.calls).toEqual([]);
  });
});

describe("polyfill-swap preflight", () => {
  it("no package in packages/gmt: exit 2 with the quoted message", async () => {
    const s = setup(null);
    const code = await main(["node", "--version=1.0.7"], s.io(null));
    expect(code).toBe(2);
    expect(s.verdict("node")).toEqual({
      source: "temporal-polyfill-swap-node",
      status: "could-not-run",
      message: "temporal-polyfill is not installed in packages/gmt",
    });
    expect(s.calls).toEqual([]);
  });

  it("installed 1.0.6 but 1.0.7 asked: exit 2 with the quoted message", async () => {
    const s = setup("1.0.6");
    const code = await main(["node", "--version=1.0.7"], s.io(null));
    expect(code).toBe(2);
    expect(s.verdict("node").message).toBe(
      "installed temporal-polyfill is 1.0.6, expected 1.0.7",
    );
  });

  it("the entry returns the runtime's built-in Temporal: exit 2 and no pass runs", async () => {
    // Node 22 and 24 have no built-in Temporal, so give the runtime one the entry then returns.
    const builtIn = { builtIn: true };
    vi.stubGlobal("Temporal", builtIn);
    const s = setup();
    const code = await main(
      ["node", "--version=1.0.7"],
      s.io(null, { loadEntry: async () => ({ Temporal: builtIn }) }),
    );
    expect(code).toBe(2);
    expect(s.verdict("node").message).toBe(
      "temporal-polyfill/full/implementation returned the runtime's built-in Temporal",
    );
    expect(s.calls).toEqual([]);
  });

  it("the entry exports no Temporal: exit 2 with the same message", async () => {
    const s = setup();
    const code = await main(
      ["node", "--version=1.0.7"],
      s.io(null, { loadEntry: async () => ({}) }),
    );
    expect(code).toBe(2);
    expect(s.verdict("node").message).toMatch(/built-in Temporal/);
  });

  it("the entry is named in packages/gmt/vitest.swap.config.ts: the runner and the config agree", () => {
    const config = readFileSync(
      join(__dirname, "../../../../packages/gmt/vitest.swap.config.ts"),
      "utf8",
    );
    expect(config).toContain(`SWAP_ENTRY = "${ENTRY}"`);
  });
});

describe("polyfill-swap judging", () => {
  const run = async (spec: Spec, leg = "node") => {
    const s = setup();
    const code = await main([leg, "--version=1.0.7"], s.io(spec));
    return { s, code, v: s.verdict(leg) };
  };

  it("control and swap identical, all pass: exit 0, failed 0, failing empty", async () => {
    const { code, v, s } = await run({
      control: one("passed"),
      swap: one("passed"),
    });
    expect(code).toBe(0);
    expect(v).toMatchObject({
      source: "temporal-polyfill-swap-node",
      status: "ran",
      leg: "node",
      version: "1.0.7",
      entry: ENTRY,
      runtime: {
        node: "26.12.1",
        vitest: "4.1.4",
        playwright: null,
        browser: null,
      },
      counts: {
        files: 2,
        tests: 2,
        passed: 2,
        skipped: 0,
        failed: 0,
        both: 0,
        fixed: 0,
      },
      failing: [],
      failingTruncated: false,
    });
    expect(s.out()).toBe(
      "polyfill-swap: node temporal-polyfill 1.0.7: 0 swap-only failures of 2 tests; sweep: 0 zones differ\n",
    );
  });

  it("one test fails on the swap only: failed 1 and the row is listed", async () => {
    const { code, v } = await run({
      control: one("passed"),
      swap: one("failed"),
    });
    expect(code).toBe(0);
    expect(v.counts).toMatchObject({ failed: 1, both: 0, fixed: 0 });
    expect(v.failing).toEqual([
      {
        file: FILE,
        test: "a",
        message: expect.stringContaining("a differs"),
      },
    ]);
  });

  it("one test fails on both: both 1, failed 0", async () => {
    const { v } = await run({ control: one("failed"), swap: one("failed") });
    expect(v.counts).toMatchObject({ failed: 0, both: 1, fixed: 0 });
    expect(v.failing).toEqual([]);
  });

  it("one test fails on the control only: fixed 1, failed 0", async () => {
    const { v } = await run({ control: one("failed"), swap: one("passed") });
    expect(v.counts).toMatchObject({ failed: 0, both: 0, fixed: 1 });
  });

  it("the swap pass ran fewer files than the control: exit 2, the message says swap pass", async () => {
    const two = report(
      suite(FILE, [["a", "passed"]]),
      suite(OTHER, [["b", "passed"]]),
    );
    const { code, v } = await run({
      control: two,
      swap: one("passed"),
      bare: true,
    });
    expect(code).toBe(2);
    expect(v.message).toBe("the swap pass ran 1 files, the control pass 2");
  });

  it("the swap pass ran no tests: exit 2, the message says swap pass", async () => {
    const { code, v } = await run({
      control: one("passed"),
      swap: report(),
      bare: true,
    });
    expect(code).toBe(2);
    expect(v.message).toBe("the swap pass ran no tests");
  });

  it("the swap pass stops on both tries: exit 2 from the rerun rule", async () => {
    const stopped = report(suite(FILE, [["a", "passed"]]), {
      name: `/work/gmt/packages/gmt/${OTHER}`,
      status: "passed",
      message: "",
      startTime: 5,
      endTime: 5,
      assertionResults: [],
    });
    const { code, v, s } = await run({
      control: one("passed"),
      swap: stopped,
      bare: true,
    });
    expect(code).toBe(2);
    expect(v.message).toMatch(/^the swap pass stopped after 1 of 2 files/);
    expect(s.calls.filter((c) => c.pass === "swap")).toHaveLength(2);
  });

  it("Vitest exits non-zero on the swap with no failure in the report: one row '(vitest exited 1)'", async () => {
    const { v } = await run({
      control: one("passed"),
      swap: one("passed"),
      swapExit: 1,
    });
    expect(v.counts.failed).toBe(1);
    expect(v.failing[0]).toMatchObject({
      file: "(vitest)",
      test: "(vitest exited 1)",
    });
    expect(v.failing[0].message).toMatch(/swap pass/);
  });

  it("60 swap-only failures: 50 listed, failingTruncated, failed 60, messages cut to 300", async () => {
    const names = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const swap = report({
      ...suite(
        FILE,
        names.map((n) => [n, "failed"] as [string, Status]),
      ),
    });
    swap.testResults[0] = {
      ...(swap.testResults[0] as object),
      assertionResults: (swap.testResults[0] as any).assertionResults.map(
        (r: any) => ({
          ...r,
          failureMessages: ["x".repeat(900)],
        }),
      ),
    };
    const control = report(
      suite(
        FILE,
        names.map((n) => [n, "passed"] as [string, Status]),
      ),
    );
    const { v } = await run({ control, swap });
    expect(v.counts.failed).toBe(60);
    expect(v.failing).toHaveLength(50);
    expect(v.failingTruncated).toBe(true);
    expect(v.failing[0].message).toHaveLength(300);
  });

  it("the verdict is deterministic: the same input writes the same bytes", async () => {
    const spec = { control: one("passed"), swap: one("failed") };
    const a = await run(spec);
    const first = readFileSync(
      join(a.s.root, "artifacts/temporal-polyfill-swap-node.json"),
      "utf8",
    );
    const b = await run(spec);
    const second = readFileSync(
      join(b.s.root, "artifacts/temporal-polyfill-swap-node.json"),
      "utf8",
    );
    expect(second).toBe(first);
  });
});

describe("polyfill-swap entry check", () => {
  const CHECK_FILE = "src/test/swapEntry.test.ts";
  const entrySuite = (
    status: string,
    file = CHECK_FILE,
    test = ENTRY_CHECK.test,
  ) => ({
    name: `/work/gmt/packages/gmt/${file}`,
    status: status === "failed" ? "failed" : "passed",
    message: "",
    assertionResults: [
      { fullName: test, title: test, status, failureMessages: [] },
    ],
  });
  const swapWith = (...extra: unknown[]) =>
    report(suite(FILE, [["a", "passed"]]), ...extra);
  const verdictAfter = async (swap: unknown, leg = "node") => {
    const s = setup();
    const code = await main(
      [leg, "--version=1.0.7"],
      s.io({ control: one("passed"), swap, bare: true }),
    );
    return { code, v: s.verdict(leg), err: s.err() };
  };
  const loadedAfter = async (swap: unknown, leg = "node") =>
    (await verdictAfter(swap, leg)).v.entryLoaded === true;

  it("names the swap test file the pass runs", () => {
    expect(ENTRY_CHECK.file).toBe(CHECK_FILE);
    const source = readFileSync(
      join(__dirname, "../../../../packages/gmt", CHECK_FILE),
      "utf8",
    );
    expect(source).toContain(`? "${ENTRY_CHECK.test}"`);
  });

  it.each`
    label                          | swap                                               | loaded
    ${"the check passed"}          | ${swapWith(entrySuite("passed"))}                  | ${true}
    ${"the check is missing"}      | ${swapWith()}                                      | ${false}
    ${"the check was skipped"}     | ${swapWith(entrySuite("skipped"))}                 | ${false}
    ${"the check failed"}          | ${swapWith(entrySuite("failed"))}                  | ${false}
    ${"another file has the name"} | ${swapWith(entrySuite("passed", OTHER))}           | ${false}
    ${"the file has another test"} | ${swapWith(entrySuite("passed", CHECK_FILE, "x"))} | ${false}
  `("node: entryLoaded is $loaded when $label", async ({ swap, loaded }) => {
    expect(await loadedAfter(swap)).toBe(loaded);
  });

  it.each`
    label                          | swap
    ${"the check is missing"}      | ${swapWith()}
    ${"the check was skipped"}     | ${swapWith(entrySuite("skipped"))}
    ${"the check failed"}          | ${swapWith(entrySuite("failed"))}
    ${"another file has the name"} | ${swapWith(entrySuite("passed", OTHER))}
  `(
    "a leg whose swap pass did not load the entry is could-not-run when $label",
    async ({ swap }) => {
      const { code, v, err } = await verdictAfter(swap, "chromium");
      expect(code).toBe(2);
      expect(v).toEqual({
        source: "temporal-polyfill-swap-chromium",
        status: "could-not-run",
        message: "swap entry not loaded",
      });
      expect(err).toContain("chromium could not run: swap entry not loaded");
    },
  );

  it("a browser leg reads the same check from its report", async () => {
    expect(await loadedAfter(swapWith(entrySuite("passed")), "webkit")).toBe(
      true,
    );
    expect(await loadedAfter(swapWith(), "webkit")).toBe(false);
  });

  it("a failed check is could-not-run even when the control skipped it", async () => {
    const s = setup();
    await main(
      ["node", "--version=1.0.7"],
      s.io({
        control: report(suite(FILE, [["a", "passed"]]), entrySuite("skipped")),
        swap: swapWith(entrySuite("failed")),
        bare: true,
      }),
    );
    expect(s.verdict("node").status).toBe("could-not-run");
  });

  it("entryLoaded is a pure function of the report", () => {
    expect(entryLoaded(swapWith(entrySuite("passed")))).toBe(true);
    expect(entryLoaded({ testResults: [] })).toBe(false);
  });
});

describe("polyfill-swap sweep and legs", () => {
  it("the sweep throws on node: exit 0, sweep could-not-run, both passes still ran", async () => {
    const s = setup();
    const code = await main(
      ["node", "--version=1.0.7"],
      s.io(
        { control: one("passed"), swap: one("passed") },
        {
          sweep: () => {
            throw new Error(
              'Intl longOffset text for X is "?", which the sweep cannot read',
            );
          },
        },
      ),
    );
    expect(code).toBe(0);
    expect(s.verdict("node").sweep).toEqual({
      status: "could-not-run",
      message: 'Intl longOffset text for X is "?", which the sweep cannot read',
    });
    expect(s.calls.map((c) => c.pass)).toEqual(["control", "swap"]);
    expect(s.out()).not.toContain("sweep:");
  });

  it("the sweep finds 11 zones on node: the line and the verdict carry the number", async () => {
    const s = setup();
    await main(
      ["node", "--version=1.0.7"],
      s.io(
        { control: one("passed"), swap: one("passed") },
        {
          sweep: () => ({ status: "ran", differingZones: 11 }),
        },
      ),
    );
    expect(s.out()).toContain("; sweep: 11 zones differ");
    expect(s.verdict("node").sweep).toEqual({
      status: "ran",
      differingZones: 11,
    });
  });

  it("the sweep gets the entry and the run date from deps.today", async () => {
    const s = setup();
    const seen: unknown[][] = [];
    await main(
      ["node", "--version=1.0.7"],
      s.io(
        { control: one("passed"), swap: one("passed") },
        {
          loadEntry: async () => ({ Temporal: { fake: "entry" } }),
          today: () => RUN_DATE,
          sweep: (...args: unknown[]) => {
            seen.push(args);
            return { status: "ran", differingZones: 0 };
          },
        },
      ),
    );
    expect(seen).toEqual([[{ Temporal: { fake: "entry" } }, RUN_DATE]]);
  });

  it("the sweep runs before either pass on node", async () => {
    const s = setup();
    const order: string[] = [];
    await main(
      ["node", "--version=1.0.7"],
      s.io(null, {
        sweep: () => {
          order.push("sweep");
          return { status: "ran", differingZones: 0 };
        },
        runPass: (_l: string, pass: string, r: string) => {
          order.push(pass);
          mkdirSync(join(r, "artifacts"), { recursive: true });
          const name = `artifacts/native-suite-node.${pass}.`;
          writeFileSync(
            join(r, `${name}vitest.json`),
            JSON.stringify(one("passed")),
          );
          writeFileSync(join(r, `${name}errors.json`), "[]");
          return 0;
        },
      }),
    );
    expect(order).toEqual(["sweep", "control", "swap"]);
  });

  it("a browser leg: sweep null, no sweep call, the swap pass requested, playwright in the runtime", async () => {
    const s = setup();
    const code = await main(
      ["chromium", "--version=1.0.7"],
      s.io({ control: one("passed"), swap: one("passed") }),
    );
    expect(code).toBe(0);
    expect(s.swept()).toBe(0);
    expect(s.calls).toEqual([
      { leg: "chromium", pass: "control" },
      { leg: "chromium", pass: "swap" },
    ]);
    const v = s.verdict("chromium");
    expect(v.sweep).toBeNull();
    expect(v.runtime).toEqual({
      node: "26.12.1",
      vitest: "4.1.4",
      playwright: "1.58.0",
      browser: "chromium 140.0",
    });
    expect(s.out()).not.toContain("sweep");
  });
});

describe("passSetup", () => {
  it.each`
    leg           | pass         | config                                     | env
    ${"node"}     | ${"swap"}    | ${"packages/gmt/vitest.swap.config.ts"}    | ${{}}
    ${"node"}     | ${"control"} | ${"packages/gmt/vitest.config.ts"}         | ${{}}
    ${"node"}     | ${"native"}  | ${"packages/gmt/vitest.native.config.ts"}  | ${{}}
    ${"chromium"} | ${"swap"}    | ${"packages/gmt/vitest.browser.config.ts"} | ${{ GMT_TEMPORAL: "temporal-polyfill" }}
    ${"firefox"}  | ${"control"} | ${"packages/gmt/vitest.browser.config.ts"} | ${{ GMT_TEMPORAL: "polyfill" }}
    ${"webkit"}   | ${"native"}  | ${"packages/gmt/vitest.browser.config.ts"} | ${{}}
  `(
    "$leg $pass pass runs $config with env $env",
    ({ leg, pass, config, env }) => {
      expect(passSetup(leg, pass)).toEqual({ config, env });
    },
  );
});

describe("polyfill-swap sweep, for real", () => {
  // 1960-01-02 plus ten years is 1970-01-02: two days (epoch days 0 and 1), no waiting.
  const today = PolyfillTemporal.PlainDate.from("1960-01-02");
  const entry = { Temporal: PolyfillTemporal };

  it("compares exactly the zones it is given, over the span, with the offset in seconds", () => {
    // New York is -05:00 and Kolkata +05:30 on those days: a unit slip (ms for s) shows at once.
    expect(
      sweep(entry, today, ["America/New_York", "Asia/Kolkata"]),
    ).toMatchObject({
      status: "ran",
      from: "1970-01-01",
      through: "1970-01-02",
      zones: 2,
      days: 2,
      comparisons: 4,
      differingZones: 0,
      differing: [],
    });
  });

  it("reads every primary zone when none are given", () => {
    expect(sweep(entry, today).zones).toBe(
      Intl.supportedValuesOf("timeZone").length,
    );
  });

  it("flags a zone whose implementation offset is off", () => {
    const wrong = {
      Temporal: {
        Instant: {
          fromEpochMilliseconds: () => ({
            toZonedDateTimeISO: () => ({ offsetNanoseconds: 0 }),
          }),
        },
      },
    };
    expect(sweep(wrong, today, ["America/New_York"])).toMatchObject({
      differingZones: 1,
      differing: [{ zone: "America/New_York", days: 2 }],
    });
  });
});

describe("polyfill-swap runtime", () => {
  it("names the Node and Vitest versions that run the leg, and no browser on node", async () => {
    const vitest = JSON.parse(
      readFileSync(
        createRequire(import.meta.url).resolve("vitest/package.json"),
        "utf8",
      ),
    ).version;
    expect(await runtime("node")).toEqual({
      node: process.versions.node,
      vitest,
      playwright: null,
      browser: null,
    });
  });
});
