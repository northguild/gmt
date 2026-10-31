import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRequire } from "node:module";
import vm from "node:vm";

import {
  main,
  mergeReports,
  runPass,
  shimProblems,
  shimSource,
} from "../../../../scripts/native-suite.mjs";
import { browserCompatVerdict } from "../../../../scripts/lib/canary-verdict.mjs";
import NativeSuiteReporter from "../../../../scripts/lib/native-suite-reporter.mjs";
import { ENGINE_IDS } from "../../../../scripts/lib/workarounds.mjs";
import {
  classify,
  KNOWN_HOST_FAILURES,
  KNOWN_NATIVE_FAILURES,
  withFailureMessages,
} from "../../../../scripts/lib/native-suite-tags.mjs";

/**
 * The native-suite runner's pure sorting (`classify`) and its command (`main`, with the Vitest
 * runs and the browser launch replaced). Fixtures are small hand-written Vitest JSON reports;
 * every expected value is written out here from the rules: native fail + control pass is a
 * divergence, native fail + control fail is a host failure, control fail + native pass (or absent)
 * is control-only.
 */

type Leg = "node" | "chromium" | "firefox" | "webkit";
type Row = {
  file: string;
  test: string;
  legs: Leg[];
  defect: string;
  upstream: string | null;
};
type Group = {
  id: string;
  legs: Leg[];
  reason: string;
  file?: RegExp;
  test?: RegExp;
};

const FILE = "src/zoned/calculate/roundZoned.test.ts";
const OTHER = "src/plain/format/formatDate.test.ts";

/** One suite of a Vitest JSON report: `[fullName, "passed" | "failed"]` pairs. */
const suite = (file: string, tests: [string, "passed" | "failed"][]) => ({
  name: `/work/gmt/packages/gmt/${file}`,
  status: tests.some(([, s]) => s === "failed") ? "failed" : "passed",
  message: "",
  assertionResults: tests.map(([fullName, status]) => ({
    fullName,
    title: fullName,
    status,
    failureMessages:
      status === "failed" ? [`AssertionError: ${fullName} differs`] : [],
  })),
});
const loadFailure = (file: string, message: string) => ({
  name: `/work/gmt/packages/gmt/${file}`,
  status: "failed",
  message,
  assertionResults: [],
});
const report = (...testResults: unknown[]) => ({ testResults });

const row = (over: Partial<Row> = {}): Row => ({
  file: FILE,
  test: "round > day",
  legs: ["node"],
  defect: "a-some-defect",
  upstream: null,
  ...over,
});
const group = (over: Partial<Group> = {}): Group => ({
  id: "chromium-icelandic-locale-data",
  legs: ["chromium"],
  reason: "Chromium ships no Icelandic locale data.",
  test: /\bis-IS\b/,
  ...over,
});

describe("classify", () => {
  it("native fail, control pass, no row: one untagged", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(FILE, [["round > day", "passed"]])),
      "node",
      [],
      [],
    );
    expect(r.untagged).toEqual([
      {
        file: FILE,
        test: "round > day",
        message: "AssertionError: round > day differs",
      },
    ]);
    expect(r.counts.untagged).toBe(1);
    expect(r.counts.passed).toBe(0);
    expect(r.tagged).toEqual([]);
  });

  it("native fail, control pass, row for another leg only: still untagged", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(FILE, [["round > day", "passed"]])),
      "node",
      [row({ legs: ["chromium", "firefox"] })],
      [],
    );
    expect(r.counts.untagged).toBe(1);
    expect(r.tagged).toEqual([]);
    expect(r.staleTags).toEqual([]);
  });

  it("native fail, control pass, row for this leg: tagged with the row's defect", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(FILE, [["round > day", "passed"]])),
      "node",
      [row({ defect: "d14-day-rounding" })],
      [],
    );
    expect(r.tagged).toEqual([
      { file: FILE, test: "round > day", defect: "d14-day-rounding" },
    ]);
    expect(r.counts.untagged).toBe(0);
    expect(r.staleTags).toEqual([]);
  });

  it("native pass, divergence row for this leg: stale divergence tag", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "passed"]])),
      report(suite(FILE, [["round > day", "passed"]])),
      "node",
      [row({ defect: "d14" })],
      [],
    );
    expect(r.staleTags).toEqual([
      { kind: "divergence", file: FILE, test: "round > day", defect: "d14" },
    ]);
    expect(r.counts).toMatchObject({
      untagged: 0,
      hostUntagged: 0,
      staleTags: 1,
      passed: 1,
    });
  });

  it("native fail, control fail, no group matches: one host untagged", () => {
    const r = classify(
      report(suite(OTHER, [["format > de-DE", "failed"]])),
      report(suite(OTHER, [["format > de-DE", "failed"]])),
      "chromium",
      [],
      [group()],
    );
    expect(r.hostUntagged).toEqual([
      {
        file: OTHER,
        test: "format > de-DE",
        message: "AssertionError: format > de-DE differs",
      },
    ]);
    expect(r.untagged).toEqual([]);
    expect(r.staleTags).toEqual([
      {
        kind: "host",
        group: "chromium-icelandic-locale-data",
        reason: "Chromium ships no Icelandic locale data.",
      },
    ]);
  });

  it("native fail, control fail, group matches by test: host tagged with its count", () => {
    const failing: [string, "failed"][] = [
      ["format > is-IS", "failed"],
      ["format > is-IS long", "failed"],
    ];
    const r = classify(
      report(suite(OTHER, failing)),
      report(suite(OTHER, failing)),
      "chromium",
      [],
      [group()],
    );
    expect(r.hostTagged).toEqual([
      {
        group: "chromium-icelandic-locale-data",
        count: 2,
        reason: "Chromium ships no Icelandic locale data.",
      },
    ]);
    expect(r.hostUntagged).toEqual([]);
    expect(r.counts).toMatchObject({
      hostTagged: 2,
      hostUntagged: 0,
      staleTags: 0,
    });
  });

  it("group with file and test where only file matches: not matched, host untagged", () => {
    const r = classify(
      report(suite(OTHER, [["format > de-DE", "failed"]])),
      report(suite(OTHER, [["format > de-DE", "failed"]])),
      "chromium",
      [],
      [group({ file: /formatDate\.test\.ts$/, test: /\bis-IS\b/ })],
    );
    expect(r.hostUntagged).toHaveLength(1);
    expect(r.hostTagged).toEqual([]);
  });

  it("group for another leg only: not matched on this leg", () => {
    const r = classify(
      report(suite(OTHER, [["format > is-IS", "failed"]])),
      report(suite(OTHER, [["format > is-IS", "failed"]])),
      "firefox",
      [],
      [group({ legs: ["chromium"] })],
    );
    expect(r.hostUntagged).toHaveLength(1);
    expect(r.hostTagged).toEqual([]);
    expect(r.staleTags).toEqual([]);
  });

  it("group whose matched tests all pass on this leg: stale host tag", () => {
    const r = classify(
      report(suite(OTHER, [["format > is-IS", "passed"]])),
      report(suite(OTHER, [["format > is-IS", "passed"]])),
      "chromium",
      [],
      [group()],
    );
    expect(r.staleTags).toEqual([
      {
        kind: "host",
        group: "chromium-icelandic-locale-data",
        reason: "Chromium ships no Icelandic locale data.",
      },
    ]);
    expect(r.counts.hostUntagged).toBe(0);
  });

  it("native fail, control fail, a divergence row names the test: host only; the row is stale", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(FILE, [["round > day", "failed"]])),
      "node",
      [row({ defect: "d14" })],
      [],
    );
    expect(r.tagged).toEqual([]);
    expect(r.untagged).toEqual([]);
    expect(r.hostUntagged).toHaveLength(1);
    expect(r.staleTags).toEqual([
      { kind: "divergence", file: FILE, test: "round > day", defect: "d14" },
    ]);
  });

  it("a host group never matches a divergence", () => {
    const r = classify(
      report(suite(OTHER, [["format > is-IS", "failed"]])),
      report(suite(OTHER, [["format > is-IS", "passed"]])),
      "chromium",
      [],
      [group()],
    );
    expect(r.untagged).toHaveLength(1);
    expect(r.hostTagged).toEqual([]);
    expect(r.staleTags).toEqual([
      {
        kind: "host",
        group: "chromium-icelandic-locale-data",
        reason: "Chromium ships no Icelandic locale data.",
      },
    ]);
  });

  it("file failed to load natively, loaded on control: one untagged (file did not load)", () => {
    const r = classify(
      report(loadFailure(FILE, "Error: cannot import node:fs")),
      report(suite(FILE, [["round > day", "passed"]])),
      "chromium",
      [],
      [],
    );
    expect(r.untagged).toEqual([
      {
        file: FILE,
        test: "(file did not load)",
        message: "Error: cannot import node:fs",
      },
    ]);
  });

  it("file failed to load in both passes: one host untagged (file did not load)", () => {
    const r = classify(
      report(loadFailure(FILE, "Error: boom")),
      report(loadFailure(FILE, "Error: boom")),
      "chromium",
      [],
      [],
    );
    expect(r.hostUntagged).toEqual([
      { file: FILE, test: "(file did not load)", message: "Error: boom" },
    ]);
    expect(r.untagged).toEqual([]);
  });

  it("native pass, control fail: one control-only, nothing else", () => {
    const r = classify(
      report(suite(FILE, [["diff > UTC vs Etc/UTC", "passed"]])),
      report(suite(FILE, [["diff > UTC vs Etc/UTC", "failed"]])),
      "webkit",
      [],
      [],
    );
    expect(r.controlOnly).toEqual([
      {
        file: FILE,
        test: "diff > UTC vs Etc/UTC",
        message: "AssertionError: diff > UTC vs Etc/UTC differs",
      },
    ]);
    expect(r.counts).toMatchObject({
      passed: 1,
      untagged: 0,
      hostUntagged: 0,
      controlOnly: 1,
      staleTags: 0,
    });
    expect(r.untagged).toEqual([]);
    expect(r.hostUntagged).toEqual([]);
  });

  it("test absent natively, failed on control: counts as control-only", () => {
    const r = classify(
      report(suite(OTHER, [["format > x", "passed"]])),
      report(suite(FILE, [["round > day", "failed"]])),
      "node",
      [],
      [],
    );
    expect(r.controlOnly.map((f) => f.test)).toEqual(["round > day"]);
    expect(r.counts).toMatchObject({ controlOnly: 1, tests: 1, passed: 1 });
  });

  it("a control-only failure is never matched against a divergence row or a host group: both go stale", () => {
    const r = classify(
      report(suite(OTHER, [["format > is-IS", "passed"]])),
      report(suite(OTHER, [["format > is-IS", "failed"]])),
      "chromium",
      [row({ file: OTHER, test: "format > is-IS", legs: ["chromium"] })],
      [group()],
    );
    expect(r.counts).toMatchObject({
      tagged: 0,
      hostTagged: 0,
      controlOnly: 1,
      staleTags: 2,
    });
    expect(r.staleTags.map((t) => t.kind)).toEqual(["divergence", "host"]);
  });

  it("a test that fails on both passes is a host failure, never control-only", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(FILE, [["round > day", "failed"]])),
      "node",
      [],
      [],
    );
    expect(r.controlOnly).toEqual([]);
    expect(r.counts).toMatchObject({ hostUntagged: 1, controlOnly: 0 });
  });

  it("file failed to load on the control alone: one control-only (file did not load)", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "passed"]])),
      report(loadFailure(FILE, "Error: polyfill hung")),
      "webkit",
      [],
      [],
    );
    expect(r.controlOnly).toEqual([
      {
        file: FILE,
        test: "(file did not load)",
        message: "Error: polyfill hung",
      },
    ]);
    expect(r.untagged).toEqual([]);
  });

  it("an unhandled error on the control alone is control-only; one on both passes is a host failure", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "passed"]])),
      report(suite(FILE, [["round > day", "passed"]])),
      "node",
      [],
      [],
      [{ message: "on both" }],
      [{ message: "on both" }, { message: "control only" }],
    );
    expect(r.controlOnly).toEqual([
      {
        file: "(vitest)",
        test: "(unhandled error)",
        message: "control only",
      },
    ]);
    expect(r.hostUntagged.map((f) => f.message)).toEqual(["on both"]);
  });

  it("test present natively, absent from control: counts as a control pass", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(OTHER, [["format > x", "passed"]])),
      "node",
      [],
      [],
    );
    expect(r.counts.untagged).toBe(1);
    expect(r.hostUntagged).toEqual([]);
  });

  it("counts files, tests and passes of the native pass", () => {
    const r = classify(
      report(
        suite(FILE, [
          ["a", "passed"],
          ["b", "passed"],
          ["c", "failed"],
        ]),
        suite(OTHER, [["d", "passed"]]),
      ),
      report(suite(FILE, [["c", "passed"]])),
      "node",
      [],
      [],
    );
    expect(r.counts).toMatchObject({
      files: 2,
      tests: 4,
      passed: 3,
      untagged: 1,
    });
  });

  it("a failure message keeps the assertion and drops the stack", () => {
    const failing = suite(FILE, [["t", "failed"]]);
    failing.assertionResults[0]!.failureMessages = [
      "AssertionError: expected 1 to be 2\n    at /Users/someone/gmt/x.test.ts:3:4\n    at node:internal",
    ];
    const r = classify(
      report(failing),
      report(suite(FILE, [["t", "passed"]])),
      "node",
      [],
      [],
    );
    expect(r.untagged[0]?.message).toBe("AssertionError: expected 1 to be 2");
  });

  it("a recorded path with no packages/gmt/ prefix is used as it is", () => {
    const r = classify(
      report({
        name: FILE,
        status: "failed",
        assertionResults: [
          { fullName: "t", status: "failed", failureMessages: ["m"] },
        ],
      }),
      report(),
      "node",
      [],
      [],
    );
    expect(r.untagged[0]?.file).toBe(FILE);
  });
});

