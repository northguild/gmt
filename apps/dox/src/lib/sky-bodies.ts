/**
 * The Sun and the Moon on the night sky's stars canvas, drawn flat: a core and a glare, and a disc
 * with its terminator. A textured Moon (`body-paint.ts`, loaded with the Moon's map) takes the
 * disc over through `MoonPainter` and returns false when it cannot, so the flat Moon always has
 * the last word.
 */
import {
  bodyOnScreen,
  limbOnScreen,
  SUN_RADIUS,
  sunRaDec,
  toUnit,
  type CameraMoon,
  type RaDec,
  type SkyLens,
} from "./sky-math";
import { drawHalo, rgba } from "./sky-halo";
import { moonFromCamera } from "./sky-moon";
import type { DiscId } from "./sky-registry";

export type Rgb = [number, number, number];

/**
 * The Sun's glare reaches this many of its own radii past its disc, so it grows with the zoom as the
 * disc does. In a vacuum the Sun has no halo of its own; this is a short bloom that reads as bright.
 * A Sun whose glare lies wholly inside the Earth's disc is left out.
 */
export const GLARE_RADII = 2;

const SUN_CORE = "#fffaf0";
const SUN_GLARE: Rgb = [255, 244, 214];
const MOON_LIT = "#f4f6ff";
/** The ice-tinted look of the Moon's lit part: the flat disc's colour, which the textured one is tinted to. */
export const ICE_TINT: Rgb = [244, 246, 255];
/** The dark part of the Moon shows earthshine: this strong at a new Moon, fading to nothing at a full one. */
const EARTHSHINE = 0.08;

export interface Disc {
  x: number;
  y: number;
  r: number;
}

/**
 * Draws the Moon's disc over the cleared one, lit part and earthshine, into `ctx` for the camera
 * `lens` and `m` (axes of date) at `instantMs`, `dpr` device pixels to a CSS pixel: `disc` is its
 * place on screen, `angle` the bright limb's screen direction, radians, and `shine` the
 * earthshine's strength, `EARTHSHINE * (1 - lit)`. False when it cannot, and the flat Moon is
 * drawn.
 */
export type MoonPainter = (
  ctx: CanvasRenderingContext2D,
  lens: SkyLens,
  m: Float64Array,
  instantMs: number,
  dpr: number,
  disc: Disc,
  moon: CameraMoon,
  angle: number,
  shine: number,
) => boolean;

/** The Sun's disc painted from its photograph, in place of the flat core: `disc` is its place on screen, `sun` its sky position. False when it cannot. */
export type SunPainter = (
  ctx: CanvasRenderingContext2D,
  lens: SkyLens,
  m: Float64Array,
  instantMs: number,
  dpr: number,
  disc: Disc,
  sun: RaDec,
) => boolean;

/** The textured bodies' painters, each once its map has loaded; a body without one is drawn flat. Keyed by the registry's disc ids. */
export type BodyPainters = {
  [Id in DiscId]?: { sun: SunPainter; moon: MoonPainter }[Id] | null;
};

/**
 * A layer drawn on the stars canvas between the stars and the bodies, inside the Earth's clip (the
 * planets): into `ctx` for the camera `lens`, `m` and `rotation` at `instantMs`, `tint` the sky's.
 * It writes what the gate reads on the canvas itself.
 */
export type SkyLayer = (
  ctx: CanvasRenderingContext2D,
  lens: SkyLens,
  m: Float64Array,
  frame: [number, number, number, number],
  rotation: readonly [number, number],
  instantMs: number,
  tint: Rgb,
) => void;

/**
 * Clears the Moon's disc on the stars canvas: the Moon is solid, so no star or Sun behind it
 * shows; at an eclipse it covers the Sun.
 */
function erase(ctx: CanvasRenderingContext2D, { x, y, r }: Disc): void {
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Draws the Sun and then the Moon in front of it, on a canvas of `width` by `height` CSS pixels,
 * for the camera at `rotation`, `instantMs`, with the solid Earth's disc of `earth` CSS pixels
 * (0 with none) left clear and no glare when `plain`. Returns what the gate reads, their places
 * and the Moon's lit part, and the Moon's disc, which the Milky Way leaves clear.
 */
export function drawBodies(
  ctx: CanvasRenderingContext2D,
  lens: SkyLens,
  m: Float64Array,
  [width, height, earth, dpr]: [number, number, number, number],
  rotation: readonly [number, number],
  instantMs: number,
  plain: boolean,
  tint: Rgb,
  paint: BodyPainters,
): [string, Disc | null] {
  const at = (
    body: { ra: number; dec: number },
    degrees: number,
    reach: number,
  ) =>
    bodyOnScreen(
      lens,
      m,
      toUnit(body.ra, body.dec),
      degrees,
      width,
      height,
      reach,
    );
  const sun = sunRaDec(instantMs);
  const moon = moonFromCamera(instantMs, rotation);
  const sunAt = at(sun, SUN_RADIUS, GLARE_RADII);
  const reach = sunAt ? sunAt.r * (1 + GLARE_RADII) : 0;
  const hidden =
    sunAt !== null &&
    Math.hypot(sunAt.x - lens.centreX, sunAt.y - lens.centreY) < earth - reach;
  if (sunAt && !hidden) {
    const { x, y, r } = sunAt;
    if (!plain) drawHalo(ctx, x, y, reach, SUN_GLARE, 0.35, r);
    if (!paint.sun?.(ctx, lens, m, instantMs, dpr, sunAt, sun)) {
      ctx.fillStyle = SUN_CORE;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const moonAt = at(moon, moon.radius, 0);
  if (moonAt) {
    const { x, y, r } = moonAt;
    erase(ctx, moonAt);
    const shine = EARTHSHINE * (1 - moon.lit);
    /* The bright limb points toward the Sun along the great circle: a step that way, projected, gives its direction on screen. */
    const angle = limbOnScreen(lens, m, moon, moonAt);
    if (
      !paint.moon?.(ctx, lens, m, instantMs, dpr, moonAt, moon, angle, shine)
    ) {
      /* The cleared disc is still the path: fill it again for the earthshine. */
      if (shine >= 0.0005) {
        ctx.fillStyle = rgba(tint, shine);
        ctx.fill();
      }
      const across = Math.abs(2 * moon.lit - 1) * r;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      /* The terminator: half an ellipse, bulging into the dark half past half lit and into the lit half before it. */
      ctx.ellipse(
        0,
        0,
        across,
        r,
        0,
        Math.PI / 2,
        -Math.PI / 2,
        moon.lit <= 0.5,
      );
      ctx.fillStyle = MOON_LIT;
      ctx.fill();
      ctx.restore();
    }
  }
  const place = (found: { x: number; y: number } | null): string =>
    found ? `${found.x.toFixed(1)} ${found.y.toFixed(1)}` : "none none";
  return [
    `${place(hidden ? null : sunAt)} ${place(moonAt)} ${moon.lit.toFixed(3)}`,
    moonAt,
  ];
}
