#!/usr/bin/env node
/**
 * Turns ESO's Milky Way panorama into the small all-sky map the landing hero's night sky draws
 * its Milky Way from.
 *
 * The page projects the map itself, through the globe's camera, so this script keeps the whole
 * sky. It is run by hand, not on every build, and its output is committed:
 *
 * - `src/assets/hero-milkyway.webp`  1024 x 512 greyscale, equirectangular in J2000 right
 *                                    ascension and declination: row 0 is the north pole, right
 *                                    ascension runs left to right from 0 degrees, cell (X, Y) is
 *                                    centred on RA 360 (X + 0.5) / 1024 and Dec 90 - 180 (Y + 0.5) / 512.
 *                                    Brightness 0 is the sky's median, 255 its 99.9th percentile,
 *                                    with a 0.7 power between, so the faint sky away from the band
 *                                    is black and the band keeps its dust lanes.
 * - `src/assets/hero-milkyway.json`  the credit sidecar: the source, its size and sha256, the
 *                                    licence, the changes made, the stretch and the size and
 *                                    sha256 of the map.
 *
 * Source: ESO/S. Brunier, The Milky Way panorama (eso0932a), the 6000 x 3000 JPEG: the whole sky
 * photographed from the ground, equirectangular in galactic longitude and latitude with the
 * galactic centre in the middle and longitude rising to the left. ESO releases it under Creative
 * Commons Attribution 4.0, which asks for the credit unaltered and for the changes to be stated;
 * the sidecar carries both. The script downloads it (or reads a copy given with `--jpeg`) and
 * refuses any other hash.
 *
 * The photograph's stars are taken out, since the hero draws its stars from the HYG list: each
 * 4 x 4 block of pixels becomes its median, then each cell the median of the 5 x 5 cells about
 * it, 1.2 degrees across, which a star is far smaller than and the band's lanes are not.
 * Brightness is Rec. 709 luminance of the linear colour. Each map cell is then looked up in that
 * starless sky at the galactic position of its centre. The WebP is written by sharp, found
 * through Astro's own install as the size gate finds Vite.
 *
 * Run it from `apps/dox`:
 *
 *     node scripts/prepare-hero-milkyway.mjs [--jpeg path/to/eso0932a.jpg]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SOURCE_URL = "https://cdn.eso.org/images/large/eso0932a.jpg";
const SOURCE_BYTES = 8_228_817;
const SOURCE_SHA256 =
  "60400c92c54b7c1bd12299c69e83b16e5b6256e7dabacc478c021758ecd28179";
const SOURCE_WIDTH = 6000;
const SOURCE_HEIGHT = 3000;

export const MAP_FILE = "hero-milkyway.webp";

/** The map's size: a cell is 0.35 degree. */
export const MAP_WIDTH = 1024;
export const MAP_HEIGHT = 512;

/** Byte budget for the map (1 kB = 1,000 bytes, as the bundle table counts). */
export const MAP_BUDGET = 40_000;

/** Source pixels to a block each way, and the blocks across the median that takes the stars out. */
export const BLOCK = 4;
export const STARLESS_SPAN = 5;

/** The stretch: the percentiles that become 0 and 255, and the power between. */
export const FLOOR_PERCENTILE = 0.5;
export const WHITE_PERCENTILE = 0.999;
export const GAMMA = 0.7;

/** WebP quality, 0 to 100. */
const QUALITY = 80;

/**
 * The J2000 galactic frame: the north galactic pole's right ascension and declination and the
 * galactic longitude of the north celestial pole, degrees (Hipparcos catalogue, ESA SP-1200,
 * vol. 1, section 1.5.3).
 */
const POLE_RA = 192.85948;
const POLE_DEC = 27.12825;
const NCP_LONGITUDE = 122.93192;

const RAD = Math.PI / 180;

const flag = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};

function fail(message) {
  console.error(`prepare-hero-milkyway: ${message}`);
  process.exit(1);
}

// --- the source -----------------------------------------------------------------

async function readSource() {
  const given = flag("jpeg");
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
      `the panorama is not the pinned file (${bytes.length} bytes, sha256 ${sha256}); ` +
        `expected ${SOURCE_BYTES} bytes, ${SOURCE_SHA256}`,
    );
  return bytes;
}

// --- the geometry ---------------------------------------------------------------

/** Galactic longitude, 0 to 360, and latitude of a J2000 right ascension and declination, degrees. */
export function galactic(ra, dec) {
  const d = dec * RAD;
  const p = POLE_DEC * RAD;
  const h = (ra - POLE_RA) * RAD;
  const b = Math.asin(
    Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(h),
  );
  const l =
    NCP_LONGITUDE -
    Math.atan2(
      Math.cos(d) * Math.sin(h),
      Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(h),
    ) /
      RAD;
  return { l: ((l % 360) + 360) % 360, b: b / RAD };
}

// --- the brightness ---------------------------------------------------------------

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** The middle of the first `n` values of `values`, sorted in place. */
function median(values, n) {
  const part = values.subarray(0, n).sort();
  return n % 2 ? part[n >> 1] : (part[n / 2 - 1] + part[n / 2]) / 2;
}

