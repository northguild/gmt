/**
 * Licence layout: MIT for the root and each package, all rights reserved everywhere else.
 *
 * The root `LICENSE` and each `packages/<name>/LICENSE` hold the MIT text. Every other top-level
 * folder that git tracks holds its own `LICENSE` that reserves all rights, so a new folder cannot
 * fall under the root MIT text by accident. Folders that hold only repository configuration are
 * exempt. The root files `AGENTS.md` and `CLAUDE.md` are the entry points to the agent setup in
 * `.agents/`, so each carries a notice that puts it under `.agents/LICENSE` instead of the root MIT.
 *
 * Usage: node scripts/licences.mjs check
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIG_ONLY = new Set([".github", ".changeset", ".vscode"]);
const MIT = /^MIT License\n/;
const RESERVED = /^Copyright \(c\) \d{4} NorthGuild\. All rights reserved\.\n/;
const AGENT_ENTRY_POINTS = ["AGENTS.md", "CLAUDE.md"];
const AGENT_NOTICE =
  /^Copyright \(c\) \d{4} NorthGuild\. All rights reserved under \[`\.agents\/LICENSE`\]\(\.agents\/LICENSE\); the root MIT licence does not apply to this file\.$/m;

/** Lists the tracked paths under `root`, so local build and tool folders are left out. */
function trackedPaths(root) {
  return execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
  }).split("\n");
}

/** Returns one message per folder whose `LICENSE` is missing or carries the wrong terms. */
export function findLicenceProblems(root, paths = trackedPaths(root)) {
  const problems = [];
  const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

  if (!MIT.test(read(join(root, "LICENSE")) ?? "")) {
    problems.push("LICENSE: the root licence must be the MIT text");
  }

  for (const file of AGENT_ENTRY_POINTS) {
    if (!AGENT_NOTICE.test(read(join(root, file)) ?? "")) {
      problems.push(
        `${file}: the agent entry point must carry the all-rights-reserved notice for .agents/LICENSE`,
      );
    }
  }

  const folders = new Set(
    paths.filter((p) => p.includes("/")).map((p) => p.split("/")[0]),
  );
  const packages = new Set(
    paths.filter((p) => p.startsWith("packages/")).map((p) => p.split("/")[1]),
  );

  for (const folder of [...folders].sort()) {
    if (CONFIG_ONLY.has(folder) || folder === "packages") continue;
    if (!RESERVED.test(read(join(root, folder, "LICENSE")) ?? "")) {
      problems.push(
        `${folder}/LICENSE: a folder outside packages/ must reserve all rights`,
      );
    }
  }

  for (const pkg of [...packages].sort()) {
    if (!MIT.test(read(join(root, "packages", pkg, "LICENSE")) ?? "")) {
      problems.push(
        `packages/${pkg}/LICENSE: a package licence must be the MIT text`,
      );
    }
  }

  return problems;
}

if (process.argv[2] === "check") {
  const problems = findLicenceProblems(ROOT);
  if (problems.length > 0) {
    console.error(
      `Licence layout check failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("Licence layout check passed.");
} else if (process.argv[2] !== undefined) {
  console.error("Usage: node scripts/licences.mjs check");
  process.exit(2);
}
