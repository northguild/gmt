/**
 * The real stars of the night sky: the packed HYG v4.4 list (`src/assets/hero-sky.bin`, made by
 * `scripts/prepare-hero-sky.mjs`) decoded, grouped by colour and brightness step, and drawn on
 * the stars canvas as one path per group.
 */
import { drawHalo, parseHex, rgba, type Rgb } from "./sky-bodies";
import { skyToScreen, toUnit, type SkyLens, type Unit } from "./sky-math";

/** Bytes per star in the list (see the generator). */
const RECORD = 6;

/** The colour of a star by B-V class: blue-white, white, yellow-white, orange. */
const CLASS_COLOURS = ["#cfe0ff", "#f2f6ff", "#fff4e0", "#ffd9b0"];

/** How far each star's colour is mixed toward the ice token. */
const ICE_MIX = 0.6;

/** The faintest magnitude the sky draws, and the brightness steps a path is shared by. */
export const FAINT = 5.5;
const ALPHA_STEPS = 8;

/** Only a body brighter than this gets a soft halo: Sirius among the stars. */
const HALO_MAGNITUDE = -1;
/** Sirius's magnitude as the list decodes it: the halo is 6 dots wide there, and wider for a brighter body. */
const SIRIUS = -1.45;

const clamp = (low: number, value: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/** A point of magnitude `mag`: its dot's radius, CSS pixels, at `scale` dots to a pixel. */
export const dotRadius = (mag: number, scale: number): number =>
  clamp(0.45, 0.45 + 0.42 * (FAINT - mag), 2.4) * scale;

/** The brightness step (0 to 7) of a magnitude; the dot's alpha is `(step + 3) / 10`. */
export const dotStep = (mag: number): number =>
  Math.round(clamp(0.3, 0.3 + 0.14 * (FAINT - mag), 1) * 10) - 3;

/** The halo's reach past a point of magnitude `mag`, CSS pixels; 0 for one too faint for a halo. */
export const haloReach = (mag: number, scale: number): number =>
  mag < HALO_MAGNITUDE ? 6 * scale * 10 ** (0.1 * (SIRIUS - mag)) : 0;

/** The B-V class (0 blue-white to 3 orange) of a colour index. */
export const classOf = (bv: number): number =>
  bv < 0 ? 0 : bv < 0.5 ? 1 : bv < 1 ? 2 : 3;

/** A class's colour mixed toward the `tint`, the way every point of the sky is. */
export function classColour(index: number, tint: Rgb): Rgb {
  const base = parseHex(CLASS_COLOURS[index]!)!;
  return base.map((c, k) =>
    Math.round(c * (1 - ICE_MIX) + tint[k]! * ICE_MIX),
  ) as Rgb;
}

interface StarList {
  count: number;
  mag: Float32Array;
  /** Unit vectors in J2000 axes, three numbers per star. */
  unit: Float64Array;
  /** Each star's path: its B-V colour class and brightness step. */
  group: Uint8Array;
}

/** Decodes the packed list. */
export function decodeStars(data: ArrayBuffer): StarList {
  const count = Math.floor(data.byteLength / RECORD);
  const view = new DataView(data);
  const list: StarList = {
    count,
    mag: new Float32Array(count),
    unit: new Float64Array(count * 3),
    group: new Uint8Array(count),
  };
  for (let i = 0; i < count; i++) {
    const at = i * RECORD;
    const ra = (view.getUint16(at, true) / 65536) * 360;
    const dec = (view.getInt16(at + 2, true) / 32767) * 90;
    const mag = (list.mag[i] = view.getUint8(at + 4) / 20 - 2);
    list.group[i] = view.getUint8(at + 5) * ALPHA_STEPS + dotStep(mag);
    list.unit.set(toUnit(ra, dec), i * 3);
  }
  return list;
}

const point = { x: 0, y: 0 };

/**
 * Clears the canvas, keeps what is drawn next out of the solid Earth's disc (`earth`, CSS pixels,
 * 0 with no globe on screen), and draws the stars of `list`, seen through `lens` by the camera's
 * rotation `m` in the list's own axes (J2000).
 * The globe's ocean is translucent, so a star, the Moon or the Sun drawn there would show through
 * the land; the Sun's glare past the limb is the atmosphere and stays. The clip is left saved:
 * the caller draws the bodies inside it, then restores.
 */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  list: StarList,
  lens: SkyLens,
  m: Float64Array,
  [width, height, earth, dpr]: [number, number, number, number],
  tint: Rgb,
): void {
  const { group } = list;
  const scale = lens.dots;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.arc(lens.centreX, lens.centreY, earth, 0, 7);
  ctx.clip("evenodd");
  const paths = new Map<number, Path2D>();
  for (let i = 0; i < list.count; i++) {
    const unit: Unit = [
      list.unit[i * 3]!,
      list.unit[i * 3 + 1]!,
      list.unit[i * 3 + 2]!,
    ];
    if (!skyToScreen(lens, m, unit, point)) continue;
    const { x, y } = point;
    if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
    const radius = dotRadius(list.mag[i]!, scale);
    let path = paths.get(group[i]!);
    if (!path) paths.set(group[i]!, (path = new Path2D()));
    path.moveTo(x + radius, y);
    /* Any sweep past a turn is a full circle. */
    path.arc(x, y, radius, 0, 7);
    const reach = haloReach(list.mag[i]!, scale);
    if (reach) drawHalo(ctx, x, y, reach, tint);
  }
  for (const [key, path] of paths) {
    ctx.fillStyle = rgba(
      classColour(Math.floor(key / ALPHA_STEPS), tint),
      ((key % ALPHA_STEPS) + 3) / 10,
    );
    ctx.fill(path);
  }
}
