/**
 * The locale list of the weekly CLDR sweeps (`scripts/canary/weekYear.mjs` and
 * `scripts/canary/rangeFields.mjs`): the directory listing of the `cldr-dates-full` package for the
 * CLDR version the engine reports, fetched at run time with `npm pack` into a temporary directory,
 * never a dependency and never shipped, then filtered by `Intl.DateTimeFormat.supportedLocalesOf`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The comma list after `--name` on the command line, or `null` when the option is absent. */
export function argument(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? null : (process.argv[at + 1] ?? "").split(",");
}

/** The locales of `cldr-dates-full` for this engine's CLDR version, fetched into a temp directory. */
function cldrLocales() {
  const directory = mkdtempSync(join(tmpdir(), "gmt-cldr-"));
  try {
    const version = process.versions.cldr?.split(".")[0] ?? "";
    const pack = spawnSync(
      "npm",
      [
        "pack",
        `cldr-dates-full@${version ? `${version}` : "latest"}`,
        "--silent",
      ],
      { cwd: directory, encoding: "utf8" },
    );
    if (pack.status !== 0) {
      return null;
    }
    const tarball = pack.stdout.trim().split("\n").at(-1) ?? "";
    spawnSync("tar", ["-xzf", tarball], { cwd: directory });
    const main = join(directory, "package", "main");
    return existsSync(main) ? readdirSync(main) : null;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * The locales to sweep: `--locales` as given, else every `cldr-dates-full` locale the engine
 * supports. Exits 2 when the package cannot be fetched.
 */
export function localeList() {
  const given = argument("locales");
  if (given !== null) {
    return given;
  }
  const listed = cldrLocales();
  if (listed === null) {
    console.error(
      "cannot fetch cldr-dates-full (npm pack failed): pass --locales",
    );
    process.exit(2);
  }
  return Intl.DateTimeFormat.supportedLocalesOf(listed);
}
