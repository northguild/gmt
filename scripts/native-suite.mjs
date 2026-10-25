#!/usr/bin/env node
/**
 * Runs the whole packages/gmt suite on a native Temporal engine and sorts what fails.
 *
 *   node scripts/native-suite.mjs <node|chromium|firefox|webkit>
 *   node scripts/native-suite.mjs summary <node|chromium|firefox|webkit>
 *
 * A leg runs the suite twice on the same host: once on @js-temporal/polyfill (the control) and
 * once on the native engine. A test that fails natively and passes on the control is a
 * divergence; one that fails on both is the runtime's own data or setup; one that fails on the
 * control alone is a wrong answer GMT gives on the polyfill in that runtime. Known divergences and
 * host failures are tagged in scripts/lib/native-suite-tags.mjs; a control-only failure never is. The verdict goes to artifacts/native-suite-<leg>.json for
 * the canary reporter, the raw Vitest reports beside it.
 *
 * A browser leg first runs the compat check in that browser (scripts/lib/native-suite-compat.mjs):
 * the probes `temporal-compat.mjs check` runs on Node, on the browser's own engine, against the
 * polyfill GMT ships. Its verdict goes to artifacts/temporal-compat-<leg>.json. A workaround for
 * one engine's defect (D17 on Firefox, say) can only be judged there, so the reporter calls a
 * group removable when every engine in its scope says so.
 *
 * Exit 0 when nothing is untagged and nothing failed on the control alone (stale tags never fail
 * the job), 1 when a divergence or host failure has no tag or a test failed on the control alone,
 * 2 when the leg could not run (wrong Node, browser missing, a pass left no
 * report, a pass that stopped before every file ran on both tries), when a browser's compat
 * check could not run (the suite still runs and its verdict is still written), or when the
 * argument is unknown. `summary <leg>` prints the verdict files' engine line and counts for the job
 * summary and always exits 0.
 *
 * A pass that stops early is run once more before the leg gives up. Vitest's browser pool gives
 * up on a run when a page is lost ("Failed to run the test <file>."), and its JSON reporter then
 * writes every file it never started as passed with no tests, so a report alone looks complete.
 *
 * A browser pass runs as `BROWSER_SHARDS` Vitest runs (`--shard`), each in a fresh browser, and
 * the reports they leave are merged into the one report the pass is judged on.
 *
 * Node built-ins and Vitest only, and no `Date`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  couldNotRunVerdict,
  nativeSuiteVerdict,
  saveVerdict,
  VERDICT_FILES,
} from "./lib/canary-verdict.mjs";
import {
  BROWSER_LABELS,
  runBrowserCompat,
} from "./lib/native-suite-compat.mjs";
import {
  classify,
  KNOWN_HOST_FAILURES,
  KNOWN_NATIVE_FAILURES,
  withFailureMessages,
} from "./lib/native-suite-tags.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LEGS = ["node", "chromium", "firefox", "webkit"];
const USAGE =
  "Usage: node scripts/native-suite.mjs <node|chromium|firefox|webkit>\n" +
  "       node scripts/native-suite.mjs summary <node|chromium|firefox|webkit>";
const SHOWN = 20;
/**
 * One pass may run this long, all of its shards together (the job allows 45 minutes for both
 * passes and the setup).
 */
const PASS_TIMEOUT_MS = 18 * 60 * 1000;
/** A fixture check that starts a child process may run this long. */
const CHILD_TIMEOUT_MS = 60 * 1000;
/**
 * How many Vitest runs a browser pass is split into, each in a fresh browser. In Vitest's browser
 * mode every test file runs in its own iframe, and what the browser fetched for a file stays held
 * until the browser exits: on Chromium as deleted-but-open files under the temp directory
 * (Playwright starts it with `--disable-dev-shm-usage`; vitest-dev/vitest#9437), on WebKit in
 * memory. Over the whole suite that outgrows a GitHub runner: the Chromium page died at 325 to 361
 * of 880 files on three runs in a row, and the WebKit leg took the runner down. A shard of about
 * 110 files stays well under that on every engine. Node runs in one shard: no browser, nothing to
 * hold. Set it back to 1 once Vitest recycles the browser during a run.
 */
const BROWSER_SHARDS = 8;
const NO_NATIVE_MESSAGE = "native Temporal is not available on this runtime";
const SHIM_PATH = "packages/gmt/src/test/nativeTemporal.ts";

/**
 * @typedef {"node" | "chromium" | "firefox" | "webkit"} Leg
 * @typedef {"control" | "native"} Pass
 * @typedef {{ index: number, count: number }} Shard  one of a pass's Vitest runs, 1-based
 * @typedef {{ engine: string, playwright: string | null }} Engine
 * @typedef {ReturnType<typeof import("./lib/canary-verdict.mjs").browserCompatVerdict>} CompatVerdict
 * @typedef {{
 *   preflight: (leg: Leg, root: string) => Promise<Engine>,
 *   compatCheck: (leg: Exclude<Leg, "node">, root: string) => Promise<CompatVerdict>,
 *   runPass: (leg: Leg, pass: Pass, root: string, shard: Shard, timeoutMs: number) => number | void,
 *   shards: (leg: Leg) => number,
 *   runtime: () => { node: string, vitest: string },
 *   divergenceRows: typeof KNOWN_NATIVE_FAILURES,
 *   hostGroups: typeof KNOWN_HOST_FAILURES,
 * }} Deps
 */