// --- what Vitest really reports ---------------------------------------------------------------

type Status = "passed" | "failed" | "skipped" | "pending" | "todo";
/** A suite as Vitest 5 writes it: the file status is its own, apart from its tests. */
const rawSuite = (
  file: string,
  fileStatus: "passed" | "failed",
  fileMessage: string,
  tests: [string, Status, string?][],
) => ({
  name: `/work/gmt/packages/gmt/${file}`,
  status: fileStatus,
  message: fileMessage,
  assertionResults: tests.map(([fullName, status, message]) => ({
    fullName,
    title: fullName,
    status,
    failureMessages: message === undefined ? [] : [message],
  })),
});

describe("classify, reports that hide a failure", () => {
  const passing = report(suite(FILE, [["a", "passed"]]));

  it("beforeAll throws: the file failed and its tests are skipped: one untagged '(file failed)' with the file's message", () => {
    const r = classify(
      report(
        rawSuite(FILE, "failed", "setup blew up", [
          ["a", "skipped"],
          ["b", "skipped"],
        ]),
      ),
      passing,
      "node",
      [],
      [],
    );
    const skip =
      "did not run natively (skipped by a failed hook): setup blew up";
    expect(r.untagged).toEqual([
      { file: FILE, test: "a", message: skip },
      { file: FILE, test: "b", message: skip },
      { file: FILE, test: "(file failed)", message: "setup blew up" },
    ]);
    expect(r.counts).toMatchObject({
      tests: 3,
      passed: 0,
      skipped: 2,
      untagged: 3,
    });
  });

  it("a beforeAll that throws in a describe, beside a tagged failing test: the skipped test is a native failure (the reviewer's case)", () => {
    const native = report(
      rawSuite(FILE, "failed", "", [
        ["tagged one", "failed", "AssertionError: expected 1 to be 2"],
        ["grp hidden", "skipped"],
      ]),
    );
    const control = report(
      rawSuite(FILE, "passed", "", [
        ["tagged one", "passed"],
        ["grp hidden", "passed"],
      ]),
    );
    const r = classify(
      native,
      control,
      "node",
      [row({ test: "tagged one", defect: "d1" })],
      [],
    );
    expect(r.counts).toMatchObject({ tagged: 1, untagged: 1 });
    expect(r.untagged).toEqual([
      {
        file: FILE,
        test: "grp hidden",
        message: "did not run natively (skipped by a failed hook)",
      },
    ]);
  });

  it("a divergence row can name a test that did not run natively", () => {
    const native = report(
      rawSuite(FILE, "failed", "", [["grp hidden", "skipped"]]),
    );
    const control = report(
      rawSuite(FILE, "passed", "", [["grp hidden", "passed"]]),
    );
    const r = classify(
      native,
      control,
      "node",
      [row({ test: "grp hidden", defect: "d1" })],
      [],
    );
    expect(r.counts).toMatchObject({ tagged: 1, untagged: 0 });
  });

  it("an afterAll that throws beside a failing test: both are reported", () => {
    const native = report(
      rawSuite(FILE, "failed", "teardown blew up", [
        ["tagged one", "failed", "AssertionError: x"],
      ]),
    );
    const control = report(
      rawSuite(FILE, "passed", "", [["tagged one", "passed"]]),
    );
    const r = classify(
      native,
      control,
      "node",
      [row({ test: "tagged one", defect: "d1" })],
      [],
    );
    expect(r.counts).toMatchObject({ tagged: 1, untagged: 1 });
    expect(r.untagged).toEqual([
      { file: FILE, test: "(file failed)", message: "teardown blew up" },
    ]);
  });

  it("a test skipped by a failing hook on both passes is a host failure, not a divergence", () => {
    const both = report(
      rawSuite(FILE, "failed", "", [["grp hidden", "skipped"]]),
    );
    const r = classify(both, both, "chromium", [], []);
    expect(r.counts).toMatchObject({ untagged: 0, hostUntagged: 1 });
  });

  it("an ordinary failing test in a file with no file-level message: one row, no '(file failed)'", () => {
    const r = classify(
      report(
        rawSuite(FILE, "failed", "", [
          ["t", "failed", "AssertionError: x"],
          ["u", "passed"],
        ]),
      ),
      report(
        rawSuite(FILE, "passed", "", [
          ["t", "passed"],
          ["u", "passed"],
        ]),
      ),
      "node",
      [],
      [],
    );
    expect(r.untagged.map((u) => u.test)).toEqual(["t"]);
  });

  it("a test that is skipped in a passing file is not a failure", () => {
    const r = classify(
      report(rawSuite(FILE, "passed", "", [["s", "skipped"]])),
      report(rawSuite(FILE, "passed", "", [["s", "skipped"]])),
      "node",
      [],
      [],
    );
    expect(r.counts).toMatchObject({
      untagged: 0,
      hostUntagged: 0,
      skipped: 1,
    });
  });

  it("afterAll throws: the file failed and every test passed: still one untagged failure, with a fallback message when the report has none", () => {
    const r = classify(
      report(
        rawSuite(FILE, "failed", "", [
          ["a", "passed"],
          ["b", "passed"],
        ]),
      ),
      passing,
      "node",
      [],
      [],
    );
    expect(r.untagged).toHaveLength(1);
    expect(r.untagged[0]).toMatchObject({ file: FILE, test: "(file failed)" });
    expect(r.untagged[0]?.message).toMatch(/hook|unhandled/);
    expect(r.counts).toMatchObject({ passed: 2, untagged: 1 });
  });

  it("a failed file whose control also failed is a host failure, not a divergence", () => {
    const failed = report(rawSuite(FILE, "failed", "boom", [["a", "passed"]]));
    const r = classify(failed, failed, "chromium", [], []);
    expect(r.counts).toMatchObject({ untagged: 0, hostUntagged: 1 });
  });

  it("a file that failed with a failed test is not also reported as '(file failed)'", () => {
    const r = classify(
      report(
        rawSuite(FILE, "failed", "", [["a", "failed", "AssertionError: x"]]),
      ),
      passing,
      "node",
      [],
      [],
    );
    expect(r.untagged.map((u) => u.test)).toEqual(["a"]);
  });

  it.each`
    status
    ${"skipped"}
    ${"pending"}
    ${"todo"}
  `("a native test that is $status is not a pass", ({ status }) => {
    const r = classify(
      report(rawSuite(FILE, "passed", "", [["a", status]])),
      passing,
      "node",
      [],
      [],
    );
    expect(r.counts).toMatchObject({
      tests: 1,
      passed: 0,
      skipped: 1,
      untagged: 0,
    });
  });

  it.each`
    order                 | first       | second
    ${"failed then pass"} | ${"failed"} | ${"passed"}
    ${"pass then failed"} | ${"passed"} | ${"failed"}
  `("two tests with one name, $order: the key failed", ({ first, second }) => {
    const mk = (a: Status, b: Status) =>
      report(
        rawSuite(FILE, "passed", "", [
          ["same", a, a === "failed" ? "AssertionError: first" : undefined],
          ["same", b, b === "failed" ? "AssertionError: second" : undefined],
        ]),
      );
    const r = classify(
      mk(first, second),
      mk("passed", "passed"),
      "node",
      [],
      [],
    );
    expect(r.untagged).toHaveLength(1);
    expect(r.untagged[0]?.message).toBe(
      first === "failed" ? "AssertionError: first" : "AssertionError: second",
    );
    expect(r.counts).toMatchObject({ tests: 2, passed: 1, untagged: 1 });
  });

  it("two tests with one name that fail on both engines, one passing on the control: a divergence only when the control key passed whole", () => {
    const dup = (a: Status, b: Status) =>
      report(
        rawSuite(FILE, "passed", "", [
          ["same", a, a === "failed" ? "AssertionError: x" : undefined],
          ["same", b, b === "failed" ? "AssertionError: x" : undefined],
        ]),
      );
    const r = classify(
      dup("failed", "passed"),
      dup("passed", "failed"),
      "chromium",
      [],
      [group({ test: /same/ })],
    );
    expect(r.counts).toMatchObject({
      untagged: 0,
      hostUntagged: 0,
      hostTagged: 1,
    });
  });

  it("failure messages lose their stack in V8 and in Firefox frame formats", () => {
    const v8 =
      "AssertionError: expected 1 to be 2\n    at /Users/me/gmt/x.test.ts:3:4";
    const firefox =
      "AssertionError: expected 1 to be 2\nfn@http://localhost:63315/src/x.test.ts:3:4\n@http://localhost:63315/y.js:9:1";
    const r = classify(
      report(
        rawSuite(FILE, "passed", "", [
          ["v8", "failed", v8],
          ["ff", "failed", firefox],
        ]),
      ),
      passing,
      "node",
      [],
      [],
    );
    expect(r.untagged.map((u) => u.message)).toEqual([
      "AssertionError: expected 1 to be 2",
      "AssertionError: expected 1 to be 2",
    ]);
  });
});

