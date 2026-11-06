#!/usr/bin/env node
/**
 * Bundle-size gate for `@northguild/gmt`.
 *
 *   node scripts/bundle-size.mjs [check]            table; exit 1 over a budget, or an `absent`
 *                                                   path that is bundled or no longer names a
 *                                                   file, exit 2 when esbuild fails
 *   node scripts/bundle-size.mjs report            the same table and the same --json file, but
 *                                                   exit 0 over a budget (still 2 when esbuild
 *                                                   fails); the Dox build uses it to write the
 *                                                   figures its bundle-size page shows
 *   node scripts/bundle-size.mjs --files <entry>    also the top 15 inputs of one entry
 *   node scripts/bundle-size.mjs --json <file>      also write the measurements to a file
 *   node scripts/bundle-size.mjs --compare <file>   also print the change against such a file
 *   node scripts/bundle-size.mjs --update           rewrite every budget to size + 1%
 *
 * esbuild bundles `packages/gmt/src` in memory (`write: false`), so `dist` is never touched and
 * the minified sizes are byte-for-byte repeatable for a pinned esbuild. Gzipped sizes are
 * reported, never gated: they vary with zlib's version.
 *
 * Two sets are measured with the same esbuild settings:
 *   shipped    GMT's own source on `temporal-polyfill`. It is gated by `check`.
 *   previous   the last GMT release on `@js-temporal/polyfill` (pinned through the root
 *              devDependency `gmt-js-temporal-release`; the pin moves only by a reviewed edit). It is never gated, and only a run with `--json` measures it.
 *              A name the release does not export is recorded as null.
 *
 * The `--json` file holds `floor` (the entry every other size contains, `polyfill`) and, per entry
 * of the shipped set, its minified and gzipped bytes and its `budget` (a number, or null for an
 * entry with none). It also holds `polyfills`: one item per set, shipped first, each with its
 * `package`, `version`, `import` line, `shipped` flag, measured `gmt` version, `from` ("source" or
 * "npm") and `entries` (minified and gzipped bytes, or null). `apps/dox` reads it.
 *
 * Budgets live in `scripts/bundle-size.budgets.json`. A budget is raised only by a reviewed edit
 * to that file; `--update` is for that edit.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { version as esbuildVersion } from "esbuild";
import {
  absentPathFailures,
  measureEntry,
  reportShape,
} from "./lib/bundle-size.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GMT_DIR = path.join(ROOT, "packages", "gmt");
const BUDGETS_FILE = path.join(ROOT, "scripts", "bundle-size.budgets.json");

const SHIPPED_POLYFILL = "temporal-polyfill";
const SHIPPED_IMPORT = "temporal-polyfill/full/implementation";
const PREVIOUS_POLYFILL = "@js-temporal/polyfill";
const RELEASE_ALIAS = "gmt-js-temporal-release";
const FUNCTIONS = [
  "isValidDate",
  "formatDate",
  "businessDaysBetween",
  "addBusinessDays",
  "chargeableDays",
  "operatingTimeBetween",
  "dutyViolations",
];
const FLOOR = "polyfill";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** A set of entries: each name maps to the `stdin` string esbuild bundles for it. */
const entriesFor = (from, floorImport) => ({
  root: `export * from "${from}";`,
  // The floor: reported, not budgeted.
  [FLOOR]: `export { Temporal } from "${floorImport}";`,
  ...Object.fromEntries(
    FUNCTIONS.map((name) => [name, `export { ${name} } from "${from}";`]),
  ),
});

/** The shipped set bundles this checkout's source. */
const ENTRIES = entriesFor("./src/index.ts", SHIPPED_IMPORT);

const toForward = (p) => p.split(path.sep).join("/").replaceAll("\\", "/");

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const kb = (n) => (n / 1000).toFixed(1);
const signed = (n) => {
  const r = Math.round(n * 10) / 10 || 0;
  return (r >= 0 ? "+" : "") + r.toFixed(1);
};
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

