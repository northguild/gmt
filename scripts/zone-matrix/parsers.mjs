/**
 * Turns each suite's report into `{ tests, failed: string[], messages?, couldNotRun? }`. A test id
 * is `file › full name`. `messages` maps a failed id to the first line of its failure message,
 * where the format has one (Jest and Vitest JSON), so a failure seen once can be explained. Four formats: Jest and Vitest JSON, QUnit text (Moment.js), TAP
 * (Spacetime) and the demitasse tree (`@js-temporal/polyfill`).
 */
import { relative, isAbsolute } from "node:path";

const ANSI = /\u001b\[[0-9;]*m/g;
export const SEP = " › ";

/** The first non-empty line of a failure message, without colour codes, at most 300 characters. */
const firstLine = (text) =>
  (
    String(text)
      .replace(ANSI, "")
      .split("\n")
      .find((l) => l.trim()) ?? ""
  )
    .trim()
    .slice(0, 300);

/**
 * Jest and Vitest JSON. A file that fails to load has no assertion results; Vitest reports it
 * as `passed` with a `message`, so both cases are failures. No tests at all means the toolchain
 * broke before a test ran.
 * @param {string} text
 * @param {string} root checkout directory; file names are made relative to it
 */
export function parseJson(text, root) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return {
      tests: 0,
      failed: [],
      couldNotRun: `no readable JSON report: ${error.message}`,
    };
  }
  const rel = (f) =>
    (isAbsolute(f) ? relative(root, f) : f).split("\\").join("/");
  let tests = 0;
  const failed = [];
  const messages = {};
  for (const file of json.testResults ?? []) {
    const name = rel(file.name ?? "");
    const cases = file.assertionResults ?? [];
    if (cases.length === 0 && (file.message || file.status === "failed")) {
      const id = `${name}${SEP}(file did not load)`;
      failed.push(id);
      if (file.message) messages[id] = firstLine(file.message);
      continue;
    }
    for (const c of cases) {
      if (c.status === "passed") tests += 1;
      else if (c.status === "failed") {
        tests += 1;
        const id = `${name}${SEP}${c.fullName ?? c.title}`;
        failed.push(id);
        const message = (c.failureMessages ?? []).find(Boolean);
        if (message) messages[id] = firstLine(message);
      }
    }
  }
  if (tests === 0)
    return { tests, failed: [], couldNotRun: "the report holds no tests" };
  return { tests, failed, messages };
}

/**
 * QUnit through `scripts/qunit-reporter.js`: stdout ends with `N tests, M assertions, F failed
 * tests`; stderr holds a name line (`module > test`) then stack lines naming the test file.
 */
export function parseQunit(stdout, stderr) {
  const summary = /(\d+) tests, (\d+) assertions, (\d+) failed tests/.exec(
    stdout.replace(ANSI, ""),
  );
  if (!summary)
    return { tests: 0, failed: [], couldNotRun: "no QUnit summary line" };
  const lines = stderr.replace(ANSI, "").split("\n");
  const failed = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const name = lines[i];
    if (name.trim() === "" || /^\s/.test(name)) continue;
    for (
      let j = i + 1;
      j < Math.min(lines.length, i + 40) && /^\s/.test(lines[j]);
      j += 1
    ) {
      const at = /^\s+at .*?build\/qunit\/test\/([\w/.-]+?)\.js:\d+:\d+/.exec(
        lines[j],
      );
      if (at) {
        failed.push(`${at[1]}.js${SEP}${name.trim()}`);
        break;
      }
    }
  }
  return { tests: Number(summary[1]), failed: [...new Set(failed)] };
}

/** TAP. A `# section` line names the group; each assertion line is one test. */
export function parseTap(stdout) {
  let section = "";
  let tests = 0;
  const failed = [];
  for (const raw of stdout.replace(ANSI, "").split("\n")) {
    const line = raw.trimEnd();
    const heading = /^# (.+)$/.exec(line);
    if (heading) {
      section = heading[1];
      continue;
    }
    const result = /^(not ok|ok) \d+\s*-?\s*(.*)$/.exec(line);
    if (!result || /# (SKIP|TODO)/i.test(result[2])) continue;
    tests += 1;
    if (result[1] === "not ok")
      failed.push(["tape", section, result[2]].filter(Boolean).join(SEP));
  }
  if (tests === 0)
    return { tests, failed: [], couldNotRun: "no TAP assertions" };
  return { tests, failed: [...new Set(failed)] };
}

/**
 * The demitasse "pretty" tree: two spaces per depth; headers carry no marker; leaves start with
 * ☑ (pass), ☒ (fail), ❀ (skip) or ☐ (todo). Detail lines under a failure and the summary lines
 * (`N ☑ passed`) are not tests.
 */
export function parseDemitasse(stdout) {
  const stack = [];
  let tests = 0;
  const failed = [];
  for (const raw of stdout.replace(ANSI, "").split("\n")) {
    if (raw.trim() === "") continue;
    if (/^\s*\d+\s+[☑☒❀☐]/u.test(raw)) continue;
    if (/^\s*(assertion|expected|actual|error|location):/.test(raw)) continue;
    const depth = (/^ */.exec(raw)?.[0].length ?? 0) / 2;
    const leaf = /^\s*([☑☒❀☐])\s+(.*)$/u.exec(raw);
    if (leaf) {
      if (leaf[1] === "☑" || leaf[1] === "☒") {
        tests += 1;
        if (leaf[1] === "☒")
          failed.push(
            ["demitasse", ...stack.slice(0, depth), leaf[2]].join(SEP),
          );
      }
    } else {
      stack.length = Math.min(stack.length, depth);
      stack[depth] = raw.trim();
    }
  }
  if (tests === 0)
    return { tests, failed: [], couldNotRun: "no demitasse results" };
  return { tests, failed: [...new Set(failed)] };
}

/** @param {"json"|"qunit"|"tap"|"demitasse"} kind */
export function parseReport(kind, { stdout, stderr, file, root }) {
  if (kind === "json") return parseJson(file, root);
  if (kind === "qunit") return parseQunit(stdout, stderr);
  if (kind === "tap") return parseTap(stdout);
  if (kind === "demitasse") return parseDemitasse(stdout);
  throw new Error(`unknown report kind ${kind}`);
}