describe("classify, a Firefox stack with no message line", () => {
  const passing = report(suite(FILE, [["a", "passed"]]));
  // Shape copied from the first Firefox 155.0 run (northguild/gmt run 39655011688): Vitest's
  // `failureMessages[0]` is the engine's stack alone, and the stack starts with a frame.
  const firefoxStackOnly =
    "@http://localhost:63315/home/runner/work/gmt/gmt/packages/gmt/src/internal/zonedWallClock.test.ts?import&browserv=1792609139415:104:55\n" +
    "createTaskCollector/taskFn.each/</</<@http://localhost:63315/node_modules/.pnpm/@vitest+runner@4.1.4/node_modules/@vitest/runner/dist/chunk-artifact.js?v=184fa290:2027:67\n" +
    "runTest/</</<@http://localhost:63315/node_modules/.pnpm/@vitest+runner@4.1.4/node_modules/@vitest/runner/dist/chunk-artifact.js?v=184fa290:2955:64\n";

  it("a stack that starts with a frame leaves no frame in the message", () => {
    const r = classify(
      report(
        rawSuite(FILE, "passed", "", [["ff", "failed", firefoxStackOnly]]),
      ),
      passing,
      "firefox",
      [],
      [],
    );
    const message = r.untagged[0]?.message ?? "";
    expect(message).not.toMatch(/@http|localhost|:\d+:\d+/);
    expect(message).toBe("(the report holds a stack and no message)");
  });

  it("a stack that starts with a named frame leaves no frame in the message", () => {
    const named = `expectDateTimeEqual@http://localhost:63315/src/test/icuVariants.ts?v=1:12:9\n${firefoxStackOnly}`;
    const r = classify(
      report(rawSuite(FILE, "passed", "", [["ff", "failed", named]])),
      passing,
      "firefox",
      [],
      [],
    );
    expect(r.untagged[0]?.message).toBe(
      "(the report holds a stack and no message)",
    );
  });

  it("an assertion text that contains an @ is kept", () => {
    const r = classify(
      report(
        rawSuite(FILE, "passed", "", [
          [
            "at",
            "failed",
            "AssertionError: expected a@b:1:2 to equal c\nfn@http://x/y.js:3:4",
          ],
        ]),
      ),
      passing,
      "firefox",
      [],
      [],
    );
    expect(r.untagged[0]?.message).toBe(
      "AssertionError: expected a@b:1:2 to equal c",
    );
  });
});