/** The one shard of a pass that is not split. */
const WHOLE = { index: 1, count: 1 };

/** @param {Leg} leg */
const shardsFor = (leg) => (leg === "node" ? 1 : BROWSER_SHARDS);

/** `.2of8` in a shard's file names; nothing for a pass that is not split. */
const shardSuffix = (/** @type {Shard} */ shard) =>
  shard.count === 1 ? "" : `.${shard.index}of${shard.count}`;

/** ` in shard 2 of 8` in a message; nothing for a pass that is not split. */
const shardLabel = (/** @type {Shard} */ shard) =>
  shard.count === 1 ? "" : ` in shard ${shard.index} of ${shard.count}`;

/** @param {Leg} leg @param {Pass} pass @param {Shard} [shard] */
const reportPath = (leg, pass, shard = WHOLE) =>
  `artifacts/native-suite-${leg}.${pass}${shardSuffix(shard)}.vitest.json`;

/** @param {Leg} leg @param {Pass} pass @param {Shard} [shard] */
const errorsPath = (leg, pass, shard = WHOLE) =>
  `artifacts/native-suite-${leg}.${pass}${shardSuffix(shard)}.errors.json`;

/** @param {Leg} leg @param {Pass} pass @param {Shard} [shard] */
const messagesPath = (leg, pass, shard = WHOLE) =>
  `artifacts/native-suite-${leg}.${pass}${shardSuffix(shard)}.messages.json`;

/** @param {unknown} error */
const messageOf = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * The test-clock fixture's own properties, checked on the shim an engine loaded: the host's `Now`
 * is not the shim's, the clock follows `Date.now()` with the sub-millisecond tail the polyfill
 * leg gives, a bad zone throws the engine's error before the clock is read, the clock is clamped
 * to the Instant range, and `Temporal` is frozen while `Now` stays spy-able. Self-contained,
 * because it also runs inside a browser page (serialised with `toString`). Returns one sentence
 * per problem.
 * @param {{ Temporal: any }} shim
 * @returns {string[]}
 */
export function shimProblems(shim) {
  /** @type {string[]} */
  const problems = [];
  const { Temporal } = shim;
  const realNow = Date.now; // date-ban: the fixture's clock is Date.now by design
  const zoneMethods = [
    "zonedDateTimeISO",
    "plainDateTimeISO",
    "plainDateISO",
    "plainTimeISO",
  ];
  /** @param {number} ms */
  const setClock = (ms) => {
    Date.now = () => ms; // date-ban: the fixture's clock is Date.now by design
  };

  const checkHostNow = () => {
    if (Temporal.Now === globalThis.Temporal.Now) {
      problems.push(
        "the shim's Temporal.Now is the host's own Temporal.Now, so the test clock is not in place",
      );
    }
  };

  const checkSubMillisecondTail = () => {
    const expected = "2024-03-10T12:00:00.8000008Z"; // the tail is the previous call's ms % 1e6
    try {
      setClock(1710072000800); // 2024-03-10T12:00:00.800Z
      Temporal.Now.instant();
      const got = Temporal.Now.instant().toString();
      if (got !== expected) {
        problems.push(`Now.instant() is ${got}, expected ${expected}`);
      }
    } finally {
      Date.now = realNow; // date-ban: restores the clock
    }
  };

  /** @param {() => unknown} call @param {string} name @param {string} what */
  const expectThrow = (call, name, what) => {
    try {
      call();
      problems.push(`${what} did not throw ${name}`);
    } catch (error) {
      if (/** @type {any} */ (error)?.name !== name) {
        problems.push(`${what} threw ${String(error)}, expected ${name}`);
      }
    }
  };

  const checkBadZones = () => {
    for (const method of zoneMethods) {
      expectThrow(
        () => Temporal.Now[method]("Not/AZone"),
        "RangeError",
        `Now.${method}("Not/AZone")`,
      );
      expectThrow(
        () => Temporal.Now[method](5),
        "TypeError",
        `Now.${method}(5)`,
      );
    }
  };

  /** @param {number[]} clock */
  const lastInstant = (clock) => {
    let last = "";
    try {
      for (const ms of clock) {
        setClock(ms);
        last = String(Temporal.Now.instant().epochNanoseconds);
      }
    } catch (error) {
      last = `an error (${String(error)})`;
    }
    return last;
  };

  // As in the polyfill: the zone is checked before the clock is read.
  /** @param {string} method */
  const checkZoneBeforeClock = (method) => {
    setClock(1700000000123);
    Temporal.Now.instant();
    setClock(1700000000456);
    try {
      Temporal.Now[method]("Not/AZone");
    } catch {
      // checked above
    }
    const tail = String(Temporal.Now.instant().epochNanoseconds);
    if (tail !== "1700000000456000123") {
      problems.push(
        `after a rejected Now.${method}() Now.instant() is ${tail} ns, expected 1700000000456000123 (the rejected call read the clock)`,
      );
    }
  };

  // The clock is clamped to the Instant range after the carried tail is added.
  const checkClamp = () => {
    const max = lastInstant([8.64e15 - 1, 8.64e15]);
    if (max !== "8640000000000000000000") {
      problems.push(
        `Now.instant() at the last millisecond gave ${max}, expected 8640000000000000000000 (no clamp)`,
      );
    }
    const min = lastInstant([-8.64e15 + 1, -8.64e15]);
    if (min !== "-8640000000000000000000") {
      problems.push(
        `Now.instant() at the first millisecond gave ${min}, expected -8640000000000000000000 (no clamp)`,
      );
    }
  };

  const checkClockOrdering = () => {
    try {
      for (const method of zoneMethods) checkZoneBeforeClock(method);
      checkClamp();
    } catch (error) {
      problems.push(`the clock checks threw ${String(error)}`);
    } finally {
      Date.now = realNow; // date-ban: restores the clock
    }
  };

  // The suite spies on Now's members, as it does on the polyfill's own Now: each one must stay
  // writable and configurable.
  const checkSpyable = () => {
    if (!Object.isFrozen(Temporal))
      problems.push("the shim's Temporal is not frozen");
    if (Object.isFrozen(Temporal.Now))
      problems.push("the shim's Now is frozen, so it cannot be spied on");
    for (const member of ["instant", "timeZoneId", ...zoneMethods]) {
      const own = Object.getOwnPropertyDescriptor(Temporal.Now, member);
      if (!own?.writable || !own.configurable) {
        problems.push(
          `the shim's Now.${member} is not a writable, configurable member, so it cannot be spied on`,
        );
      }
    }
    if (
      Object.prototype.toString.call(Temporal.Now) !== "[object Temporal.Now]"
    ) {
      problems.push("the shim's Now is not tagged Temporal.Now");
    }
  };

  checkHostNow();
  checkSubMillisecondTail();
  checkBadZones();
  checkClockOrdering();
  checkSpyable();
  return problems;
}

