#!/usr/bin/env node
/**
 * Runs the code an agent wrote for the running question of Deck 0 ("Give Me Temporal") in every
 * zone and Node major of the `gmt-matrix` job, and records what it returned.
 *
 * The owner commits the transcript to `apps/dox/src/slides/give-me-temporal/quotes/agent-answer.json`
 * (`question`, `model`, `date`, `answer`, `code`, `call`, optional `excerpt`). This script writes
 * `agent-run.json` beside it. The slide reads both through `lib/slides/agent-quote.ts`; the record
 * is current only while its `sha256` matches the code and the call.
 *
 *   cd scripts/zone-matrix
 *   fnm exec --using=26 -- node agent-answer.mjs
 *
 * Exit 2 means the run cannot start: a transcript field is empty, or the code imports a package
 * that is not pinned here (the message gives the command that pins it). Any library the agent
 * picked can be added that way. Exit 1 means a run could not be made in the zone asked for.
 *
 * The code and a small runner are written to `.work/agent-answer/` (ignored by git). The code runs
 * as ES module or CommonJS, whichever it is written as, and `call` is evaluated in the module's own
 * scope, so a function that is not exported can be called. A promise is awaited. A throw is
 * recorded as `{ threw: "<name>: <message>" }`.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { builtinModules } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readMatrix } from "./matrix.mjs";
import { formatJson } from "../lib/format-json.mjs";
import { loadGmt } from "../lib/gmt.mjs";
import { versionOf } from "./probe/versions.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..", "..");
const QUOTES = join(ROOT, "apps/dox/src/slides/give-me-temporal/quotes");
export const ANSWER_FILE = join(QUOTES, "agent-answer.json");
export const RUN_FILE = join(QUOTES, "agent-run.json");
const WORK = join(HERE, ".work", "agent-answer");

/** The command that runs this script, as the slide's run record and the check name it. */
export const COMMAND =
  "cd scripts/zone-matrix && fnm exec --using=26 -- node agent-answer.mjs";

/** The transcript fields the owner fills in. `excerpt` is optional. */
export const FIELDS = ["question", "model", "date", "answer", "code", "call"];

/** The line the runner prints before its JSON result, so the code's own output cannot be mistaken for it. */
const MARK = "@@agent-answer@@";

/** A reason the run cannot start. `code` is the exit code. */
export class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** The hash both this script and the slide use to tie a run record to its code: `code`, NUL, `call`. */
export const hashOf = (code, call) =>
  createHash("sha256").update(`${code}\0${call}`).digest("hex");

/** The names of the transcript fields that are empty or missing. */
export const emptyFields = (record) =>
  FIELDS.filter(
    (f) => typeof record?.[f] !== "string" || record[f].trim() === "",
  );

const SPECIFIER_PATTERNS = [
  /\bimport\s+(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:[\w$*{}\s,]+?\s+)from\s+["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/** Every module specifier the code imports or requires, in order of first appearance. */
export function specifiersOf(code) {
  const found = [];
  for (const pattern of SPECIFIER_PATTERNS)
    for (const m of code.matchAll(pattern)) found.push([m.index, m[1]]);
  return [...new Set(found.sort((a, b) => a[0] - b[0]).map(([, s]) => s))];
}

const BUILTINS = new Set(builtinModules);

/** The package a specifier names, or `null` for a relative path or a Node built-in module. */
export function packageOf(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("node:")) return null;
  const parts = specifier.split("/");
  const name = specifier.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0];
  return BUILTINS.has(name) ? null : name;
}

/** The packages the code needs from `node_modules`, without repeats. */
export const packagesOf = (code) => [
  ...new Set(specifiersOf(code).map(packageOf).filter(Boolean)),
];

/** The command that pins a package here at the exact version it resolves to. */
export const pinCommand = (name) =>
  `cd scripts/zone-matrix && pnpm add --ignore-workspace --save-exact ${name}`;