describe("failure messages captured by the reporter", () => {
  const ABS = `/work/gmt/packages/gmt/${FILE}`;
  // A SpiderMonkey failure as Vitest's JSON reporter writes it: the stack alone.
  const stackOnly =
    "@http://localhost:63315/work/gmt/packages/gmt/src/x.test.ts?import&browserv=1:104:55\nrunTest@http://localhost:63315/runner.js?v=1:2955:13\n";

  it("the reporter writes name and message of each failed test, with the suites above it", () => {
    const dir = mkdtempSync(join(tmpdir(), "ns-rep-"));
    const path = join(dir, "m.json");
    const failed = {
      name: "throws for x",
      parent: {
        type: "suite",
        name: "zonedDateTimeFrom",
        parent: { type: "module" },
      },
      result: () => ({
        state: "failed",
        errors: [
          {
            name: "AssertionError",
            message: "expected [Function] to throw an error",
            stack: stackOnly,
          },
        ],
      }),
    };
    const passed = {
      name: "ok",
      parent: { type: "module" },
      result: () => ({ state: "passed" }),
    };
    process.env.NATIVE_SUITE_MESSAGES = path;
    try {
      new NativeSuiteReporter().onTestRunEnd(
        [{ moduleId: ABS, children: { allTests: () => [failed, passed] } }],
        [],
      );
    } finally {
      delete process.env.NATIVE_SUITE_MESSAGES;
    }
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([
      {
        file: ABS,
        fullName: "zonedDateTimeFrom throws for x",
        message: "AssertionError: expected [Function] to throw an error",
      },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("a stack-only Firefox record shows the assertion text once the messages are merged in", () => {
    const raw = report(
      rawSuite(FILE, "passed", "", [
        ["zonedDateTimeFrom throws for x", "failed", stackOnly],
      ]),
    );
    const merged = withFailureMessages(raw, [
      {
        file: ABS,
        fullName: "zonedDateTimeFrom throws for x",
        message: "AssertionError: expected [Function] to throw an error",
      },
    ]);
    const r = classify(
      merged,
      report(suite(FILE, [["zonedDateTimeFrom throws for x", "passed"]])),
      "firefox",
      [],
      [],
    );
    expect(r.untagged[0]?.message).toBe(
      "AssertionError: expected [Function] to throw an error",
    );
  });

  it("a record with a message already, or with no captured message, is left as it was", () => {
    const raw = report(
      rawSuite(FILE, "passed", "", [
        ["a", "failed", "AssertionError: kept\n    at f (x.js:1:1)"],
        ["b", "failed", stackOnly],
      ]),
    );
    const merged = withFailureMessages(raw, [
      { file: ABS, fullName: "a", message: "AssertionError: kept" },
    ]);
    const msgs = merged.testResults[0]!.assertionResults.map(
      (a: any) => a.failureMessages[0],
    );
    expect(msgs[0]).toBe("AssertionError: kept\n    at f (x.js:1:1)");
    expect(msgs[1]).toBe(stackOnly);
  });
});

describe("unhandled errors captured by the reporter", () => {
  const write = (errors: unknown[]) => {
    const dir = mkdtempSync(join(tmpdir(), "ns-err-"));
    const path = join(dir, "e.json");
    process.env.NATIVE_SUITE_ERRORS = path;
    try {
      new NativeSuiteReporter().onTestRunEnd([], errors as never);
    } finally {
      delete process.env.NATIVE_SUITE_ERRORS;
    }
    const out = JSON.parse(readFileSync(path, "utf8"));
    rmSync(dir, { recursive: true, force: true });
    return out;
  };

  it("writes each error with its cause chain, outermost first, as `Name: message` lines", () => {
    expect(
      write([
        {
          name: "Error",
          message:
            "Failed to run the test /work/gmt/packages/gmt/src/x.test.ts.",
          cause: {
            name: "Error",
            message: "page.evaluate: Target closed",
            cause: {
              name: "TargetClosedError",
              message: "Target page, context or browser has been closed",
            },
          },
        },
        { name: "TypeError", message: "x is not a function" },
      ]),
    ).toEqual([
      {
        name: "Error",
        message: "Failed to run the test /work/gmt/packages/gmt/src/x.test.ts.",
        causes: [
          "Error: page.evaluate: Target closed",
          "TargetClosedError: Target page, context or browser has been closed",
        ],
      },
      { name: "TypeError", message: "x is not a function", causes: [] },
    ]);
  });

  it("a cause that is not an error, and a cause that loops back, end the chain", () => {
    const loop: { name: string; message: string; cause?: unknown } = {
      name: "Error",
      message: "outer",
    };
    loop.cause = { name: "Error", message: "inner", cause: loop };
    expect(
      write([{ name: "Error", message: "m", cause: "a string" }, loop]),
    ).toEqual([
      { name: "Error", message: "m", causes: ["a string"] },
      { name: "Error", message: "outer", causes: ["Error: inner"] },
    ]);
  });
});

describe("classify, unhandled errors", () => {
  const ok = report(suite(FILE, [["a", "passed"]]));
  const boom = { name: "Error", message: "boom\n    at /Users/me/x.ts:1:2" };

  it("an unhandled error on the native pass only: one untagged '(unhandled error)' with its message, stack trimmed", () => {
    const r = classify(ok, ok, "node", [], [], [boom], []);
    expect(r.untagged).toEqual([
      { file: "(vitest)", test: "(unhandled error)", message: "boom" },
    ]);
    expect(r.counts.untagged).toBe(1);
  });

  it("the same error on both passes: a host failure", () => {
    const r = classify(ok, ok, "chromium", [], [], [boom], [boom]);
    expect(r.counts).toMatchObject({ untagged: 0, hostUntagged: 1 });
    expect(r.hostUntagged[0]).toMatchObject({
      test: "(unhandled error)",
      message: "boom",
    });
  });

  it("two different errors are two failures; the control having only one of them", () => {
    const other = { name: "Error", message: "other" };
    const r = classify(ok, ok, "chromium", [], [], [boom, other], [other]);
    expect(r.untagged.map((u) => u.message)).toEqual(["boom"]);
    expect(r.hostUntagged.map((u) => u.message)).toEqual(["other"]);
  });

  it("an unhandled error beside a tagged failure is still reported", () => {
    const r = classify(
      report(suite(FILE, [["round > day", "failed"]])),
      report(suite(FILE, [["round > day", "passed"]])),
      "node",
      [row()],
      [],
      [boom],
      [],
    );
    expect(r.counts).toMatchObject({ tagged: 1, untagged: 1 });
  });
});

describe("classify, overlapping host groups", () => {
  it("a failing test matched by two groups credits both: neither is stale", () => {
    const failing = report(suite(OTHER, [["format > is-IS", "failed"]]));
    const r = classify(
      failing,
      failing,
      "chromium",
      [],
      [
        group({ id: "first-group" }),
        group({ id: "second-group", test: /format/ }),
      ],
    );
    expect(r.staleTags).toEqual([]);
    expect(r.hostTagged.map((g) => [g.group, g.count])).toEqual([
      ["first-group", 1],
      ["second-group", 1],
    ]);
    expect(r.counts).toMatchObject({ hostTagged: 1, hostUntagged: 0 });
  });
});

// --- the command -----------------------------------------------------------------------------

type Spec = {
  native: unknown;
  control: unknown | null;
  nativeExit?: number;
  controlExit?: number;
  /** Unhandled errors the reporter wrote; `null` writes no errors file. */
  nativeErrors?: { name: string; message: string }[] | null;
  controlErrors?: { name: string; message: string }[] | null;
};
const ENGINE = "Node v26.10.0 · V8 14.6 · ICU 78.3 · tz 2026c";
const BROWSER_ENGINES: Record<string, string> = {
  chromium: "Chromium 153.0.8010.12",
  firefox: "Firefox 155.0",
  webkit: "WebKit 26.6",
};
const COMPAT_RUNTIME = {
  polyfill: "0.5.1",
  node: "v26.10.0",
  playwright: "1.63.0",
};
/** The stubbed compat check's verdict for a browser leg: one group, still needed. */
function compatVerdict(leg: string) {
  return browserCompatVerdict({
    leg: leg as "chromium" | "firefox" | "webkit",
    engine: BROWSER_ENGINES[leg],
    engineId: ENGINE_IDS[leg as keyof typeof ENGINE_IDS],
    runtime: COMPAT_RUNTIME,
    groups: [
      {
        workaround: {
          defects: ["D1"],
          title: "D1 — one",
          trigger: "t",
          steps: ["s"],
        },
        results: [{}, {}],
        passing: 1,
        state: "still-needed",
        guardLapsed: false,
      },
    ],
  });
}
/** What the runner prints for the stubbed compat check on `leg`. */
const compatLine = (leg: string) =>
  `1 workarounds on @js-temporal/polyfill 0.5.1 in ${BROWSER_ENGINES[leg]}: 1 still needed, 0 removable, 0 guard, 0 out of scope on ${ENGINE_IDS[leg as keyof typeof ENGINE_IDS]}\n`;

function setup() {
  const root = mkdtempSync(join(tmpdir(), "native-suite-"));
  let out = "";
  let err = "";
  const io = (spec: Spec | null, extra: Record<string, unknown> = {}) => ({
    root,
    stdout: (t: string) => (out += t),
    stderr: (t: string) => (err += t),
    deps: {
      preflight: async () => ({ engine: ENGINE, playwright: null }),
      compatCheck: async (leg: string) => compatVerdict(leg),
      runPass: (leg: string, pass: "control" | "native", r: string) => {
        if (spec === null) return 0;
        const body = pass === "native" ? spec.native : spec.control;
        const exit =
          (pass === "native" ? spec.nativeExit : spec.controlExit) ?? 0;
        mkdirSync(join(r, "artifacts"), { recursive: true });
        if (body !== null) {
          writeFileSync(
            join(r, `artifacts/native-suite-${leg}.${pass}.vitest.json`),
            JSON.stringify(body),
          );
        }
        const given =
          pass === "native" ? spec.nativeErrors : spec.controlErrors;
        const errors = given === undefined ? [] : given;
        if (errors !== null) {
          writeFileSync(
            join(r, `artifacts/native-suite-${leg}.${pass}.errors.json`),
            JSON.stringify(errors),
          );
        }
        return exit;
      },
      shards: () => 1,
      runtime: () => ({ node: "26.10.0", vitest: "4.1.4" }),
      divergenceRows: [],
      hostGroups: [],
      ...extra,
    },
  });
  return {
    root,
    io,
    out: () => out,
    err: () => err,
    verdict: (leg: string) =>
      JSON.parse(
        readFileSync(join(root, `artifacts/native-suite-${leg}.json`), "utf8"),
      ),
    hasVerdict: (leg: string) =>
      existsSync(join(root, `artifacts/native-suite-${leg}.json`)),
    compat: (leg: string) =>
      JSON.parse(
        readFileSync(
          join(root, `artifacts/temporal-compat-${leg}.json`),
          "utf8",
        ),
      ),
    hasCompat: (leg: string) =>
      existsSync(join(root, `artifacts/temporal-compat-${leg}.json`)),
    done: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe("a browser pass split into shards", () => {
  const THIRD = "src/utc/convert/convertUtcToPlainDateTime.test.ts";
  type ShardCall = {
    pass: "control" | "native";
    index: number;
    count: number;
    left: number;
  };
  /**
   * A `runPass` that writes one shard's files from `bodies[pass][index - 1]` (or nothing when that
   * entry is `null`) and records every call.
   */
  const sharded = (
    bodies: Record<"control" | "native", (unknown | null)[]>,
    messages: Record<string, unknown[]> = {},
  ) => {
    const calls: ShardCall[] = [];
    const runPass = (
      leg: string,
      pass: "control" | "native",
      r: string,
      shard: { index: number; count: number },
      left: number,
    ) => {
      calls.push({ pass, index: shard.index, count: shard.count, left });
      const body = bodies[pass][shard.index - 1];
      if (body === null) return 0;
      const suffix = `.${shard.index}of${shard.count}`;
      mkdirSync(join(r, "artifacts"), { recursive: true });
      writeFileSync(
        join(r, `artifacts/native-suite-${leg}.${pass}${suffix}.vitest.json`),
        JSON.stringify(body),
      );
      writeFileSync(
        join(r, `artifacts/native-suite-${leg}.${pass}${suffix}.errors.json`),
        JSON.stringify(
          pass === "native" && shard.index === 2
            ? [{ name: "Error", message: "late in shard 2", causes: [] }]
            : [],
        ),
      );
      const captured = messages[`${pass}${suffix}`];
      if (captured) {
        writeFileSync(
          join(
            r,
            `artifacts/native-suite-${leg}.${pass}${suffix}.messages.json`,
          ),
          JSON.stringify(captured),
        );
      }
      return pass === "native" && shard.index === 2 ? 1 : 0;
    };
    return { calls, runPass };
  };
  const firstHalf = report(suite(FILE, [["a", "passed"]]));
  const secondHalf = report(
    suite(OTHER, [["b", "passed"]]),
    suite(THIRD, [["c", "failed"]]),
  );

  it("runs each shard in turn within the pass's time and judges the merged report", async () => {
    const s = setup();
    const { calls, runPass } = sharded(
      { control: [firstHalf, secondHalf], native: [firstHalf, secondHalf] },
      {
        "native.2of2": [
          {
            file: `/work/gmt/packages/gmt/${THIRD}`,
            fullName: "c",
            message: "RangeError: c differs on this engine",
          },
        ],
      },
    );
    try {
      const code = await main(
        ["chromium"],
        s.io(null, { runPass, shards: () => 2 }),
      );
      expect(code).toBe(1);
      expect(
        calls.map(({ pass, index, count }) => `${pass} ${index}/${count}`),
      ).toEqual(["control 1/2", "control 2/2", "native 1/2", "native 2/2"]);
      // The second shard gets what the first left of the 18 minutes.
      expect(calls[0].left).toBeLessThanOrEqual(18 * 60 * 1000);
      expect(calls[0].left).toBeGreaterThan(17 * 60 * 1000);
      expect(Number.isInteger(calls[0].left)).toBe(true);
      expect(calls[1].left).toBeLessThanOrEqual(calls[0].left);
      expect(calls[1].left).toBeGreaterThan(17 * 60 * 1000);
      // Files from both shards, the host failure in shard 2 with the message its reporter kept,
      // and the error shard 2 reported, which counts as one failed test in its own file.
      expect(s.verdict("chromium")).toMatchObject({
        status: "ran",
        counts: { files: 4, tests: 4, passed: 2, hostUntagged: 1, untagged: 1 },
      });
      const verdict = s.verdict("chromium");
      expect(verdict.hostUntagged).toEqual([
        {
          file: THIRD,
          test: "c",
          message:
            "RangeError: c differs on this engine\nAssertionError: c differs",
        },
      ]);
      expect(verdict.untagged[0]).toMatchObject({
        file: "(vitest)",
        test: "(unhandled error)",
        message: expect.stringContaining("late in shard 2"),
      });
      // One merged report per pass is left for the artifact, the shards' files are gone.
      const left = readdirSync(join(s.root, "artifacts")).sort();
      expect(left).toEqual([
        "native-suite-chromium.control.errors.json",
        "native-suite-chromium.control.messages.json",
        "native-suite-chromium.control.vitest.json",
        "native-suite-chromium.json",
        "native-suite-chromium.native.errors.json",
        "native-suite-chromium.native.messages.json",
        "native-suite-chromium.native.vitest.json",
        "temporal-compat-chromium.json",
      ]);
      const merged = JSON.parse(
        readFileSync(
          join(s.root, "artifacts/native-suite-chromium.native.vitest.json"),
          "utf8",
        ),
      );
      expect(merged.testResults.map((f: { name: string }) => f.name)).toEqual([
        `/work/gmt/packages/gmt/${FILE}`,
        `/work/gmt/packages/gmt/${OTHER}`,
        `/work/gmt/packages/gmt/${THIRD}`,
      ]);
    } finally {
      s.done();
    }
  });

  it("a shard that leaves no report is could-not-run, naming the shard", async () => {
    const s = setup();
    const { calls, runPass } = sharded({
      control: [firstHalf, secondHalf],
      native: [firstHalf, null],
    });
    try {
      const code = await main(
        ["chromium"],
        s.io(null, { runPass, shards: () => 2 }),
      );
      expect(code).toBe(2);
      expect(calls).toHaveLength(4);
      expect(s.verdict("chromium")).toEqual({
        source: "native-suite-chromium",
        status: "could-not-run",
        message:
          "the native pass left no Vitest report in shard 2 of 2 (artifacts/native-suite-chromium.native.2of2.vitest.json)",
      });
    } finally {
      s.done();
    }
  });

  it("a shard Vitest stopped early is a stopped pass: every shard runs again", async () => {
    const s = setup();
    const unstarted = {
      name: `/work/gmt/packages/gmt/${THIRD}`,
      status: "passed",
      message: "",
      startTime: 1700000000000,
      endTime: 1700000000000,
      assertionResults: [],
    };
    let nativeRuns = 0;
    const { calls, runPass } = sharded({
      control: [firstHalf, secondHalf],
      native: [firstHalf, secondHalf],
    });
    const stoppingOnce = (
      leg: string,
      pass: "control" | "native",
      r: string,
      shard: { index: number; count: number },
      left: number,
    ) => {
      const code = runPass(leg, pass, r, shard, left);
      if (pass === "native" && shard.index === 2 && nativeRuns++ === 0) {
        writeFileSync(
          join(r, `artifacts/native-suite-${leg}.native.2of2.vitest.json`),
          JSON.stringify(report(suite(OTHER, [["b", "passed"]]), unstarted)),
        );
      }
      return code;
    };
    try {
      const code = await main(
        ["chromium"],
        s.io(null, { runPass: stoppingOnce, shards: () => 2 }),
      );
      expect(code).toBe(1);
      expect(calls.filter((c) => c.pass === "native")).toHaveLength(4);
      expect(s.err()).toContain(
        "native-suite: the native pass stopped after 2 of 3 files (Vitest said: Error: late in shard 2); running it again\n",
      );
      // The three files of the second try plus the unhandled error shard 2 reports each time.
      expect(s.verdict("chromium").counts).toMatchObject({
        files: 4,
        tests: 4,
      });
    } finally {
      s.done();
    }
  });

  it("the node leg runs in one shard, with no suffix on its files", async () => {
    const s = setup();
    const seen: { index: number; count: number }[] = [];
    try {
      const code = await main(
        ["node"],
        s.io(
          { native: firstHalf, control: firstHalf },
          {
            runPass: (
              leg: string,
              pass: "control" | "native",
              r: string,
              shard: { index: number; count: number },
            ) => {
              seen.push(shard);
              return s
                .io({ native: firstHalf, control: firstHalf })
                .deps.runPass(leg, pass, r);
            },
          },
        ),
      );
      expect(code).toBe(0);
      expect(seen).toEqual([
        { index: 1, count: 1 },
        { index: 1, count: 1 },
      ]);
    } finally {
      s.done();
    }
  });
});

describe("mergeReports", () => {
  const top = (over: Record<string, unknown>) => ({
    numTotalTestSuites: 1,
    numPassedTestSuites: 1,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTests: 2,
    numPassedTests: 2,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    snapshot: { total: 0 },
    startTime: 1700000000000,
    success: true,
    testResults: [],
    ...over,
  });

  it("adds the counts, keeps every file in shard order, takes the earliest start and the first snapshot", () => {
    const a = top({
      startTime: 1700000005000,
      testResults: [suite(FILE, [["a", "passed"]])],
      snapshot: { total: 1 },
    });
    const b = top({
      numFailedTests: 1,
      numPassedTests: 1,
      numFailedTestSuites: 1,
      numPassedTestSuites: 0,
      success: false,
      startTime: 1700000001000,
      testResults: [suite(OTHER, [["b", "failed"]])],
      snapshot: { total: 2 },
    });
    expect(mergeReports([a, b])).toEqual({
      numTotalTestSuites: 2,
      numPassedTestSuites: 1,
      numFailedTestSuites: 1,
      numPendingTestSuites: 0,
      numTotalTests: 4,
      numPassedTests: 3,
      numFailedTests: 1,
      numPendingTests: 0,
      numTodoTests: 0,
      snapshot: { total: 1 },
      startTime: 1700000001000,
      success: false,
      testResults: [
        suite(FILE, [["a", "passed"]]),
        suite(OTHER, [["b", "failed"]]),
      ],
    });
  });

  it("one report merges to itself; a count or start that is missing counts as nothing", () => {
    const only = top({});
    expect(mergeReports([only])).toEqual(only);
    const bare = { testResults: [], success: true };
    expect(mergeReports([bare, top({})])).toMatchObject({
      numTotalTests: 2,
      startTime: 1700000000000,
      success: true,
    });
    expect(() => mergeReports([])).toThrow("no shard reports to merge");
  });
});

describe("native-suite command", () => {
  const ok = report(suite(FILE, [["a", "passed"]]));

  it("Vitest exits non-zero on the native pass but the report shows no failure: exit 1, one untagged '(vitest exited 1)'", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io({ native: ok, control: ok, nativeExit: 1 }),
      );
      expect(code).toBe(1);
      const v = s.verdict("node");
      expect(v.counts.untagged).toBe(1);
      expect(v.untagged[0]).toMatchObject({ test: "(vitest exited 1)" });
      expect(v.untagged[0].message).toMatch(/native pass/);
    } finally {
      s.done();
    }
  });

  it("Vitest exits non-zero on the native pass and the report shows a tagged failure: that is the explanation, exit 0", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io(
          {
            native: report(suite(FILE, [["round > day", "failed"]])),
            control: report(suite(FILE, [["round > day", "passed"]])),
            nativeExit: 1,
          },
          { divergenceRows: [row()] },
        ),
      );
      expect(code).toBe(0);
    } finally {
      s.done();
    }
  });

  it("an unhandled error beside a tagged failure: exit 1 and the error in the verdict", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io(
          {
            native: report(suite(FILE, [["round > day", "failed"]])),
            control: report(suite(FILE, [["round > day", "passed"]])),
            nativeExit: 1,
            nativeErrors: [{ name: "Error", message: "leaked rejection" }],
          },
          { divergenceRows: [row()] },
        ),
      );
      expect(code).toBe(1);
      expect(s.verdict("node").untagged).toEqual([
        {
          file: "(vitest)",
          test: "(unhandled error)",
          message: "leaked rejection",
        },
      ]);
    } finally {
      s.done();
    }
  });

  it("a test that fails on the control alone: exit 1, the row in the verdict and in the printed report", async () => {
    const s = setup();
    try {
      const code = await main(
        ["webkit"],
        s.io({
          native: report(suite(FILE, [["diff > UTC vs Etc/UTC", "passed"]])),
          control: report(suite(FILE, [["diff > UTC vs Etc/UTC", "failed"]])),
          controlExit: 1,
        }),
      );
      expect(code).toBe(1);
      const v = s.verdict("webkit");
      expect(v.counts).toMatchObject({ untagged: 0, controlOnly: 1 });
      expect(v.controlOnly).toEqual([
        {
          file: FILE,
          test: "diff > UTC vs Etc/UTC",
          message: "AssertionError: diff > UTC vs Etc/UTC differs",
        },
      ]);
      expect(v.controlOnlyTruncated).toBe(false);
      expect(s.out()).toContain(
        "0 host untagged, 1 control only, 0 stale tags\nFailures on the control alone (1, first 1):\n" +
          `  ${FILE} > diff > UTC vs Etc/UTC\n    AssertionError: diff > UTC vs Etc/UTC differs`,
      );
    } finally {
      s.done();
    }
  });

  it.each`
    pass
    ${"native"}
    ${"control"}
  `(
    "no errors file from the $pass pass although its JSON exists: could-not-run naming the pass",
    async ({ pass }) => {
      const s = setup();
      try {
        const code = await main(
          ["node"],
          s.io({
            native: ok,
            control: ok,
            [`${pass}Errors`]: null,
          } as never),
        );
        expect(code).toBe(2);
        expect(s.verdict("node").message).toMatch(
          new RegExp(`${pass} pass.*errors`),
        );
      } finally {
        s.done();
      }
    },
  );

  it("Vitest exits non-zero on the control pass with no failure in its report: could-not-run naming the control pass", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io({ native: ok, control: ok, controlExit: 1 }),
      );
      expect(code).toBe(2);
      expect(s.verdict("node")).toMatchObject({ status: "could-not-run" });
      expect(s.verdict("node").message).toMatch(/control pass/);
    } finally {
      s.done();
    }
  });

  it.each`
    what                         | native                                    | control                                                                    | named
    ${"no native tests at all"}  | ${report()}                               | ${report(suite(FILE, [["a", "passed"]]))}                                  | ${/native pass ran no tests/}
    ${"no control tests at all"} | ${report(suite(FILE, [["a", "passed"]]))} | ${report()}                                                                | ${/control pass ran no tests/}
    ${"fewer native files"}      | ${report(suite(FILE, [["a", "passed"]]))} | ${report(suite(FILE, [["a", "passed"]]), suite(OTHER, [["b", "passed"]]))} | ${/native pass ran 1 files, the control pass 2/}
  `(
    "an empty or truncated report ($what) is could-not-run, never a green leg",
    async ({ native, control, named }) => {
      const s = setup();
      try {
        const code = await main(["node"], s.io({ native, control }));
        expect(code).toBe(2);
        expect(s.verdict("node").status).toBe("could-not-run");
        expect(s.verdict("node").message).toMatch(named);
      } finally {
        s.done();
      }
    },
  );

  describe("a pass Vitest stopped before every file ran", () => {
    /** A file Vitest never started: passed, no tests, the run's start as both of its times. */
    const unstarted = (file: string, startTime = 1700000000000) => ({
      name: `/work/gmt/packages/gmt/${file}`,
      status: "passed",
      message: "",
      startTime,
      endTime: startTime,
      assertionResults: [],
    });
    const complete = report(
      suite(FILE, [["a", "passed"]]),
      suite(OTHER, [["b", "passed"]]),
    );
    const stopped = report(suite(FILE, [["a", "passed"]]), unstarted(OTHER));
    const poolError = {
      name: "Error",
      message: `Failed to run the test /work/gmt/packages/gmt/${OTHER}.`,
      causes: ["Error: page.evaluate: Target closed"],
    };

    /**
     * A `runPass` that writes, per pass, the bodies given in order and the last one after that,
     * and counts its calls.
     */
    const scripted = (
      plan: Record<
        "control" | "native",
        { body: unknown; errors?: unknown[] }[]
      >,
    ) => {
      const calls = { control: 0, native: 0 };
      const runPass = (leg: string, pass: "control" | "native", r: string) => {
        const steps = plan[pass];
        const step = steps[Math.min(calls[pass], steps.length - 1)];
        calls[pass] += 1;
        mkdirSync(join(r, "artifacts"), { recursive: true });
        writeFileSync(
          join(r, `artifacts/native-suite-${leg}.${pass}.vitest.json`),
          JSON.stringify(step.body),
        );
        writeFileSync(
          join(r, `artifacts/native-suite-${leg}.${pass}.errors.json`),
          JSON.stringify(step.errors ?? []),
        );
        return 0;
      };
      return { calls, runPass };
    };

    it("is run again, and the second, complete run is the one judged", async () => {
      const s = setup();
      const { calls, runPass } = scripted({
        control: [{ body: complete }],
        native: [{ body: stopped, errors: [poolError] }, { body: complete }],
      });
      try {
        const code = await main(["chromium"], s.io(null, { runPass }));
        expect(code).toBe(0);
        expect(calls).toEqual({ control: 1, native: 2 });
        expect(s.verdict("chromium")).toMatchObject({
          status: "ran",
          counts: { files: 2, tests: 2, passed: 2, untagged: 0 },
        });
        expect(s.err()).toBe(
          `native-suite: the native pass stopped after 1 of 2 files (Vitest said: Error: Failed to run the test /work/gmt/packages/gmt/${OTHER}.; caused by Error: page.evaluate: Target closed); running it again\n`,
        );
      } finally {
        s.done();
      }
    });

    it("on both tries is could-not-run, naming the pass, how far it got and Vitest's error with its cause", async () => {
      const s = setup();
      const { calls, runPass } = scripted({
        control: [{ body: stopped, errors: [poolError] }],
        native: [{ body: complete }],
      });
      try {
        const code = await main(["chromium"], s.io(null, { runPass }));
        expect(code).toBe(2);
        expect(calls).toEqual({ control: 2, native: 0 });
        expect(s.verdict("chromium")).toEqual({
          source: "native-suite-chromium",
          status: "could-not-run",
          message: `the control pass stopped after 1 of 2 files (Vitest said: Error: Failed to run the test /work/gmt/packages/gmt/${OTHER}.; caused by Error: page.evaluate: Target closed), on both tries`,
        });
      } finally {
        s.done();
      }
    });

    it("with no error recorded says so", async () => {
      const s = setup();
      const { runPass } = scripted({
        control: [{ body: complete }],
        native: [{ body: stopped }],
      });
      try {
        const code = await main(["chromium"], s.io(null, { runPass }));
        expect(code).toBe(2);
        expect(s.verdict("chromium").message).toBe(
          "the native pass stopped after 1 of 2 files (with no error reported), on both tries",
        );
      } finally {
        s.done();
      }
    });

    it("never reports a tag on a file it did not reach as stale: the leg is could-not-run instead", async () => {
      const s = setup();
      const { runPass } = scripted({
        control: [{ body: complete }],
        native: [{ body: stopped, errors: [poolError] }],
      });
      try {
        const code = await main(
          ["chromium"],
          s.io(null, {
            runPass,
            divergenceRows: [
              row({ file: OTHER, test: "b", legs: ["chromium"] }),
            ],
          }),
        );
        expect(code).toBe(2);
        const v = s.verdict("chromium");
        expect(v.status).toBe("could-not-run");
        expect(v).not.toHaveProperty("staleTags");
      } finally {
        s.done();
      }
    });

    it("a file that ran and has no test in it is not a stopped pass: Vitest fails such a file", async () => {
      const s = setup();
      const failedEmpty = loadFailure(OTHER, "No test suite found in file");
      try {
        const code = await main(
          ["node"],
          s.io({
            native: report(suite(FILE, [["a", "passed"]]), failedEmpty),
            control: report(suite(FILE, [["a", "passed"]]), failedEmpty),
          }),
        );
        expect(code).toBe(1);
        expect(s.verdict("node")).toMatchObject({
          status: "ran",
          counts: { hostUntagged: 1 },
        });
      } finally {
        s.done();
      }
    });
  });

  it("a pass that runs past its time limit is could-not-run, naming the pass", async () => {
    const root = mkdtempSync(join(tmpdir(), "native-suite-timeout-"));
    try {
      expect(() =>
        runPass("node", "native", root, { index: 1, count: 1 }, 1),
      ).toThrow("the native pass ran past its 18-minute limit");
      // A shard that starts with no time left never starts Vitest.
      expect(() =>
        runPass("node", "native", root, { index: 3, count: 8 }, 0),
      ).toThrow("the native pass ran past its 18-minute limit in shard 3 of 8");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exits 1 with a divergence that has no row, and writes the verdict", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io({
          native: report(
            suite(FILE, [
              ["round > day", "failed"],
              ["ok", "passed"],
            ]),
          ),
          control: report(
            suite(FILE, [
              ["round > day", "passed"],
              ["ok", "passed"],
            ]),
          ),
        }),
      );
      expect(code).toBe(1);
      const v = s.verdict("node");
      expect(v).toMatchObject({
        source: "native-suite-node",
        status: "ran",
        leg: "node",
        engine: ENGINE,
        runtime: { node: "26.10.0", vitest: "4.1.4", playwright: null },
        counts: { files: 1, tests: 2, passed: 1, untagged: 1, hostUntagged: 0 },
      });
      expect(v.untagged).toEqual([
        {
          file: FILE,
          test: "round > day",
          message: "AssertionError: round > day differs",
        },
      ]);
      expect(s.out()).toContain(ENGINE);
      expect(s.out()).toContain(
        "src/zoned/calculate/roundZoned.test.ts > round > day",
      );
    } finally {
      s.done();
    }
  });

  it("exits 0 when the divergence is tagged and a stale divergence row is present", async () => {
    const s = setup();
    try {
      const rows = [
        row({ defect: "d14" }),
        row({ test: "gone > test", defect: "d15" }),
      ];
      const code = await main(
        ["node"],
        s.io(
          {
            native: report(
              suite(FILE, [
                ["round > day", "failed"],
                ["gone > test", "passed"],
              ]),
            ),
            control: report(
              suite(FILE, [
                ["round > day", "passed"],
                ["gone > test", "passed"],
              ]),
            ),
          },
          { divergenceRows: rows },
        ),
      );
      expect(code).toBe(0);
      const v = s.verdict("node");
      expect(v.tagged).toEqual([
        { file: FILE, test: "round > day", defect: "d14" },
      ]);
      expect(v.staleTags).toEqual([
        { kind: "divergence", file: FILE, test: "gone > test", defect: "d15" },
      ]);
    } finally {
      s.done();
    }
  });

  it("exits 0 when the only failures are host-tagged", async () => {
    const s = setup();
    try {
      const failing = suite(OTHER, [["format > is-IS", "failed"]]);
      const code = await main(
        ["chromium"],
        s.io(
          { native: report(failing), control: report(failing) },
          {
            hostGroups: [group()],
          },
        ),
      );
      expect(code).toBe(0);
      expect(s.verdict("chromium").hostTagged).toEqual([
        {
          group: "chromium-icelandic-locale-data",
          count: 1,
          reason: "Chromium ships no Icelandic locale data.",
        },
      ]);
    } finally {
      s.done();
    }
  });

  it("exits 1 with a host failure no group covers", async () => {
    const s = setup();
    try {
      const failing = suite(OTHER, [["format > de-DE", "failed"]]);
      const code = await main(
        ["chromium"],
        s.io({ native: report(failing), control: report(failing) }),
      );
      expect(code).toBe(1);
      expect(s.verdict("chromium").counts.hostUntagged).toBe(1);
    } finally {
      s.done();
    }
  });

  it("60 untagged and 60 host untagged: the verdict keeps 50 of each, counts stay 60", async () => {
    const s = setup();
    try {
      const names = (p: string) =>
        Array.from({ length: 60 }, (_, i) => `${p} ${i}`);
      const nativeTests = [
        ...names("div").map((n) => [n, "failed"] as [string, "failed"]),
        ...names("host").map((n) => [n, "failed"] as [string, "failed"]),
      ];
      const controlTests = [
        ...names("div").map((n) => [n, "passed"] as [string, "passed"]),
        ...names("host").map((n) => [n, "failed"] as [string, "failed"]),
      ];
      await main(
        ["node"],
        s.io({
          native: report(suite(FILE, nativeTests)),
          control: report(suite(FILE, controlTests)),
        }),
      );
      const v = s.verdict("node");
      expect(v.untagged).toHaveLength(50);
      expect(v.hostUntagged).toHaveLength(50);
      expect(v.untaggedTruncated).toBe(true);
      expect(v.hostUntaggedTruncated).toBe(true);
      expect(v.counts).toMatchObject({ untagged: 60, hostUntagged: 60 });
    } finally {
      s.done();
    }
  });

  it("cuts a message to 300 characters", async () => {
    const s = setup();
    try {
      const long = suite(FILE, [["t", "failed"]]);
      long.assertionResults[0]!.failureMessages = ["x".repeat(500)];
      await main(
        ["node"],
        s.io({
          native: report(long),
          control: report(suite(FILE, [["t", "passed"]])),
        }),
      );
      expect(s.verdict("node").untagged[0].message).toBe("x".repeat(300));
    } finally {
      s.done();
    }
  });

  it("missing control report: could-not-run verdict naming the pass, exit 2", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io({ native: report(suite(FILE, [["t", "passed"]])), control: null }),
      );
      expect(code).toBe(2);
      const v = s.verdict("node");
      expect(v.source).toBe("native-suite-node");
      expect(v.status).toBe("could-not-run");
      expect(v.message).toContain("control pass");
      expect(s.err()).toContain("could not run");
    } finally {
      s.done();
    }
  });

  it("unreadable native report: could-not-run naming the pass, exit 2", async () => {
    const s = setup();
    try {
      const code = await main(
        ["node"],
        s.io({ native: "not an object", control: report() }),
      );
      expect(code).toBe(2);
      expect(s.verdict("node").message).toContain("native pass");
    } finally {
      s.done();
    }
  });

  it("preflight failure: could-not-run with the reason, no pass is run, exit 2", async () => {
    const s = setup();
    try {
      let ran = false;
      const code = await main(
        ["chromium"],
        s.io(null, {
          preflight: async () => {
            throw new Error("playwright is not installed");
          },
          runPass: () => {
            ran = true;
          },
        }),
      );
      expect(code).toBe(2);
      expect(ran).toBe(false);
      expect(s.verdict("chromium")).toEqual({
        source: "native-suite-chromium",
        status: "could-not-run",
        message: "playwright is not installed",
      });
    } finally {
      s.done();
    }
  });

  it.each`
    argv
    ${[]}
    ${["safari"]}
    ${["node", "extra"]}
    ${["summary"]}
    ${["summary", "safari"]}
  `(
    "argument $argv: usage on stderr, exit 2, no verdict file",
    async ({ argv }) => {
      const s = setup();
      try {
        const code = await main(argv, s.io(null));
        expect(code).toBe(2);
        expect(s.err()).toContain(
          "Usage: node scripts/native-suite.mjs <node|chromium|firefox|webkit>",
        );
        expect(existsSync(join(s.root, "artifacts"))).toBe(false);
      } finally {
        s.done();
      }
    },
  );
});

