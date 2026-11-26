#!/usr/bin/env node
/**
 * Probes `@internationalized/date`'s calendars against native `Temporal` for Deck 0's `stand-ins`
 * slide, and records what differs. Our own probe is the only source: the slide's counts are read
 * from `intl-date-calendars.json`, never typed in, and nothing here is filed anywhere.
 *
 *   cd scripts/zone-matrix
 *   fnm exec --using=26 -- node intl-date-calendars.mjs
 *
 * The library comes from this folder's `node_modules` and the reference is the host's `Temporal`
 * (Node 26 and later), so the record names both versions. Four checks, each one a calendar:
 *
 * - Persian: Nowruz (1 Farvardin) of years 1 to 3000, converted to Gregorian, against Temporal.
 * - Japanese: every day from 1868-01-01 to 1873-12-31, its era and era year, against Temporal.
 * - Chinese: `createCalendar("chinese")`, which the library has no class for, and so answers
 *   with the calendar it falls back to.
 * - Indian: the first day of every month of saka years 1 to 2000, against Temporal. Not shown.
 *
 * The record holds the SHA-256 of this file, so the Dox tests fail once the probe changes and the
 * record does not.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatJson } from "../lib/format-json.mjs";
import { versionOf } from "./probe/versions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const RECORD_FILE = join(
  HERE,
  "..",
  "..",
  "apps/dox/src/slides/give-me-temporal/intl-date-calendars.json",
);

/** The command that runs this script, as the record names it. */
export const COMMAND =
  "cd scripts/zone-matrix && fnm exec --using=26 -- node intl-date-calendars.mjs";

export const PERSIAN_YEARS = 3000;
export const JAPANESE_FROM = "1868-01-01";
export const JAPANESE_TO = "1873-12-31";
export const INDIAN_YEARS = 2000;

/** SHA-256 of this file, which the record keeps to show it was written by this probe. */
export const sourceHash = () =>
  createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex");

/** The first ten characters of a Temporal date's string: its ISO date. */
const iso = (date) => date.toString().slice(0, 10);

/**
 * Runs the four checks.
 *
 * @param {object} deps `lib`: the `@internationalized/date` module; `Temporal`: the reference
 */
export function probeCalendars({ lib, Temporal }) {
  const {
    CalendarDate,
    GregorianCalendar,
    IndianCalendar,
    JapaneseCalendar,
    PersianCalendar,
    createCalendar,
    toCalendar,
  } = lib;
  const gregorian = new GregorianCalendar();

  const persian = [];
  for (let year = 1; year <= PERSIAN_YEARS; year++) {
    const gives = toCalendar(
      new CalendarDate(new PersianCalendar(), year, 1, 1),
      gregorian,
    ).toString();
    const expected = iso(
      Temporal.PlainDate.from({
        calendar: "persian",
        year,
        monthCode: "M01",
        day: 1,
      }),
    );
    if (gives !== expected) persian.push({ year, gives, expected });
  }

  const japanese = [];
  let days = 0;
  const end = Temporal.PlainDate.from(JAPANESE_TO);
  for (
    let day = Temporal.PlainDate.from(JAPANESE_FROM);
    Temporal.PlainDate.compare(day, end) <= 0;
    day = day.add({ days: 1 })
  ) {
    days++;
    const gives = toCalendar(
      new CalendarDate(day.year, day.month, day.day),
      new JapaneseCalendar(),
    );
    const native = day.withCalendar("japanese");
    if (gives.era !== native.era || gives.year !== native.eraYear)
      japanese.push({
        date: day.toString(),
        gives: { era: gives.era, year: gives.year },
        expected: { era: native.era, year: native.eraYear },
      });
  }

  let months = 0;
  let indian = 0;
  for (let year = 1; year <= INDIAN_YEARS; year++)
    for (let month = 1; month <= 12; month++) {
      months++;
      const gives = toCalendar(
        new CalendarDate(new IndianCalendar(), year, month, 1),
        gregorian,
      ).toString();
      const expected = iso(
        Temporal.PlainDate.from({ calendar: "indian", year, month, day: 1 }),
      );
      if (gives !== expected) indian++;
    }

  return {
    persian: {
      years: PERSIAN_YEARS,
      differ: persian.length,
      first: persian[0] ?? null,
    },
    japanese: {
      from: JAPANESE_FROM,
      to: JAPANESE_TO,
      days,
      differ: japanese.length,
      first: japanese[0] ?? null,
      last: japanese.at(-1) ?? null,
    },
    chinese: {
      asked: "chinese",
      gotIdentifier: createCalendar("chinese").identifier,
    },
    indian: { years: INDIAN_YEARS, months, differ: indian },
  };
}

/** The whole record: what was measured with, and what it found. */
export async function recordCalendars() {
  const lib = await import(
    "@internationalized/date" /* resolved from this folder's node_modules */
  );
  return {
    command: COMMAND,
    node: process.version,
    library: "@internationalized/date",
    version: versionOf("@internationalized/date"),
    reference: "native Temporal",
    sourceSha256: sourceHash(),
    ...probeCalendars({ lib, Temporal: globalThis.Temporal }),
  };
}

async function main() {
  if (!globalThis.Temporal) {
    console.error("This probe needs a Node with Temporal built in (Node 26).");
    process.exit(1);
  }
  const record = await recordCalendars();
  writeFileSync(RECORD_FILE, formatJson(record));
  console.error(
    `Persian ${record.persian.differ} of ${record.persian.years} years, ` +
      `Japanese ${record.japanese.differ} of ${record.japanese.days} days, ` +
      `Chinese gives ${record.chinese.gotIdentifier}, Indian ${record.indian.differ} of ${record.indian.months} months.`,
  );
  console.error(`Wrote ${RECORD_FILE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
