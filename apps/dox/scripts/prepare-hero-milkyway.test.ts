import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  FLOOR_PERCENTILE,
  GAMMA,
  MAP_BUDGET,
  MAP_FILE,
  MAP_HEIGHT,
  MAP_WIDTH,
  SOURCE_URL,
  WHITE_PERCENTILE,
  blockLuminance,
  equatorialMap,
  galactic,
  starless,
  stretch,
} from "./prepare-hero-milkyway.mjs";

/**
 * The hero's Milky Way map and its credit sidecar.
 *
 * The map is ESO's Milky Way panorama under CC BY 4.0, so the sidecar carries ESO's credit, the
 * licence, the changes made and the hash of the file it came from.
 */
const assets = resolve(process.cwd(), "src/assets");
const webp = readFileSync(resolve(assets, MAP_FILE));
const sidecar = JSON.parse(
  readFileSync(resolve(assets, "hero-milkyway.json"), "utf8"),
);

/* Loading sharp sets `VIPSHOME`; the file puts it back as it found it. */
const vipsHome = process.env["VIPSHOME"];
afterAll(() => {
  if (vipsHome === undefined) delete process.env["VIPSHOME"];
  else process.env["VIPSHOME"] = vipsHome;
});

type Sharp = (input: Buffer) => {
  raw: () => {
    toBuffer: (options: { resolveWithObject: true }) => Promise<{
      data: Buffer;
      info: { width: number; height: number; channels: number };
    }>;
  };
};

let decoding: ReturnType<typeof decodeMap> | undefined;
/** The map's brightness as the generator wrote it, decoded once by sharp, when a test first asks. */
const decoded = () => (decoding ??= decodeMap());

async function decodeMap() {
  /* Sharp is a dependency of Astro, not of the app, so it is found from Astro's own install. */
  const sharpFile = createRequire(
    createRequire(import.meta.url).resolve("astro/package.json"),
  ).resolve("sharp");
  const sharp = (await import(pathToFileURL(sharpFile).href)).default as Sharp;
  return sharp(webp).raw().toBuffer({ resolveWithObject: true });
}

/** The mean brightness of the 7 x 7 cells around a sky position, degrees. */
async function brightness(ra: number, dec: number): Promise<number> {
  const { data, info } = await decoded();
  let sum = 0;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const x =
        (Math.floor((ra / 360) * info.width) + dx + info.width) % info.width;
      const y = Math.floor(((90 - dec) / 180) * info.height) + dy;
      sum += data[(y * info.width + x) * info.channels]!;
    }
  return sum / 49;
}