function parseArgs(argv) {
  const args = argv.filter((a) => a !== "--");
  const out = { mode: "check", files: null, json: null, compare: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "check") out.mode = "check";
    else if (a === "report") out.mode = "report";
    else if (a === "--update") out.mode = "update";
    else if (a === "--files") out.files = args[++i];
    else if (a === "--json") out.json = args[++i];
    else if (a === "--compare") out.compare = args[++i];
    else {
      console.error(`bundle-size: unknown argument ${a}`);
      process.exit(2);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const budgets = JSON.parse(readFileSync(BUDGETS_FILE, "utf8"));

if (args.files !== null && !(args.files in ENTRIES)) {
  console.error(`bundle-size: no entry named ${args.files}`);
  process.exit(2);
}

/**
 * The previous set: the published release, bundled from its package directory. Its own polyfill is
 * resolved by esbuild from the release's real path, because pnpm only links it next to the release.
 */
async function measurePrevious() {
  let releaseDir;
  try {
    releaseDir = realpathSync(path.join(ROOT, "node_modules", RELEASE_ALIAS));
  } catch {
    console.error(
      `bundle-size: ${RELEASE_ALIAS} is not installed; run pnpm install`,
    );
    process.exit(2);
  }
  const release = readJson(path.join(releaseDir, "package.json"));
  const sets = entriesFor(RELEASE_ALIAS, PREVIOUS_POLYFILL);
  const previous = {};
  for (const [name, contents] of Object.entries(sets)) {
    const resolveDir = name === FLOOR ? releaseDir : ROOT;
    try {
      // A name the release does not export is a null entry, never an error.
      previous[name] = await measureEntry(contents, resolveDir, {
        missingIsNull: name !== FLOOR,
      });
    } catch (error) {
      console.error(
        `bundle-size: esbuild failed on previous entry "${name}": ${error.message}`,
      );
      process.exit(2);
    }
  }
  // esbuild resolved the release's own polyfill; read its version from the file it bundled.
  const marker = `node_modules/${PREVIOUS_POLYFILL}/`;
  const bundled = Object.keys(previous[FLOOR].inputs)
    .map(toForward)
    .find((f) => f.includes(marker));
  // esbuild's metafile paths are relative to its working directory, the current one.
  const polyfillDir = path.resolve(
    bundled.slice(0, bundled.indexOf(marker) + marker.length),
  );
  return {
    package: PREVIOUS_POLYFILL,
    version: readJson(path.join(polyfillDir, "package.json")).version,
    importPath: PREVIOUS_POLYFILL,
    gmt: release.version,
    from: "npm",
    measured: previous,
  };
}

const measured = {};
for (const name of Object.keys(ENTRIES)) {
  try {
    measured[name] = await measureEntry(ENTRIES[name], GMT_DIR, {
      missingIsNull: false,
    });
  } catch (error) {
    console.error(
      `bundle-size: esbuild failed on entry "${name}": ${error.message}`,
    );
    process.exit(2);
  }
}

const absentFailures = absentPathFailures(budgets, GMT_DIR, (file) => {
  try {
    return statSync(file).isFile() ? "file" : "directory";
  } catch {
    return "missing";
  }
});

if (args.mode === "update") {
  for (const name of Object.keys(budgets.entries)) {
    const old = budgets.entries[name].minified;
    const next = Math.ceil((measured[name].minified * 101) / 10000) * 100;
    budgets.entries[name].minified = next;
    console.log(`${pad(name, 22)} ${old} -> ${next}`);
  }
  writeFileSync(BUDGETS_FILE, `${JSON.stringify(budgets, null, 2)}\n`);
  process.exit(0);
}

const floor = measured[FLOOR].minified;
console.log(
  [
    pad("entry", 22),
    padL("minified", 10),
    padL("gzipped", 10),
    padL("budget", 10),
    padL("over floor", 11),
  ].join(" "),
);
const failures = [...absentFailures];
for (const [name, m] of Object.entries(measured)) {
  const budget = budgets.entries[name]?.minified;
  console.log(
    [
      pad(name, 22),
      padL(m.minified, 10),
      padL(m.gzipped, 10),
      padL(budget ?? "—", 10),
      padL(name === FLOOR ? "—" : m.minified - floor, 11),
    ].join(" "),
  );
  if (budget !== undefined && m.minified > budget) {
    failures.push(
      `${name}: ${m.minified} bytes minified is over its budget of ${budget}`,
    );
  }
  for (const banned of budgets.absent?.[name] ?? []) {
    const wanted = toForward(banned);
    // esbuild keys inputs relative to the working directory; `absent` paths are relative to packages/gmt.
    const hit = Object.keys(m.inputs).find(
      (f) => toForward(path.relative(GMT_DIR, path.resolve(f))) === wanted,
    );
    if (hit !== undefined)
      failures.push(`${name}: ${banned} is bundled but must be absent`);
  }
}

if (args.files !== null) {
  const inputs = Object.entries(measured[args.files].inputs)
    .map(([file, v]) => [file, v.bytesInOutput])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  console.log(`\nTop 15 inputs of ${args.files} by bytes in the output:`);
  for (const [file, bytes] of inputs)
    console.log(`${padL(bytes, 9)}  ${toForward(file)}`);
}

if (args.json !== null) {
  const previous = await measurePrevious();
  const shipped = {
    package: SHIPPED_POLYFILL,
    version: readJson(
      path.join(GMT_DIR, "node_modules", SHIPPED_POLYFILL, "package.json"),
    ).version,
    importPath: SHIPPED_IMPORT,
    gmt: readJson(path.join(GMT_DIR, "package.json")).version,
    from: "source",
    measured,
  };
  writeFileSync(
    path.resolve(args.json),
    `${JSON.stringify(
      reportShape({
        meta: {
          // `date`, not a native Date: the repo bans it even in scripts.
          measuredAt: execFileSync("date", ["-u", "+%Y-%m-%dT%H:%M:%SZ"], {
            encoding: "utf8",
          }).trim(),
          node: process.version,
          esbuild: esbuildVersion,
          commit: git("rev-parse", "HEAD"),
          dirty: git("status", "--porcelain") !== "",
        },
        floor: FLOOR,
        budgets,
        shipped,
        previous,
      }),
      null,
      2,
    )}\n`,
  );
}

if (args.compare !== null) {
  const before = JSON.parse(
    readFileSync(path.resolve(args.compare), "utf8"),
  ).entries;
  console.log(
    `\nChange against ${args.compare} (kB = 1,000 bytes)\n` +
      [
        pad("entry", 22),
        padL("min before", 11),
        padL("after", 8),
        padL("change", 8),
        padL("%", 7),
        padL("gz before", 10),
        padL("after", 8),
        padL("change", 8),
        padL("%", 7),
      ].join(" "),
  );
  const row = (b, a) => {
    if (b === undefined || a === undefined)
      return [padL("—", 11), "—", "—", "—"].map((s, i) =>
        padL(s, [11, 8, 8, 7][i]),
      );
    const d = a - b;
    return [
      padL(kb(b), 11),
      padL(kb(a), 8),
      padL(signed(d / 1000), 8),
      padL(b === 0 ? "—" : signed((d / b) * 100), 7),
    ];
  };
  const totals = { bMin: 0, aMin: 0, bGz: 0, aGz: 0 };
  for (const name of new Set([
    ...Object.keys(before),
    ...Object.keys(measured),
  ])) {
    const b = before[name];
    const a = measured[name];
    const gz = row(b?.gzipped, a?.gzipped);
    gz[0] = padL(gz[0].trim(), 10);
    console.log(
      [pad(name, 22), ...row(b?.minified, a?.minified), ...gz].join(" "),
    );
    if (b !== undefined && a !== undefined) {
      totals.bMin += b.minified;
      totals.aMin += a.minified;
      totals.bGz += b.gzipped;
      totals.aGz += a.gzipped;
    }
  }
  const gz = row(totals.bGz, totals.aGz);
  gz[0] = padL(gz[0].trim(), 10);
  console.log(
    [pad("total", 22), ...row(totals.bMin, totals.aMin), ...gz].join(" "),
  );
}

if (failures.length > 0 && args.mode === "report") {
  console.log(
    `\nbundle-size: ${failures.length} problem(s), not failing in report mode`,
  );
  for (const f of failures) console.log(`  ${f}`);
} else if (failures.length > 0) {
  console.error(`\nbundle-size: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
