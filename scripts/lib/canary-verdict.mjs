/**
 * The JSON each canary writes for the issue reporter (CORE-81).
 *
 * Pure builders plus two writers; Node built-ins and `./format-json.mjs` only. No verdict carries a
 * timestamp: the run link dates it, and the files stay deterministic for tests.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatJson } from "./format-json.mjs";

/** Where each source's verdict goes, relative to the repo root. Written on every run. */
export const VERDICT_FILES = {
  "temporal-compat-check": "artifacts/temporal-compat-check.json",
  "temporal-oracle": "artifacts/temporal-oracle-verdict.json",
  "leap-seconds": "artifacts/leap-seconds.json",
  "native-suite-node": "artifacts/native-suite-node.json",
  "native-suite-chromium": "artifacts/native-suite-chromium.json",
  "native-suite-firefox": "artifacts/native-suite-firefox.json",
};

/**
 * How many untagged oracle mismatches a verdict names. 50 rows keep an issue body far below any
 * size problem while naming enough rows to start; the full list stays in the dated oracle report.
 */
export const UNTAGGED_ROWS_IN_VERDICT = 50;

/** The committed snapshot the verdict says is or is not current (`temporal-compat.mjs snapshot`). */
const SNAPSHOT_PATH = "apps/dox/src/data/temporal-compat.json";

/**
 * The `check` verdict: one entry per workaround group, in script order.
 *
 * @param {{ runtime: { polyfill: string, node: string, icu: string | null },
 *           groups: Array<{ workaround: { defects: string[], title: string, trigger: string,
 *             steps: string[], guard?: { package: string, through: string, reason: string } },
 *             results: unknown[], passing: number,
 *             state: "still-needed" | "removable" | "guard" | "out-of-scope", guardLapsed: boolean }>,
 *           snapshotCurrent: boolean }} input
 */
export function compatCheckVerdict({ runtime, groups, snapshotCurrent }) {
  const inState = (state) => groups.filter((g) => g.state === state).length;
  return {
    source: "temporal-compat-check",
    status: "ran",
    runtime,
    counts: {
      workarounds: groups.length,
      stillNeeded: inState("still-needed"),
      removable: inState("removable"),
      guard: inState("guard"),
      outOfScope: inState("out-of-scope"),
    },
    snapshot: { path: SNAPSHOT_PATH, current: snapshotCurrent },
    workarounds: groups.map(
      ({ workaround, results, passing, state, guardLapsed }) => ({
        id: workaround.defects.join("+"),
        defects: workaround.defects,
        title: workaround.title,
        trigger: workaround.trigger,
        state,
        probes: results.length,
        failing: results.length - passing,
        ...(workaround.engines ? { engines: workaround.engines } : {}),
        ...(workaround.guard
          ? { guard: { ...workaround.guard, lapsed: guardLapsed } }
          : {}),
        steps: workaround.steps,
      }),
    ),
  };
}

/**
 * The `oracle` verdict. `groups` and `untagged` are the tally's: `groups` as
 * `{ key, count, example }` entries and `untagged` as the first untagged mismatches in tally order
 * (the tally keeps its own list, so tagged mismatches can never crowd them out).
 *
 * @param {{ runtime: object, chromium: string, calendars: string[],
 *           counts: { comparisons: number, mismatches: number, tagged: number, untagged: number },
 *           groups: Array<{ key: string, count: number, example: object }>,
 *           untagged: Array<{ [field: string]: unknown }>,
 *           report: string }} input
 */
export function oracleVerdict({
  runtime,
  chromium,
  calendars,
  counts,
  groups,
  untagged: tallied,
  report,
}) {
  const untagged = tallied.slice(0, UNTAGGED_ROWS_IN_VERDICT);
  return {
    source: "temporal-oracle",
    status: "ran",
    runtime,
    chromium,
    calendars,
    counts,
    untaggedGroups: groups
      .filter((g) => !g.key.endsWith(" [tagged]"))
      .map(({ key, count, example }) => ({ key, count, example })),
    untagged,
    untaggedTruncated: counts.untagged > untagged.length,
    report,
  };
}

