#!/usr/bin/env node
/**
 * Turns the sky bodies' source imagery into the small maps the night sky paints them from.
 *
 * One row of `SOURCES` per body: its pinned source, its credit and licence, and the map it
 * becomes. The script is run by hand, not on every build, and its output is committed:
 *
 * - `src/assets/sky-<id>.webp`  the map, RGB, WebP at the first of its row's `webp` settings (default: quality 80, then lower steps) that fits its budget, equirectangular, longitude -180 degrees at the left
 *                               edge and 0 at the centre, north at the top. The Moon's brightness is
 *                               remapped to albedo (`REMAP`) with the hue held.
 * - `src/assets/sky-<id>.json`  the credit sidecar, in the fields of `hero-milkyway.json`.
 *
 * The Moon is NASA's Scientific Visualization Studio CGI Moon Kit (page 4720), `lroc_color_2k.jpg`,
 * made from the LRO LROC WAC mosaic. NASA's media guidelines allow its use with a credit and no
 * implied endorsement. The script downloads the file (or reads a copy given with `--<flag>`) and
 * refuses any other size or hash.
 *
 * The Sun is ESA's "PHI's view of the Sun in visible light", a mosaic of 25 images of the High
 * Resolution Telescope of the Polarimetric and Helioseismic Imager on Solar Orbiter, taken on
 * 22 March 2023 from 0.495 au in the 617 nm continuum (ESA's page; Hirzberger et al., ESPM-17).
 * ESA offers the press image under CC BY-SA 3.0 IGO, credited "ESA & NASA/Solar Orbiter/PHI
 * Team"; the ESA Space Science Archive's FITS files are CC BY-NC, so none is used or shipped.
 *
 * The image is one band drawn through an orange colour table, so the script takes the JPEG's own
 * luma (the full-resolution channel of the file, 0.299 R + 0.587 G + 0.114 B), which rises with
 * every channel of the table, and keeps that as the grey tone. Solar north is up and west to the
 * right, unmirrored: measured, because no text says so. The sunspots' heliographic latitudes in
 * the image agree with those in the Solar Orbiter archive's `solo_L2_phi-fdt-icnt_20230322T060008`
 * (header CROTA 123.64 degrees, `CRLT_OBS` -6.83) at a turn of 0 degrees, within 0.5. The image
 * therefore needs no turn, and the disc's pole angle on screen comes from `sunPole`.
 *
 * A body is added as one more row in `SOURCES`, its asset and sidecar, a `SKY_CREDITS` row and a
 * row of the registry (`sky-registry.ts`).
 *
 * Run it from `apps/dox`:
 *
 *     node scripts/prepare-sky-bodies.mjs [--jpeg path/to/lroc_color_2k.jpg] [--sunjpg path/to/PHI_s_view_of_the_Sun_in_visible_light.jpg]
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fail, readPinnedSource } from "./prepare-source.mjs";
import { colourMapOrdered } from "./sun-colour-map.mjs";
import {
  DISC_CROP,
  DISC_THRESHOLD,
  discImage,
  fitDisc,
  flattenDisc,
  lumaOf,
} from "./sun-disc.mjs";

export { discImage, fitDisc, flattenDisc };

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The Moon's albedo remap. The SVS map is "optimized for aesthetics, not science" (its page), so
 * its highland-to-mare contrast is about 2.1; the measured albedos give about 1.7. The remap is
 * affine in linear luminance and anchored on the medians of the two terrains, the way the
 * Lunar Sourcebook (Heiken, Vaniman, French, 1991) gives them:
 *
 * - maria cover 17% of the surface (ch. 4, p. 95), so their median is the 8.5th percentile of the
 *   map, and it is set to 8.5%, the middle of the maria's 7 to 10% (ch. 3, App. A3.2, p. 59);
 * - the highlands are the other 83%, so their median is the 58.5th percentile (17 + 83 / 2), set
 *   to 14.5%, the middle of the highlands' 11 to 18% (same table).
 *
 * The percentiles are weighted by cos(latitude) over latitudes within 70 degrees (beyond them the
 * map is filled from a 1064 nm laser map), and are read from the file, not written here: the
 * SVS maps of 2019 and 2025 differ. Mare Tranquillitatis comes out near the 7% the Apollo 11 site
 * measures (ch. 9, 9.4, p. 559), which was no anchor.
 */
export const REMAP = {
  latitudeLimit: 70,
  mare: { percentile: 0.085, albedo: 0.085 },
  highland: { percentile: 0.585, albedo: 0.145 },
  /** The albedo that is stored as 1, so the brightest rays fit a byte and the maria keep their steps. */
  scale: 0.25,
};

/** WebP settings, tried in order: the first that fits a map's budget is used. A row's own `webp` list replaces them. */
const QUALITIES = [80, 76, 72, 68, 64, 60].map((quality) => ({ quality }));