/**
 * The shim as plain script: types stripped and `export` dropped, so a browser page can run it
 * (inside a `try`) and read `Temporal` and `toTemporalInstant` from the surrounding scope.
 * @param {string} root
 * @returns {string}
 */
export function shimSource(root) {
  const text = stripTypeScriptTypes(
    readFileSync(join(root, SHIM_PATH), "utf8"),
  );
  const plain = text.replace(/^export (const|function) /gm, "$1 ");
  if (/^export /m.test(plain))
    throw new Error("the shim has an export shimSource cannot drop");
  return plain;
}

/**
 * Fixture checks that need a process of their own, run on the Node leg: the engine's time zone
 * under `TZ`, and the shim refusing to load without native Temporal.
 * @param {string} root
 * @returns {string[]}
 */
function childProblems(root) {
  const url = pathToFileURL(join(root, SHIM_PATH)).href;
  /** @param {string} code @param {Record<string, string>} env */
  const run = (code, env) => {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: CHILD_TIMEOUT_MS,
    });
    return r.error ? `error: ${r.error.message}` : r.stdout.trim();
  };
  const problems = [];
  const zone = "America/New_York";
  const gotZone = run(
    `const { Temporal } = await import(${JSON.stringify(url)}); console.log(Temporal.Now.timeZoneId());`,
    { TZ: zone },
  );
  if (gotZone !== zone) {
    problems.push(
      `Now.timeZoneId() under TZ=${zone} is ${gotZone}, expected ${zone}`,
    );
  }
  const gotMessage = run(
    `delete globalThis.Temporal; try { await import(${JSON.stringify(url)}); console.log("loaded"); } catch (e) { console.log(e.message); }`,
    {},
  );
  if (gotMessage !== NO_NATIVE_MESSAGE) {
    problems.push(
      `the shim without native Temporal said "${gotMessage}", expected "${NO_NATIVE_MESSAGE}"`,
    );
  }
  return problems;
}

/** @param {string[]} problems */
function failChecks(problems) {
  if (problems.length > 0) {
    throw new Error(`fixture check failed: ${problems.join("; ")}`);
  }
}

/**
 * @param {string} root
 * @returns {Promise<Engine>}
 */
async function nodePreflight(root) {
  const major = Number(process.versions.node.split(".")[0]);
  if (typeof globalThis.Temporal !== "object" || major < 26) {
    throw new Error(
      `native Temporal is not available on Node ${process.version}; the node leg needs Node 26 or newer`,
    );
  }
  const shim = await import(pathToFileURL(join(root, SHIM_PATH)).href);
  failChecks([...shimProblems(shim), ...childProblems(root)]);
  return {
    engine: `Node ${process.version} · V8 ${process.versions.v8} · ICU ${process.versions.icu} · tz ${process.versions.tz}`,
    playwright: null,
  };
}

