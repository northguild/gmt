#!/usr/bin/env node
/**
 * Leap-second canary.
 *
 *   node scripts/leap-seconds.mjs check [--file=<path>] [--iana-file=<path>]
 *     Fetches IERS `Leap_Second.dat`, parses its data rows (MJD, day, month, year, TAI − UTC) and
 *     compares them, row by row, with `LEAP_SECOND_STEPS` re-parsed from the source literal in
 *     `packages/gmt/src/internal/leapSeconds.ts`. Exit 0 when every row matches. Exit 1, printing
 *     the IERS header line ("Updated through IERS Bulletin …"), when any row differs, a row is
 *     added or removed, or the file no longer reads as rows. Exit 2 when it cannot run (the
 *     network or the source file). `--file` reads a local IERS copy instead of fetching, for
 *     offline debugging.
 *
 *     When IERS cannot be read (network error, timeout, HTTP error, unreadable `--file`), it reads
 *     IANA's `leap-seconds.list` instead: the same IERS table, republished by tzdb. A file that is
 *     read but differs or does not parse never falls back; that stays exit 1 against IERS. The IANA
 *     file carries an expiry (`#@`, NTP seconds); once it is at or before now, the fallback cannot
 *     vouch for the table and the run exits 2. `--iana-file` reads a local IANA copy instead of
 *     fetching. If both sources fail, exit 2 with both failures named.
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
 * `Date` arithmetic: an epoch-nanosecond value, an NTP second count and an MJD are all whole days
 * from a fixed epoch, so they compare with integer arithmetic. Only `Date.now()` is read, for the
 * IANA expiry check.
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
  saveVerdict,
} from "./lib/canary-verdict.mjs";

// fileURLToPath, not `.pathname`: see scripts/test-markers.mjs — a percent-encoded path breaks
// any checkout whose directory name contains a space.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = "packages/gmt/src/internal/leapSeconds.ts";
const IERS_URL = "https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat";
const IANA_URL = "https://data.iana.org/time-zones/tzdb/leap-seconds.list";
const IERS_NAME = "IERS Leap_Second.dat";
const IANA_NAME = "IANA leap-seconds.list";
const FETCH_TIMEOUT_MS = 30_000;

const SECONDS_PER_DAY = 86_400n;
/** MJD of 1900-01-01, the epoch NTP seconds count from (RFC 5905 §6). */
const MJD_OF_NTP_EPOCH = 15_020n;
/** NTP seconds at 1970-01-01: 25 567 days (70 years, 17 leap days) of 86 400 s. */
const NTP_OF_UNIX_EPOCH = 2_208_988_800n;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const NANOSECONDS_PER_DAY = 86_400_000_000_000n;
/** MJD of 1970-01-01, the epoch `epochNanoseconds` counts from. */
const MJD_OF_UNIX_EPOCH = 40_587n;

/** One `ROWS` entry: `  [63072000000000000n, 10n], // 1972-01-01T00:00:00Z`. */
const SOURCE_ROW =
  /^\s*\[(\d+)n,\s*(-?\d+)n\],\s*\/\/\s*(\d{4})-(\d{2})-(\d{2})T00:00:00Z\s*$/;