describe("native-suite command: the compat check in a browser", () => {
  const ok = report(suite(FILE, [["a", "passed"]]));

  it("runs the compat check on a browser leg, saves its verdict and prints its line first", async () => {
    const s = setup();
    try {
      const code = await main(["webkit"], s.io({ native: ok, control: ok }));
      expect(code).toBe(0);
      expect(s.compat("webkit")).toEqual(compatVerdict("webkit"));
      expect(s.out().startsWith(compatLine("webkit"))).toBe(true);
      expect(s.out()).toContain(`${ENGINE}\n1 tests in 1 files`);
    } finally {
      s.done();
    }
  });

  it("never runs it on the node leg", async () => {
    const s = setup();
    try {
      const calls: string[] = [];
      const code = await main(
        ["node"],
        s.io(
          { native: ok, control: ok },
          {
            compatCheck: async (leg: string) => {
              calls.push(leg);
              return compatVerdict("chromium");
            },
          },
        ),
      );
      expect(code).toBe(0);
      expect(calls).toEqual([]);
      expect(s.hasCompat("node")).toBe(false);
      expect(s.out()).not.toContain("workarounds");
    } finally {
      s.done();
    }
  });

  it("a check that cannot run leaves a could-not-run verdict, the suite still runs, and the leg exits 2", async () => {
    const s = setup();
    try {
      const code = await main(
        ["firefox"],
        s.io(
          { native: ok, control: ok },
          {
            compatCheck: async () => {
              throw new Error(
                "packages/gmt/dist is missing: run pnpm build first",
              );
            },
          },
        ),
      );
      expect(code).toBe(2);
      expect(s.compat("firefox")).toEqual({
        source: "temporal-compat-firefox",
        status: "could-not-run",
        message: "packages/gmt/dist is missing: run pnpm build first",
      });
      expect(s.err()).toContain(
        "native-suite: the firefox compat check could not run: packages/gmt/dist is missing: run pnpm build first\n",
      );
      expect(s.verdict("firefox")).toMatchObject({
        status: "ran",
        counts: { tests: 1, untagged: 0 },
      });
    } finally {
      s.done();
    }
  });

  it("an untagged failure still exits 1 when the check ran", async () => {
    const s = setup();
    try {
      const failing = suite(FILE, [["a", "failed"]]);
      const code = await main(
        ["chromium"],
        s.io({ native: report(failing), control: ok }),
      );
      expect(code).toBe(1);
      expect(s.compat("chromium").status).toBe("ran");
    } finally {
      s.done();
    }
  });

  it("summary prints no verdict, then the could-not-run message, for the compat source", async () => {
    const s = setup();
    try {
      expect(await main(["summary", "webkit"], s.io(null))).toBe(0);
      expect(s.out()).toBe(
        "native-suite-webkit: no verdict\ntemporal-compat-webkit: no verdict\n",
      );
      await main(
        ["webkit"],
        s.io(
          { native: ok, control: ok },
          {
            compatCheck: async () => {
              throw new Error("no browser");
            },
          },
        ),
      );
      const before = s.out().length;
      expect(await main(["summary", "webkit"], s.io(null))).toBe(0);
      expect(s.out().slice(before)).toBe(
        `${ENGINE}\n1 tests in 1 files: 1 passed, 0 tagged, 0 untagged, 0 host tagged, 0 host untagged, 0 control only, 0 stale tags\ntemporal-compat-webkit: could not run — no browser\n`,
      );
    } finally {
      s.done();
    }
  });
});