/** How many characters of a failure message a native-suite verdict keeps. */
const MESSAGE_CHARS_IN_VERDICT = 300;

/**
 * @typedef {{ file: string, test: string, message: string }} NativeFailure
 * @typedef {{ kind: "divergence", file: string, test: string, defect: string }
 *   | { kind: "host", group: string, reason: string }} NativeStaleTag
 */

/**
 * The verdict of one native-suite leg. `untagged` and `hostUntagged` come in full from
 * `classify`; the verdict keeps the first 50 of each, with each message cut to 300 characters, and
 * says when it cut. The counts stay the full numbers. Raw Vitest reports stay in `artifacts/`.
 *
 * @param {{ leg: "node" | "chromium" | "firefox", engine: string,
 *           runtime: { node: string, vitest: string, playwright: string | null },
 *           counts: { files: number, tests: number, passed: number, tagged: number,
 *                     untagged: number, hostTagged: number, hostUntagged: number,
 *                     staleTags: number },
 *           tagged: Array<{ file: string, test: string, defect: string }>,
 *           untagged: NativeFailure[],
 *           hostTagged: Array<{ group: string, count: number, reason: string }>,
 *           hostUntagged: NativeFailure[],
 *           staleTags: NativeStaleTag[] }} input
 */
export function nativeSuiteVerdict({
  leg,
  engine,
  runtime,
  counts,
  tagged,
  untagged,
  hostTagged,
  hostUntagged,
  staleTags,
}) {
  const keep = (/** @type {NativeFailure[]} */ rows) =>
    rows.slice(0, UNTAGGED_ROWS_IN_VERDICT).map(({ file, test, message }) => ({
      file,
      test,
      message: message.slice(0, MESSAGE_CHARS_IN_VERDICT),
    }));
  return {
    source: `native-suite-${leg}`,
    status: "ran",
    leg,
    engine,
    runtime,
    counts,
    tagged,
    untagged: keep(untagged),
    untaggedTruncated: untagged.length > UNTAGGED_ROWS_IN_VERDICT,
    hostTagged,
    hostUntagged: keep(hostUntagged),
    hostUntaggedTruncated: hostUntagged.length > UNTAGGED_ROWS_IN_VERDICT,
    staleTags,
  };
}

/**
 * The `leap-seconds check` verdict. `differences` is the exact `problems` list the command prints:
 * source parse problems, IERS parse problems, then the row comparisons, each string unchanged.
 *
 * @param {{ header: string | null, gmtRows: number, iersRows: number, differences: string[] }} input
 *        `header` is the IERS "Updated through …" line, or null when the file has none
 */
export function leapSecondsVerdict({ header, gmtRows, iersRows, differences }) {
  return {
    source: "leap-seconds",
    status: "ran",
    header,
    rows: { gmt: gmtRows, iers: iersRows },
    differences: [...differences],
  };
}

/**
 * What a command that exited 2 leaves behind: a canary that cannot run is a finding, not a silence.
 *
 * @returns {{ source: string, status: "could-not-run", message: string }}
 */
export function couldNotRunVerdict(source, message) {
  return { source, status: "could-not-run", message };
}

/** Writes `formatJson(verdict)` to `<root>/<VERDICT_FILES[verdict.source]>`, creating the folder. */
export function writeVerdict(root, verdict) {
  const path = join(root, VERDICT_FILES[verdict.source]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatJson(verdict));
}

/**
 * `writeVerdict` that only reports a failure, on stderr as `<prefix>: cannot write verdict: …`.
 * The file is an extra for the issue step: when it cannot be written, the console text and the
 * exit code of the command that ran stand, and a write inside an error path cannot mask the error.
 *
 * @param {string} root
 * @param {Parameters<typeof writeVerdict>[1]} verdict
 * @param {string} prefix the command name that leads the stderr line
 */
export function saveVerdict(root, verdict, prefix) {
  try {
    writeVerdict(root, verdict);
  } catch (error) {
    console.error(`${prefix}: cannot write verdict: ${error.message}`);
  }
}
