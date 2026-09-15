/**
 * Zero known bugs: no disabled, focused or expected-to-fail test ships.
 *
 * GMT never ships a known bug. A defect found during a story is fixed in that story, so a test
 * that is skipped, left as a todo, focused, or marked as expected to fail can only mean one of
 * two things: a bug is being carried, or a check is switched off. Both are forbidden in finished
 * work. They may exist for a moment while working (the red step of a TDD slice) and must be gone
 * before a handoff. See context/testing-standards/references/index.md § "Zero known bugs".
 *
 * Usage: node scripts/test-markers.mjs check
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["packages", "apps"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  "out",
  ".astro",
  "generated",
]);
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;

/** Markers that disable, focus or invert a test, in any test file. */
const TEST_MARKERS = [
  {
    label: "disabled, focused or expected-to-fail test",
    pattern:
      /\b(?:it|test|describe|suite|bench)(?:\s*\.\s*(?:each|concurrent|sequential|shuffle))*\s*\.\s*(?:fails|skip|todo|only|skipIf|runIf)\b/,
  },
  {
    label: "x-prefixed (disabled) test",
    pattern: /\bx(?:it|test|describe)\s*\(/,
  },
  {
    label: "f-prefixed (focused) test",
    pattern: /\bf(?:it|describe)\s*\(/,
  },
];

/** A known-defect note is a bug being carried, wherever it is written. */
const DEFECT_NOTE = {
  label: "known-defect note",
  pattern: /\bknown[\s-]+(?:defect|bug)s?\b/i,
};

/** Every source file under `dir`, pruning `SKIP_DIRS` by name (symlinks followed, as `statSync` does). */
function walk(dir) {
  return readdirSync(dir)
    .filter((entry) => !SKIP_DIRS.has(entry))
    .flatMap((entry) => sourceFilesAt(join(dir, entry)));
}

/** A source file as a one-element list, a directory's source files, or nothing. */
function sourceFilesAt(path) {
  if (statSync(path).isDirectory()) return walk(path);
  return SOURCE.test(path) ? [path] : [];
}

function findProblems() {
  const problems = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rules = TEST_FILE.test(file)
        ? [...TEST_MARKERS, DEFECT_NOTE]
        : [DEFECT_NOTE];
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const rule of rules) {
          if (rule.pattern.test(line)) {
            problems.push(
              `${relative(ROOT, file)}:${index + 1}: ${rule.label}: ${line.trim()}`,
            );
          }
        }
      });
    }
  }
  return problems;
}

const command = process.argv[2];

if (command !== "check") {
  console.error("usage: node scripts/test-markers.mjs check");
  process.exit(2);
}

const problems = findProblems();

if (problems.length > 0) {
  console.error(
    `test-markers: ${problems.length} problem(s). GMT ships zero known bugs — fix the defect, ` +
      "then remove the marker:",
  );
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  "test-markers: no disabled, focused or expected-to-fail tests, no known-defect notes",
);