describe("native-suite summary", () => {
  it("prints the engine line and the counts of a verdict that ran", async () => {
    const s = setup();
    try {
      const failing = suite(OTHER, [
        ["format > is-IS", "failed"],
        ["ok", "passed"],
      ]);
      await main(
        ["chromium"],
        s.io(
          { native: report(failing), control: report(failing) },
          { hostGroups: [group()] },
        ),
      );
      const before = s.out().length;
      const code = await main(["summary", "chromium"], s.io(null));
      expect(code).toBe(0);
      expect(s.out().slice(before)).toBe(
        `${ENGINE}\n2 tests in 1 files: 1 passed, 0 tagged, 0 untagged, 1 host tagged, 0 host untagged, 0 control only, 0 stale tags\n${compatLine("chromium")}`,
      );
    } finally {
      s.done();
    }
  });

  it("prints the could-not-run message", async () => {
    const s = setup();
    try {
      await main(
        ["firefox"],
        s.io(null, {
          preflight: async () => {
            throw new Error("no browser");
          },
        }),
      );
      const before = s.out().length;
      expect(await main(["summary", "firefox"], s.io(null))).toBe(0);
      expect(s.out().slice(before)).toBe(
        `native-suite-firefox: could not run — no browser\n${compatLine("firefox")}`,
      );
    } finally {
      s.done();
    }
  });

  it("prints no verdict when the file is absent", async () => {
    const s = setup();
    try {
      expect(await main(["summary", "node"], s.io(null))).toBe(0);
      expect(s.out()).toBe("native-suite-node: no verdict\n");
    } finally {
      s.done();
    }
  });
});

