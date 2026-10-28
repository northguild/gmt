/**
 * A Vitest reporter for the native-suite runner. The JSON reporter leaves out the errors a test
 * run did not catch (an unhandled rejection, say); this one writes them to the file named by
 * `NATIVE_SUITE_ERRORS` as `[{ name, message, causes }]`, so the runner can tell a clean run from
 * one Vitest failed for a reason no test reports. `causes` is the error's `cause` chain, outermost
 * first, each one `Name: message`: the browser pool's "Failed to run the test <file>." wraps the
 * real reason (the page went away, say) in its cause, and without it the record says nothing.
 * Node built-ins only; it runs in Vitest's own process, browser mode included.
 *
 * It also writes the message of every failed test to `NATIVE_SUITE_MESSAGES` as
 * `[{ file, fullName, message }]`. The JSON reporter builds `failureMessages` from `error.stack`,
 * and SpiderMonkey's stack has no `Name: message` line (V8's has), so on Firefox the assertion text
 * is missing from that report. `TestCase.result().errors[]` keeps `name` and `message` apart from
 * the stack on every engine.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * The JSON reporter's `fullName`: the suite titles above a test and its own, joined by a space.
 * @param {any} test
 */
function fullNameOf(test) {
  const names = [String(test.name)];
  for (let p = test.parent; p?.type === "suite"; p = p.parent) {
    names.unshift(String(p.name));
  }
  return names.join(" ");
}

/** @param {ReadonlyArray<any>} testModules */
function writeMessages(testModules) {
  const path = process.env.NATIVE_SUITE_MESSAGES;
  if (!path) return;
  const out = [];
  for (const module of testModules) {
    for (const test of module.children.allTests("failed")) {
      const error = test.result()?.errors?.[0];
      if (!error || !error.message) continue;
      out.push({
        file: String(module.moduleId),
        fullName: fullNameOf(test),
        message: `${error.name ?? "Error"}: ${error.message}`,
      });
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out));
}

/** How deep a cause chain is followed; a self-referencing cause stops it earlier. */
const CAUSE_DEPTH = 8;

/** @param {{ name?: string, message?: string }} e */
const lineOf = (e) =>
  `${String(e.name ?? "Error")}: ${String(e.message ?? "")}`;

/**
 * The `cause` chain under an error, outermost first, one line each.
 * @param {{ cause?: unknown }} error
 * @returns {string[]}
 */
function causesOf(error) {
  const out = [];
  const seen = new Set([error]);
  let cause = error.cause;
  while (
    out.length < CAUSE_DEPTH &&
    cause !== undefined &&
    cause !== null &&
    !seen.has(cause)
  ) {
    seen.add(cause);
    if (typeof cause !== "object") {
      out.push(String(cause));
      break;
    }
    const c =
      /** @type {{ name?: string, message?: string, cause?: unknown }} */ (
        cause
      );
    out.push(lineOf(c));
    cause = c.cause;
  }
  return out;
}

export default class NativeSuiteErrors {
  /**
   * @param {ReadonlyArray<any>} testModules
   * @param {ReadonlyArray<{ name?: string, message?: string, cause?: unknown }>} unhandledErrors
   */
  onTestRunEnd(testModules, unhandledErrors) {
    writeMessages(testModules);
    const path = process.env.NATIVE_SUITE_ERRORS;
    if (!path) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        unhandledErrors.map((e) => ({
          name: String(e.name ?? "Error"),
          message: String(e.message ?? ""),
          causes: causesOf(e),
        })),
      ),
    );
  }
}