export const SOURCES = [
  {
    id: "moon",
    kind: "albedo",
    title: "CGI Moon Kit, lroc_color_2k.jpg",
    publisher: "NASA's Scientific Visualization Studio",
    page: "https://svs.gsfc.nasa.gov/4720",
    url: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg",
    bytes: 457_942,
    sha256: "f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170",
    flag: "jpeg",
    sourceWidth: 2048,
    sourceHeight: 1024,
    width: 1024,
    height: 512,
    /** Byte budget for the map (1 kB = 1,000 bytes, as the bundle table counts). */
    budget: 80_000,
    credit:
      "NASA's Scientific Visualization Studio, CGI Moon Kit, from Lunar Reconnaissance Orbiter LROC data",
    license:
      "NASA media guidelines (public domain, credit asked, no endorsement implied)",
    licenseUrl: "https://www.nasa.gov/multimedia/guidelines/index.html",
    changes:
      "Scaled to 1024 x 512 and the brightness remapped to measured albedos (maria 8.5%, highlands 14.5% at their medians), the colour held.",
  },
  {
    id: "sun",
    kind: "disc",
    title: "PHI's view of the Sun in visible light",
    publisher: "ESA",
    page: "https://www.esa.int/ESA_Multimedia/Images/2024/11/PHI_s_view_of_the_Sun_in_visible_light",
    url: "https://media.esa.int/legacy/web/images/esa_multimedia/images/2024/11/phi_s_view_of_the_sun_in_visible_light/26451845-1-eng-GB/PHI_s_view_of_the_Sun_in_visible_light.jpg?dl",
    bytes: 61_247_330,
    sha256: "697f9bd228092d88956b13f3b2647d8935038701ef2739bf3a7e85308eaaad08",
    flag: "sunjpg",
    sourceWidth: 9600,
    sourceHeight: 9600,
    width: 256,
    height: 256,
    budget: 16_000,
    /* Lossy WebP's 4x4 blocks show as a grid on a smooth disc (quality 80 erred by up to 25 levels); near-lossless errs by 2 at most. */
    webp: [{ nearLossless: true, quality: 60 }],
    observed: "2023-03-22",
    credit: "ESA & NASA/Solar Orbiter/PHI Team",
    license: "CC-BY-SA-3.0-IGO",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
    changes:
      "Reduced from its orange colour table to one grey band (the JPEG's luma), cropped to a square of 1.02 solar radii, scaled to 256 x 256, the mosaic's tile vignetting divided out (the median, over 0.06 solar radii, of each pixel over its ring's median; the limb darkening kept), scaled so the brightest 0.1% of the disc is white, and the pixels outside the disc set to black. Not turned: solar north is up.",
  },
];

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (l) =>
  l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;

/**
 * The RGB bytes with the Moon's albedo remapped: the linear luminance becomes an albedo by the
 * affine line through the two anchors, and each pixel's linear colour is scaled by albedo over
 * luminance (the hue holds), divided by `REMAP.scale` and re-encoded. The anchors' luminances and
 * the line's offset and gain come back with the bytes.
 */
export function remapAlbedo(rgb, width, height) {
  const table = new Float64Array(256);
  for (let i = 0; i < 256; i++) table[i] = linear(i / 255);
  const lum = new Float64Array(width * height);
  for (let p = 0; p < lum.length; p++)
    lum[p] =
      0.2126 * table[rgb[3 * p]] +
      0.7152 * table[rgb[3 * p + 1]] +
      0.0722 * table[rgb[3 * p + 2]];
  /* The pixels within the latitude limit, darkest first, each with its row's cos(latitude). */
  const weight = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    const lat = 90 - ((y + 0.5) / height) * 180;
    weight[y] =
      Math.abs(lat) <= REMAP.latitudeLimit
        ? Math.cos((lat * Math.PI) / 180)
        : 0;
  }
  const order = [];
  let total = 0;
  for (let p = 0; p < lum.length; p++) {
    const w = weight[Math.floor(p / width)];
    if (w > 0) {
      order.push(p);
      total += w;
    }
  }
  order.sort((a, b) => lum[a] - lum[b]);
  const luminanceAt = (share) => {
    let seen = 0;
    for (const p of order) {
      seen += weight[Math.floor(p / width)];
      if (seen >= share * total) return lum[p];
    }
    return lum[order.at(-1)];
  };
  const mare = luminanceAt(REMAP.mare.percentile);
  const highland = luminanceAt(REMAP.highland.percentile);
  if (!(highland > mare))
    throw new Error("the map has no contrast between its maria and highlands");
  const gain = (REMAP.highland.albedo - REMAP.mare.albedo) / (highland - mare);
  const offset = REMAP.mare.albedo - gain * mare;
  const out = new Uint8Array(rgb.length);
  for (let p = 0; p < lum.length; p++) {
    const albedo = offset + gain * lum[p];
    for (let c = 0; c < 3; c++) {
      /* A black pixel has no hue to hold: it takes the grey of its albedo. */
      const channel =
        lum[p] > 0 ? (table[rgb[3 * p + c]] * albedo) / lum[p] : albedo;
      out[3 * p + c] = Math.round(
        255 * encode(Math.min(1, channel / REMAP.scale)),
      );
    }
  }
  return { bytes: out, mare, highland, gain, offset };
}

