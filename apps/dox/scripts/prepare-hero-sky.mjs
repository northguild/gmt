#!/usr/bin/env node
/**
 * Packs the HYG v4.4 star catalogue into the star list the landing hero's night sky draws.
 *
 * The page projects the stars itself, from wherever the reader has turned the Earth, so this
 * script keeps the whole sky and no picture. It is run by hand, not on every build, and its
 * output is committed:
 *
 * - `src/assets/hero-sky.bin`   6 bytes per star, little-endian, no header, faintest first so
 *                               brighter stars paint on top:
 *                               uint16 right ascension  round(ra / 360 * 65536) mod 65536
 *                               int16  declination      round(dec / 90 * 32767)
 *                               uint8  magnitude        round((mag + 2) * 20)
 *                               uint8  colour class     B-V below 0: 0; 0 to 0.5: 1; 0.5 to 1.0: 2;
 *                                                       above 1.0: 3; a missing B-V is 1.
 * - `src/assets/hero-sky.json`  the licence sidecar, the star count, the magnitude limit and the
 *                               size and sha256 of the list.
 *
 * Source: HYG v4.4 (Hipparcos, Yale Bright Star and Gliese catalogues combined) by astronexus,
 * CC BY-SA 4.0, at a pinned commit and file hash. The file is kept in Git LFS; the script
 * downloads it (or reads a copy given with `--csv`) and refuses any other hash. The list is an
 * adaptation, so it carries the same licence; the repository's MIT licence does not cover it. The
 * sidecar says so. The Sun (id 0) is skipped.
 *
 * Run it from `apps/dox`:
 *
 *     node scripts/prepare-hero-sky.mjs [--csv path/to/hyg_v44.csv.gz]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const COMMIT = "53e3df311869e813ace5f1ad2ec4ce909f13256c";
const SOURCE_FILE = "data/hyg/CURRENT/hyg_v44.csv.gz";
const SOURCE_BYTES = 13_636_362;
const SOURCE_SHA256 =
  "00b349893b9a53106dd488d8371e8d2fa586043e500bb3cdb8bff3931682197d";
const SOURCE_URL = `https://codeberg.org/astronexus/hyg/media/commit/${COMMIT}/${SOURCE_FILE}`;

export const LIST_FILE = "hero-sky.bin";

/** Bytes per star in the list. */
export const RECORD = 6;

/** Byte budget for the list (1 kB = 1,000 bytes, as the bundle table counts). */
export const LIST_BUDGET = 24_000;

/** Naked eye under a dark sky; lowered by 0.1 until the list fits its budget. */
const START_LIMIT = 5.5;

const flag = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};

function fail(message) {
  console.error(`prepare-hero-sky: ${message}`);
  process.exit(1);
}

// --- the catalogue -------------------------------------------------------------

async function readCatalogue() {
  const given = flag("csv");
  let bytes;
  if (given) {
    if (!existsSync(given)) fail(`no file at ${given}`);
    bytes = readFileSync(given);
  } else {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) fail(`download failed: ${response.status} ${SOURCE_URL}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== SOURCE_SHA256 || bytes.length !== SOURCE_BYTES)
    fail(
      `the catalogue is not the pinned file (${bytes.length} bytes, sha256 ${sha256}); ` +
        `expected ${SOURCE_BYTES} bytes, ${SOURCE_SHA256}`,
    );
  return gunzipSync(bytes).toString("utf8");
}

/** One CSV line into fields; the catalogue quotes fields that hold a comma. */
function splitLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      fields.push(field);
      field = "";
    } else field += c;
  }
  fields.push(field);
  return fields;
}

/** Every star as `{ id, name, ra, dec, mag, ci }`, right ascension in degrees. */
function parseCatalogue(text) {
  const [head, ...lines] = text.split("\n");
  const columns = splitLine(head.trim());
  const at = (name) => {
    const i = columns.indexOf(name);
    if (i === -1) fail(`the catalogue has no "${name}" column`);
    return i;
  };
  const [iId, iName, iRa, iDec, iMag, iCi] = [
    "id",
    "proper",
    "ra",
    "dec",
    "mag",
    "ci",
  ].map(at);
  const stars = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const f = splitLine(line);
    const ci = f[iCi] === "" ? null : Number(f[iCi]);
    stars.push({
      id: Number(f[iId]),
      name: f[iName],
      ra: Number(f[iRa]) * 15,
      dec: Number(f[iDec]),
      mag: Number(f[iMag]),
      ci: Number.isFinite(ci) ? ci : null,
    });
  }
  if (stars.length < 100_000) fail(`only ${stars.length} stars were read`);
  return stars;
}

// --- the list -------------------------------------------------------------------

/** The colour class of a B-V index. */
export function colourClass(ci) {
  if (ci === null) return 1;
  if (ci < 0) return 0;
  if (ci < 0.5) return 1;
  if (ci < 1) return 2;
  return 3;
}

/**
 * The packed list of the stars at or brighter than `limit`, faintest first.
 *
 * @param {{ id: number; ra: number; dec: number; mag: number; ci: number | null }[]} stars
 */
export function pack(stars, limit) {
  const kept = stars
    .filter((star) => star.id !== 0 && star.mag <= limit)
    .sort((a, b) => b.mag - a.mag);
  const bytes = Buffer.alloc(kept.length * RECORD);
  kept.forEach((star, i) => {
    const at = i * RECORD;
    bytes.writeUInt16LE(Math.round((star.ra / 360) * 65536) % 65536, at);
    bytes.writeInt16LE(Math.round((star.dec / 90) * 32767), at + 2);
    bytes.writeUInt8(Math.round((star.mag + 2) * 20), at + 4);
    bytes.writeUInt8(colourClass(star.ci), at + 5);
  });
  return { bytes, count: kept.length };
}

async function main() {
  const stars = parseCatalogue(await readCatalogue());
  let limit = START_LIMIT;
  let list = pack(stars, limit);
  while (list.bytes.length > LIST_BUDGET) {
    limit = Math.round((limit - 0.1) * 10) / 10;
    list = pack(stars, limit);
  }

  const assets = path.join(APP, "src/assets");
  writeFileSync(path.join(assets, LIST_FILE), list.bytes);
  const sidecar = {
    name: "Night sky for the Dox landing hero",
    source: {
      catalogue:
        "HYG v4.4 (Hipparcos, Yale Bright Star and Gliese catalogues combined)",
      author: "astronexus",
      repository: "https://codeberg.org/astronexus/hyg",
      commit: COMMIT,
      file: SOURCE_FILE,
      bytes: SOURCE_BYTES,
      sha256: SOURCE_SHA256,
    },
    license: "CC-BY-SA-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    notice:
      "hero-sky.bin is an adaptation of the HYG v4.4 star catalogue and is offered under CC BY-SA 4.0. The repository's MIT licence does not cover it.",
    generator: "apps/dox/scripts/prepare-hero-sky.mjs",
    starCount: list.count,
    magnitudeLimit: limit,
    list: {
      file: LIST_FILE,
      bytes: list.bytes.length,
      sha256: createHash("sha256").update(list.bytes).digest("hex"),
    },
  };
  writeFileSync(
    path.join(assets, "hero-sky.json"),
    `${JSON.stringify(sidecar, null, 2)}\n`,
  );
  console.log(
    `stars: ${list.count} at magnitude <= ${limit}, ${list.bytes.length} bytes`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
