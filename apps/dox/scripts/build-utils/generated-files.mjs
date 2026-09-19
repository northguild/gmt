/**
 * Write helpers for the `generate` steps that keep regenerated output quiet.
 *
 * `astro dev`, VS Code's file watcher and its TypeScript server all react to every file
 * that is written or deleted. Deleting the whole reference tree and writing ~650 pages back
 * — identical or not — made every `dox:dev` start look like 1,300 file changes. These
 * helpers only touch a file whose content actually changed, and only delete the files the
 * new output no longer contains, so an unchanged regeneration touches nothing.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Writes `text` to `path` unless the file already holds exactly that text.
 *
 * @param {string} path
 * @param {string} text
 * @returns {boolean} true when the file was written
 */
export function writeIfChanged(path, text) {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return true;
}

/**
 * Makes `dir` hold exactly `files` (relative path → content): writes the changed ones,
 * deletes every other file under `dir`, then removes directories left empty.
 *
 * @param {string} dir
 * @param {ReadonlyMap<string, string>} files
 * @returns {{ written: number, removed: number }}
 */
export function syncTree(dir, files) {
  let written = 0;
  for (const [rel, text] of files) {
    if (writeIfChanged(join(dir, rel), text)) written++;
  }
  let removed = 0;
  for (const path of listFiles(dir)) {
    if (!files.has(relative(dir, path))) {
      rmSync(path);
      removed++;
    }
  }
  removeEmptyDirs(dir);
  return { written, removed };
}

/**
 * A content hash over `paths`: each file's path and bytes. Unlike mtimes, it does not
 * change when a checkout, formatter or `touch` rewrites a file with the same content.
 *
 * @param {readonly string[]} paths
 * @returns {string}
 */
export function hashFiles(paths) {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * @param {string} dir
 * @returns {boolean} true when `dir` was empty and has been removed
 */
function removeEmptyDirs(dir) {
  if (!existsSync(dir)) return false;
  let empty = true;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !removeEmptyDirs(join(dir, entry.name))) {
      empty = false;
    }
  }
  if (empty) rmdirSync(dir);
  return empty;
}
