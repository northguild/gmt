/**
 * A Vitest reporter for the native-suite runner. The JSON reporter leaves out the errors a test
 * run did not catch (an unhandled rejection, say); this one writes them to the file named by
 * `NATIVE_SUITE_ERRORS` as `[{ name, message }]`, so the runner can tell a clean run from one
 * Vitest failed for a reason no test reports. Node built-ins only; it runs in Vitest's own process,
 * browser mode included.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export default class NativeSuiteErrors {
  /**
   * @param {unknown} _testModules
   * @param {ReadonlyArray<{ name?: string, message?: string }>} unhandledErrors
   */
  onTestRunEnd(_testModules, unhandledErrors) {
    const path = process.env.NATIVE_SUITE_ERRORS;
    if (!path) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        unhandledErrors.map((e) => ({
          name: String(e.name ?? "Error"),
          message: String(e.message ?? ""),
        })),
      ),
    );
  }
}
