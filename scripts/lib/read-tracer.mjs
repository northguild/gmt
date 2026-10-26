/**
 * Preload for `node scripts/affected.mjs audit`: records every repo path a Node process reads or
 * lists, one line per path, appended to `$AFFECTED_TRACE_LOG`. Loaded with `--import` through
 * `NODE_OPTIONS`, so the child processes and workers a check starts record into the same log.
 *
 * Lines are `R <path>` for a file opened or read, `S <path>` for a file stat'ed or checked for
 * existence, and `D <path>` for a directory listed, relative to `$AFFECTED_TRACE_ROOT`. A script
 * that skips its work when its output is newer than its input shows only an `S` for the input on a
 * run that skips, so the stat must be recorded too. Paths outside it, and anything under `node_modules`, are dropped. Native
 * tools (esbuild, oxlint, rolldown) read without Node's `fs` and are not seen.
 */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.AFFECTED_TRACE_ROOT;
const LOG = process.env.AFFECTED_TRACE_LOG;
const append = fs.appendFileSync;
const seen = new Set();

function note(kind, target) {
  try {
    if (target == null || typeof target === "number") return;
    let p = target instanceof URL ? fileURLToPath(target) : String(target);
    if (p.startsWith("file:")) p = fileURLToPath(p);
    p = path.resolve(p);
    if (!p.startsWith(ROOT + path.sep)) return;
    const rel = p
      .slice(ROOT.length + 1)
      .split(path.sep)
      .join("/");
    if (rel.split("/").includes("node_modules")) return;
    const line = `${kind} ${rel}`;
    if (seen.has(line)) return;
    seen.add(line);
    append(LOG, `${line}\n`);
  } catch {
    // A path that cannot be resolved is not a repo path.
  }
}

function wrap(target, name, kind) {
  const original = target[name];
  if (typeof original !== "function") return;
  target[name] = function traced(p, ...rest) {
    note(kind, p);
    return original.call(this, p, ...rest);
  };
}

if (ROOT && LOG) {
  for (const name of [
    "readFileSync",
    "readFile",
    "openSync",
    "open",
    "createReadStream",
  ]) {
    wrap(fs, name, "R");
  }
  for (const name of [
    "statSync",
    "stat",
    "lstatSync",
    "lstat",
    "existsSync",
    "exists",
    "accessSync",
    "access",
  ]) {
    wrap(fs, name, "S");
  }
  for (const name of ["readdirSync", "readdir", "opendirSync", "opendir"])
    wrap(fs, name, "D");
  for (const name of ["readFile", "open"]) wrap(fs.promises, name, "R");
  for (const name of ["stat", "lstat", "access"]) wrap(fs.promises, name, "S");
  for (const name of ["readdir", "opendir"]) wrap(fs.promises, name, "D");
  // `import { readFileSync } from "node:fs"` binds the export, not the property; this updates it.
  syncBuiltinESMExports();
}
