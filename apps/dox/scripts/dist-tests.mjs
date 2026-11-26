#!/usr/bin/env node
/**
 * Run every test that reads the built site, found by rule rather than from a list.
 *
 * A built-site test calls `distDirOrSkip()` (scripts/dist-dir.ts) and returns early when there is
 * no `dist`. The CI Tests job never builds the site, so such a test only checks anything in the
 * one step that builds it first. That step used to name its files by hand, and five of them were
 * never added: they passed in CI by skipping. The rule here leaves nothing to add: every test file
 * that imports `dist-dir` runs, except the `.browser.test.ts` ones, which need Chromium and run
 * with the browser config in the `dox-tables` step.
 *
 * Run as: pnpm --filter @gmt/dox run test:dist (CI sets DOX_DIST_REQUIRED=1 on it).
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = resolve(import.meta.dirname, "..");

/** Folders that hold no test sources. */
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", "public"]);

/** An import of the helper, from any depth: `./dist-dir`, `../dist-dir`, `../../scripts/dist-dir`. */
const IMPORTS_DIST_DIR =
  /from\s+["'](?:\.{1,2}\/)+(?:[\w-]+\/)*dist-dir(?:\.ts)?["']/;

/**
 * Whether a test file is a built-site test: a Node test (not a browser one) that imports `dist-dir`.
 *
 * @param {string} name the file name
 * @param {string} source the file's text
 * @returns {boolean}
 */
export function isDistTest(name, source) {
  return (
    name.endsWith(".test.ts") &&
    !name.endsWith(".browser.test.ts") &&
    IMPORTS_DIST_DIR.test(source)
  );
}

/**
 * Every built-site test under `root`, as sorted POSIX paths relative to it.
 *
 * @param {string} [root] the Dox app folder
 * @returns {string[]}
 */
export function distTestFiles(root = appRoot) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.name.endsWith(".test.ts")) {
        const full = join(dir, entry.name);
        if (isDistTest(entry.name, readFileSync(full, "utf8"))) {
          found.push(relative(root, full).split(sep).join("/"));
        }
      }
    }
  };
  walk(root);
  return found.sort();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const files = distTestFiles();
  if (files.length === 0) {
    console.error(
      "[dist-tests] no built-site tests found; the rule must have broken.",
    );
    process.exit(1);
  }
  console.log(
    `[dist-tests] ${files.length} built-site test files:\n  ${files.join("\n  ")}`,
  );
  const run = spawnSync("vitest", ["run", ...files], {
    cwd: appRoot,
    stdio: "inherit",
  });
  if (run.error)
    console.error(`[dist-tests] could not start vitest: ${run.error.message}`);
  process.exit(run.status ?? 1);
}
