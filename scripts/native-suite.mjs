#!/usr/bin/env node
/**
 * Runs the whole packages/gmt suite on a native Temporal engine and sorts what fails.
 *
 *   node scripts/native-suite.mjs <node|chromium|firefox>
 *   node scripts/native-suite.mjs summary <node|chromium|firefox>
 *
 * A leg runs the suite twice on the same host: once on @js-temporal/polyfill (the control) and
 * once on the native engine. A test that fails natively and passes on the control is a
 * divergence; one that fails on both is the runtime's own data or setup. Known failures are tagged
 * in scripts/lib/native-suite-tags.mjs. The verdict goes to artifacts/native-suite-<leg>.json for
 * the canary reporter, the raw Vitest reports beside it.
 *
 * Exit 0 when nothing is untagged (stale tags never fail the job), 1 when a divergence or host
 * failure has no tag, 2 when the leg could not run (wrong Node, browser missing, a pass left no
 * report) or the argument is unknown. `summary <leg>` prints the verdict file's engine line and
 * counts for the job summary and always exits 0.
 *
 * Node built-ins and Vitest only, and no `Date`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
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
  classify,
  KNOWN_HOST_FAILURES,
  KNOWN_NATIVE_FAILURES,
  withFailureMessages,
} from "./lib/native-suite-tags.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LEGS = ["node", "chromium", "firefox"];
const USAGE =
  "Usage: node scripts/native-suite.mjs <node|chromium|firefox>\n" +
  "       node scripts/native-suite.mjs summary <node|chromium|firefox>";
const SHOWN = 20;
/** One Vitest pass may run this long (the job allows 45 minutes for both passes and the setup). */
const PASS_TIMEOUT_MS = 18 * 60 * 1000;
/** A fixture check that starts a child process may run this long. */
const CHILD_TIMEOUT_MS = 60 * 1000;
const NO_NATIVE_MESSAGE = "native Temporal is not available on this runtime";
const SHIM_PATH = "packages/gmt/src/test/nativeTemporal.ts";

/**
 * @typedef {"node" | "chromium" | "firefox"} Leg
 * @typedef {"control" | "native"} Pass
 * @typedef {{ engine: string, playwright: string | null }} Engine
 * @typedef {{
 *   preflight: (leg: Leg, root: string) => Promise<Engine>,
 *   runPass: (leg: Leg, pass: Pass, root: string) => number | void,
 *   runtime: () => { node: string, vitest: string },
 *   divergenceRows: typeof KNOWN_NATIVE_FAILURES,
 *   hostGroups: typeof KNOWN_HOST_FAILURES,
 * }} Deps
 */

/** @param {Leg} leg @param {Pass} pass */
const reportPath = (leg, pass) =>
  `artifacts/native-suite-${leg}.${pass}.vitest.json`;

/** @param {Leg} leg @param {Pass} pass */
const errorsPath = (leg, pass) =>
  `artifacts/native-suite-${leg}.${pass}.errors.json`;

/** @param {Leg} leg @param {Pass} pass */
const messagesPath = (leg, pass) =>
  `artifacts/native-suite-${leg}.${pass}.messages.json`;

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
 * @param {"chromium" | "firefox"} leg
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
    const label = leg === "chromium" ? "Chromium" : "Firefox";
    return { engine: `${label} ${browser.version()}`, playwright: version };
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
 * @param {number} [timeoutMs]
 * @returns {number}
 */
export function runPass(leg, pass, root, timeoutMs = PASS_TIMEOUT_MS) {
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
  const out = reportPath(leg, pass);
  rmSync(join(root, out), { force: true });
  rmSync(join(root, errorsPath(leg, pass)), { force: true });
  rmSync(join(root, messagesPath(leg, pass)), { force: true });
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      vitestBin,
      "run",
      "--config",
      config,
      ...(browser ? ["--project", leg] : []),
      "--reporter=json",
      `--reporter=${fileURLToPath(new URL("./lib/native-suite-reporter.mjs", import.meta.url))}`,
      `--outputFile.json=${out}`,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NATIVE_SUITE_ERRORS: join(root, errorsPath(leg, pass)),
        NATIVE_SUITE_MESSAGES: join(root, messagesPath(leg, pass)),
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
        ? `the ${pass} pass timed out after ${Math.round(timeoutMs / 60000)} minutes`
        : `the ${pass} pass could not start: ${result.error.message}`,
    );
  }
  if (result.status === null) {
    throw new Error(`the ${pass} pass was killed by ${result.signal}`);
  }
  return result.status;
}