// --- the fixture checks ----------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const polyfill = createRequire(join(REPO_ROOT, "packages/gmt/package.json"))(
  "@js-temporal/polyfill",
);

/**
 * A realm that stands in for a native engine: the polyfill is its `Temporal`, so the shim's
 * source can run in it the way it runs in a browser page. A realm without Temporal deletes both
 * globals, because a `vm` context on Node 26 starts with V8's own `Temporal`.
 */
function realm(withTemporal: boolean) {
  const context = vm.createContext({ polyfill });
  vm.runInContext(
    withTemporal
      ? "globalThis.Temporal = polyfill.Temporal; Date.prototype.toTemporalInstant = polyfill.toTemporalInstant;"
      : "delete globalThis.Temporal; delete Date.prototype.toTemporalInstant;",
    context,
  );
  return context;
}

function loadShim(
  context: vm.Context,
  source: string,
): { shim?: unknown; error?: string } {
  vm.runInContext(
    `try { ${source}\n globalThis.__shim = { Temporal, toTemporalInstant }; } catch (e) { globalThis.__shimError = String(e && e.message); }`,
    context,
  );
  return { shim: (context as any).__shim, error: (context as any).__shimError };
}

const clockIgnored = (t: string) => t.replaceAll("Date.now()", "1"); // date-ban: edits the shim's clock call