/**
 * Loads the shim in a fresh page of `context`, runs `shimProblems` there and returns its problems
 * and the zone it reports.
 * @param {any} context
 * @param {string} load  the shim as a page script
 * @param {string} zone  the zone the context was created with
 * @returns {Promise<string[]>}
 */
async function pageProblems(context, load, zone) {
  const page = await context.newPage();
  const readShim = `(${(/** @type {typeof shimProblems} */ check) => {
    const w = /** @type {any} */ (window);
    if (w.__shimError) return { error: w.__shimError };
    return {
      problems: check(w.__shim),
      zone: w.__shim.Temporal.Now.timeZoneId(),
    };
  }})(${shimProblems})`;
  await page.addScriptTag({ type: "module", content: load });
  await page.waitForFunction("window.__shim || window.__shimError");
  const loaded = await page.evaluate(readShim);
  if (loaded.error) return [`the shim did not load: ${loaded.error}`];
  const problems = [...loaded.problems];
  if (loaded.zone !== zone) {
    problems.push(
      `Now.timeZoneId() under timezoneId ${zone} is ${loaded.zone}, expected ${zone}`,
    );
  }
  return problems;
}

/**
 * Loads the shim in a page without `Temporal` and reports whether it refused with the expected
 * message.
 * @param {any} context
 * @param {string} load
 * @returns {Promise<string[]>}
 */
async function bareProblems(context, load) {
  const bare = await context.newPage();
  await bare.addInitScript("delete globalThis.Temporal;");
  await bare.goto("about:blank");
  await bare.addScriptTag({ type: "module", content: load });
  await bare.waitForFunction("window.__shim || window.__shimError");
  const refused = await bare.evaluate("window.__shimError ?? null");
  if (refused === NO_NATIVE_MESSAGE) return [];
  return [
    `the shim without native Temporal said "${refused}", expected "${NO_NATIVE_MESSAGE}"`,
  ];
}

/**
 * @param {Exclude<Leg, "node">} leg
 * @param {string} root
 * @returns {Promise<Engine>}
 */