/** @type {Deps} */
const realDeps = {
  preflight,
  runPass,
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
 */
function readReport(root, leg, pass) {
  const path = join(root, reportPath(leg, pass));
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `the ${pass} pass left no Vitest report (${reportPath(leg, pass)})`,
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
      `the ${pass} pass left an unreadable Vitest report (${reportPath(leg, pass)}): ${messageOf(error)}`,
    );
  }
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
 * The unhandled errors the reporter wrote for a pass.
 * @param {string} root
 * @param {Leg} leg
 * @param {Pass} pass
 * @returns {{ name: string, message: string }[]}
 */
function readErrors(root, leg, pass) {
  const path = errorsPath(leg, pass);
  try {
    const parsed = JSON.parse(readFileSync(join(root, path), "utf8"));
    if (!Array.isArray(parsed)) throw new Error("not a list");
    return parsed;
  } catch (error) {
    throw new Error(
      `the ${pass} pass left no readable errors file (${path}), so its unhandled errors are unknown: ${messageOf(error)}`,
    );
  }
}

/**
 * The failure messages the reporter captured for a pass; none when it wrote no file.
 * @param {string} root
 * @param {Leg} leg
 * @param {Pass} pass
 * @returns {{ file: string, fullName: string, message: string }[]}
 */
function readMessages(root, leg, pass) {
  try {
    const parsed = JSON.parse(
      readFileSync(join(root, messagesPath(leg, pass)), "utf8"),
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
  let verdict;
  try {
    verdict = JSON.parse(
      readFileSync(
        join(
          root,
          /** @type {Record<string, string>} */ (VERDICT_FILES)[source],
        ),
        "utf8",
      ),
    );
  } catch {
    stdout(`${source}: no verdict\n`);
    return;
  }
  if (verdict.status !== "ran") {
    stdout(`${source}: could not run — ${verdict.message}\n`);
    return;
  }
  const c = verdict.counts;
  stdout(
    `${verdict.engine}\n` +
      `${c.tests} tests in ${c.files} files: ${c.passed} passed, ${c.tagged} tagged, ` +
      `${c.untagged} untagged, ${c.hostTagged} host tagged, ${c.hostUntagged} host untagged, ` +
      `${c.staleTags} stale tags\n`,
  );
}

/**
 * Runs both passes and reads what they left.
 * @param {Leg} leg
 * @param {string} root
 * @param {Deps} d
 */
function runPasses(leg, root, d) {
  const controlExit = d.runPass(leg, "control", root) ?? 0;
  const nativeExit = d.runPass(leg, "native", root) ?? 0;
  const control = withMessages(
    readReport(root, leg, "control"),
    readMessages(root, leg, "control"),
  );
  const native = withMessages(
    readReport(root, leg, "native"),
    readMessages(root, leg, "native"),
  );
  const controlErrors = readErrors(root, leg, "control");
  const nativeErrors = readErrors(root, leg, "native");
  const problem = incompleteRun(
    control,
    native,
    controlExit,
    controlErrors.length,
  );
  if (problem) throw new Error(problem);
  return { control, native, nativeExit, controlErrors, nativeErrors };
}

/** @param {any} report @param {{ file: string, fullName: string, message: string }[]} messages */
const withMessages = (report, messages) =>
  report === null ? null : withFailureMessages(report, messages);

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
        `${c.staleTags} stale tags`,
      ...listFailures("Untagged failures", result.untagged, c.untagged),
      ...listFailures(
        "Untagged host failures",
        result.hostUntagged,
        c.hostUntagged,
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

  /** @type {Engine} */
  let engine;
  /** @type {ReturnType<typeof runPasses>} */
  let passes;
  try {
    engine = await d.preflight(leg, root);
    passes = runPasses(leg, root, d);
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
  return result.counts.untagged > 0 || result.counts.hostUntagged > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
