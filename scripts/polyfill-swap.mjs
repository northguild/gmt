#!/usr/bin/env node
/**
 * Runs the whole packages/gmt suite on `temporal-polyfill` and judges it against the same suite on
 * `@js-temporal/polyfill` (CORE-92).
 *
 *   node scripts/polyfill-swap.mjs <node|chromium|firefox|webkit> --version=<x.y.z>
 *   node scripts/polyfill-swap.mjs summary <node|chromium|firefox|webkit>
 *
 * A leg runs the suite twice on one host: the control on `@js-temporal/polyfill` and the swap on
 * `temporal-polyfill/full/implementation`, behind the unchanged seam (an alias, see
 * packages/gmt/vitest.swap.config.ts). A test that fails on the swap and passes on the control
 * blocks the swap; one that fails on both is the host's and does not. No tag excuses anything.
 * Type errors do not decide. The Node leg also compares the swap's UTC offsets with Intl's on
 * every day from 1970 to ten years ahead (scripts/lib/offset-sweep.mjs).
 *
 * The package must already be installed in packages/gmt (the swap job does it; it is never in a
 * manifest or lockfile). Exit 0 when both passes ran, whether the swap passed or not; 2 when the
 * leg could not run or the arguments are wrong. It never exits 1: the verdict is the signal.
 * `summary <leg>` prints the verdict as Markdown for the job summary and always exits 0.
 *
 * Node built-ins only, and no `Date`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  couldNotRunVerdict,
  polyfillSwapVerdict,
  saveVerdict,
  VERDICT_FILES,
} from "./lib/canary-verdict.mjs";
import {
  incompleteRun,
  runPass,
  runPassAgainIfStopped,
} from "./native-suite.mjs";
import { classify } from "./lib/native-suite-tags.mjs";
import { sweepOffsets, sweepSpan } from "./lib/offset-sweep.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LEGS = ["node", "chromium", "firefox", "webkit"];
/** Never `/full`: that entry returns the runtime's built-in `Temporal` where one exists. */
const SWAP_ENTRY = "temporal-polyfill/full/implementation";
const BROWSER_SHARDS = 8;
/**
 * The test in the swap pass that proves GMT ran on `temporal-polyfill`
 * (packages/gmt/src/test/swapEntry.test.ts): the seam's `Temporal` is the swap entry's own object.
 * Only the swap pass runs it, on Node and in every browser.
 */
export const ENTRY_CHECK = {
  file: "src/test/swapEntry.test.ts",
  test: "the swap pass runs GMT on the swap entry's own Temporal object",
};
const USAGE =
  "Usage: node scripts/polyfill-swap.mjs <node|chromium|firefox|webkit> --version=<x.y.z>\n" +
  "       node scripts/polyfill-swap.mjs summary <node|chromium|firefox|webkit>";

/** @param {unknown} error */
const messageOf = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * @typedef {Parameters<typeof sweepSpan>[0]} SweepDate
 * @typedef {import("./native-suite.mjs").Leg} Leg
 * @typedef {{ node: string, vitest: string, playwright: string | null, browser: string | null }} Runtime
 * @typedef {{
 *   runPass: typeof runPass,
 *   shards: (leg: Leg) => number,
 *   runtime: (leg: Leg) => Promise<Runtime>,
 *   loadEntry: (root: string) => Promise<{ Temporal?: unknown }>,
 *   sweep: (entry: any, today: SweepDate) => object,
 *   today: () => SweepDate,
 * }} Deps
 */

/** The swap implementation, imported from where packages/gmt resolves it. */
async function loadEntry(root) {
  const require = createRequire(join(root, "packages/gmt/package.json"));
  return import(pathToFileURL(require.resolve(SWAP_ENTRY)).href);
}

/**
 * Whether the swap pass's report shows `ENTRY_CHECK` passed: the seam's `Temporal` was the swap
 * entry's object, so the pass tested `temporal-polyfill` and not the polyfill it replaces. A report
 * without the test, or with it skipped or failed, says no.
 * @param {{ testResults: any[] }} report
 * @returns {boolean}
 */
export function entryLoaded(report) {
  return report.testResults.some(
    (/** @type {any} */ file) =>
      String(file.name ?? "").endsWith(`/${ENTRY_CHECK.file}`) &&
      (file.assertionResults ?? []).some(
        (/** @type {any} */ r) =>
          r.fullName === ENTRY_CHECK.test && r.status === "passed",
      ),
  );
}

/**
 * Every primary zone, one `Intl.DateTimeFormat` each, from the runtime's own `Intl` (never the
 * polyfill's export): the swap's offset against `longOffset`, from 1970-01-01 to ten years after
 * `today`.
 * @param {any} entry
 * @param {SweepDate} today  the run date, a `Temporal.PlainDate`
 * @param {string[]} [zones]  the zones to compare (default: every primary zone)
 */
