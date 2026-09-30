/**
 * The globe's uniform block (#289).
 *
 * Every field is a `vec4<f32>`, which is not a coincidence: WGSL's uniform
 * address space requires 16-byte alignment for struct members of vector type,
 * and mixing scalars in means hand-tracking padding and getting it wrong the
 * first time something is inserted. With vec4-only fields a slot's byte offset
 * is always `16 * index`, so the layout below and the WGSL struct in
 * `shaders.ts` can be checked against each other mechanically — which
 * `uniforms.test.ts` does.
 *
 * Distances are in **device pixels**, not CSS pixels. The fragment shader works
 * in `@builtin(position)` units, so keeping one unit throughout avoids a
 * scattering of `* dpr` factors and the off-by-a-device-pixel line widths that
 * come with them.
 *
 * Colours are straight (non-premultiplied) sRGB-encoded, matching `Rgba` in
 * `../types.ts`. The shader composites in that space deliberately: a 2D canvas
 * blends in encoded sRGB, and matching it is what makes the two renderers
 * comparable pixel for pixel.
 */

import type { GlobeTheme, Rgba } from "../types";

/** Slot order. The WGSL struct lists its members in exactly this sequence. */
export const UNIFORM_SLOTS = [
  /** `(widthDev, heightDev, radiusDev, dpr)` */
  "viewport",
  /** `(centreXDev, centreYDev, zoom, quiet)` — `quiet` is 0 or 1. */
  "view",
  /** Sun in screen space: `(right, down, towardsViewer, 0)`. */
  "sun",
  /** Camera trig: `(cosLambda, sinLambda, cosPhi, sinPhi)`. */
  "cameraTrig",
  /** `(rotationLngDeg, gridWidthDev, limbWidthDev, atmosphereReach)` */
  "lines",
  /** Subsolar point as a geographic unit vector, for per-marker day/night. */
  "subsolar",
  "ocean",
  "limb",
  "grid",
  "land",
  "landStroke",
  "day",
  "night",
  "atmosphere",
  "haze",
  "label",
  /* The region colours for the pass being drawn. Regions are composited a
     colour-group at a time (see `renderer-webgpu.ts`), so these change between
     passes within one frame rather than once per frame like the rest. */
  "regionFill",
  "regionStroke",
] as const;

export type UniformSlot = (typeof UNIFORM_SLOTS)[number];

/** Floats per slot. */
const SLOT_FLOATS = 4;

/** Total size of the uniform buffer, in bytes. */
export const UNIFORM_BYTES = UNIFORM_SLOTS.length * SLOT_FLOATS * 4;

/** Byte offset of a named slot — `16 * index`, by construction. */
export function slotOffset(slot: UniformSlot): number {
  return UNIFORM_SLOTS.indexOf(slot) * SLOT_FLOATS * 4;
}

export interface UniformInput {
  /** Canvas size in device pixels. */
  widthDev: number;
  heightDev: number;
  /** Sphere radius and centre in device pixels. */
  radiusDev: number;
  centreXDev: number;
  centreYDev: number;
  dpr: number;
  zoom: number;
  quiet: boolean;
  /** Screen-space sun direction: x right, y down, z towards the viewer. */
  sun: readonly [number, number, number];
  /** `(cosLambda, sinLambda, cosPhi, sinPhi)` from the camera. */
  cameraTrig: readonly [number, number, number, number];
  /** The camera's λ in degrees, to recover a pixel's longitude in the shader. */
  rotationLngDeg: number;
  /** Subsolar point as a geographic unit vector. */
  subsolar: readonly [number, number, number];
  theme: GlobeTheme;
  /** Grid and limb stroke widths in CSS pixels; scaled by `dpr` here. */
  gridWidthCss: number;
  limbWidthCss: number;
  /** How far the atmosphere glow reaches past the limb, as a multiple of R. */
  atmosphereReach: number;
  /** Colours for the region group in this pass; omitted means draw no region. */
  regionFill?: Rgba;
  regionStroke?: Rgba;
}

/** Write the block into `target`, which must hold `UNIFORM_BYTES`. */
export function writeUniforms(
  target: Float32Array<ArrayBuffer>,
  input: UniformInput,
): void {
  const put = (
    slot: UniformSlot,
    a: number,
    b: number,
    c: number,
    d: number,
  ) => {
    const at = UNIFORM_SLOTS.indexOf(slot) * SLOT_FLOATS;
    target[at] = a;
    target[at + 1] = b;
    target[at + 2] = c;
    target[at + 3] = d;
  };
  const colour = (slot: UniformSlot, value: readonly number[]) =>
    put(slot, value[0], value[1], value[2], value[3]);

  put("viewport", input.widthDev, input.heightDev, input.radiusDev, input.dpr);
  put(
    "view",
    input.centreXDev,
    input.centreYDev,
    input.zoom,
    input.quiet ? 1 : 0,
  );
  put("sun", input.sun[0], input.sun[1], input.sun[2], 0);
  put(
    "cameraTrig",
    input.cameraTrig[0],
    input.cameraTrig[1],
    input.cameraTrig[2],
    input.cameraTrig[3],
  );
  put(
    "lines",
    input.rotationLngDeg,
    input.gridWidthCss * input.dpr,
    input.limbWidthCss * input.dpr,
    input.atmosphereReach,
  );
  put("subsolar", input.subsolar[0], input.subsolar[1], input.subsolar[2], 0);

  const theme = input.theme;
  colour("ocean", theme.ocean);
  colour("limb", theme.limb);
  colour("grid", theme.grid);
  colour("land", theme.land);
  colour("landStroke", theme.landStroke);
  colour("day", theme.day);
  colour("night", theme.night);
  colour("atmosphere", theme.atmosphere);
  colour("haze", theme.haze);
  colour("label", theme.label);
  colour("regionFill", input.regionFill ?? TRANSPARENT);
  colour("regionStroke", input.regionStroke ?? TRANSPARENT);
}

const TRANSPARENT: Rgba = [0, 0, 0, 0];

/**
 * The WGSL struct matching the layout above.
 *
 * Generated from `UNIFORM_SLOTS` rather than written out, so a slot cannot be
 * added in one place and forgotten in the other.
 */
export function uniformStructWgsl(): string {
  const members = UNIFORM_SLOTS.map((slot) => `  ${slot}: vec4<f32>,`).join(
    "\n",
  );
  return `struct Globe {\n${members}\n}`;
}
