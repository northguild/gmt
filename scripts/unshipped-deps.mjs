/**
 * Does a branch change nothing in any workspace package except dependencies that never ship?
 *
 * CI requires a changeset for every changed package. Some dependency changes release nothing:
 * - devDependencies, in any package
 * - every dependency field in a private package (`"private": true`, such as apps/dox), which
 *   is never published
 * A Renovate PR that changes only those has nothing to release, so CI lets it skip that check.
 * Any other change inside a package still needs a changeset: a source file, a published
 * package's `dependencies` or `peerDependencies`, `engines`, or a version.
 *
 * Usage: node scripts/unshipped-deps.mjs <base-ref>
 * Exits 0 when the branch changes only those dependencies, 1 otherwise.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGE_DIRS = /^(?:packages|apps)\/[^/]+\//;

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
];

/**
 * The manifest at a commit without the fields that never ship, with keys sorted at every level.
 * `private` is kept, so a package that turns private or public counts as a change.
 */
function shippedManifest(commit, path) {
  const manifest = JSON.parse(git("show", `${commit}:${path}`));
  const unshipped =
    manifest.private === true ? DEPENDENCY_FIELDS : ["devDependencies"];
  for (const field of unshipped) delete manifest[field];
  return JSON.stringify(manifest, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : value,
  );
}

const baseRef = process.argv[2];
if (!baseRef) {
  console.error("Usage: node scripts/unshipped-deps.mjs <base-ref>");
  process.exit(2);
}

const base = git("merge-base", baseRef, "HEAD").trim();
const changed = git("diff", "--name-status", "--no-renames", base, "HEAD")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"))
  .filter(([, path]) => PACKAGE_DIRS.test(path));

const reasons = [];
for (const [status, path] of changed) {
  const isManifest = /^(?:packages|apps)\/[^/]+\/package\.json$/.test(path);
  if (!isManifest || status !== "M" || !existsSync(`${ROOT}${path}`)) {
    reasons.push(`${path} (${status})`);
  } else if (shippedManifest(base, path) !== shippedManifest("HEAD", path)) {
    reasons.push(`${path}: changes what the package ships`);
  }
}

if (reasons.length > 0) {
  console.log("Changes what a package ships:");
  for (const reason of reasons) console.log(`  ${reason}`);
  process.exit(1);
}
console.log("Only dependencies that never ship change; nothing to release.");
