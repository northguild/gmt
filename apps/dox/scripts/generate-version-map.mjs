#!/usr/bin/env node
/**
 * Generate the docs-site version map.
 *
 * Reads every packages/<pkg>/package.json and emits a typed module at
 * apps/dox/src/generated/versions.ts, so that no version number is ever
 * hardcoded in site content and the site cannot ship a stale version badge.
 *
 * Run as: node apps/dox/scripts/generate-version-map.mjs
 *
 * Wired to the `generate` Nx target, which `build`, `dev`, and `typecheck` all
 * depend on. Deliberately NOT wired via an npm `prebuild`/`predev` lifecycle
 * hook: pnpm's `enable-pre-post-scripts` defaults to false and this repo has no
 * .npmrc, so those hooks never fire.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..", "..");
const packagesDir = resolve(repoRoot, "packages");

// 1. Collect every publishable workspace package's name and version.
const entries = [];
for (const dir of readdirSync(packagesDir).sort()) {
  let pkg;
  try {
    pkg = JSON.parse(
      readFileSync(join(packagesDir, dir, "package.json"), "utf-8"),
    );
  } catch {
    continue; // not a package directory
  }
  if (!pkg.name || !pkg.version || pkg.private === true) continue;
  entries.push([pkg.name, pkg.version]);
}

// 2. gmt is the site's subject — a missing version is fatal, not a warning.
const gmt = entries.find(([name]) => name === "@northguild/gmt");
if (!gmt) {
  console.error(
    "ERROR: Could not read a version for @northguild/gmt from packages/*/package.json",
  );
  process.exit(1);
}

// 3. Emit a typed module, not JSON — consumers get autocomplete and type errors.
const body = entries
  .map(
    ([name, version]) =>
      `  ${JSON.stringify(name)}: ${JSON.stringify(version)},`,
  )
  .join("\n");

const source = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/generate-version-map.mjs (\`nx run dox:generate\`).
export const packageVersions = {
${body}
} as const;

export type PackageName = keyof typeof packageVersions;

export const gmtVersion: string = packageVersions["@northguild/gmt"];
`;

const outDir = resolve(appRoot, "src", "generated");
const outPath = join(outDir, "versions.ts");
mkdirSync(outDir, { recursive: true });

// 4. Idempotent write — don't bump mtime when nothing changed, so `astro dev`
//    doesn't HMR-thrash and Nx doesn't see a spurious output change.
let previous = "";
try {
  previous = readFileSync(outPath, "utf-8");
} catch {
  previous = "";
}

if (previous === source) {
  console.log(`[versions] up to date (@northguild/gmt ${gmt[1]})`);
  process.exit(0);
}

writeFileSync(outPath, source);
console.log(
  `[versions] wrote ${entries.length} package versions (@northguild/gmt ${gmt[1]})`,
);
