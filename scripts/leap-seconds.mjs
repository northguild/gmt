#!/usr/bin/env node
/**
 * Leap-second canary.
 *
 *   node scripts/leap-seconds.mjs check [--file=<path>]
 *     Fetches IERS `Leap_Second.dat`, parses its data rows (MJD, day, month, year, TAI − UTC) and
 *     compares them, row by row, with `LEAP_SECOND_STEPS` re-parsed from the source literal in
 *     `packages/gmt/src/internal/leapSeconds.ts`. Exit 0 when every row matches. Exit 1, printing
 *     the IERS header line ("Updated through IERS Bulletin …"), when any row differs, a row is
 *     added or removed, or the file no longer reads as rows. Exit 2 when it cannot run (the
 *     network or the source file). `--file` reads a local copy instead of fetching, for offline
 *     debugging.
 *
 * Every run that gets as far as reading the two tables writes `artifacts/leap-seconds.json`
 * (CORE-81) before it prints or exits: a verdict of what it found, or a could-not-run note ahead of
 * exit 2. The workflow files an issue from that file with `scripts/canary-report.mjs`. A usage
 * error writes nothing: no canary ran. A file that cannot be written is reported on stderr and
 * changes neither the console text nor the exit code.
 *
 * The leap-second table is closed and built in: CGPM 2026 Resolution 5 makes UTC continuous from
 * 20 May 2027, and IERS Bulletin C 72 rules out an insertion at the end of December 2026. ITU-R
 * TF.460-6 Annex 1 §2.1 still allows another month end, with at least eight weeks' notice (§2.3),
 * so this canary is what would catch a Bulletin C announcing one. A new row is a data edit in
 * `leapSeconds.ts` plus a `patch` changeset; `leapSeconds.test.ts` checks the edit.
 *
 * It reads the source text rather than importing the module, so it needs no build. It uses no
 * `Date`: an epoch-nanosecond value and an MJD are both whole days from a fixed epoch, so they
 * compare with integer arithmetic.
 *
 * Never wired into `validate` or `ci.yml`: those runs have no network. The weekly/manual run is
 * `.github/workflows/leap-seconds.yml`. Both are retired once IERS publishes its file format for
 * continuous UTC.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  couldNotRunVerdict,
  leapSecondsVerdict,
  writeVerdict,
} from "./lib/canary-verdict.mjs";

// fileURLToPath, not `.pathname`: see scripts/test-markers.mjs — a percent-encoded path breaks
// any checkout whose directory name contains a space.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = "packages/gmt/src/internal/leapSeconds.ts";
const IERS_URL = "https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat";
const FETCH_TIMEOUT_MS = 30_000;

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;
/** MJD of 1970-01-01, the epoch `epochNanoseconds` counts from. */
const MJD_OF_UNIX_EPOCH = 40_587n;

/** One `ROWS` entry: `  [63072000000000000n, 10n], // 1972-01-01T00:00:00Z`. */
const SOURCE_ROW =
  /^\s*\[(\d+)n,\s*(-?\d+)n\],\s*\/\/\s*(\d{4})-(\d{2})-(\d{2})T00:00:00Z\s*$/;
/** One `Leap_Second.dat` data row: `    41317.0    1  1 1972       10`. */
const IERS_ROW = /^\s*(\d+)\.0\s+(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s+(-?\d+)\s*$/;
const IERS_HEADER = /Updated through[^\n]*/;
/** The body of `const ROWS = [ … ];`: every line after the opening one, up to the closing `];`. */
const SOURCE_BLOCK = /const ROWS[^\n]*\n([\s\S]*?)\n\];/;
const COMMENT_OR_BLANK = /^\s*(?:#|$)/;

// ---------------------------------------------------------------- dates without `Date`

/**
 * The proleptic Gregorian date of a Modified Julian Date, as `YYYY-MM-DD`.
 *
 * Days are counted from 1970-01-01 and split into 400-year eras (H. Hinnant, "chrono-compatible
 * low-level date algorithms", `civil_from_days`). Integer `bigint` arithmetic throughout.
 */
function dateOfMjd(mjd) {
  const z = mjd - MJD_OF_UNIX_EPOCH + 719_468n;
  const era = (z >= 0n ? z : z - 146_096n) / 146_097n;
  const dayOfEra = z - era * 146_097n;
  const yearOfEra =
    (dayOfEra - dayOfEra / 1_460n + dayOfEra / 36_524n - dayOfEra / 146_096n) /
    365n;
  const dayOfYear =
    dayOfEra - (365n * yearOfEra + yearOfEra / 4n - yearOfEra / 100n);
  const shiftedMonth = (5n * dayOfYear + 2n) / 153n;
  const day = dayOfYear - (153n * shiftedMonth + 2n) / 5n + 1n;
  const month = shiftedMonth < 10n ? shiftedMonth + 3n : shiftedMonth - 9n;
  const year = yearOfEra + era * 400n + (month <= 2n ? 1n : 0n);
  return isoDate(year, month, day);
}

function isoDate(year, month, day) {
  const pad = (value, width) => String(value).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

// ---------------------------------------------------------------- the two tables

/**
 * `LEAP_SECOND_STEPS` as written in `leapSeconds.ts`: the lines between `const ROWS` and its
 * closing `];`. Every line there must be a row, so a reformatted literal fails loudly instead of
 * silently comparing fewer rows. Returns `{ rows, problems }`; each row is `{ mjd, date, offset }`.
 */
function parseSourceRows(text) {
  const block = SOURCE_BLOCK.exec(text);
  if (!block) {
    return { rows: [], problems: [`${SOURCE}: no \`const ROWS = [ … ];\``] };
  }
  const lines = block[1].split("\n").filter((l) => l.trim() !== "");
  return readRows(lines, SOURCE_ROW, sourceRow, SOURCE);
}

/** Each line read as a row by `toRow`, or a problem naming the line that is not one. */
function readRows(lines, pattern, toRow, label) {
  const rows = [];
  const problems = [];
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match) rows.push(toRow(match, problems));
    else problems.push(`${label}: not a table row: ${line.trim()}`);
  }
  return { rows, problems };
}

