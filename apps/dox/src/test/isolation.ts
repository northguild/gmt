/**
 * Which test files get a worker module graph of their own.
 *
 * Most files share one (`isolate: false`), which skips re-importing the library, the polyfill
 * and React for every file. A file that replaces a module or a global must not: the
 * replacement would still be in place for the next file. `vitest.config.ts` runs the files
 * this module selects in an `isolated` project and every other file in a `shared` one.
 *
 * The scan reads source text, so it needs no import of the test files. It sees only the
 * four calls below. A test that leaves other global state behind must undo it, as
 * `context/dox/built.md` (Test isolation) says.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** `vi.mock` and `vi.doMock` replace a module for everyone who imports it afterwards. */
const MODULE_REPLACEMENT = /vi\.(?:mock|doMock)\(/;

/** `vi.stubGlobal` and `vi.stubEnv` change process-wide state the setup file does not restore. */
const GLOBAL_STUB = /vi\.stub(?:Global|Env)\(/;

/** Every pattern that picks a test file, relative to the app root. Matches `vitest.config.ts`. */
export const TEST_GLOBS = [
  "lint/**/*.test.ts",
  "scripts/**/*.test.ts",
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "worker/**/*.test.ts",
];

/**
 * A test that launches a real browser. The Tests job has none, so these files stay out of the
 * default run; `vitest.browser.config.ts` runs them in the `dox-tables` check, after Chromium is
 * installed.
 */
export const BROWSER_TEST_GLOB = "**/*.browser.test.ts";

/** The directories `TEST_GLOBS` search. */
const TEST_DIRS = ["lint", "scripts", "src", "worker"];

/** Every `*.test.ts` and `*.test.tsx` under the test directories but the browser tests, relative to `appDir`, in path order. */
export function listTestFiles(appDir: string): string[] {
  return TEST_DIRS.filter((dir) => existsSync(path.join(appDir, dir)))
    .flatMap((dir) =>
      readdirSync(path.join(appDir, dir), { recursive: true }).map((file) =>
        path.join(dir, file.toString()),
      ),
    )
    .filter(
      (file) =>
        /\.test\.tsx?$/.test(file) &&
        !file.endsWith(".browser.test.ts") &&
        !file.includes("node_modules"),
    )
    .sort();
}

/** Whether a test file's source replaces a module or a global, so it needs a worker of its own. */
export function needsIsolation(source: string): boolean {
  return MODULE_REPLACEMENT.test(source) || GLOBAL_STUB.test(source);
}

/** The test files under `appDir`, relative to it, split by whether they need isolation. */
export function splitTestFiles(appDir: string): {
  isolated: string[];
  shared: string[];
} {
  const isolated: string[] = [];
  const shared: string[] = [];
  for (const file of listTestFiles(appDir)) {
    const source = readFileSync(path.join(appDir, file), "utf8");
    (needsIsolation(source) ? isolated : shared).push(file);
  }
  return { isolated, shared };
}
