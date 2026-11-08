#!/usr/bin/env tsx
/**
 * Draw the Earth of the share card: `src/assets/og-earth.webp`, 1200 by 630, a large Earth whose
 * limb arcs across the lower part of the card on a dark sky, with no text. `src/lib/og-art.ts` lays
 * the title and the description on top of it, above the limb.
 *
 * Run by hand, never in `build`: `pnpm --filter dox exec tsx scripts/build-og-earth.ts`. The same
 * run always writes the same bytes: a fixed instant, a fixed camera, a fixed seed for the stars and
 * no clock. The sphere is the Blue Marble texture (`public/earth-blue-marble.webp`) projected through
 * the same pinhole camera as the home hero (6.61 Earth radii), lit by the Sun at the fixed instant,
 * with a cyan rim of air. The globe engine itself is not captured: it draws zone pins and labels
 * over the planet, which a share card does not want.
 *
 * The middle of the visible Earth (x 600, halfway between the limb's crest and the card's bottom
 * edge) is the great-circle midpoint of Helsinki and Isafjordur, in the Norwegian Sea, north up.
 * The colours are the site's: the photograph only says where land, ice and sea are, and a
 * tritone read from `src/styles/gmt-tokens.css` paints them (sea in the void-to-teal range, land
 * from teal to ice-dim, ice caps and snow in ice).
 *
 * Imagery: NASA Earth Observatory, Blue Marble Next Generation, public domain (see
 * `scripts/prepare-globe-imagery.py` and `context/dox/built.md`, Earth imagery). Resampled and
 * lit here; no NASA logo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getCanvasKit } from "../src/lib/og-canvaskit";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WIDTH = 1200;
const HEIGHT = 630;
/** The hero's camera: distance from the Earth's centre, in Earth radii. */
const CAMERA = 6.61;
/**
 * The instant that sets the Sun: the June solstice at 11:46 UTC, with the Sun over 23.44 N and the
 * longitude of the middle point (3.5 E, 180 - 15 x 11.766 h). The whole visible cap is then in
 * daylight and the terminator lies 90 degrees away, behind both limbs.
 */
const SUN_LAT = 23.44;

/** The two cities whose great-circle midpoint is the middle of the visible Earth. */
const HELSINKI = { lat: 60.1699, lon: 24.9384 };
const ISAFJORDUR = { lat: 66.075, lon: -23.124 };

