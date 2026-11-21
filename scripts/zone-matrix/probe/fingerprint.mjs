/**
 * What GMT's answers in the probe depend on, as one hash: the commit, every uncommitted change under
 * `packages/gmt` (the diff and the content of each untracked file) and the built `dist` the GMT
 * adapter loads. The own-suite runner's `<HEAD>+dirty` key does not change when a dirty file is
 * edited a second time, so it can serve a stale cell; this one changes with any byte.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function* walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** @param {string} root the repository root */
export function gmtFingerprint(root) {
  const git = (...args) =>
    spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 })
      .stdout ?? "";
  const h = createHash("sha256");
  h.update(git("rev-parse", "HEAD"));
  h.update(git("diff", "HEAD", "--binary", "--", "packages/gmt"));
  for (const file of git(
    "ls-files",
    "-o",
    "--exclude-standard",
    "--",
    "packages/gmt",
  )
    .split("\n")
    .filter(Boolean)
    .sort()) {
    h.update(`\0${file}\0`);
    h.update(readFileSync(join(root, file)));
  }
  const dist = join(root, "packages/gmt/dist");
  if (existsSync(dist))
    for (const file of walk(dist)) h.update(file).update(readFileSync(file));
  return h.digest("hex").slice(0, 32);
}
