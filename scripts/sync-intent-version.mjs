#!/usr/bin/env node
/**
 * Sync TanStack Intent skill versions after `changeset version`.
 *
 * Reads the new version from packages/gmt/package.json and updates
 * all skill frontmatter via `intent validate --set-version` + `intent stale`.
 *
 * Run as: node scripts/sync-intent-version.mjs
 * Exit silently (code 0) if gmt wasn't bumped this release.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// 1. Read the new version from packages/gmt/package.json
const gmtPkgPath = resolve(root, "packages/gmt/package.json");
const gmtPkg = JSON.parse(readFileSync(gmtPkgPath, "utf-8"));
const version = gmtPkg.version;

if (!version) {
  console.error("ERROR: Could not read version from packages/gmt/package.json");
  process.exit(1);
}

// 2. Check if gmt was actually bumped by comparing with git HEAD
//    (changeset version has modified the file on disk but not yet committed,
//     so HEAD is still the previous release's committed version)
let prevVersion;
try {
  const prevPkg = JSON.parse(
    execSync("git show HEAD:packages/gmt/package.json", {
      cwd: root,
      encoding: "utf-8",
    }),
  );
  prevVersion = prevPkg.version;
} catch {
  // Not on a branch with a prior commit — assume version is correct
  prevVersion = null;
}

if (prevVersion && prevVersion === version) {
  // gmt version didn't change this release — skip intent sync
  console.log(
    `[intent] gmt version unchanged (${version}), skipping skill sync.`,
  );
  process.exit(0);
}

console.log(`[intent] Syncing skills to version ${version}...`);

// 3. Run intent validate with --set-version
try {
  execSync(
    `pnpm exec intent validate packages/gmt/skills --set-version ${version}`,
    { cwd: root, stdio: "inherit" },
  );
} catch {
  console.error("[intent] validate failed — continuing anyway (non-fatal)");
}

// 4. Run intent stale to clean up any stale skills
try {
  execSync(`pnpm exec intent stale packages/gmt/skills`, {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  console.error("[intent] stale failed — continuing anyway (non-fatal)");
}

console.log("[intent] Skill sync complete.");