async function browserPreflight(leg, root) {
  const require = createRequire(import.meta.url);
  let playwright;
  try {
    playwright = await import("playwright");
  } catch (error) {
    throw new Error(`playwright is not installed: ${messageOf(error)}`);
  }
  const version = JSON.parse(
    readFileSync(require.resolve("playwright/package.json"), "utf8"),
  ).version;
  const browser = await playwright[leg].launch();
  try {
    const zone = "America/New_York";
    const context = await browser.newContext({ timezoneId: zone });
    const page = await context.newPage();
    const [temporal, toInstant] = await page.evaluate(() => [
      typeof globalThis.Temporal,
      typeof Date.prototype.toTemporalInstant,
    ]);
    if (temporal !== "object" || toInstant !== "function") {
      throw new Error(
        `native Temporal is not available in ${leg} ${browser.version()}`,
      );
    }
    const load = `try {\n${shimSource(root)}\nwindow.__shim = { Temporal, toTemporalInstant };\n} catch (e) { window.__shimError = String(e && e.message); }`;
    failChecks([
      ...(await pageProblems(context, load, zone)),
      ...(await bareProblems(context, load)),
    ]);
    return {
      engine: `${BROWSER_LABELS[leg]} ${browser.version()}`,
      playwright: version,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Checks that this runtime can run the native leg and names its engine. Throws with the reason.
 * Every leg runs the shim's fixture checks (see `shimProblems`); a browser runs them in a page,
 * with its time zone set through the context and without `Temporal` in a second page.
 * @param {Leg} leg
 * @param {string} root
 * @returns {Promise<Engine>}
 */
function preflight(leg, root) {
  return leg === "node" ? nodePreflight(root) : browserPreflight(leg, root);
}

/**
 * Runs Vitest once, leaves its JSON report under `artifacts/` and returns Vitest's exit status.
 * Vitest exits non-zero when tests fail, so the status alone is no verdict; `main` reads it beside
 * the report. Throws when the process cannot start, is killed, or runs past `timeoutMs`.
 * @param {Leg} leg
 * @param {Pass} pass
 * @param {string} root
 * @param {Shard} [shard]  which of the pass's runs this is; `--shard` goes to Vitest when it is split
 * @param {number} [timeoutMs]  what is left of the pass's time
 * @returns {number}
 */
export function runPass(
  leg,
  pass,
  root,
  shard = WHOLE,
  timeoutMs = PASS_TIMEOUT_MS,
) {
  const require = createRequire(import.meta.url);
  // `vitest/vitest.mjs` is not an exported subpath: find the bin through package.json.
  const pkgPath = require.resolve("vitest/package.json");
  const vitestBin = join(
    dirname(pkgPath),
    JSON.parse(readFileSync(pkgPath, "utf8")).bin.vitest,
  );
  const browser = leg !== "node";
  const config = browser
    ? "packages/gmt/vitest.browser.config.ts"
    : pass === "native"
      ? "packages/gmt/vitest.native.config.ts"
      : "packages/gmt/vitest.config.ts";
  const out = reportPath(leg, pass, shard);
  rmSync(join(root, out), { force: true });
  rmSync(join(root, errorsPath(leg, pass, shard)), { force: true });
  rmSync(join(root, messagesPath(leg, pass, shard)), { force: true });
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const limit = `the ${pass} pass ran past its ${Math.round(PASS_TIMEOUT_MS / 60000)}-minute limit${shardLabel(shard)}`;
  if (timeoutMs <= 0) throw new Error(limit);
  const result = spawnSync(
    process.execPath,
    [
      vitestBin,
      "run",
      "--config",
      config,
      ...(browser ? ["--project", leg] : []),
      ...(shard.count > 1 ? [`--shard=${shard.index}/${shard.count}`] : []),
      "--reporter=json",
      `--reporter=${fileURLToPath(new URL("./lib/native-suite-reporter.mjs", import.meta.url))}`,
      `--outputFile.json=${out}`,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NATIVE_SUITE_ERRORS: join(root, errorsPath(leg, pass, shard)),
        NATIVE_SUITE_MESSAGES: join(root, messagesPath(leg, pass, shard)),
        ...(browser && pass === "control" ? { GMT_TEMPORAL: "polyfill" } : {}),
      },
      stdio: ["ignore", "ignore", "inherit"],
      maxBuffer: 256 * 1024 * 1024,
      timeout: timeoutMs,
    },
  );
  if (result.error) {
    const timedOut = /** @type {any} */ (result.error).code === "ETIMEDOUT";
    throw new Error(
      timedOut
        ? limit
        : `the ${pass} pass could not start${shardLabel(shard)}: ${result.error.message}`,
    );
  }
  if (result.status === null) {
    throw new Error(
      `the ${pass} pass was killed by ${result.signal}${shardLabel(shard)}`,
    );
  }
  return result.status;
}

/** @type {Deps} */
const realDeps = {
  preflight,
  compatCheck: (leg, root) =>
    runBrowserCompat(leg, root, { playwright: () => import("playwright") }),
  runPass,
  shards: shardsFor,
  runtime: () => ({
    node: process.versions.node,
    vitest: JSON.parse(
      readFileSync(
        createRequire(import.meta.url).resolve("vitest/package.json"),
        "utf8",
      ),
    ).version,
  }),
  divergenceRows: KNOWN_NATIVE_FAILURES,
  hostGroups: KNOWN_HOST_FAILURES,
};

/**
 * @param {string} root
 * @param {Leg} leg
 * @param {Pass} pass
 * @param {Shard} [shard]
 */
function readReport(root, leg, pass, shard = WHOLE) {
  const path = join(root, reportPath(leg, pass, shard));
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `the ${pass} pass left no Vitest report${shardLabel(shard)} (${reportPath(leg, pass, shard)})`,
    );
  }
  try {
    const parsed = JSON.parse(text);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.testResults)
    ) {
      throw new Error("no testResults");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `the ${pass} pass left an unreadable Vitest report${shardLabel(shard)} (${reportPath(leg, pass, shard)}): ${messageOf(error)}`,
    );
  }
}

/** The counts the JSON reporter puts at the top of a report; a merge adds them up. */
const REPORT_COUNTS = [
  "numTotalTestSuites",
  "numPassedTestSuites",
  "numFailedTestSuites",
  "numPendingTestSuites",
  "numTotalTests",
  "numPassedTests",
  "numFailedTests",
  "numPendingTests",
  "numTodoTests",
];

/**
 * One Vitest JSON report from the reports of a pass's shards, in shard order: the counts added
 * up, `success` only when every shard succeeded, the earliest `startTime`, and every file. The
 * first shard's other fields (its snapshot summary) stand for all; nothing reads them.
 * @param {any[]} reports
 * @returns {any}
 */
export function mergeReports(reports) {
  if (reports.length === 0) throw new Error("no shard reports to merge");
  /** @param {string} key */
  const sum = (key) =>
    reports.reduce((n, r) => n + (Number.isFinite(r[key]) ? r[key] : 0), 0);
  const starts = reports
    .map((r) => r.startTime)
    .filter((t) => Number.isFinite(t));
  return {
    ...reports[0],
    ...Object.fromEntries(REPORT_COUNTS.map((key) => [key, sum(key)])),
    startTime: starts.length === 0 ? reports[0].startTime : Math.min(...starts),
    success: reports.every((r) => r.success === true),
    testResults: reports.flatMap((r) => r.testResults),
  };
}

/**
 * Why a pair of reports cannot be trusted, or `null`: a pass that ran no tests, a native pass
 * that ran fewer files than the control, or a control pass Vitest failed without a failure in its
 * report.
 * @param {any} control
 * @param {any} native
 * @param {number} controlExit
 * @param {number} controlErrors  how many unhandled errors the control pass reported
 * @returns {string | null}
 */
