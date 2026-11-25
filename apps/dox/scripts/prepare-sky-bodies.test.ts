import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeWebp,
  expectWebpMatchesSidecar,
  restoreVipsHomeAfterAll,
} from "./webp-test-kit";
import {
  REMAP,
  SOURCES,
  discImage,
  fitDisc,
  remapAlbedo,
} from "./prepare-sky-bodies.mjs";

/**
 * The Moon's map and its credit sidecar. The map is NASA SVS's CGI Moon Kit colour map, so the
 * sidecar carries NASA's credit, the terms and the hash of the file it came from. No network.
 */
const assets = resolve(process.cwd(), "src/assets");
const moon = SOURCES.find((source) => source.id === "moon")!;
const webp = readFileSync(resolve(assets, "sky-moon.webp"));
const sidecar = JSON.parse(
  readFileSync(resolve(assets, "sky-moon.json"), "utf8"),
);

const sun = SOURCES.find((source) => source.id === "sun")!;
const sunWebp = readFileSync(resolve(assets, "sky-sun.webp"));
const sunSidecar = JSON.parse(
  readFileSync(resolve(assets, "sky-sun.json"), "utf8"),
);

restoreVipsHomeAfterAll();

let decoding: ReturnType<typeof decodeMap> | undefined;
const decoded = () => (decoding ??= decodeMap());

const decodeMap = () => decodeWebp(webp);

/** The luminance (0 to 255, Rec. 709 weights on the encoded bytes) at a longitude and latitude, degrees. */
async function luminance(lon: number, lat: number): Promise<number> {
  const { data, info } = await decoded();
  const x = Math.round(((lon + 180) / 360) * info.width - 0.5);
  const y = Math.round(((90 - lat) / 180) * info.height - 0.5);
  const at = (y * info.width + ((x + info.width) % info.width)) * info.channels;
  return 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!;
}

