#!/usr/bin/env node
/**
 * The weekly sweep for D23 and D24 (CORE-112): CLDR date patterns that print the week-of-year year
 * where the calendar year is meant, and V8 without commit 0426b0d1045d aborting the process in
 * `formatToParts` on them (nodejs/node#67076).
 *
 * The recorded repros in `temporalCompat/repros.ts` cannot see a new locale's `Y`. This sweep can:
 * the locale list is the directory listing of the `cldr-dates-full` package for the CLDR version
 * the engine reports, fetched at run time with `npm pack` into a temporary directory, never a
 * dependency and never shipped, then filtered by `Intl.DateTimeFormat.supportedLocalesOf`.
 *
 * For every locale and calendar, over a set of option shapes:
 *
 * 1. In this process, `format` and the guard's parts only. A formatter the guard replaces must give
 *    non-empty parts that join to its own `format`, and a `format` that keeps its digit runs.
 * 2. In one child process per locale: the engine's own `formatToParts` on every formatter the
 *    guard left alone. An exit of 133 is a guard false negative and fails the run.
 *
 * The D23 reading is confirmed on Node: `resolvedOptions().year` of a week-year pattern and a child
 * process that calls `formatToParts` must agree (exit 133 with no year, exit 0 with one), else a
 * signal GMT relies on has changed and the run fails.
 *
 * Needs `packages/gmt/dist` (run `pnpm build` first). Options: `--locales gd,ksh` for a quick run,
 * `--calendars gregory,hebrew`. Exits 1 on any failure, 2 when it cannot run.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIST = join(ROOT, "packages/gmt/dist");

const OPTION_SETS = [
  { year: "numeric", month: "short" },
  { year: "numeric", month: "long" },
  { year: "numeric", month: "numeric" },
  { year: "2-digit", month: "2-digit" },
  { year: "numeric", month: "numeric", day: "numeric" },
  { year: "numeric", month: "short", day: "numeric", weekday: "short" },
  {
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  },
  { year: "numeric", month: "short", hour: "numeric", minute: "numeric" },
  { year: "numeric" },
  { era: "short" },
  { dateStyle: "full" },
  { dateStyle: "long" },
  { dateStyle: "medium" },
  { dateStyle: "short" },
  { dateStyle: "full", timeStyle: "short" },
];

const DATES = [1735554000000, 1798798800000, 1782901200000, 1798755600000];

function argument(name) {
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

function localeList() {
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

/** Exit status of a child process running `source`. */
function exitOf(source) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    timeout: 60_000,
  });
}

if (!existsSync(join(DIST, "internal/weekYearGuard.js"))) {
  console.error("packages/gmt/dist is missing: run pnpm build first");
  process.exit(2);
}
const { guardDateTimeFormat } = await import(
  pathToFileURL(join(DIST, "internal/weekYearGuard.js")).href
);

const failures = [];
const counts = { formatters: 0, flagged: 0, unflagged: 0, crashed: 0 };
const calendars = argument("calendars") ?? Intl.supportedValuesOf("calendar");

for (const locale of localeList()) {
  const unflagged = [];
  for (const calendar of calendars) {
    for (const options of OPTION_SETS) {
      const full = { ...options, calendar, timeZone: "UTC" };
      let native;
      try {
        native = new Intl.DateTimeFormat(locale, full);
      } catch {
        continue;
      }
      counts.formatters++;
      const guarded = guardDateTimeFormat(native, full);
      if (guarded === native) {
        counts.unflagged++;
        unflagged.push({ calendar, options: full });
        continue;
      }
      counts.flagged++;
      for (const ms of DATES) {
        const text = guarded.format(ms);
        const parts = guarded.formatToParts(ms);
        if (
          parts.length === 0 ||
          parts.map((part) => part.value).join("") !== text
        ) {
          failures.push({
            locale,
            calendar,
            options,
            ms,
            why: "parts do not join to the text",
            text,
            parts,
          });
        }
      }
    }
  }
  if (unflagged.length > 0) {
    const run = exitOf(
      `for (const o of ${JSON.stringify(unflagged)}) for (const ms of ${JSON.stringify(DATES)})` +
        ` new Intl.DateTimeFormat(${JSON.stringify(locale)}, { ...o.options }).formatToParts(ms);`,
    );
    if (run.status !== 0) {
      counts.crashed++;
      failures.push({
        locale,
        why: `unflagged formatter crashed (exit ${run.status}): a guard false negative`,
      });
    }
  }
}

// The D23 reading and the abort must agree (Node only).
const gd = { year: "numeric", month: "short", timeZone: "UTC" };
const resolvedYear = new Intl.DateTimeFormat("gd", gd).resolvedOptions().year;
const child = exitOf(
  `new Intl.DateTimeFormat("gd", ${JSON.stringify(gd)}).formatToParts(0);`,
);
const aborts = child.status !== 0;
console.log(
  `V8 ${process.versions.v8 ?? "none"}: resolvedOptions().year ${resolvedYear}, formatToParts exit ${child.status}`,
);
if ((resolvedYear === undefined) !== aborts) {
  failures.push({
    why: "resolvedOptions().year and the abort disagree: the D23 crash signal no longer holds",
  });
}

console.log(JSON.stringify(counts));
for (const failure of failures) {
  console.log(JSON.stringify(failure));
}
process.exit(failures.length === 0 ? 0 : 1);