/** One `Leap_Second.dat` data row: `    41317.0    1  1 1972       10`. */
const IERS_ROW = /^\s*(\d+)\.0\s+(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s+(-?\d+)\s*$/;
/** One `leap-seconds.list` data row: `2272060800\t10\t# 1 Jan 1972`. */
const IANA_ROW = new RegExp(
  `^\\s*(\\d+)\\s+(-?\\d+)\\s*#\\s*(\\d{1,2})\\s+(${MONTHS.join("|")})\\s+(\\d{4})\\s*$`,
);
/** The expiry line of `leap-seconds.list`: `#@\t4023129600`. */
const IANA_EXPIRY = /^#@\s+(\d+)\s*$/m;
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

/**
 * The data rows of IANA's `leap-seconds.list` (NTP seconds, TAI − UTC, a date comment). `#` lines
 * are comments except `#@`, the expiry; any other non-blank line must be a row. Returns
 * `{ header, rows, expiry, problems }`; `expiry` is NTP seconds as a bigint, or null when missing.
 */
function parseIanaRows(text) {
  const header = IERS_HEADER.exec(text);
  const lines = text.split("\n").filter((l) => !COMMENT_OR_BLANK.test(l));
  const { rows, problems } = readRows(lines, IANA_ROW, ianaRow, "IANA");
  if (!header) problems.push('IANA: no "Updated through" line');
  const expiry = IANA_EXPIRY.exec(text);
  if (!expiry) problems.push("IANA: no expiry (#@) line");
  return {
    header: header ? header[0].trim() : null,
    rows,
    expiry: expiry ? BigInt(expiry[1]) : null,
    problems,
  };
}

/** An IANA row as `{ mjd, date, offset }`, checking the NTP value against its own comment. */
function ianaRow(match, problems) {
  const [, ntp, offset, day, month, year] = match;
  const at = BigInt(ntp);
  const mjd = MJD_OF_NTP_EPOCH + at / SECONDS_PER_DAY;
  const date = isoDate(year, BigInt(MONTHS.indexOf(month) + 1), day);
  if (at % SECONDS_PER_DAY !== 0n || dateOfMjd(mjd) !== date) {
    problems.push(`IANA: ${ntp} is not 00:00:00 on ${date}`);
  }
  return { mjd, date, offset: BigInt(offset) };
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

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return await response.text();
}

async function readIers(file) {
  return file ? readFileSync(file, "utf8") : await fetchText(IERS_URL);
}

async function readIana(file) {
  return file ? readFileSync(file, "utf8") : await fetchText(IANA_URL);
}

/** Writes the verdict file; a failure is only reported (see `saveVerdict`). */
function saveLeapVerdict(verdict) {
  saveVerdict(ROOT, verdict, "leap-seconds");
}

/** Reports that the check cannot run, writes the could-not-run verdict and exits 2. */
function cannotRun(message) {
  console.error(`leap-seconds: cannot run: ${message}`);
  saveLeapVerdict(couldNotRunVerdict("leap-seconds", `cannot run: ${message}`));
  process.exit(2);
}

/** The current time as NTP seconds. `Date.now()` is whole milliseconds. */
function nowNtpSeconds() {
  // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- this script imports no build of the library (see header)
  return BigInt(Date.now()) / 1000n + NTP_OF_UNIX_EPOCH; // date-ban: epoch seconds compared with the IANA expiry in epoch seconds, not a date value
}

/** `{ from, table }`: IERS when it can be read, otherwise IANA, which must not have expired. */
async function loadSourceTable(options) {
  let iersError;
  try {
    return {
      from: IERS_NAME,
      table: parseIersRows(await readIers(options.file)),
    };
  } catch (error) {
    iersError = error.message;
  }
  console.error(
    `leap-seconds: ${IERS_NAME} unreachable (${iersError}); reading ${IANA_NAME}`,
  );
  let table;
  try {
    table = parseIanaRows(await readIana(options.ianaFile));
  } catch (error) {
    return cannotRun(
      `${IERS_NAME}: ${iersError}; ${IANA_NAME}: ${error.message}`,
    );
  }
  if (table.expiry !== null && table.expiry <= nowNtpSeconds()) {
    const expired = dateOfMjd(
      MJD_OF_NTP_EPOCH + table.expiry / SECONDS_PER_DAY,
    );
    return cannotRun(
      `${IERS_NAME}: ${iersError}; ${IANA_NAME} expired on ${expired}, so it cannot vouch for the table`,
    );
  }
  return { from: IANA_NAME, table };
}

async function loadTables(options) {
  let sourceText;
  try {
    sourceText = readFileSync(join(ROOT, SOURCE), "utf8");
  } catch (error) {
    return cannotRun(error.message);
  }
  const { from, table } = await loadSourceTable(options);
  return { from, source: parseSourceRows(sourceText), iers: table };
}

async function check(options) {
  const { from, source, iers } = await loadTables(options);
  const problems = [
    ...source.problems,
    ...iers.problems,
    ...compareRows(source.rows, iers.rows),
  ];
  saveLeapVerdict(
    leapSecondsVerdict({
      from,
      header: iers.header,
      gmtRows: source.rows.length,
      iersRows: iers.rows.length,
      differences: problems,
    }),
  );
  const header = iers.header ?? "(no header line)";
  if (problems.length > 0) {
    console.error(
      `leap-seconds: ${SOURCE} no longer matches ${from}.\n` +
        `IERS: ${header}\n` +
        problems.map((p) => `  ${p}`).join("\n") +
        "\nA new row is a data edit in leapSeconds.ts plus a `patch` changeset; " +
        "leapSeconds.test.ts checks the edit.",
    );
    process.exit(1);
  }
  console.log(
    `leap-seconds: ${source.rows.length} rows match ${from} (${header})`,
  );
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const command = argv[0] ?? "check";
const file = argv.find((a) => a.startsWith("--file="))?.slice("--file=".length);
const ianaFile = argv
  .find((a) => a.startsWith("--iana-file="))
  ?.slice("--iana-file=".length);
const commands = { check };
if (!commands[command]) {
  console.error(
    "Usage: node scripts/leap-seconds.mjs check [--file=<path>] [--iana-file=<path>]",
  );
  process.exit(1);
}
await commands[command]({ file, ianaFile });