function incompleteRun(control, native, controlExit, controlErrors) {
  /** @param {any} report */
  const tests = (report) =>
    report.testResults.reduce(
      (/** @type {number} */ n, /** @type {any} */ f) =>
        n + (f.assertionResults?.length ?? 0),
      0,
    );
  if (tests(native) === 0) return "the native pass ran no tests";
  if (tests(control) === 0) return "the control pass ran no tests";
  const nativeFiles = native.testResults.length;
  const controlFiles = control.testResults.length;
  if (nativeFiles < controlFiles) {
    return `the native pass ran ${nativeFiles} files, the control pass ${controlFiles}`;
  }
  const controlFailed = control.testResults.some(
    (/** @type {any} */ f) =>
      f.status === "failed" ||
      (f.assertionResults ?? []).some(
        (/** @type {any} */ r) => r.status === "failed",
      ),
  );
  if (controlExit !== 0 && !controlFailed && controlErrors === 0) {
    return `Vitest exited with status ${controlExit} on the control pass, and its report shows no failure`;
  }
  return null;
}

/**
 * The files of a report that Vitest never started. The JSON reporter writes a file the run
 * stopped short of as passed, with no tests and the run's own start as both of its times; a file
 * that ran with no test in it is failed, and a file whose tests were all skipped lists them.
 * @param {any} report
 * @returns {string[]}
 */
function unfinishedFiles(report) {
  return report.testResults
    .filter(
      (/** @type {any} */ f) =>
        (f.assertionResults?.length ?? 0) === 0 &&
        f.status !== "failed" &&
        f.startTime === f.endTime,
    )
    .map((/** @type {any} */ f) => String(f.name ?? ""));
}

/** @param {{ name: string, message: string, causes?: string[] }} e */
const errorLine = (e) =>
  [
    `${e.name}: ${e.message}`,
    ...(e.causes ?? []).map((c) => `caused by ${c}`),
  ].join("; ");

/**
 * The unhandled errors the reporter wrote for a pass.
 * @param {string} root
 * @param {Leg} leg
 * @param {Pass} pass
 * @param {Shard} [shard]
 * @returns {{ name: string, message: string, causes?: string[] }[]}
 */
function readErrors(root, leg, pass, shard = WHOLE) {
  const path = errorsPath(leg, pass, shard);
  try {
    const parsed = JSON.parse(readFileSync(join(root, path), "utf8"));
    if (!Array.isArray(parsed)) throw new Error("not a list");
    return parsed;
  } catch (error) {
    throw new Error(
      `the ${pass} pass left no readable errors file${shardLabel(shard)} (${path}), so its unhandled errors are unknown: ${messageOf(error)}`,
    );
  }
}

/**
 * The failure messages the reporter captured for a pass; none when it wrote no file.
 * @param {string} root
 * @param {Leg} leg
 * @param {Pass} pass
 * @param {Shard} [shard]
 * @returns {{ file: string, fullName: string, message: string }[]}
 */