describe("fixture checks", () => {
  const source = shimSource(REPO_ROOT);

  it("the shim source is plain script: no types, no exports", () => {
    expect(source).not.toMatch(/^export /m);
    expect(source).not.toMatch(/\bas unknown as\b/);
    expect(source).toContain(
      "native Temporal is not available on this runtime",
    );
  });

  it("the shim over an engine with Temporal: no problems", () => {
    const context = realm(true);
    const { shim, error } = loadShim(context, source);
    expect(error).toBeUndefined();
    (context as any).__shimArg = shim;
    expect(
      vm.runInContext(`(${shimProblems.toString()})(__shimArg)`, context),
    ).toEqual([]);
  });

  it("the shim over an engine without Temporal throws the documented message", () => {
    const { error, shim } = loadShim(realm(false), source);
    expect(shim).toBeUndefined();
    expect(error).toBe("native Temporal is not available on this runtime");
  });

  it.each`
    broken                             | edit
    ${"a clock that ignores the time"} | ${clockIgnored}
    ${"a lost sub-millisecond tail"}   | ${(t: string) => t.replace("carried = floorTail(now);", "")}
  `("a shim with $broken is a problem", ({ edit }) => {
    const context = realm(true);
    const { shim, error } = loadShim(context, edit(source));
    expect(error).toBeUndefined();
    (context as any).__shimArg = shim;
    const problems = vm.runInContext(
      `(${shimProblems.toString()})(__shimArg)`,
      context,
    ) as string[];
    expect(problems.join("\n")).toContain(
      "expected 2024-03-10T12:00:00.8000008Z",
    );
  });

  it("a shim whose Now is the host's own Now is a problem", () => {
    const context = realm(true);
    const { shim } = loadShim(
      context,
      source.replace("{ value: Now,", "{ value: native.Now,"),
    );
    (context as any).__shimArg = shim;
    const problems = vm.runInContext(
      `(${shimProblems.toString()})(__shimArg)`,
      context,
    ) as string[];
    expect(problems.join("\n")).toContain("the host's own Temporal.Now");
  });

  it.each`
    broken                                         | from                                                                                                              | to                                                                                                            | message
    ${"a clock without the Instant-range clamp"}   | ${"return ns > NS_MAX ? NS_MAX : ns < -NS_MAX ? -NS_MAX : ns;"}                                                   | ${"return ns;"}                                                                                               | ${"(no clamp)"}
    ${"a zone checked after the clock is read"}    | ${"const zone = native.Now.zonedDateTimeISO(timeZone).timeZoneId;\n  return instant().toZonedDateTimeISO(zone);"} | ${"const at = instant();\n  return at.toZonedDateTimeISO(native.Now.zonedDateTimeISO(timeZone).timeZoneId);"} | ${"the rejected call read the clock"}
    ${"a frozen Now"}                              | ${"{ value: Now, enumerable: false }"}                                                                            | ${"{ value: Object.freeze(Now), enumerable: false }"}                                                         | ${"cannot be spied on"}
    ${"a plain method that reads the clock first"} | ${"zonedDateTimeISO(timeZone).toPlainDate()"}                                                                     | ${"(instant(), zonedDateTimeISO(timeZone)).toPlainDate()"}                                                    | ${"after a rejected Now.plainDateISO()"}
    ${"a read-only Now member"}                    | ${"{ value: Now, enumerable: false }"}                                                                            | ${'{ value: Object.defineProperty(Now, "instant", { writable: false }), enumerable: false }'}                 | ${"Now.instant is not a writable, configurable member"}
  `("a shim with $broken is a problem", ({ from, to, message }) => {
    expect(source).toContain(from);
    const context = realm(true);
    const { shim, error } = loadShim(context, source.replace(from, to));
    expect(error).toBeUndefined();
    (context as any).__shimArg = shim;
    const problems = vm.runInContext(
      `(${shimProblems.toString()})(__shimArg)`,
      context,
    ) as string[];
    expect(problems.join("\n")).toContain(message);
  });

  it("a shim that lets an invalid zone through is a problem", () => {
    const context = realm(true);
    const validation = "native.Now.zonedDateTimeISO(timeZone).timeZoneId";
    expect(source).toContain(validation);
    const { shim } = loadShim(context, source.replace(validation, "'UTC'"));
    (context as any).__shimArg = shim;
    const problems = vm.runInContext(
      `(${shimProblems.toString()})(__shimArg)`,
      context,
    ) as string[];
    expect(problems.join("\n")).toContain("RangeError");
  });
});

// --- the real tag lists ------------------------------------------------------------------------

const REPO = join(import.meta.dirname, "../../../..");
const GMT = join(REPO, "packages/gmt");

function testFiles(): string[] {
  return (readdirSync(join(GMT, "src"), { recursive: true }) as string[])
    .map((p) => p.split("\\").join("/"))
    .filter((p) => p.endsWith(".test.ts"))
    .map((p) => `src/${p}`);
}

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
function anchors(markdown: string): Set<string> {
  const out = new Set<string>();
  for (const m of markdown.matchAll(/^#{1,6} (.+)$/gm)) {
    out.add(
      m[1]!
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .trim()
        .replace(/\s/g, "-"),
    );
  }
  return out;
}

/**
 * The titles of the suite's tests, read from the sources: the first string argument of every
 * `it`, `test` and `describe` call (a template with `$var` stays as written). Enough to tell a
 * pattern aimed at a few tests from one that matches most of them.
 */
function testTitles(files: string[]): string[] {
  const titles: string[] = [];
  for (const f of files) {
    const text = readFileSync(join(GMT, f), "utf8");
    for (const m of text.matchAll(
      /\b(?:it|test|describe)(?:\.\w+)*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g,
    )) {
      titles.push(m[2]!);
    }
  }
  return titles;
}

/** Every problem with one divergence row. */
function rowProblems(r: Row, files: string[], headings: Set<string>): string[] {
  const problems: string[] = [];
  if (!files.includes(r.file))
    problems.push(`row ${r.file} > ${r.test}: no such test file`);
  if (r.test.trim() === "") problems.push(`row ${r.file}: empty test name`);
  if (!headings.has(r.defect))
    problems.push(`row ${r.file} > ${r.test}: no heading #${r.defect}`);
  if (r.legs.length === 0) problems.push(`row ${r.file} > ${r.test}: no legs`);
  return problems;
}

/** Every problem with the file pattern of a host group. */
function filePatternProblems(g: Group, files: string[]): string[] {
  if (!g.file) return [];
  const problems: string[] = [];
  const hits = files.filter((f) => g.file!.test(f)).length;
  if (hits === 0)
    problems.push(`group ${g.id}: file pattern matches no test file`);
  if (hits > files.length / 2)
    problems.push(
      `group ${g.id}: file pattern matches more than half the test files`,
    );
  return problems;
}

/** Every problem with the test pattern of a host group. */
function testPatternProblems(g: Group, titles: string[]): string[] {
  if (!g.test) return [];
  const problems: string[] = [];
  if (g.test.test(""))
    problems.push(`group ${g.id}: test pattern matches an empty name`);
  const hits = titles.filter((t) => g.test!.test(t)).length;
  if (hits > titles.length / 2)
    problems.push(
      `group ${g.id}: test pattern matches more than half the test titles`,
    );
  return problems;
}

/** Every problem with one host group, `ids` being the ids of the groups before it. */
function groupProblems(
  g: Group,
  ids: Set<string>,
  files: string[],
  titles: string[],
): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id))
    problems.push(`group ${g.id}: id is not kebab-case`);
  if (ids.has(g.id)) problems.push(`group ${g.id}: duplicate id`);
  ids.add(g.id);
  if (g.reason.trim() === "") problems.push(`group ${g.id}: no reason`);
  if (g.legs.length === 0) problems.push(`group ${g.id}: no legs`);
  if (!g.file && !g.test) problems.push(`group ${g.id}: neither file nor test`);
  return [
    ...problems,
    ...filePatternProblems(g, files),
    ...testPatternProblems(g, titles),
  ];
}

/** Every problem with a pair of lists; empty when they are valid. */
function tagProblems(
  rows: ReadonlyArray<Row>,
  groups: ReadonlyArray<Group>,
  files: string[],
  headings: Set<string>,
  titles: string[],
): string[] {
  const ids = new Set<string>();
  return [
    ...rows.flatMap((r) => rowProblems(r, files, headings)),
    ...groups.flatMap((g) => groupProblems(g, ids, files, titles)),
  ];
}

describe("native-suite tag lists", () => {
  const files = testFiles();
  const headings = anchors(
    readFileSync(
      join(REPO, "context/domination/js-temporal-polyfill-bugs.md"),
      "utf8",
    ),
  );
  const titles = testTitles(files);

  it("the real lists are valid", () => {
    expect(files.length).toBeGreaterThan(500);
    expect(
      tagProblems(
        KNOWN_NATIVE_FAILURES,
        KNOWN_HOST_FAILURES,
        files,
        headings,
        titles,
      ),
    ).toEqual([]);
  });

  it("the check flags every kind of invalid entry", () => {
    const bad = tagProblems(
      [row({ file: "src/nope.test.ts", defect: "no-such-heading" })],
      [
        group({ id: "Not Kebab", reason: "", legs: [], test: undefined }),
        group({ id: "dup", file: /\.test\.ts$/ }),
        group({ id: "dup", file: /^src\/never-matches$/ }),
      ],
      files,
      headings,
      titles,
    );
    expect(bad).toEqual([
      "row src/nope.test.ts > round > day: no such test file",
      "row src/nope.test.ts > round > day: no heading #no-such-heading",
      "group Not Kebab: id is not kebab-case",
      "group Not Kebab: no reason",
      "group Not Kebab: no legs",
      "group Not Kebab: neither file nor test",
      "group dup: file pattern matches more than half the test files",
      "group dup: duplicate id",
      "group dup: file pattern matches no test file",
    ]);
  });

  it("the check flags a test pattern that matches most titles or an empty name", () => {
    expect(titles.length).toBeGreaterThan(3000);
    const bad = tagProblems(
      [],
      [
        group({ id: "everything", test: /./ }),
        group({ id: "also-empty", test: /^/ }),
        group({ id: "one-locale", test: /\bis-IS\b/ }),
      ],
      files,
      headings,
      titles,
    );
    expect(bad).toEqual([
      "group everything: test pattern matches more than half the test titles",
      "group also-empty: test pattern matches an empty name",
      "group also-empty: test pattern matches more than half the test titles",
    ]);
  });

  it("the check accepts a well-formed row and group", () => {
    const anyAnchor = [...headings][0]!;
    expect(
      tagProblems(
        [row({ file: files[0]!, defect: anyAnchor })],
        [
          group({
            file: new RegExp(
              `^${files[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            ),
          }),
        ],
        files,
        headings,
        titles,
      ),
    ).toEqual([]);
  });
});