async function load() {
  const sharpFile = createRequire(
    createRequire(import.meta.url).resolve("astro/package.json"),
  ).resolve("sharp");
  return (await import(pathToFileURL(sharpFile).href)).default;
}

/** The Moon's map: scaled, then the albedo remapped. RGB bytes and what the sidecar records. */
async function moonMap(file, source, sharp) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .resize(source.width, source.height, { kernel: "lanczos3", fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3)
    throw new Error(`${source.id}: the source is not RGB`);
  const { bytes, mare, highland, gain, offset } = remapAlbedo(
    data,
    source.width,
    source.height,
  );
  return {
    bytes,
    changes: source.changes,
    extra: {
      remap: {
        latitudeLimit: REMAP.latitudeLimit,
        mare: { ...REMAP.mare, luminance: mare },
        highland: { ...REMAP.highland, luminance: highland },
        offset,
        gain,
        scale: REMAP.scale,
      },
    },
  };
}

/** The Sun's disc: fitted on a quarter-size copy, cropped from the full image, scaled, in grey. */
async function sunDisc(file, source, sharp) {
  const fitSize = source.sourceWidth / 4;
  const small = await sharp(file)
    .removeAlpha()
    .resize(fitSize, fitSize, { kernel: "lanczos3", fit: "fill" })
    .raw()
    .toBuffer();
  /* The luma stands for the picture's brightness only if the table rises in every channel. */
  const table = colourMapOrdered(small);
  if (!table.ok)
    fail(
      "sun",
      `the colour table does not keep the brightness order (worst fall ${table.worstDrop})`,
    );
  const fit = fitDisc(lumaOf(small), fitSize);
  const scale = source.sourceWidth / fitSize;
  const disc = {
    x: fit.x * scale,
    y: fit.y * scale,
    radius: fit.radius * scale,
  };
  const side = Math.round(2 * DISC_CROP * disc.radius);
  const crop = await sharp(file)
    .removeAlpha()
    .extract({
      left: Math.round(disc.x - side / 2),
      top: Math.round(disc.y - side / 2),
      width: side,
      height: side,
    })
    .resize(source.width, source.height, { kernel: "lanczos3" })
    .raw()
    .toBuffer();
  const grey = discImage(crop, source.width);
  /* One grey band, written as equal red, green and blue. */
  const bytes = new Uint8Array(grey.length * 3);
  for (let p = 0; p < grey.length; p++) bytes.fill(grey[p], 3 * p, 3 * p + 3);
  const round = (v) => Math.round(v * 10) / 10;
  return {
    bytes,
    changes: `${source.changes} The disc was fitted at (${round(disc.x)}, ${round(disc.y)}) with a radius of ${round(disc.radius)} source pixels.`,
    extra: {
      observed: source.observed,
      disc: {
        x: round(disc.x),
        y: round(disc.y),
        radius: round(disc.radius),
        crop: DISC_CROP,
        threshold: DISC_THRESHOLD,
      },
    },
  };
}

const MAKERS = { albedo: moonMap, disc: sunDisc };

async function prepare(source, sharp) {
  const name = "prepare-sky-bodies";
  const file = await readPinnedSource({ ...source, name });
  const { bytes, changes, extra } = await MAKERS[source.kind](
    file,
    source,
    sharp,
  );
  let webp;
  let setting;
  for (setting of source.webp ?? QUALITIES) {
    webp = await sharp(Buffer.from(bytes), {
      raw: { width: source.width, height: source.height, channels: 3 },
    })
      .webp({ ...setting, effort: 6 })
      .toBuffer();
    if (webp.length <= source.budget) break;
  }
  if (webp.length > source.budget)
    throw new Error(
      `${source.id}: the map is ${webp.length} bytes, over its ${source.budget} budget`,
    );

  const assets = path.join(APP, "src/assets");
  const mapFile = `sky-${source.id}.webp`;
  writeFileSync(path.join(assets, mapFile), webp);
  const sidecar = {
    name: `${source.id[0].toUpperCase()}${source.id.slice(1)} for the Dox night sky`,
    source: {
      title: source.title,
      publisher: source.publisher,
      page: source.page,
      url: source.url,
      bytes: source.bytes,
      sha256: source.sha256,
    },
    credit: source.credit,
    license: source.license,
    licenseUrl: source.licenseUrl,
    changes,
    generator: "apps/dox/scripts/prepare-sky-bodies.mjs",
    ...extra,
    map: {
      ...setting,
      file: mapFile,
      width: source.width,
      height: source.height,
      bytes: webp.length,
      sha256: createHash("sha256").update(webp).digest("hex"),
    },
  };
  writeFileSync(
    path.join(assets, `sky-${source.id}.json`),
    `${JSON.stringify(sidecar, null, 2)}\n`,
  );
  console.log(
    `${source.id}: ${source.width} x ${source.height}, ${JSON.stringify(setting)}, ${webp.length} bytes`,
  );
}

async function main() {
  const sharp = await load();
  for (const source of SOURCES) await prepare(source, sharp);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