export function sweep(
  entry,
  today,
  zones = Intl.supportedValuesOf("timeZone"),
) {
  const formats = new Map(
    zones.map((zone) => [
      zone,
      new globalThis.Intl.DateTimeFormat("en", {
        timeZone: zone,
        timeZoneName: "longOffset",
      }),
    ]),
  );
  const span = sweepSpan(today);
  return {
    status: "ran",
    tz: process.versions.tz,
    ...sweepOffsets({
      zones,
      firstDay: span.firstDay,
      lastDay: span.lastDay,
      implOffset: (zone, ms) =>
        Number(
          entry.Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(
            zone,
          ).offsetNanoseconds,
        ) / 1e9,
      intlOffset: (zone, ms) =>
        formats
          .get(zone)
          ?.formatToParts(ms)
          .find((p) => p.type === "timeZoneName")?.value ?? "",
    }),
  };
}

/** @param {Leg} leg @returns {Promise<Runtime>} */
export async function runtime(leg) {
  const require = createRequire(import.meta.url);
  const version = (/** @type {string} */ name) =>
    JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8"))
      .version;
  const base = {
    node: process.versions.node,
    vitest: version("vitest"),
  };
  if (leg === "node") return { ...base, playwright: null, browser: null };
  const playwright = await import("playwright");
  const browser = await playwright[leg].launch();
  try {
    return {
      ...base,
      playwright: version("playwright"),
      browser: `${leg} ${browser.version()}`,
    };
  } finally {
    await browser.close();
  }
}

/** @type {Deps} */
const realDeps = {
  runPass,
  shards: (leg) => (leg === "node" ? 1 : BROWSER_SHARDS),
  runtime,
  loadEntry,
  sweep: (entry, today) => sweep(entry, today),
  today: () => globalThis.Temporal.Now.plainDateISO("UTC"),
};

/**
 * Why the swap cannot run on this checkout, or `null`.
 * @param {string} root
 * @param {string} version
 */
function installProblem(root, version) {
  let installed;
  try {
    installed = JSON.parse(
      readFileSync(
        join(root, "packages/gmt/node_modules/temporal-polyfill/package.json"),
        "utf8",
      ),
    ).version;
  } catch {
    return "temporal-polyfill is not installed in packages/gmt";
  }
  return installed === version
    ? null
    : `installed temporal-polyfill is ${installed}, expected ${version}`;
}

/** @param {string} root @param {Leg} leg */
function readVerdict(root, leg) {
  try {
    return JSON.parse(
      readFileSync(
        join(root, VERDICT_FILES[`temporal-polyfill-swap-${leg}`]),
        "utf8",
      ),
    );
  } catch {
    return null;
  }
}

/** @param {string} root @param {Leg} leg @param {(text: string) => void} stdout */
function summary(root, leg, stdout) {
  const v = readVerdict(root, leg);
  const lines = [`### Temporal polyfill swap (${leg})`, ""];
  if (v === null) lines.push("no verdict was written");
  else if (v.status !== "ran") lines.push(`could not run: ${v.message}`);
  else {
    const c = v.counts;
    lines.push(
      `temporal-polyfill ${v.version}: ${c.failed} tests fail on the swap and pass on @js-temporal/polyfill (of ${c.tests}).`,
      `${c.both} fail on both; ${c.fixed} fail only on @js-temporal/polyfill.`,
    );
  }
  // A Node leg that could not run after its sweep still carries the sweep.
  if (v?.sweep?.status === "ran") {
    lines.push(
      `Offset sweep: ${v.sweep.differingZones} zones differ from Intl, ${v.sweep.from} to ${v.sweep.through}, ${v.sweep.zones} zones, tz ${v.sweep.tz}.`,
    );
  } else if (v?.sweep) {
    lines.push(`Offset sweep could not run: ${v.sweep.message}`);
  }
  stdout(`${lines.join("\n")}\n`);
}

/**
 * Runs the command; returns the exit code.
 * @param {string[]} argv  the arguments after `node scripts/polyfill-swap.mjs`
 * @param {{ root?: string, stdout: (text: string) => void, stderr: (text: string) => void,
 *           deps?: Partial<Deps> }} io
 * @returns {Promise<number>}
 */
