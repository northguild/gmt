#!/usr/bin/env node
/**
 * Runs the Date chain of Deck 0's `kinds` slide ("Date takes anything") with each kind of input,
 * in every zone and Node major of the `gmt-matrix` job and in Helsinki, and records what it
 * returned. The same runner and record shape as `agent-answer.mjs` (`runCode`).
 *
 * It reads `apps/dox/src/slides/give-me-temporal/date-kinds.json`: the `code`, the value every
 * call should give (`want`) and the `kinds`, each with `id`, `kind` (the words the slide shows) and
 * `call`. It writes `date-kinds-run.json` beside it, one record per kind id. The slide reads both
 * through `lib/slides/run-grid.ts`; a record is current only while its `sha256` matches the code
 * and the call.
 *
 *   cd scripts/zone-matrix
 *   fnm exec --using=26 -- node date-kinds.mjs
 *
 * Exit 2 means the file cannot be run: no code, no kinds, or a kind with an id that is malformed
 * or repeated, or with no call. Exit 1 means a run could not be made in the zone asked for.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cellOptions,
  recordRuns,
  runCode,
  Stop,
  withShownZone,
} from "./agent-answer.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DECK = join(HERE, "..", "..", "apps/dox/src/slides/give-me-temporal");
export const KINDS_FILE = join(DECK, "date-kinds.json");
export const RUN_FILE = join(DECK, "date-kinds-run.json");
const WORK = join(HERE, ".work", "date-kinds");

/** The command that runs this script, as the run record and the check name it. */
export const COMMAND =
  "cd scripts/zone-matrix && fnm exec --using=26 -- node date-kinds.mjs";

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const filled = (value) => typeof value === "string" && value.trim() !== "";

/** The kinds of the file, in order. Throws `Stop` (exit 2) when the file cannot be run. */
export function kindsOf(file) {
  const stop = (message) => new Stop(2, `${KINDS_FILE}: ${message}`);
  if (!filled(file?.code)) throw stop("the code is empty.");
  if (!Array.isArray(file.kinds) || file.kinds.length === 0)
    throw stop("there are no kinds.");
  const ids = new Set();
  for (const k of file.kinds) {
    if (typeof k?.id !== "string" || !ID.test(k.id))
      throw stop(
        `the id ${JSON.stringify(k?.id)} is not lower-case words joined by hyphens.`,
      );
    if (ids.has(k.id)) throw stop(`the id "${k.id}" is used twice.`);
    ids.add(k.id);
    if (!filled(k.call)) throw stop(`the kind "${k.id}" has no call.`);
  }
  return file.kinds;
}

/**
 * Runs the code with every kind's call and returns the run record file, one `runCode` record per
 * kind id. Checks the whole file before the first cell runs.
 *
 * @param {object} options as `runCode`, with `file` (the kinds file) and `matrix` (the CI matrix)
 *   in place of `code`, `call`, `command`, `zones` and `node`
 */
export async function runKinds({ file, matrix, workDir, ...options }) {
  const kinds = kindsOf(file);
  const records = {};
  for (const k of kinds)
    records[k.id] = await runCode({
      ...options,
      code: file.code,
      call: k.call,
      command: COMMAND,
      zones: withShownZone(matrix.zones),
      node: matrix.node,
      workDir: join(workDir, k.id),
    });
  return records;
}

async function main() {
  let file;
  try {
    file = JSON.parse(readFileSync(KINDS_FILE, "utf8"));
    kindsOf(file);
  } catch (error) {
    console.error(
      error instanceof Stop
        ? error.message
        : `Cannot read ${KINDS_FILE}: ${error.message}`,
    );
    process.exit(error instanceof Stop ? error.code : 2);
  }
  const options = await cellOptions("date-kinds.mjs");
  rmSync(WORK, { recursive: true, force: true });
  await recordRuns(RUN_FILE, () =>
    runKinds({ ...options, file, workDir: WORK }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