/** The Earth's apparent radius in pixels and the pixel its centre sits on; the crest is at y 360. */
const FRAME = {
  radius: 900,
  cx: 600,
  cy: 1262,
  /** Where the middle point sits on the card: x 600, halfway from the crest (y 360) to y 630. */
  target: { x: 600, y: 495 },
  /** Pixels kept free of stars: the text box. */
  clear: [280, 30, 920, 300],
} as const;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
type Vec = [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec): Vec => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};
const ecef = (lat: number, lon: number): Vec => [
  Math.cos(rad(lat)) * Math.cos(rad(lon)),
  Math.cos(rad(lat)) * Math.sin(rad(lon)),
  Math.sin(rad(lat)),
];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A colour token's value from the dark theme's block, the first definition in the file. */
const tokens = readFileSync(
  resolve(appRoot, "src/styles/gmt-tokens.css"),
  "utf8",
);
const token = (name: string): Vec => {
  const hit = new RegExp(`--gmt-${name}:\\s*#([0-9a-fA-F]{6})`).exec(tokens);
  if (!hit) throw new Error(`token --gmt-${name} not found`);
  const n = parseInt(hit[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: Vec, b: Vec, t: number): Vec => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const VOID = token("void");
const SURFACE_2 = token("surface-2");
const TEAL = token("teal");
const CYAN = token("cyan");
const ICE_DIM = token("ice-dim");
const ICE = token("ice");

/** The great-circle midpoint of two places, as a unit vector. */
const midpoint = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) => norm(ecef(a.lat, a.lon).map((v, i) => v + ecef(b.lat, b.lon)[i]) as Vec);

async function main() {
  const CanvasKit = await getCanvasKit();
  const encoded = readFileSync(
    resolve(appRoot, "public/earth-blue-marble.webp"),
  );
  const image = CanvasKit.MakeImageFromEncoded(encoded);
  if (!image) throw new Error("cannot decode earth-blue-marble.webp");
  const texW = image.width();
  const texH = image.height();
  const texture = image.readPixels(0, 0, {
    width: texW,
    height: texH,
    colorType: CanvasKit.ColorType.RGBA_8888,
    alphaType: CanvasKit.AlphaType.Unpremul,
    colorSpace: CanvasKit.ColorSpace.SRGB,
  }) as Uint8Array;

  const sample = (lat: number, lon: number): Vec => {
    const u = ((((lon + 180) / 360) % 1) + 1) % 1;
    const v = Math.min(0.9999, Math.max(0, (90 - lat) / 180));
    const x = u * texW - 0.5;
    const y = v * texH - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.max(0, Math.min(texH - 2, Math.floor(y)));
    const fx = x - x0;
    const fy = y - y0;
    const out: Vec = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const at = (xx: number, yy: number) =>
        texture[(yy * texW + ((xx + texW) % texW)) * 4 + c];
      out[c] =
        at(x0, y0) * (1 - fx) * (1 - fy) +
        at(x0 + 1, y0) * fx * (1 - fy) +
        at(x0, y0 + 1) * (1 - fx) * fy +
        at(x0 + 1, y0 + 1) * fx * fy;
    }
    return out;
  };

  {
    const { radius, cx, cy } = FRAME;
    // The focal length that makes the limb's apparent radius `radius` pixels.
    const focal = radius * Math.sqrt(CAMERA * CAMERA - 1);
    const mid = midpoint(HELSINKI, ISAFJORDUR);
    const midLat = (Math.asin(mid[2]) * 180) / Math.PI;
    const midLon = (Math.atan2(mid[1], mid[0]) * 180) / Math.PI;
    // The angle from the sub-camera point to the middle point that lands it FRAME.target.y high:
    // sin(t) / (CAMERA - cos(t)) = rise / focal, solved by bisection (it rises with t).
    const rise = (cy - FRAME.target.y) / focal;
    let lo = 0;
    let hi = Math.PI / 2;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (Math.sin(m) / (CAMERA - Math.cos(m)) < rise) lo = m;
      else hi = m;
    }
    const tilt = (lo + hi) / 2;
    // North up: the sub-camera point is the middle point moved `tilt` south along its meridian.
    const east = norm(cross([0, 0, 1], mid));
    const northAtMid = cross(mid, east);
    const s: Vec = [
      Math.cos(tilt) * mid[0] - Math.sin(tilt) * northAtMid[0],
      Math.cos(tilt) * mid[1] - Math.sin(tilt) * northAtMid[1],
      Math.cos(tilt) * mid[2] - Math.sin(tilt) * northAtMid[2],
    ];
    const right = east;
    const up = cross(s, right);
    const sun = ecef(SUN_LAT, midLon);
    console.log(
      `middle point ${midLat.toFixed(4)} N, ${midLon.toFixed(4)} E; sub-camera tilt ${((tilt * 180) / Math.PI).toFixed(2)} deg`,
    );
    const SS = 3;

    // The sky: void, plus stars from a fixed generator.
    const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    const sky = (y: number): Vec => {
      const t = y / HEIGHT;
      return mix(VOID, SURFACE_2, t * 0.6);
    };
    for (let y = 0; y < HEIGHT; y++) {
      const c = sky(y);
      for (let x = 0; x < WIDTH; x++) {
        const at = (y * WIDTH + x) * 4;
        rgba[at] = c[0];
        rgba[at + 1] = c[1];
        rgba[at + 2] = c[2];
        rgba[at + 3] = 255;
      }
    }
    let seed = 20261108;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rnd() * WIDTH);
      const y = Math.floor(rnd() * HEIGHT);
      const b = 40 + rnd() * rnd() * 70;
      const [x0, y0, x1, y1] = FRAME.clear;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      const at = (y * WIDTH + x) * 4;
      rgba[at] = Math.max(rgba[at], b * 0.9);
      rgba[at + 1] = Math.max(rgba[at + 1], b);
      rgba[at + 2] = Math.max(rgba[at + 2], b * 1.05);
    }

    const x0 = Math.max(0, Math.floor(cx - radius * 1.25));
    const x1 = Math.min(WIDTH, Math.ceil(cx + radius * 1.25));
    const y0 = Math.max(0, Math.floor(cy - radius * 1.25));
    const y1 = Math.min(HEIGHT, Math.ceil(cy + radius * 1.25));
    const limbSin = 1 / CAMERA;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let cover = 0;
        // The rim of air: strongest at the limb, fading out over about 5 per cent of the radius.
        let glow = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const px = x + (sx + 0.5) / SS - cx;
            const py = cy - (y + (sy + 0.5) / SS);
            const dir = norm([px / focal, py / focal, -1]);
            // Ray from (0, 0, CAMERA) against the unit sphere.
            const bq = CAMERA * dir[2];
            const disc = bq * bq - (CAMERA * CAMERA - 1);
            if (disc >= 0) {
              const t = -bq - Math.sqrt(disc);
              const p: Vec = [dir[0] * t, dir[1] * t, CAMERA + dir[2] * t];
              const world: Vec = [
                right[0] * p[0] + up[0] * p[1] + s[0] * p[2],
                right[1] * p[0] + up[1] * p[1] + s[1] * p[2],
                right[2] * p[0] + up[2] * p[1] + s[2] * p[2],
              ];
              const lat =
                (Math.asin(Math.max(-1, Math.min(1, world[2]))) * 180) /
                Math.PI;
              const lon = (Math.atan2(world[1], world[0]) * 180) / Math.PI;
              const tex = sample(lat, lon);
              const lit = dot(world, sun);
              const day = smooth(-0.1, 0.35, lit);
              const shade = 0.12 + 0.95 * day;
              // What the photograph says: land is warmer than the sea, snow and ice are white.
              const luma = (0.3 * tex[0] + 0.55 * tex[1] + 0.15 * tex[2]) / 255;
              const warm = (tex[0] - tex[2] + 0.3 * (tex[1] - tex[2])) / 255;
              const snow = smooth(
                0.5,
                0.72,
                Math.min(tex[0], tex[1], tex[2]) / 255,
              );
              const land = Math.max(smooth(0.0, 0.07, warm), snow);
              // The sea runs void to teal with the photograph's depth; land teal to ice-dim, with
              // its own relief; snow and ice reach the ice token.
              const sea = mix(SURFACE_2, TEAL, smooth(0.03, 0.3, luma) * 0.75);
              const ground = mix(TEAL, ICE_DIM, smooth(0.08, 0.5, luma));
              const toned = mix(mix(sea, ground, land), ICE, snow * 0.85);
              // Fresnel haze: the more edge-on the surface, the more of the air's cyan.
              const normalFacing = Math.max(
                0,
                dot(norm([p[0], p[1], p[2]]), [-dir[0], -dir[1], -dir[2]]),
              );
              const haze = Math.pow(1 - normalFacing, 3) * 0.75;
              for (let c = 0; c < 3; c++) {
                const base = toned[c] * shade;
                const v =
                  base * (1 - haze * (0.4 + 0.6 * day)) +
                  CYAN[c] * haze * (0.25 + 0.75 * day);
                if (c === 0) r += v;
                else if (c === 1) g += v;
                else b += v;
              }
              cover += 1;
            } else {
              // Distance from the sphere's limb in sphere radii: sin of the ray's angle to the axis.
              const rayTan = Math.hypot(dir[0], dir[1]) / -dir[2];
              const limbTan = limbSin / Math.sqrt(1 - limbSin * limbSin);
              const out = rayTan / limbTan - 1;
              if (out < 0.09) {
                const sideLit = Math.max(
                  0,
                  Math.min(
                    1,
                    0.35 +
                      0.9 *
                        dot(
                          norm([dir[0], dir[1], 0]),
                          norm([
                            right[0] * sun[0] +
                              right[1] * sun[1] +
                              right[2] * sun[2],
                            up[0] * sun[0] + up[1] * sun[1] + up[2] * sun[2],
                            0,
                          ]),
                        ),
                  ),
                );
                glow += Math.pow(1 - out / 0.09, 2.2) * (0.25 + 0.75 * sideLit);
              }
            }
          }
        }
        const n = SS * SS;
        const at = (y * WIDTH + x) * 4;
        const sr = rgba[at];
        const sg = rgba[at + 1];
        const sb = rgba[at + 2];
        const k = cover / n;
        const gl = (glow / n) * 0.55;
        // Atmosphere over the sky, then the planet over both.
        const ar = sr + (CYAN[0] - sr) * gl;
        const ag = sg + (CYAN[1] - sg) * gl;
        const ab = sb + (CYAN[2] - sb) * gl;
        rgba[at] = ar * (1 - k) + r / n;
        rgba[at + 1] = ag * (1 - k) + g / n;
        rgba[at + 2] = ab * (1 - k) + b / n;
      }
    }

    const pixels = CanvasKit.MakeImage(
      {
        width: WIDTH,
        height: HEIGHT,
        alphaType: CanvasKit.AlphaType.Unpremul,
        colorType: CanvasKit.ColorType.RGBA_8888,
        colorSpace: CanvasKit.ColorSpace.SRGB,
      },
      new Uint8Array(rgba.buffer),
      WIDTH * 4,
    );
    if (!pixels) throw new Error("cannot build the image");
    const bytes = pixels.encodeToBytes(CanvasKit.ImageFormat.WEBP, 90);
    if (!bytes) throw new Error("cannot encode WebP");
    const file = resolve(appRoot, `src/assets/og-earth.webp`);
    writeFileSync(file, bytes);
    console.log(`wrote ${file} (${bytes.length} bytes)`);
  }
}

await main();