/** Each `block` x `block` block of an RGB image's linear luminance, as its median. */
export function blockLuminance(rgb, width, height, block = BLOCK) {
  const lum = new Float64Array(256);
  for (let i = 0; i < 256; i++) lum[i] = linear(i / 255);
  const w = width / block;
  const h = height / block;
  const grid = new Float64Array(w * h);
  const cell = new Float64Array(block * block);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = 0; dy < block; dy++)
        for (let dx = 0; dx < block; dx++) {
          const at = ((y * block + dy) * width + x * block + dx) * 3;
          cell[n++] =
            0.2126 * lum[rgb[at]] +
            0.7152 * lum[rgb[at + 1]] +
            0.0722 * lum[rgb[at + 2]];
        }
      grid[y * w + x] = median(cell, n);
    }
  return grid;
}

/**
 * The grid with its stars out: each cell becomes the median of the `span` x `span` cells about
 * it, wrapping round in longitude and held at the poles.
 */
export function starless(grid, width, height, span = STARLESS_SPAN) {
  const out = new Float64Array(grid.length);
  const half = span >> 1;
  const window = new Float64Array(span * span);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (let dy = -half; dy <= half; dy++) {
        const row = Math.min(height - 1, Math.max(0, y + dy)) * width;
        for (let dx = -half; dx <= half; dx++)
          window[n++] = grid[row + ((x + dx + width) % width)];
      }
      out[y * width + x] = median(window, n);
    }
  return out;
}

/**
 * The map: each cell's centre, a right ascension and declination, turned to a galactic position
 * and read from the starless galactic grid between its four nearest cells. The grid is centred on
 * the galactic centre with longitude rising to the left, as the panorama is.
 */
export function equatorialMap(grid, width, height) {
  const out = new Float64Array(MAP_WIDTH * MAP_HEIGHT);
  const read = (row, column) => grid[row * width + column];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const dec = 90 - (180 * (y + 0.5)) / MAP_HEIGHT;
    for (let x = 0; x < MAP_WIDTH; x++) {
      const { l, b } = galactic((360 * (x + 0.5)) / MAP_WIDTH, dec);
      const u = ((((0.5 - l / 360) % 1) + 1) % 1) * width - 0.5;
      const v = Math.min(
        height - 1,
        Math.max(0, (0.5 - b / 180) * height - 0.5),
      );
      const u0 = Math.floor(u);
      const v0 = Math.min(height - 2, Math.floor(v));
      const du = u - u0;
      const dv = v - v0;
      const c0 = (u0 + width) % width;
      const c1 = (u0 + 1) % width;
      out[y * MAP_WIDTH + x] =
        (read(v0, c0) * (1 - du) + read(v0, c1) * du) * (1 - dv) +
        (read(v0 + 1, c0) * (1 - du) + read(v0 + 1, c1) * du) * dv;
    }
  }
  return out;
}

/** The map's bytes: the luminance stretched from the floor to the white percentile. */
export function stretch(grid) {
  const sorted = Float64Array.from(grid).sort();
  const floor = sorted[Math.floor(FLOOR_PERCENTILE * sorted.length)];
  const white = sorted[Math.floor(WHITE_PERCENTILE * sorted.length)];
  const map = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    const t = Math.min(1, Math.max(0, (grid[i] - floor) / (white - floor)));
    map[i] = Math.round(255 * t ** GAMMA);
  }
  return { map, floor, white };
}

async function main() {
  const sharpFile = createRequire(
    createRequire(import.meta.url).resolve("astro/package.json"),
  ).resolve("sharp");
  const sharp = (await import(pathToFileURL(sharpFile).href)).default;
  const { data, info } = await sharp(await readSource())
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== SOURCE_WIDTH ||
    info.height !== SOURCE_HEIGHT ||
    info.channels !== 3
  )
    fail("the panorama is not 6000 x 3000 RGB");
  const w = SOURCE_WIDTH / BLOCK;
  const h = SOURCE_HEIGHT / BLOCK;
  const sky = starless(blockLuminance(data, info.width, info.height), w, h);
  const { map, floor, white } = stretch(equatorialMap(sky, w, h));
  const webp = await sharp(Buffer.from(map), {
    raw: { width: MAP_WIDTH, height: MAP_HEIGHT, channels: 1 },
  })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();
  if (webp.length > MAP_BUDGET)
    fail(`the map is ${webp.length} bytes, over its ${MAP_BUDGET} budget`);

  const assets = path.join(APP, "src/assets");
  writeFileSync(path.join(assets, MAP_FILE), webp);
  const sidecar = {
    name: "Milky Way for the Dox landing hero",
    source: {
      title: "The Milky Way panorama",
      publisher: "ESO",
      page: "https://www.eso.org/public/images/eso0932a/",
      url: SOURCE_URL,
      bytes: SOURCE_BYTES,
      sha256: SOURCE_SHA256,
    },
    credit: "ESO/S. Brunier",
    license: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    changes:
      "Stars removed, reduced to greyscale brightness, reprojected from galactic to equatorial coordinates and scaled to 1024 x 512.",
    generator: "apps/dox/scripts/prepare-hero-milkyway.mjs",
    stretch: {
      floorPercentile: FLOOR_PERCENTILE,
      whitePercentile: WHITE_PERCENTILE,
      gamma: GAMMA,
      floor,
      white,
    },
    map: {
      file: MAP_FILE,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      bytes: webp.length,
      sha256: createHash("sha256").update(webp).digest("hex"),
    },
  };
  writeFileSync(
    path.join(assets, "hero-milkyway.json"),
    `${JSON.stringify(sidecar, null, 2)}\n`,
  );
  console.log(
    `map: ${MAP_WIDTH} x ${MAP_HEIGHT}, floor ${floor}, white ${white}, ${webp.length} bytes`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