describe("hero-milkyway.json", () => {
  it("names ESO's panorama, its page and the pinned file's hash", () => {
    expect(sidecar.source.title).toBe("The Milky Way panorama");
    expect(sidecar.source.page).toBe(
      "https://www.eso.org/public/images/eso0932a/",
    );
    expect(sidecar.source.url).toBe(SOURCE_URL);
    expect(sidecar.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("carries ESO's credit unaltered, the licence and the changes made", () => {
    expect(sidecar.credit).toBe("ESO/S. Brunier");
    expect(sidecar.license).toBe("CC-BY-4.0");
    expect(sidecar.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by/4.0/",
    );
    expect(sidecar.changes).toMatch(/stars removed/i);
    expect(sidecar.changes).toMatch(/galactic to equatorial/);
  });

  it("records the stretch the generator uses", () => {
    expect(sidecar.stretch).toMatchObject({
      floorPercentile: FLOOR_PERCENTILE,
      whitePercentile: WHITE_PERCENTILE,
      gamma: GAMMA,
    });
    expect(sidecar.stretch.white).toBeGreaterThan(sidecar.stretch.floor);
  });
});

describe("hero-milkyway.webp", () => {
  it("is a WebP that matches the sidecar's size and hash", () => {
    expect(webp.toString("latin1", 0, 4)).toBe("RIFF");
    expect(webp.toString("latin1", 8, 12)).toBe("WEBP");
    expect(webp.length).toBe(sidecar.map.bytes);
    expect(createHash("sha256").update(webp).digest("hex")).toBe(
      sidecar.map.sha256,
    );
  });

  it("stays within the size budget", () => {
    expect(webp.length).toBeLessThanOrEqual(MAP_BUDGET);
  });

  it("is the whole sky, twice as wide as tall", async () => {
    const { info } = await decoded();
    expect([info.width, info.height]).toEqual([MAP_WIDTH, MAP_HEIGHT]);
    expect([sidecar.map.width, sidecar.map.height]).toEqual([
      MAP_WIDTH,
      MAP_HEIGHT,
    ]);
  });

  it("puts right ascension and declination where the sky draws them", async () => {
    /* The band is bright about the galactic centre and Carina; the galactic poles are dark. */
    expect(await brightness(266.405, -28.936)).toBeGreaterThan(60);
    expect(await brightness(160, -59.5)).toBeGreaterThan(60);
    expect(await brightness(192.859, 27.128)).toBeLessThan(5);
    expect(await brightness(12.859, -27.128)).toBeLessThan(5);
    /* The Large Magellanic Cloud, far off the band: a mirrored right ascension or declination loses it. */
    const cloud = await brightness(80.894, -69.756);
    expect(cloud).toBeGreaterThan(
      4 * (await brightness(360 - 80.894, -69.756)),
    );
    expect(cloud).toBeGreaterThan(4 * (await brightness(80.894, 69.756)));
  });
});

describe("galactic", () => {
  /* The frame's defining points (Hipparcos catalogue, ESA SP-1200, section 1.5.3). */
  it.each([
    ["the galactic centre", 266.40499, -28.93617, 0, 0],
    ["the north celestial pole", 0, 90, 122.93192, 27.12825],
    ["the Large Magellanic Cloud", 80.894, -69.756, 280.465, -32.888],
  ])("puts %s at its galactic place", (_, ra, dec, l, b) => {
    const at = galactic(ra, dec);
    expect(Math.min(Math.abs(at.l - l), 360 - Math.abs(at.l - l))).toBeLessThan(
      0.001,
    );
    expect(at.b).toBeCloseTo(b, 3);
  });

  it("puts the north galactic pole at latitude 90", () => {
    expect(galactic(192.85948, 27.12825).b).toBeCloseTo(90, 6);
  });
});

describe("blockLuminance", () => {
  it("takes each block's median of the linear luminance, so one bright pixel does not count", () => {
    /* A 4 x 4 block of mid grey (sRGB 128, linear 0.2158) with one white pixel. */
    const rgb = new Uint8Array(4 * 4 * 3).fill(128);
    rgb.fill(255, 0, 3);
    const [cell] = blockLuminance(rgb, 4, 4, 4);
    expect(cell).toBeCloseTo(((128 / 255 + 0.055) / 1.055) ** 2.4, 9);
  });
});

describe("starless", () => {
  it("takes out a star smaller than half the window and keeps a wide band", () => {
    const [width, height] = [12, 9];
    const grid = new Float64Array(width * height);
    /* A band three rows wide, and a star on the dark sky. */
    for (let x = 0; x < width; x++)
      for (const y of [3, 4, 5]) grid[y * width + x] = 1;
    grid[1 * width + 6] = 1;
    const out = starless(grid, width, height, 5);
    expect(out[1 * width + 6]).toBe(0);
    expect(out[4 * width + 0]).toBe(1);
    expect(out[4 * width + 11]).toBe(1);
  });

  it("wraps round in longitude, so a star by the edge sees the far side", () => {
    const [width, height] = [10, 5];
    const grid = new Float64Array(width * height).fill(1);
    for (const x of [8, 9, 0, 1]) grid[2 * width + x] = 0;
    /* Of the 25 cells about (0, 2), 4 are dark: with the far side, the median stays 1. */
    expect(starless(grid, width, height, 5)[2 * width]).toBe(1);
  });
});

describe("equatorialMap", () => {
  it("reads the galactic grid with the centre in the middle and longitude rising to the left", () => {
    /* A grid bright only left of its middle column, at longitudes 0 to 180. */
    const [width, height] = [360, 180];
    const grid = new Float64Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width / 2; x++) grid[y * width + x] = 1;
    const map = equatorialMap(grid, width, height);
    const cell = (ra: number, dec: number): number =>
      map[
        Math.floor(((90 - dec) / 180) * MAP_HEIGHT) * MAP_WIDTH +
          Math.floor((ra / 360) * MAP_WIDTH)
      ]!;
    /* Cygnus, longitude about 80, is bright; Carina, about 288, is dark. */
    expect(cell(305, 40)).toBe(1);
    expect(cell(160, -59.5)).toBe(0);
  });
});

describe("stretch", () => {
  it("makes the floor percentile 0 and the white one 255, with the power between", () => {
    const grid = Float64Array.from({ length: 1000 }, (_, i) => i);
    const { map, floor, white } = stretch(grid);
    expect([floor, white]).toEqual([500, 999]);
    expect(map[250]).toBe(0);
    expect(map[500]).toBe(0);
    expect(map[999]).toBe(255);
    expect(map[749]).toBe(Math.round(255 * (249 / 499) ** GAMMA));
  });
});