function readMessages(root, leg, pass, shard = WHOLE) {
  try {
    const parsed = JSON.parse(
      readFileSync(join(root, messagesPath(leg, pass, shard)), "utf8"),
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {string} title @param {{ file: string, test: string, message: string }[]} rows @param {number} total */
function listFailures(title, rows, total) {
  if (total === 0) return [];
  return [
    `${title} (${total}, first ${Math.min(SHOWN, rows.length)}):`,
    ...rows
      .slice(0, SHOWN)
      .map(
        (r) =>
          `  ${r.file} > ${r.test}\n    ${r.message.split("\n")[0].slice(0, 200)}`,
      ),
  ];
}

/**
 * Prints the verdict file's engine line and counts.
 * @param {Leg} leg
 * @param {string} root
 * @param {(text: string) => void} stdout
 */
function summary(leg, root, stdout) {
  const source = `native-suite-${leg}`;
  const verdict = readVerdict(root, source);
  if (verdict === null) {
    stdout(`${source}: no verdict\n`);
  } else if (verdict.status !== "ran") {
    stdout(`${source}: could not run — ${verdict.message}\n`);
  } else {
    const c = verdict.counts;
    stdout(
      `${verdict.engine}\n` +
        `${c.tests} tests in ${c.files} files: ${c.passed} passed, ${c.tagged} tagged, ` +
        `${c.untagged} untagged, ${c.hostTagged} host tagged, ${c.hostUntagged} host untagged, ` +
        `${c.controlOnly} control only, ${c.staleTags} stale tags\n`,
    );
  }
  if (leg === "node") return;
  const compatSource = `temporal-compat-${leg}`;
  const compat = readVerdict(root, compatSource);
  if (compat === null) {
    stdout(`${compatSource}: no verdict\n`);
  } else if (compat.status !== "ran") {
    stdout(`${compatSource}: could not run — ${compat.message}\n`);
  } else {
    stdout(`${compatLine(compat)}\n`);
  }
}

/**
 * The verdict a source wrote under `root`, or null when there is none or it cannot be read.
 * @param {string} root
 * @param {string} source
 * @returns {any}
 */
function readVerdict(root, source) {
  try {
    return JSON.parse(
      readFileSync(
        join(
          root,
          /** @type {Record<string, string>} */ (VERDICT_FILES)[source],
        ),
        "utf8",
      ),
    );
  } catch {
    return null;
  }
}

/**
 * The compat check's counts on this browser, as the report and the summary print them.
 * @param {CompatVerdict} compat
 */
function compatLine(compat) {
  const c = compat.counts;
  return (
    `${c.workarounds} workarounds on @js-temporal/polyfill ${compat.runtime.polyfill} in ` +
    `${compat.engine}: ${c.stillNeeded} still needed, ${c.removable} removable, ${c.guard} guard, ` +
    `${c.outOfScope} out of scope on ${compat.engineId}`
  );
}

/**
 * @typedef {{ exit: number, report: any, errors: ReturnType<typeof readErrors>,
 *             unfinished: string[] }} PassRun
 */

/**
 * Runs one pass, shard by shard within the pass's time, and reads what it left. A split pass is
 * judged on the merged report, written where an unsplit pass writes its own.
 * @param {Leg} leg
 * @param {Pass} pass
 * @param {string} root
 * @param {Deps} d
 * @param {(text: string) => void} stderr
 * @returns {PassRun}
 */
function runOnce(leg, pass, root, d, stderr) {
  const count = d.shards(leg);
  const started = performance.now();
  let exit = 0;
  const reports = [];
  const messages = [];
  const errors = [];
  for (let index = 1; index <= count; index += 1) {
    const shard = { index, count };
    // One line per shard, so the job log says which shard a trace or a lost browser belongs to.
    if (count > 1)
      stderr(`native-suite: ${pass} pass, shard ${index} of ${count}\n`);
    // Whole milliseconds: `spawnSync` refuses a fractional timeout.
    const left = Math.floor(PASS_TIMEOUT_MS - (performance.now() - started));
    const status = d.runPass(leg, pass, root, shard, left) ?? 0;
    if (exit === 0) exit = status;
    reports.push(readReport(root, leg, pass, shard));
    messages.push(...readMessages(root, leg, pass, shard));
    errors.push(...readErrors(root, leg, pass, shard));
  }
  const report = count === 1 ? reports[0] : mergeReports(reports);
  if (count > 1) {
    // The pass is judged, uploaded and summarised as one report; the shards' files go.
    writeFileSync(join(root, reportPath(leg, pass)), JSON.stringify(report));
    writeFileSync(join(root, errorsPath(leg, pass)), JSON.stringify(errors));
    writeFileSync(
      join(root, messagesPath(leg, pass)),
      JSON.stringify(messages),
    );
    for (let index = 1; index <= count; index += 1) {
      const shard = { index, count };
      for (const path of [reportPath, errorsPath, messagesPath]) {
        rmSync(join(root, path(leg, pass, shard)), { force: true });
      }
    }
  }
  const judged = withFailureMessages(report, messages);
  return { exit, report: judged, errors, unfinished: unfinishedFiles(judged) };
}

/**
 * One sentence on a pass that stopped early: how far it got and what Vitest said, cause included.
 * @param {Pass} pass
 * @param {PassRun} run
 */
function stoppedEarly(pass, run) {
  const total = run.report.testResults.length;
  const why =
    run.errors.length === 0
      ? "with no error reported"
      : `Vitest said: ${run.errors.map(errorLine).join(" | ")}`;
  return `the ${pass} pass stopped after ${total - run.unfinished.length} of ${total} files (${why})`;
}

/**
 * Runs a pass, and once more when Vitest stopped before every file ran. A pass that stops on both
 * tries is one the leg could not run, and the error Vitest gave is the reason. The verdict never
 * sees a stopped pass: its never-run files would read as passing, which hides a divergence and
 * reports every tag on such a file as stale.
 * @param {Leg} leg
 * @param {Pass} pass
 * @param {string} root
 * @param {Deps} d
 * @param {(text: string) => void} stderr
 * @returns {PassRun}
 */
function runPassAgainIfStopped(leg, pass, root, d, stderr) {
  const first = runOnce(leg, pass, root, d, stderr);
  if (first.unfinished.length === 0) return first;
  stderr(`native-suite: ${stoppedEarly(pass, first)}; running it again\n`);
  const second = runOnce(leg, pass, root, d, stderr);
  if (second.unfinished.length === 0) return second;
  throw new Error(`${stoppedEarly(pass, second)}, on both tries`);
}

/**
 * Runs both passes and reads what they left.
 * @param {Leg} leg
 * @param {string} root
 * @param {Deps} d
 * @param {(text: string) => void} stderr
 */
function runPasses(leg, root, d, stderr) {
  const control = runPassAgainIfStopped(leg, "control", root, d, stderr);
  const native = runPassAgainIfStopped(leg, "native", root, d, stderr);
  const problem = incompleteRun(
    control.report,
    native.report,
    control.exit,
    control.errors.length,
  );
  if (problem) throw new Error(problem);
  return {
    control: control.report,
    native: native.report,
    nativeExit: native.exit,
    controlErrors: control.errors,
    nativeErrors: native.errors,
  };
}

/**
 * The text printed after a run: the engine line, the counts and the first failures.
 * @param {Engine} engine
 * @param {import("./lib/native-suite-tags.mjs").Classification} result
 * @returns {string}
 */
function reportText(engine, result) {
  const c = result.counts;
  return (
    [
      engine.engine,
      `${c.tests} tests in ${c.files} files: ${c.passed} passed, ${c.tagged} tagged, ` +
        `${c.untagged} untagged, ${c.hostTagged} host tagged, ${c.hostUntagged} host untagged, ` +
        `${c.controlOnly} control only, ${c.staleTags} stale tags`,
      ...listFailures("Untagged failures", result.untagged, c.untagged),
      ...listFailures(
        "Untagged host failures",
        result.hostUntagged,
        c.hostUntagged,
      ),
      ...listFailures(
        "Failures on the control alone",
        result.controlOnly,
        c.controlOnly,
      ),
      ...(c.staleTags > 0
        ? [
            `${c.staleTags} known failure tag(s) no longer apply; the canary report names them`,
          ]
        : []),
    ].join("\n") + "\n"
  );
}

/**
 * Runs the command; returns the exit code.
 * @param {string[]} argv  the arguments after `node scripts/native-suite.mjs`
 * @param {{ root?: string, stdout: (text: string) => void, stderr: (text: string) => void,
 *           deps?: Partial<Deps> }} io
 * @returns {Promise<number>}
 */
export async function main(argv, { root = ROOT, stdout, stderr, deps = {} }) {
  const d = { ...realDeps, ...deps };
  const args = argv.filter((a) => a !== "--");
  const isSummary = args[0] === "summary";
  const leg = /** @type {Leg} */ (isSummary ? args[1] : args[0]);
  if (!LEGS.includes(leg) || args.length !== (isSummary ? 2 : 1)) {
    stderr(
      `native-suite: ${args.length === 0 ? "no leg given" : `unknown argument: ${args.join(" ")}`}\n${USAGE}\n`,
    );
    return 2;
  }
  if (isSummary) {
    summary(leg, root, stdout);
    return 0;
  }

  const source = `native-suite-${leg}`;
  /** @param {unknown} error */
  const couldNotRun = (error) => {
    const message = messageOf(error);
    saveVerdict(root, couldNotRunVerdict(source, message), "native-suite");
    stderr(`native-suite: ${leg} could not run: ${message}\n`);
    return 2;
  };

  // The compat check comes first and on its own: it needs the browser and the built dist, not
  // the suite, and a check that cannot run must not stop the suite (nor the other way round).
  let compatFailed = false;
  if (leg !== "node") {
    const compatSource = `temporal-compat-${leg}`;
    try {
      const compat = await d.compatCheck(leg, root);
      saveVerdict(root, compat, "native-suite");
      stdout(`${compatLine(compat)}\n`);
    } catch (error) {
      const message = messageOf(error);
      saveVerdict(
        root,
        couldNotRunVerdict(compatSource, message),
        "native-suite",
      );
      stderr(
        `native-suite: the ${leg} compat check could not run: ${message}\n`,
      );
      compatFailed = true;
    }
  }

  /** @type {Engine} */
  let engine;
  /** @type {ReturnType<typeof runPasses>} */
  let passes;
  try {
    engine = await d.preflight(leg, root);
    passes = runPasses(leg, root, d, stderr);
  } catch (error) {
    return couldNotRun(error);
  }

  const result = classify(
    passes.native,
    passes.control,
    leg,
    d.divergenceRows,
    d.hostGroups,
    passes.nativeErrors,
    passes.controlErrors,
  );
  const failures =
    result.untagged.length +
    result.hostUntagged.length +
    result.tagged.length +
    result.hostTagged.length;
  if (passes.nativeExit !== 0 && failures === 0) {
    // Vitest failed the run without a failure in its report (an unhandled error, say).
    result.untagged.push({
      file: "(vitest)",
      test: `(vitest exited ${passes.nativeExit})`,
      message: `Vitest exited with status ${passes.nativeExit} on the native pass, and its report shows no failed test or file. See the job log.`,
    });
    result.counts.untagged += 1;
  }
  const { node, vitest } = d.runtime();
  saveVerdict(
    root,
    nativeSuiteVerdict({
      leg,
      engine: engine.engine,
      runtime: { node, vitest, playwright: engine.playwright },
      ...result,
    }),
    "native-suite",
  );
  stdout(reportText(engine, result));
  if (compatFailed) return 2;
  const { untagged, hostUntagged, controlOnly } = result.counts;
  return untagged > 0 || hostUntagged > 0 || controlOnly > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
