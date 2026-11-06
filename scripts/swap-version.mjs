#!/usr/bin/env node
/**
 * Picks the `temporal-polyfill` release that the upgrade check tests, and says whether there
 * is nothing to check.
 *
 * Run by the `swap-version` job of .github/workflows/temporal-oracle.yml, which sets
 * `REQUESTED` (the `swap_version` input, empty when not given) and `GITHUB_OUTPUT`. It writes
 * `version=<x.y.z>` and `skip=true|false`. It reads the pin from packages/gmt/package.json and
 * the newest release from `npm view temporal-polyfill version`.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/**
 * @param {{ requested: string, newest: string, pinned: string | null }} input
 *   `requested` is the version given by hand ("" when none), `newest` the latest release
 * @returns {{ version: string, skip: boolean }}  `skip` is true only when no version was given
 *   by hand and the pin is already the newest release
 * @throws {Error} when the chosen version is not x.y.z
 */
export function pickSwapVersion({ requested, newest, pinned }) {
  const version = requested === "" ? newest : requested;
  if (!SEMVER.test(version)) throw new Error(`not a x.y.z version: ${version}`);
  return { version, skip: requested === "" && version === pinned };
}

/** @returns {number} the process exit code */
function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const requested = (process.env.REQUESTED ?? "").trim();
    const pin = JSON.parse(
      readFileSync(join(root, "packages/gmt/package.json"), "utf8"),
    ).dependencies?.["temporal-polyfill"];
    const newest =
      requested === ""
        ? execFileSync("npm", ["view", "temporal-polyfill", "version"], {
            encoding: "utf8",
          }).trim()
        : "";
    const { version, skip } = pickSwapVersion({
      requested,
      newest,
      pinned: typeof pin === "string" ? pin : null,
    });
    const lines = `version=${version}\nskip=${skip}\n`;
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, lines);
    else process.stdout.write(lines);
    if (skip && process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `The pinned temporal-polyfill ${version} is the newest release, so there is nothing to check.\n`,
      );
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main();