describe("sky-moon.json", () => {
  it("names the SVS page and the pinned file's size and hash", () => {
    expect(sidecar.source.page).toBe("https://svs.gsfc.nasa.gov/4720");
    expect(sidecar.source.url).toBe(moon.url);
    expect(sidecar.source.bytes).toBe(moon.bytes);
    expect(sidecar.source.sha256).toBe(moon.sha256);
    expect(sidecar.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("carries NASA's credit, the terms and the changes made", () => {
    expect(sidecar.credit).toBe(moon.credit);
    expect(sidecar.credit).toMatch(/^NASA's Scientific Visualization Studio/);
    expect(sidecar.licenseUrl).toBe(
      "https://www.nasa.gov/multimedia/guidelines/index.html",
    );
    expect(sidecar.changes).toMatch(/scaled to 1024 x 512/i);
  });

  it("records the remap the generator uses", () => {
    expect(sidecar.remap.latitudeLimit).toBe(REMAP.latitudeLimit);
    expect(sidecar.remap.mare.albedo).toBe(0.085);
    expect(sidecar.remap.highland.albedo).toBe(0.145);
    expect(sidecar.remap.highland.luminance).toBeGreaterThan(
      sidecar.remap.mare.luminance,
    );
    /* The line through the two anchors. */
    for (const anchor of [sidecar.remap.mare, sidecar.remap.highland])
      expect(
        sidecar.remap.offset + sidecar.remap.gain * anchor.luminance,
      ).toBeCloseTo(anchor.albedo, 6);
  });
});

describe("sky-moon.webp", () => {
  it("is a WebP that matches the sidecar's size and hash", () => {
    expectWebpMatchesSidecar(webp, sidecar);
  });

  it("stays within the 80 kB budget", () => {
    expect(moon.budget).toBe(80_000);
    expect(webp.length).toBeLessThanOrEqual(moon.budget);
  });

  it("is 1024 x 512 colour", async () => {
    const { info } = await decoded();
    expect([info.width, info.height, info.channels]).toEqual([1024, 512, 3]);
    expect([sidecar.map.width, sidecar.map.height]).toEqual([1024, 512]);
  });

  it("puts longitude and latitude where the painter reads them: Tycho's rays and Mare Crisium", async () => {
    /* Tycho's ray centre, 43.3 S 11.2 W: the brightest point within 3 degrees of that place. */
    let brightest = { value: 0, lon: 0, lat: 0 };
    for (let dLon = -3; dLon <= 3; dLon += 0.5)
      for (let dLat = -3; dLat <= 3; dLat += 0.5) {
        const value = await luminance(-11.2 + dLon, -43.3 + dLat);
        if (value > brightest.value)
          brightest = { value, lon: dLon, lat: dLat };
      }
    expect(Math.hypot(brightest.lon, brightest.lat)).toBeLessThan(3);
    expect(brightest.value).toBeGreaterThan(200);
    /* Mare Crisium's centre, 17.0 N 59.1 E: darker than the highland 12 degrees out (past the mare's rim) on all four sides. */
    const mare = await luminance(59.1, 17);
    for (const [dLon, dLat] of [
      [12, 0],
      [-12, 0],
      [0, 12],
      [0, -12],
    ] as const)
      expect(mare).toBeLessThan((await luminance(59.1 + dLon, 17 + dLat)) - 20);
  });
});

/** The sRGB byte as linear light. */
const linear = (byte: number): number => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/**
 * The albedo of every pixel within 70 degrees of the equator, darkest first, each with the weight
 * (cosine of latitude) of its area. The stored luminance times `REMAP.scale` is the albedo.
 */
async function albedos() {
  const { data, info } = await decoded();
  const rows: { albedo: number; weight: number }[] = [];
  for (let y = 0; y < info.height; y++) {
    const lat = 90 - ((y + 0.5) / info.height) * 180;
    if (Math.abs(lat) > REMAP.latitudeLimit) continue;
    for (let x = 0; x < info.width; x++) {
      const at = (y * info.width + x) * info.channels;
      rows.push({
        albedo:
          REMAP.scale *
          (0.2126 * linear(data[at]!) +
            0.7152 * linear(data[at + 1]!) +
            0.0722 * linear(data[at + 2]!)),
        weight: Math.cos((lat * Math.PI) / 180),
      });
    }
  }
  rows.sort((a, b) => a.albedo - b.albedo);
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  /** The albedo below which `share` of the area lies. */
  return (share: number): number => {
    let seen = 0;
    for (const row of rows) {
      seen += row.weight;
      if (seen >= share * total) return row.albedo;
    }
    return rows.at(-1)!.albedo;
  };
}

/*
 * The albedo of the Moon, from the Lunar Sourcebook (Heiken, Vaniman and French, 1991): maria
 * 7 to 10% and highlands 11 to 18% (ch. 3, App. A3.2, p. 59), the Apollo 11 site 7% and a highland
 * site 19% (ch. 9, 9.4, p. 559), 67 regions from 5.7 to 18.4% (p. 560). The ratio of a highland
 * to a mare is about 1.7, and 1.1 to 3.2 at the extremes.
 */
describe("sky-moon.webp albedo", () => {
  it("holds the highland-to-mare ratio near the measured 1.7", async () => {
    const at = await albedos();
    const ratio = at(REMAP.highland.percentile) / at(REMAP.mare.percentile);
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(3.2);
    expect(ratio).toBeCloseTo(1.7, 1);
  });

  it("puts Mare Tranquillitatis near the 7% of the Apollo 11 site, which was no anchor", async () => {
    const { data, info } = await decoded();
    const x = Math.round(((31.4 + 180) / 360) * info.width);
    const y = Math.round(((90 - 8.5) / 180) * info.height);
    let sum = 0;
    let count = 0;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const at = ((y + dy) * info.width + x + dx) * info.channels;
        sum +=
          0.2126 * linear(data[at]!) +
          0.7152 * linear(data[at + 1]!) +
          0.0722 * linear(data[at + 2]!);
        count++;
      }
    const albedo = (REMAP.scale * sum) / count;
    expect(albedo).toBeGreaterThan(0.06);
    expect(albedo).toBeLessThan(0.085);
  });

  it("keeps the darkest half percent at the 7% floor the sources give, and the brightest inside 24%", async () => {
    const at = await albedos();
    expect(at(0.005)).toBeGreaterThanOrEqual(0.065);
    expect(at(0.999)).toBeLessThanOrEqual(0.24);
  });
});

describe("remapAlbedo", () => {
  /** A map of two bands of equal area: a dark one on the top rows and a bright one below. */
  const bands = (dark: number, bright: number) => {
    const width = 8;
    const height = 8;
    const rgb = new Uint8Array(width * height * 3);
    for (let p = 0; p < width * height; p++) {
      const value = p < (width * height) / 2 ? dark : bright;
      rgb.set([value + 10, value, value - 10], 3 * p);
    }
    return { rgb, width, height };
  };

  it("sends the two terrains' medians to their albedos and keeps the hue's order", () => {
    const { rgb, width, height } = bands(60, 200);
    const { bytes, mare, highland, gain, offset } = remapAlbedo(
      rgb,
      width,
      height,
    );
    expect(highland).toBeGreaterThan(mare);
    expect(offset + gain * mare).toBeCloseTo(REMAP.mare.albedo, 9);
    expect(offset + gain * highland).toBeCloseTo(REMAP.highland.albedo, 9);
    for (let p = 0; p < width * height; p++) {
      expect(bytes[3 * p]!).toBeGreaterThanOrEqual(bytes[3 * p + 1]!);
      expect(bytes[3 * p + 1]!).toBeGreaterThanOrEqual(bytes[3 * p + 2]!);
    }
  });

  it("gives a map whose contrast is wider or narrower the same two albedos", () => {
    for (const [dark, bright] of [
      [30, 220],
      [120, 140],
    ] as const) {
      const { rgb, width, height } = bands(dark, bright);
      const { mare, highland, gain, offset } = remapAlbedo(rgb, width, height);
      expect((offset + gain * highland) / (offset + gain * mare)).toBeCloseTo(
        REMAP.highland.albedo / REMAP.mare.albedo,
        9,
      );
    }
  });

  it("refuses a map with no contrast", () => {
    const rgb = new Uint8Array(8 * 8 * 3).fill(100);
    expect(() => remapAlbedo(rgb, 8, 8)).toThrow(/no contrast/);
  });
});

/**
 * The Sun: ESA's press image of Solar Orbiter's PHI (CC BY-SA 3.0 IGO), cropped to the disc and
 * reduced to one grey band. No network: the file's size and hash are the pinned ones.
 */
describe("sky-sun.json", () => {
  it("names ESA's page, the pinned file's size and hash, the credit, the licence and the date", () => {
    expect(sunSidecar.source.page).toBe(sun.page);
    expect(sunSidecar.source.bytes).toBe(sun.bytes);
    expect(sunSidecar.source.sha256).toBe(sun.sha256);
    expect(sunSidecar.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sunSidecar.credit).toBe("ESA & NASA/Solar Orbiter/PHI Team");
    expect(sunSidecar.license).toBe("CC-BY-SA-3.0-IGO");
    expect(sunSidecar.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by-sa/3.0/igo/",
    );
    expect(sunSidecar.observed).toBe("2023-03-22");
  });

  it("lists the changes and the fitted disc, in source pixels", () => {
    expect(sunSidecar.changes).toMatch(/grey band.*cropped.*256 x 256/);
    expect(sunSidecar.changes).toContain(String(sunSidecar.disc.radius));
    expect(sunSidecar.disc.radius).toBeGreaterThan(3500);
    expect(sunSidecar.disc.crop).toBe(1.02);
  });
});

describe("sky-sun.webp", () => {
  const decodedSun = () => decodeWebp(sunWebp);

  it("is a 256 x 256 WebP that matches the sidecar's size and hash, within 16 kB", async () => {
    expectWebpMatchesSidecar(sunWebp, sunSidecar);
    expect(sun.budget).toBe(16_000);
    expect(sunWebp.length).toBeLessThanOrEqual(sun.budget);
    const { info } = await decodedSun();
    expect([info.width, info.height]).toEqual([256, 256]);
  });

  it("keeps the continuum's order: the mean grey falls from the centre to the limb, ring by ring", async () => {
    const { data, info } = await decodedSun();
    const radius = 128 / sunSidecar.disc.crop;
    const rings = Array.from({ length: 9 }, () => [0, 0]);
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const ring = Math.floor(
          (Math.hypot(x + 0.5 - 128, y + 0.5 - 128) / radius) * 10,
        );
        if (ring > 8) continue;
        rings[ring]![0] += data[(y * info.width + x) * info.channels]!;
        rings[ring]![1]++;
      }
    const means = rings.map(([sum, n]) => sum! / n!);
    /* Sunspots and granulation may lift a ring by a few levels; the trend may not rise. */
    for (let i = 1; i < means.length; i++)
      expect(means[i]!).toBeLessThanOrEqual(means[i - 1]! + 4);
    expect(means[8]!).toBeLessThan(0.75 * means[0]!);
  });

  it("keeps the real limb darkening: the four axis pixels at 0.98 radii are 25% darker than the centre", async () => {
    const { data, info } = await decodedSun();
    const at = (x: number, y: number) =>
      data[(Math.round(y) * info.width + Math.round(x)) * info.channels]!;
    const centre = at(128, 128);
    const reach = 0.98 * (128 / sunSidecar.disc.crop);
    for (const [dx, dy] of [
      [reach, 0],
      [-reach, 0],
      [0, reach],
      [0, -reach],
    ] as const)
      expect(at(127.5 + dx, 127.5 + dy)).toBeLessThan(0.75 * centre);
  });

  it("is black outside the disc: the four corners", async () => {
    const { data, info } = await decodedSun();
    for (const [x, y] of [
      [0, 0],
      [255, 0],
      [0, 255],
      [255, 255],
    ] as const)
      expect(data[(y * info.width + x) * info.channels]).toBe(0);
  });

  it("is one grey band: red, green and blue are equal", async () => {
    const { data } = await decodedSun();
    let spread = 0;
    for (let p = 0; p < data.length; p += 3)
      spread = Math.max(spread, Math.abs(data[p]! - data[p + 2]!));
    expect(spread).toBeLessThanOrEqual(2);
  });
});

describe("fitDisc and discImage", () => {
  /** A disc of grey, darker towards its edge, in a black square. */
  const disc = (size: number, cx: number, cy: number, radius: number) => {
    const luma = new Uint8Array(size * size);
    for (let p = 0; p < luma.length; p++) {
      const rho =
        Math.hypot((p % size) + 0.5 - cx, Math.floor(p / size) + 0.5 - cy) /
        radius;
      if (rho <= 1) luma[p] = Math.round(200 * (1 - 0.6 * rho * rho));
    }
    return luma;
  };

  it("finds the centre within a pixel and the radius within 1%", () => {
    const fit = fitDisc(disc(400, 190.3, 212.7, 150), 400);
    expect(Math.abs(fit.x - 190.3)).toBeLessThan(1);
    expect(Math.abs(fit.y - 212.7)).toBeLessThan(1);
    expect(Math.abs(fit.radius - 150)).toBeLessThan(1.5);
  });

  it("refuses an image with no disc", () => {
    expect(() => fitDisc(new Uint8Array(100), 10)).toThrow(/no disc/);
  });

  it("blacks out everything past the disc and leaves its centre alone", () => {
    const size = 64;
    const rgb = new Uint8Array(size * size * 3).fill(180);
    const grey = discImage(rgb, size);
    expect(grey[0]).toBe(0);
    expect(grey[size * size - 1]).toBe(0);
    expect(grey[(size / 2) * size + size / 2]).toBeGreaterThan(175);
  });
});
