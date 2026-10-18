#!/usr/bin/env node
/**
 * Bundle-size gate for `@northguild/gmt`.
 *
 *   node scripts/bundle-size.mjs [check]            table; exit 1 over a budget or a listed
 *                                                   `absent` path, exit 2 when esbuild fails
 *   node scripts/bundle-size.mjs --files <entry>    also the top 15 inputs of one entry
 *   node scripts/bundle-size.mjs --json <file>      also write the measurements to a file
 *   node scripts/bundle-size.mjs --compare <file>   also print the change against such a file
 *   node scripts/bundle-size.mjs --update           rewrite every budget to size + 1%
 *
 * esbuild bundles `packages/gmt/src` in memory (`write: false`), so `dist` is never touched and
 * the minified sizes are byte-for-byte repeatable for a pinned esbuild. Gzipped sizes are
 * reported, never gated: they vary with zlib's version.
 *
 * Budgets live in `scripts/bundle-size.budgets.json`. A budget is raised only by a reviewed edit
 * to that file; `--update` is for that edit.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build, version as esbuildVersion } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GMT_DIR = path.join(ROOT, "packages", "gmt");
const BUDGETS_FILE = path.join(ROOT, "scripts", "bundle-size.budgets.json");

const fromSrc = (name) => `export { ${name} } from "./src/index.ts";`;

/** Every measured entry, each one a `stdin` string bundled from `packages/gmt`. */
const ENTRIES = {
  root: `export * from "./src/index.ts";`,
  // The floor: reported, not budgeted.
  polyfill: `export { Temporal } from "@js-temporal/polyfill";`,
  isValidDate: fromSrc("isValidDate"),
  formatDate: fromSrc("formatDate"),
  businessDaysBetween: fromSrc("businessDaysBetween"),
  addBusinessDays: fromSrc("addBusinessDays"),
  chargeableDays: fromSrc("chargeableDays"),
  operatingTimeBetween: fromSrc("operatingTimeBetween"),
  dutyViolations: fromSrc("dutyViolations"),
};
const FLOOR = "polyfill";

const toForward = (p) => p.split(path.sep).join("/").replaceAll("\\", "/");

async function measure(name) {
  const result = await build({
    stdin: { contents: ENTRIES[name], resolveDir: GMT_DIR, loader: "ts" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    target: "es2022",
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  const bytes = result.outputFiles[0].contents;
  const output = Object.values(result.metafile.outputs)[0];
  return {
    minified: bytes.length,
    gzipped: gzipSync(bytes, { level: 9 }).length,
    inputs: output.inputs,
  };
}

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

const measured = {};
for (const name of Object.keys(ENTRIES)) {
  try {
    measured[name] = await measure(name);
  } catch (error) {
    console.error(
      `bundle-size: esbuild failed on entry "${name}": ${error.message}`,
    );
    process.exit(2);
  }
}

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
const failures = [];
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
  const entries = {};
  for (const [name, m] of Object.entries(measured)) {
    entries[name] = { minified: m.minified, gzipped: m.gzipped };
  }
  writeFileSync(
    path.resolve(args.json),
    `${JSON.stringify(
      {
        // `date`, not a native Date: the repo bans it even in scripts.
        measuredAt: execFileSync("date", ["-u", "+%Y-%m-%dT%H:%M:%SZ"], {
          encoding: "utf8",
        }).trim(),
        node: process.version,
        esbuild: esbuildVersion,
        commit: git("rev-parse", "HEAD"),
        dirty: git("status", "--porcelain") !== "",
        entries,
      },
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

if (failures.length > 0) {
  console.error(`\nbundle-size: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
