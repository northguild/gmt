/**
 * Install helpers. A clone sits under this folder, whose own pnpm-workspace.yaml would swallow
 * it, so `--ignore-workspace` is passed. A clone with a workspace file of its own is its own
 * workspace root (its catalogs live there); ignoring it breaks the frozen install.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/** The pnpm flags for installing in a clone rooted at `dir`. */
export function pnpmFlags(dir) {
  return [
    ...(existsSync(join(dir, "pnpm-workspace.yaml"))
      ? []
      : ["--ignore-workspace"]),
    "--pm-on-fail=ignore",
  ];
}

/**
 * The command line of an install step. A step that names `pnpm: "<version>"` runs that pnpm
 * through npx: pnpm 12 ignores the `pnpm.overrides` field of package.json, so a lockfile written
 * by an older pnpm no longer matches and a frozen install fails.
 */
export function stepCommand(step, dir) {
  if (step.cmd !== "pnpm") return { cmd: step.cmd, args: step.args };
  if (step.pnpm)
    return {
      cmd: "npx",
      args: [
        "--yes",
        `pnpm@${step.pnpm}`,
        ...step.args,
        ...pnpmFlags(dir).filter((f) => f !== "--pm-on-fail=ignore"),
      ],
    };
  return { cmd: "pnpm", args: [...step.args, ...pnpmFlags(dir)] };
}