export async function main(argv, { root = ROOT, stdout, stderr, deps = {} }) {
  const d = { ...realDeps, ...deps };
  const args = argv.filter((a) => a !== "--");
  const usage = () => {
    stderr(
      `polyfill-swap: ${args.length === 0 ? "no leg given" : `unknown argument: ${args.join(" ")}`}\n${USAGE}\n`,
    );
    return 2;
  };
  if (args[0] === "summary") {
    if (args.length !== 2 || !LEGS.includes(args[1])) return usage();
    summary(root, /** @type {Leg} */ (args[1]), stdout);
    return 0;
  }
  const leg = /** @type {Leg} */ (args[0]);
  const version = /^--version=(\d+\.\d+\.\d+)$/.exec(args[1] ?? "")?.[1];
  if (!LEGS.includes(leg) || args.length !== 2 || !version) return usage();

  const source = `temporal-polyfill-swap-${leg}`;
  /** @param {unknown} error */
  const couldNotRun = (error) => {
    const message = messageOf(error);
    // A sweep that ran before a pass failed or timed out stays in the verdict.
    const verdict = couldNotRunVerdict(source, message);
    saveVerdict(
      root,
      sweepResult === null ? verdict : { ...verdict, sweep: sweepResult },
      "polyfill-swap",
    );
    stderr(`polyfill-swap: ${leg} could not run: ${message}\n`);
    return 2;
  };

  /** @type {Runtime} */
  let host;
  /** @type {object | null} */
  let sweepResult = null;
  /** @type {ReturnType<typeof runBoth>} */
  let passes;
  try {
    const problem = installProblem(root, version);
    if (problem) throw new Error(problem);
    if (leg === "node") {
      const entry = await d.loadEntry(root);
      if (!entry.Temporal || entry.Temporal === globalThis.Temporal) {
        throw new Error(
          "temporal-polyfill/full/implementation returned the runtime's built-in Temporal",
        );
      }
      // Before the passes, so a suite timeout cannot lose it: `couldNotRun` keeps it in the
      // verdict. A sweep that cannot run does not stop the leg.
      try {
        sweepResult = d.sweep(entry, d.today());
      } catch (error) {
        sweepResult = { status: "could-not-run", message: messageOf(error) };
      }
    }
    host = await d.runtime(leg);
    passes = runBoth(leg, root, d, stderr);
  } catch (error) {
    return couldNotRun(error);
  }
  // A swap pass that ran on the wrong Temporal proves nothing about temporal-polyfill, so it
  // files like any other leg that could not run, never as a pass or a failure.
  if (!entryLoaded(passes.swap)) return couldNotRun("swap entry not loaded");

  const result = classify(
    passes.swap,
    passes.control,
    leg,
    [],
    [],
    passes.swapErrors,
    passes.controlErrors,
  );
  const failing = [...result.untagged];
  if (
    passes.swapExit !== 0 &&
    failing.length === 0 &&
    result.hostUntagged.length === 0
  ) {
    // Vitest failed the run without a failure in its report (an unhandled error, say).
    failing.push({
      file: "(vitest)",
      test: `(vitest exited ${passes.swapExit})`,
      message: `Vitest exited with status ${passes.swapExit} on the swap pass, and its report shows no failed test or file. See the job log.`,
    });
  }
  const { files, tests, passed, skipped } = result.counts;
  const counts = {
    files,
    tests,
    passed,
    skipped,
    failed: failing.length,
    both: result.counts.hostUntagged,
    fixed: result.counts.controlOnly,
  };
  saveVerdict(
    root,
    polyfillSwapVerdict({
      leg,
      version,
      entry: SWAP_ENTRY,
      entryLoaded: entryLoaded(passes.swap),
      runtime: host,
      counts,
      failing,
      sweep: leg === "node" ? sweepResult : null,
    }),
    "polyfill-swap",
  );
  const sweepNote =
    sweepResult && "differingZones" in sweepResult
      ? `; sweep: ${sweepResult.differingZones} zones differ`
      : "";
  stdout(
    `polyfill-swap: ${leg} temporal-polyfill ${version}: ${counts.failed} swap-only failures of ${counts.tests} tests${sweepNote}\n`,
  );
  return 0;
}

/**
 * The control pass, then the swap pass, each rerun once when Vitest stopped early, and the check
 * that the pair can be compared.
 * @param {Leg} leg
 * @param {string} root
 * @param {Deps} d
 * @param {(text: string) => void} stderr
 */
function runBoth(leg, root, d, stderr) {
  const control = runPassAgainIfStopped(leg, "control", root, d, stderr);
  const swap = runPassAgainIfStopped(leg, "swap", root, d, stderr);
  const problem = incompleteRun(
    control.report,
    swap.report,
    control.exit,
    control.errors.length,
    "swap",
  );
  if (problem) throw new Error(problem);
  return {
    control: control.report,
    swap: swap.report,
    swapExit: swap.exit,
    controlErrors: control.errors,
    swapErrors: swap.errors,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