/** Which module system the code is written for. ES module unless it uses `require` or `module.exports`. */
export function kindOf(code) {
  const esm = /^\s*(?:import\s+[\w$*{"']|export\s)/m.test(code);
  const cjs = /\brequire\s*\(|\bmodule\.exports\b|\bexports\.\w/.test(code);
  return cjs && !esm ? "cjs" : "esm";
}

/** The file the code is written to: the code, then the line that exposes `call` to the runner. */
export function entryOf(code, call) {
  return `${code}\n;globalThis.__agentCall = async () => (${call});\n`;
}

/** The runner every cell executes: loads the entry, calls it, prints one marked JSON line. */
export function runnerSource(entryFile) {
  return `const reply = (result) =>
  console.log(
    ${JSON.stringify(`\n${MARK} `)} +
      JSON.stringify({
        node: process.version,
        tzdata: process.versions.tz,
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...result,
      }),
  );
const text = (value) => {
  if (typeof value === "string") return value;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  return JSON.stringify(value) ?? String(value);
};
try {
  await import(${JSON.stringify(pathToFileURL(entryFile).href)});
  reply({ value: text(await globalThis.__agentCall()) });
} catch (error) {
  reply({ value: { threw: \`\${error?.name ?? "Error"}: \${error?.message ?? error}\` } });
}
`;
}

/** The result a cell printed: the last marked line of its output, or `null`. */
export function resultOf(stdout) {
  const line = stdout
    .split("\n")
    .filter((l) => l.startsWith(MARK))
    .pop();
  if (!line) return null;
  try {
    return JSON.parse(line.slice(MARK.length + 1));
  } catch {
    return null;
  }
}

/** A zone under the name Node reports it by: `Asia/Kolkata` is `Asia/Calcutta` to an older ICU. */
const zoneName = (zone) =>
  new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;

/** Runs `node` of one major under `fnm`, in this folder, with extra environment. */
export function onNode(major, args, env) {
  return new Promise((resolve) => {
    const child = spawn(
      "fnm",
      ["exec", `--using=${major}`, "--", "node", ...args],
      { cwd: HERE, env: { ...process.env, ...env } },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) =>
      resolve({ code: 127, stdout, stderr: String(error) }),
    );
  });
}

/**
 * Runs the transcript in every cell and returns the run record. Throws `Stop` when it cannot start.
 *
 * @param {object} options
 * @param {Record<string, string>} options.record the transcript
 * @param {Record<string, string>} options.pinned the packages pinned in `package.json`
 * @param {{ zones: string[]; node: string[] }} options.matrix the CI matrix
 * @param {typeof onNode} options.run how a cell is run
 * @param {() => string} options.now the current instant, from gmt
 * @param {(name: string) => string} options.version the installed version of a package
 * @param {string} options.workDir where the code and the runner are written
 */
export async function runAnswer({
  record,
  pinned,
  matrix,
  run,
  now,
  version,
  workDir,
}) {
  const empty = emptyFields(record);
  if (empty.length > 0)
    throw new Stop(
      2,
      `${ANSWER_FILE} has empty fields: ${empty.join(", ")}. Fill them from the owner's transcript.`,
    );
  const packages = packagesOf(record.code);
  for (const name of packages)
    if (!(name in pinned))
      throw new Stop(
        2,
        `The code imports "${name}", which is not pinned in scripts/zone-matrix/package.json. Pin it with:\n  ${pinCommand(name)}`,
      );

  const entryName = kindOf(record.code) === "cjs" ? "answer.cjs" : "answer.mjs";
  const entry = join(workDir, entryName);
  const runner = join(workDir, "run.mjs");
  mkdirSync(workDir, { recursive: true });
  writeFileSync(entry, entryOf(record.code, record.call));
  writeFileSync(runner, runnerSource(entry));

  const runs = [];
  for (const node of matrix.node) {
    for (const zone of matrix.zones) {
      const r = await run(node, [runner], { TZ: zone });
      const result = resultOf(r.stdout);
      if (!result)
        throw new Stop(
          1,
          `Node ${node} in ${zone} gave no result (exit ${r.code}): ${String(r.stderr).slice(-300)}`,
        );
      if (zoneName(result.zone) !== zoneName(zone))
        throw new Stop(1, `Node ${node} ran in ${result.zone}, not ${zone}`);
      runs.push({
        node,
        nodeVersion: result.node,
        tzdata: result.tzdata,
        zone,
        value: result.value,
      });
    }
  }
  return {
    sha256: hashOf(record.code, record.call),
    command: COMMAND,
    instant: now(),
    libraries: Object.fromEntries(packages.map((p) => [p, version(p)])),
    runs,
  };
}

async function main() {
  let record;
  try {
    record = JSON.parse(readFileSync(ANSWER_FILE, "utf8"));
  } catch (error) {
    console.error(`Cannot read ${ANSWER_FILE}: ${error.message}`);
    process.exit(2);
  }
  // Check the transcript before anything else, so an empty file stops here without needing a build.
  const empty = emptyFields(record);
  if (empty.length > 0) {
    console.error(
      `${ANSWER_FILE} has empty fields: ${empty.join(", ")}. Fill them from the owner's transcript.`,
    );
    process.exit(2);
  }
  if (typeof globalThis.Temporal === "undefined") {
    console.error(
      "Run this on Node 26 (fnm exec --using=26 -- node agent-answer.mjs).",
    );
    process.exit(2);
  }
  const gmt = await loadGmt();
  const pinned = JSON.parse(
    readFileSync(join(HERE, "package.json"), "utf8"),
  ).dependencies;
  const matrix = readMatrix(join(ROOT, ".github/workflows/ci.yml"));
  rmSync(WORK, { recursive: true, force: true });
  try {
    const result = await runAnswer({
      record,
      pinned,
      matrix,
      run: onNode,
      now: () => gmt.getUtcNow(),
      version: versionOf,
      workDir: WORK,
    });
    writeFileSync(RUN_FILE, formatJson(result));
    const values = new Set(result.runs.map((r) => JSON.stringify(r.value)));
    console.error(
      `${result.runs.length} runs, ${values.size} distinct value${values.size === 1 ? "" : "s"}; wrote ${RUN_FILE}`,
    );
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    console.error(error.message);
    process.exit(error.code);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
