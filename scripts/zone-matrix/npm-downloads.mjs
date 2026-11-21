#!/usr/bin/env node
/**
 * Records npm's download counts for Moment.js per calendar year, for Deck 0's `moment` slide
 * ("Agents learned from Moment"). The slide reads `moment-downloads.json`; no count is typed in.
 * Each year is one request to npm's public downloads API, and the current year runs from 1 January
 * to today (UTC), so the record marks it `partial`.
 *
 *   cd scripts/zone-matrix
 *   fnm exec --using=26 -- node npm-downloads.mjs
 *
 * Needs network and a Node with `Temporal` built in (Node 26). Exit 1 means npm did not answer
 * with a count for a year.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatJson } from "../lib/format-json.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const RECORD_FILE = join(
  HERE,
  "..",
  "..",
  "apps/dox/src/slides/give-me-temporal/moment-downloads.json",
);

export const PACKAGE = "moment";
export const FIRST_YEAR = 2019;
const API = "https://api.npmjs.org/downloads/point";

/** The command that runs this script, as the record names it. */
export const COMMAND =
  "cd scripts/zone-matrix && fnm exec --using=26 -- node npm-downloads.mjs";

/** The years from `FIRST_YEAR` to the one `today` ("YYYY-MM-DD") falls in, each with its range. */
export function yearRanges(today) {
  const last = Number(today.slice(0, 4));
  const years = [];
  for (let year = FIRST_YEAR; year <= last; year++) {
    const partial = year === last;
    years.push({
      year,
      from: `${year}-01-01`,
      to: partial ? today : `${year}-12-31`,
      partial,
    });
  }
  return years;
}

/** The record for `today`, asking `fetchJson(url)` for each year's count. */
export async function recordDownloads(today, fetchJson) {
  const years = [];
  for (const range of yearRanges(today)) {
    const url = `${API}/${range.from}:${range.to}/${PACKAGE}`;
    const answer = await fetchJson(url);
    if (!Number.isInteger(answer?.downloads) || answer.downloads < 0)
      throw new Error(`npm gave no download count for ${range.year}: ${url}`);
    years.push({ ...range, downloads: answer.downloads });
  }
  return {
    command: COMMAND,
    source: `${API}/<from>:<to>/${PACKAGE}`,
    package: PACKAGE,
    capturedOn: today,
    years,
  };
}

async function main() {
  if (!globalThis.Temporal) {
    console.error("This script needs a Node with Temporal built in (Node 26).");
    process.exit(1);
  }
  const today = Temporal.Now.plainDateISO("UTC").toString();
  const fetchJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  };
  const record = await recordDownloads(today, fetchJson);
  writeFileSync(RECORD_FILE, formatJson(record));
  console.error(`Wrote ${RECORD_FILE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