/** A source row as `{ mjd, date, offset }`, checking the bigint against its own comment. */
function sourceRow(match, problems) {
  const [, nanoseconds, offset, year, month, day] = match;
  const at = BigInt(nanoseconds);
  const mjd = at / NANOSECONDS_PER_DAY + MJD_OF_UNIX_EPOCH;
  const date = `${year}-${month}-${day}`;
  if (at % NANOSECONDS_PER_DAY !== 0n || dateOfMjd(mjd) !== date) {
    problems.push(`${SOURCE}: ${nanoseconds}n is not 00:00:00Z on ${date}`);
  }
  return { mjd, date, offset: BigInt(offset) };
}

/**
 * The data rows of `Leap_Second.dat`. `#` lines are comments; any other non-blank line must be a
 * row, so a change to the file's format fails the check. Returns `{ header, rows, problems }`.
 */
function parseIersRows(text) {
  const header = IERS_HEADER.exec(text);
  const lines = text.split("\n").filter((l) => !COMMENT_OR_BLANK.test(l));
  const { rows, problems } = readRows(lines, IERS_ROW, iersRow, "IERS");
  if (!header) problems.push('IERS: no "Updated through" line');
  return { header: header ? header[0].trim() : null, rows, problems };
}

/** An IERS row as `{ mjd, date, offset }`, with its date as IERS prints it. */
function iersRow(match) {
  const [, mjd, day, month, year, offset] = match;
  return {
    mjd: BigInt(mjd),
    date: isoDate(year, month, day),
    offset: BigInt(offset),
  };
}

/** One line per row that differs, is missing from the source, or is missing from IERS. */
function compareRows(source, iers) {
  const problems = [];
  const count = Math.max(source.length, iers.length);
  for (let index = 0; index < count; index += 1) {
    const problem = compareRow(index, source[index], iers[index]);
    if (problem) problems.push(problem);
  }
  return problems;
}

const describe = (row) =>
  `MJD ${row.mjd} (${row.date}), TAI − UTC ${row.offset} s`;

function compareRow(index, source, iers) {
  const label = `row ${index + 1}`;
  if (!source) return `${label}: IERS adds ${describe(iers)}`;
  if (!iers) return `${label}: IERS no longer lists ${describe(source)}`;
  // `describe` names every field, so equal descriptions are equal rows.
  return describe(source) === describe(iers)
    ? null
    : `${label}: GMT has ${describe(source)}; IERS has ${describe(iers)}`;
}

// ---------------------------------------------------------------- command

async function readIers(file) {
  if (file) return readFileSync(file, "utf8");
  const response = await fetch(IERS_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${IERS_URL}`);
  return await response.text();
}

/**
 * Writes the verdict file, and only reports a failure to. The file is an extra for the issue
 * step: when it cannot be written, the console text and the exit code of the check stand.
 */
function saveVerdict(verdict) {
  try {
    writeVerdict(ROOT, verdict);
  } catch (error) {
    console.error(`leap-seconds: cannot write verdict: ${error.message}`);
  }
}

async function loadTables(file) {
  try {
    const sourceText = readFileSync(join(ROOT, SOURCE), "utf8");
    const iersText = await readIers(file);
    return {
      source: parseSourceRows(sourceText),
      iers: parseIersRows(iersText),
    };
  } catch (error) {
    console.error(`leap-seconds: cannot run: ${error.message}`);
    saveVerdict(
      couldNotRunVerdict("leap-seconds", `cannot run: ${error.message}`),
    );
    process.exit(2);
  }
}

async function check(options) {
  const { source, iers } = await loadTables(options.file);
  const problems = [
    ...source.problems,
    ...iers.problems,
    ...compareRows(source.rows, iers.rows),
  ];
  saveVerdict(
    leapSecondsVerdict({
      header: iers.header,
      gmtRows: source.rows.length,
      iersRows: iers.rows.length,
      differences: problems,
    }),
  );
  const header = iers.header ?? "(no header line)";
  if (problems.length > 0) {
    console.error(
      `leap-seconds: ${SOURCE} no longer matches IERS Leap_Second.dat.\n` +
        `IERS: ${header}\n` +
        problems.map((p) => `  ${p}`).join("\n") +
        "\nA new row is a data edit in leapSeconds.ts plus a `patch` changeset; " +
        "leapSeconds.test.ts checks the edit.",
    );
    process.exit(1);
  }
  console.log(
    `leap-seconds: ${source.rows.length} rows match IERS Leap_Second.dat (${header})`,
  );
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const command = argv[0] ?? "check";
const file = argv.find((a) => a.startsWith("--file="))?.slice("--file=".length);
const commands = { check };
if (!commands[command]) {
  console.error("Usage: node scripts/leap-seconds.mjs check [--file=<path>]");
  process.exit(1);
}
await commands[command]({ file });
