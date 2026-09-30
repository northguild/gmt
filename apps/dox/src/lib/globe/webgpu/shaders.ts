/**
 * Every WGSL shader the globe uses, as TypeScript template strings (#289).
 *
 * Template strings rather than `.wgsl` files for one reason that matters: the
 * shading constants are interpolated from `../shading.ts`, so the sun-elevation
 * maths has a single definition that the Vitest suite already covers and the
 * shader cannot drift from. `shaders.test.ts` checks each constant actually
 * reaches the emitted source.
 *
 * ## The passes
 *
 * 1. **Coverage** (`fillShader`, `strokeShader`) into an offscreen 4× MSAA
 *    `rgba8unorm` target, one channel per layer: land fill, land stroke, region
 *    fill, region stroke. Blend operation is `max` with both factors `one`, so
 *    overlapping triangles and the joints between stroke segments never
 *    double-blend a translucent layer — a 2D canvas strokes a whole path as one
 *    coverage, and beaded joints are the giveaway that a port did not.
 *    `max(dst, 0)` leaves the other channels alone, which is why one shader with
 *    a one-hot mask covers all four layers instead of four write-masked
 *    pipelines.
 * 2. **Surface** (`surfaceShader`): one full-screen quad that ray-casts the
 *    sphere and composites, in the canvas-2D renderer's order, atmosphere →
 *    ocean → sun shading → limb → graticule → the four coverage channels.
 * 3. **Region overlay** (`regionOverlayShader`): only when regions differ in
 *    colour, compositing a second group's coverage over the canvas.
 * 4. **Markers** (`markerShader`) and **labels** (`labelShader`): instanced
 *    quads, screen-space sized so a dot stays the same size as the globe zooms.
 *
 * ## Conventions
 *
 * All distances are device pixels. Colours are straight-alpha sRGB-encoded and
 * composited in that space, matching a 2D canvas; only the final write is
 * premultiplied, as `alphaMode: "premultiplied"` requires.
 */

import { CIVIL_TWILIGHT, GAMMA, HAZE_START, TWILIGHT_END } from "../shading";
import { uniformStructWgsl } from "./uniforms";

/** Grid spacing, matching `d3.geoGraticule10()`. */
export const GRATICULE_STEP_DEG = 10;

/**
 * Latitude at which `geoGraticule10`'s minor meridians stop.
 *
 * d3's default `extentMinor` is `[[-180, -80], [180, 80]]`, so 10° meridians run
 * only to ±80°, while `extentMajor`'s 90° meridians (−180, −90, 0, 90) reach the
 * poles. Parallels are the minor extent's 10° steps, −80 to 80.
 */
export const GRATICULE_MINOR_LIMIT_DEG = 80;

/** Spacing of the meridians that reach the poles. */
export const GRATICULE_MAJOR_STEP_DEG = 90;

/** Enough digits that a float32 round-trip cannot shift the value. */
function f32(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : value.toPrecision(17);
}

/**
 * Helpers shared by every shader: the uniform block, the projection, and the
 * exact sun-elevation curves from `../shading.ts`.
 */
function common(): string {
  return /* wgsl */ `
${uniformStructWgsl()}

@group(0) @binding(0) var<uniform> g: Globe;

/* Sine of 18°: astronomical twilight ends when the sun is this far down. */
const TWILIGHT_END: f32 = ${f32(TWILIGHT_END)};
/* Sine of 6°: daylight fades out over civil twilight, not at the horizon. */
const CIVIL_TWILIGHT: f32 = ${f32(CIVIL_TWILIGHT)};
/* sRGB display gamma — Lambert's law holds in linear light. */
const GAMMA: f32 = ${f32(GAMMA)};
/* The limb haze starts this fraction of the radius out from the centre. */
const HAZE_START: f32 = ${f32(HAZE_START)};

const DEG_PER_RAD: f32 = 57.29577951308232;
const RAD_PER_DEG: f32 = 0.017453292519943295;

/**
 * Hermite ease from 0 at \`e0\` to 1 at \`e1\`.
 *
 * Not WGSL's \`smoothstep\`: the night curve ramps *downwards*
 * (\`ramp(0, -TWILIGHT_END, x)\`), and \`smoothstep\` has undefined results when
 * its low edge is not below its high edge. This mirrors the TypeScript
 * \`smoothstep\` in ../shading.ts, which clamps the parameter and so handles
 * either direction.
 */
fn ramp(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

/** Night wash strength: 0 in daylight, easing to 1 across twilight. */
fn nightFactor(elevation: f32) -> f32 {
  return ramp(0.0, -TWILIGHT_END, elevation);
}

/** Daylight strength: Lambert, carried into civil twilight, then gamma-encoded. */
fn dayFactor(elevation: f32) -> f32 {
  let lit = (elevation + CIVIL_TWILIGHT) / (1.0 + CIVIL_TWILIGHT);
  if (lit <= 0.0) { return 0.0; }
  return pow(lit, 1.0 / GAMMA);
}

/** Limb haze strength at a distance from centre, as a fraction of the radius. */
fn hazeFactor(distance: f32) -> f32 {
  return ramp(HAZE_START, 1.0, distance);
}

/** Whether street lights are on, from civil dusk. */
fn cityLightsOn(elevation: f32) -> bool {
  return elevation <= -CIVIL_TWILIGHT;
}

/** Straight-alpha source-over, the operation a 2D canvas performs. */
fn over(dst: vec4<f32>, src: vec4<f32>) -> vec4<f32> {
  let a = src.a + dst.a * (1.0 - src.a);
  if (a <= 0.0) { return vec4<f32>(0.0); }
  let rgb = (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a;
  return vec4<f32>(rgb, a);
}

/**
 * Project a geographic point.
 *
 * Returns \`(screenX, screenY, towardsViewer)\` in device pixels, with the depth
 * positive on the near hemisphere. Same maths as \`rotatePoint\` and \`project\`
 * in ../camera.ts, which is checked against d3's \`geoOrthographic\`.
 */
fn projectGeo(lngDeg: f32, latDeg: f32) -> vec3<f32> {
  let lambda = lngDeg * RAD_PER_DEG;
  let phi = latDeg * RAD_PER_DEG;
  let cosLat = cos(phi);
  /* Longitude rotation through the angle-addition formulae, so the camera's
     cached sin/cos are reused instead of adding angles and calling sin/cos
     again. */
  let cosSum = cos(lambda) * g.cameraTrig.x - sin(lambda) * g.cameraTrig.y;
  let sinSum = sin(lambda) * g.cameraTrig.x + cos(lambda) * g.cameraTrig.y;
  let x1 = cosLat * cosSum;
  let y1 = cosLat * sinSum;
  let z1 = sin(phi);
  let towardsViewer = x1 * g.cameraTrig.z - z1 * g.cameraTrig.w;
  let right = y1;
  let up = z1 * g.cameraTrig.z + x1 * g.cameraTrig.w;
  return vec3<f32>(
    g.view.x + g.viewport.z * right,
    g.view.y - g.viewport.z * up,
    towardsViewer,
  );
}

/** Geographic unit vector, for the marker day/night test. */
fn geoUnit(lngDeg: f32, latDeg: f32) -> vec3<f32> {
  let lambda = lngDeg * RAD_PER_DEG;
  let phi = latDeg * RAD_PER_DEG;
  let cosLat = cos(phi);
  return vec3<f32>(cosLat * cos(lambda), cosLat * sin(lambda), sin(phi));
}

/** Device-pixel position to clip space. */
fn toClip(screen: vec2<f32>) -> vec4<f32> {
  return vec4<f32>(
    screen.x / g.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / g.viewport.y * 2.0,
    0.0,
    1.0,
  );
}

/** Two triangles covering the viewport, from \`vertex_index\` alone. */
fn fullscreenQuad(index: u32) -> vec4<f32> {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  return vec4<f32>(corners[index], 0.0, 1.0);
}

/**
 * Coverage of a line of \`widthPx\` whose centre is \`distPx\` away.
 *
 * A sub-pixel width keeps its position and loses alpha instead of thinning to
 * nothing, which is how a 2D canvas renders \`lineWidth\` below 1.
 */
fn lineCoverage(distPx: f32, widthPx: f32) -> f32 {
  let w = max(widthPx, 1.0);
  return clamp(w * 0.5 + 0.5 - distPx, 0.0, 1.0) * min(widthPx, 1.0);
}

/** Distance from \`p\` to the segment \`a\`–\`b\`. */
fn segmentDistance(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}

/**
 * Ordered dither, as ../shading.ts applies before its own 8-bit rounding.
 *
 * Without it the long, faint gradients across the day side show as bands on a
 * large display. The 4×4 Bayer matrix is indexed by pixel position.
 */
fn dither(pixel: vec2<f32>) -> f32 {
  var bayer = array<f32, 16>(
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0,
  );
  let x = u32(pixel.x) & 3u;
  let y = u32(pixel.y) & 3u;
  return ((bayer[y * 4u + x] + 0.5) / 16.0 - 0.5) / 255.0;
}

/** Straight alpha to premultiplied. */
fn premultiply(colour: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(colour.rgb * colour.a, colour.a);
}

/**
 * Dither and clamp an already-premultiplied colour for output.
 *
 * Clamping the channels to the alpha rather than to 1 is what \`premultiplied\`
 * alpha mode requires: a channel above its own alpha is undefined, and the
 * dither can push one there.
 */
fn finish(premult: vec4<f32>, pixel: vec2<f32>) -> vec4<f32> {
  let offset = dither(pixel);
  let a = clamp(premult.a + offset, 0.0, 1.0);
  let rgb = clamp(premult.rgb + vec3<f32>(offset), vec3<f32>(0.0), vec3<f32>(a));
  return vec4<f32>(rgb, a);
}
`;
}

/**
 * The surface pass: sphere, shading, graticule and the coverage layers.
 *
 * One quad, all of it in the fragment shader. The graticule in particular has to
 * be analytic rather than geometry: drawing 53 clipped great-circle polylines
 * would mean re-tessellating them every frame, and a shader can get the same
 * lines from each pixel's own latitude and longitude.
 */
export function surfaceShader(): string {
  return /* wgsl */ `${common()}

@group(0) @binding(1) var coverage: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  return fullscreenQuad(index);
}

/** A pixel's latitude and longitude, plus how fast each changes on screen. */
struct Geo {
  lngDeg: f32,
  latDeg: f32,
  /** Degrees per device pixel, used to measure distance to a grid line. */
  lngGradient: f32,
  latGradient: f32,
}

/**
 * Invert the projection for one pixel, and take the screen gradients
 * analytically.
 *
 * Analytic rather than \`dpdx\`/\`dpdy\`: derivative builtins must be called in
 * uniform control flow, and this is wanted inside the "is this pixel on the
 * sphere" branch. Deriving the Jacobian costs a few multiplies and sidesteps the
 * rule, and it stays exact at the antimeridian, where differencing \`atan2\`
 * across a quad would read a 360° jump as an enormous gradient and paint a bright
 * seam.
 */
fn geoAt(u: f32, v: f32, radius: f32) -> Geo {
  let z = sqrt(max(0.0, 1.0 - u * u - v * v));
  let safeZ = max(z, 1e-4);
  let c = g.cameraTrig.z;
  let s = g.cameraTrig.w;

  // Undo the latitude rotation; see \`unproject\` in ../camera.ts.
  let x1 = z * c - v * s;
  let y1 = u;
  let z1 = -v * c - z * s;

  let latRad = asin(clamp(z1, -1.0, 1.0));
  let lngRad = atan2(y1, x1);

  // d/du and d/dv of the sphere's depth, then of each rotated component.
  let dzdu = -u / safeZ;
  let dzdv = -v / safeZ;
  let dx1du = dzdu * c;
  let dx1dv = dzdv * c - s;
  let dy1du = 1.0;
  let dy1dv = 0.0;
  let dz1du = -dzdu * s;
  let dz1dv = -c - dzdv * s;

  let horizontal = max(x1 * x1 + y1 * y1, 1e-9);
  let dLngdu = (x1 * dy1du - y1 * dx1du) / horizontal;
  let dLngdv = (x1 * dy1dv - y1 * dx1dv) / horizontal;
  let cosLat = sqrt(max(1.0 - z1 * z1, 1e-9));
  let dLatdu = dz1du / cosLat;
  let dLatdv = dz1dv / cosLat;

  /* u and v are in radii, and one device pixel is 1/radius of those, so the
     per-pixel gradient is the per-radius one divided by the radius. */
  let perPixel = DEG_PER_RAD / radius;
  return Geo(
    lngRad * DEG_PER_RAD - g.lines.x,
    latRad * DEG_PER_RAD,
    length(vec2<f32>(dLngdu, dLngdv)) * perPixel,
    length(vec2<f32>(dLatdu, dLatdv)) * perPixel,
  );
}

/**
 * The graticule, matching \`geoGraticule10()\`.
 *
 * Combined with \`max\`, never a sum: d3 strokes the whole graticule as one path,
 * so a meridian crossing a parallel is drawn once, and adding the two coverages
 * would leave a brighter dot at every intersection.
 */
fn graticule(geo: Geo, widthPx: f32) -> f32 {
  let step = ${f32(GRATICULE_STEP_DEG)};

  // Parallels: 10° steps, stopping at ±80 as d3's minor extent does.
  let nearestLat = round(geo.latDeg / step) * step;
  var parallel = 0.0;
  if (abs(nearestLat) <= ${f32(GRATICULE_MINOR_LIMIT_DEG)} + 0.001) {
    let distPx = abs(geo.latDeg - nearestLat) / max(geo.latGradient, 1e-9);
    parallel = lineCoverage(distPx, widthPx);
  }

  // Meridians: wrap into ±180 first, so the seam is not a discontinuity.
  let wrappedLng = geo.lngDeg - 360.0 * round(geo.lngDeg / 360.0);
  let nearestLng = round(wrappedLng / step) * step;
  let isMajor = abs(abs(nearestLng) % ${f32(GRATICULE_MAJOR_STEP_DEG)}) < 0.001;
  var meridian = 0.0;
  if (isMajor || abs(geo.latDeg) <= ${f32(GRATICULE_MINOR_LIMIT_DEG)} + 0.001) {
    let distPx = abs(wrappedLng - nearestLng) / max(geo.lngGradient, 1e-9);
    meridian = lineCoverage(distPx, widthPx);
  }

  return max(parallel, meridian);
}

/** The atmosphere glow outside the limb. */
fn atmosphere(u: f32, v: f32, d: f32, reach: f32) -> vec4<f32> {
  if (g.atmosphere.a <= 0.0) { return vec4<f32>(0.0); }
  /* Clamped at the inner edge so the value at the limb is the gradient's peak;
     the caller mixes against it across the boundary pixel. */
  let t = clamp((d - 1.0) / max(reach - 1.0, 1e-6), 0.0, 1.0);
  let radial = 1.0 - t;

  /* Strength round the ring follows how lit each limb point is. With the sun off
     to one side that limb glows and the opposite one keeps a floor; with the sun
     behind the globe the whole ring brightens, which is the eclipse-rim look of
     photographs taken from orbit. */
  let tilt = min(length(g.sun.xy), 1.0);
  let angle = atan2(v, u) - atan2(g.sun.y, g.sun.x);
  let lit = 0.5 + 0.5 * tilt * cos(angle);
  let floorShare = ${f32(0.15)};
  let directional = floorShare + (1.0 - floorShare) * lit;
  let backlight = 1.0 + ${f32(0.8)} * max(0.0, -g.sun.z);

  let alpha = min(1.0, g.atmosphere.a * backlight) * radial * directional;
  return vec4<f32>(g.atmosphere.rgb, clamp(alpha, 0.0, 1.0));
}

@fragment
fn fs(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let radius = max(g.viewport.z, 1e-6);
  let reach = g.lines.w;
  let u0 = (position.x - g.view.x) / radius;
  let v0 = (position.y - g.view.y) / radius;
  let d0 = sqrt(u0 * u0 + v0 * v0);

  if (d0 > reach) { return vec4<f32>(0.0); }

  let ring = atmosphere(u0, v0, d0, reach);

  /* Past the limb, shade as if on it — exactly as paintShading does — so the
     boundary pixel has a sensible sphere colour to mix towards and no dark
     fringe appears. */
  var u = u0;
  var v = v0;
  var d = d0;
  if (d0 > 1.0) {
    u = u0 / d0;
    v = v0 / d0;
    d = 1.0;
  }
  let z = sqrt(max(0.0, 1.0 - u * u - v * v));

  var colour = vec4<f32>(0.0);
  colour = over(colour, g.ocean);

  // --- sun shading: day wash, limb haze, night wash, as one layer ---
  let elevation = u * g.sun.x + v * g.sun.y + z * g.sun.z;
  let dayA = g.day.a * dayFactor(elevation);
  // The haze is sunlight scattered by air, so it fades out with the day.
  let hazeA = g.haze.a * hazeFactor(d) * (1.0 - nightFactor(elevation));
  // Both lit layers are the day colour, so their alphas stack.
  let litA = 1.0 - (1.0 - dayA) * (1.0 - hazeA);
  let nightA = g.night.a * nightFactor(elevation);
  let shadeA = nightA + litA * (1.0 - nightA);
  if (shadeA > 0.0) {
    let litWeight = litA * (1.0 - nightA) / shadeA;
    let nightWeight = nightA / shadeA;
    let shadeRgb = g.day.rgb * litWeight + g.night.rgb * nightWeight;
    colour = over(colour, vec4<f32>(shadeRgb, shadeA));
  }

  // --- limb outline ---
  let limbDistPx = abs(d0 - 1.0) * radius;
  colour = over(
    colour,
    vec4<f32>(g.limb.rgb, g.limb.a * lineCoverage(limbDistPx, g.lines.z)),
  );

  // --- graticule ---
  let geo = geoAt(u, v, radius);
  let quietFactor = select(1.0, ${f32(0.56)}, g.view.w > 0.5);
  let gridCoverage = graticule(geo, g.lines.y);
  colour = over(
    colour,
    vec4<f32>(g.grid.rgb, g.grid.a * gridCoverage * quietFactor),
  );

  // --- land and region, from the coverage target ---
  let texel = textureLoad(coverage, vec2<i32>(floor(position.xy)), 0);
  colour = over(colour, vec4<f32>(g.land.rgb, g.land.a * texel.r));
  colour = over(colour, vec4<f32>(g.landStroke.rgb, g.landStroke.a * texel.g));
  colour = over(colour, vec4<f32>(g.regionFill.rgb, g.regionFill.a * texel.b));
  colour = over(colour, vec4<f32>(g.regionStroke.rgb, g.regionStroke.a * texel.a));

  /* The sphere and the glow do not overlap: the canvas-2D renderer fills the
     ring with an even-odd rule that cuts the inner disc out, and this is the
     same exclusion. So the two are mixed by how much of the pixel each one
     covers, rather than composited one over the other — source-over here would
     lay a full-strength glow under the whole globe and roughly double its
     alpha. Premultiplied first: mixing straight-alpha colours is not linear. */
  let px = 1.0 / radius;
  let sphereCoverage = 1.0 - clamp((d0 - (1.0 - px * 0.5)) / px, 0.0, 1.0);
  let blended = mix(premultiply(ring), premultiply(colour), sphereCoverage);
  return finish(blended, position.xy);
}
`;
}

/**
 * Compositing a further region group over the canvas.
 *
 * Only runs when a caller has set regions with different colours: the coverage
 * target holds one group at a time, so each extra group needs its own pass. The
 * common case — the Dox globe's single highlighted zone — never reaches this.
 */
export function regionOverlayShader(): string {
  return /* wgsl */ `${common()}

@group(0) @binding(1) var coverage: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  return fullscreenQuad(index);
}

@fragment
fn fs(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let radius = max(g.viewport.z, 1e-6);
  let u = (position.x - g.view.x) / radius;
  let v = (position.y - g.view.y) / radius;
  if (u * u + v * v > 1.0) { return vec4<f32>(0.0); }

  let texel = textureLoad(coverage, vec2<i32>(floor(position.xy)), 0);
  var colour = vec4<f32>(0.0);
  colour = over(colour, vec4<f32>(g.regionFill.rgb, g.regionFill.a * texel.b));
  colour = over(colour, vec4<f32>(g.regionStroke.rgb, g.regionStroke.a * texel.a));
  return vec4<f32>(colour.rgb * colour.a, colour.a);
}
`;
}

/** Per-draw parameters for the coverage pass. */
export const LAYER_STRUCT_WGSL = /* wgsl */ `
struct Layer {
  /** One-hot channel this layer writes: land fill, land stroke, region fill,
   *  region stroke. */
  mask: vec4<f32>,
  /** \`x\` is the stroke width in device pixels; unused for fills. */
  params: vec4<f32>,
}
`;

/**
 * Filled geometry into one coverage channel.
 *
 * Triangles come from `earcut` on unwrapped, densified lng/lat rings, so a
 * vertex is a geographic point and the projection happens here. The
 * back-hemisphere test is per fragment because a triangle can straddle the limb.
 */
export function fillShader(): string {
  return /* wgsl */ `${common()}
${LAYER_STRUCT_WGSL}
@group(1) @binding(0) var<uniform> layer: Layer;

struct Out {
  @builtin(position) position: vec4<f32>,
  @location(0) depth: f32,
}

@vertex
fn vs(@location(0) lngLat: vec2<f32>) -> Out {
  let projected = projectGeo(lngLat.x, lngLat.y);
  var out: Out;
  out.position = toClip(projected.xy);
  out.depth = projected.z;
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4<f32> {
  // The far hemisphere projects onto the same disc as the near one.
  if (in.depth < 0.0) { discard; }
  return layer.mask;
}
`;
}

/**
 * Stroked geometry into one coverage channel.
 *
 * One instance per segment, expanded here into a quad wide enough to hold the
 * stroke plus a pixel of antialiasing, with the ends pushed out by the same
 * amount so joints between consecutive segments read as round caps rather than
 * notches. Width is in device pixels and does not scale with zoom, which is what
 * `lineWidth` on a 2D canvas does.
 */
export function strokeShader(): string {
  return /* wgsl */ `${common()}
${LAYER_STRUCT_WGSL}
@group(1) @binding(0) var<uniform> layer: Layer;

struct Out {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(flat) segA: vec2<f32>,
  @location(1) @interpolate(flat) segB: vec2<f32>,
  @location(2) depth: f32,
}

@vertex
fn vs(
  @builtin(vertex_index) index: u32,
  @location(0) a: vec2<f32>,
  @location(1) b: vec2<f32>,
) -> Out {
  let pa = projectGeo(a.x, a.y);
  let pb = projectGeo(b.x, b.y);

  var out: Out;
  out.segA = pa.xy;
  out.segB = pb.xy;

  // Wholly on the far side: collapse the quad so it rasterises nothing.
  if (pa.z < 0.0 && pb.z < 0.0) {
    out.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.depth = -1.0;
    return out;
  }

  let half = layer.params.x * 0.5 + 1.0;
  let along = pb.xy - pa.xy;
  let length2 = dot(along, along);
  // A degenerate segment still needs a direction for its cap.
  let dir = select(vec2<f32>(1.0, 0.0), along / sqrt(max(length2, 1e-12)), length2 > 1e-12);
  let normal = vec2<f32>(-dir.y, dir.x);

  var corners = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  let corner = corners[index];
  let centre = mix(pa.xy, pb.xy, corner.x);
  let position = centre
    + normal * (corner.y * half)
    + dir * ((corner.x * 2.0 - 1.0) * half);

  out.position = toClip(position);
  out.depth = mix(pa.z, pb.z, corner.x);
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4<f32> {
  if (in.depth < 0.0) { discard; }
  let distance = segmentDistance(in.position.xy, in.segA, in.segB);
  let coverage = lineCoverage(distance, layer.params.x);
  if (coverage <= 0.0) { discard; }
  return layer.mask * coverage;
}
`;
}

/**
 * Marker dots and their selection rings.
 *
 * Instanced screen-space quads: the radius is in pixels, so a dot stays the same
 * size as the globe zooms, which is what makes a small zone an easy target. A
 * non-zero inner radius draws a ring instead of a disc, so one pipeline covers
 * both.
 */
export function markerShader(): string {
  return /* wgsl */ `${common()}

struct Out {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(flat) centre: vec2<f32>,
  @location(1) @interpolate(flat) radii: vec2<f32>,
  @location(2) @interpolate(flat) colour: vec4<f32>,
}

@vertex
fn vs(
  @builtin(vertex_index) index: u32,
  @location(0) lngLat: vec2<f32>,
  /** \`(outer, inner)\` radius in CSS pixels; a non-zero inner makes a ring. */
  @location(1) radii: vec2<f32>,
  @location(2) dayColour: vec4<f32>,
  @location(3) nightColour: vec4<f32>,
  /** \`x\` non-zero means this marker has a distinct night colour. */
  @location(4) flags: vec2<f32>,
) -> Out {
  let projected = projectGeo(lngLat.x, lngLat.y);
  var out: Out;

  if (projected.z <= 0.0) {
    // Behind the globe: collapse rather than draw it through the planet.
    out.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.radii = vec2<f32>(0.0);
    out.centre = projected.xy;
    out.colour = vec4<f32>(0.0);
    return out;
  }

  let dpr = g.viewport.w;
  let outer = radii.x * dpr;
  let inner = radii.y * dpr;
  let half = outer + 1.0;

  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  out.position = toClip(projected.xy + corners[index] * half);
  out.centre = projected.xy;
  out.radii = vec2<f32>(outer, inner);

  /* Night colour from civil dusk, not from the horizon: a dot in daylight is
     not a city light at all, and this is the moment the day wash above has
     finished fading out. */
  let elevation = dot(geoUnit(lngLat.x, lngLat.y), g.subsolar.xyz);
  let useNight = flags.x > 0.5 && cityLightsOn(elevation);
  out.colour = select(dayColour, nightColour, useNight);
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4<f32> {
  if (in.radii.x <= 0.0) { discard; }
  let distance = length(in.position.xy - in.centre);
  var coverage = clamp(in.radii.x + 0.5 - distance, 0.0, 1.0);
  if (in.radii.y > 0.0) {
    // A ring: subtract the hole, so the stroke is the difference of two discs.
    coverage = coverage * clamp(distance - in.radii.y + 0.5, 0.0, 1.0);
  }
  if (coverage <= 0.0) { discard; }
  let alpha = in.colour.a * coverage;
  return vec4<f32>(in.colour.rgb * alpha, alpha);
}
`;
}

/**
 * Marker labels, from a texture atlas built once on a 2D canvas.
 *
 * Text is the one thing a 2D context does better than a shader, so the atlas is
 * rasterised there with the site's own mono font and sampled here. Its alpha
 * channel is the glyph coverage; the colour comes from the theme.
 */
export function labelShader(): string {
  return /* wgsl */ `${common()}

@group(0) @binding(1) var atlas: texture_2d<f32>;
@group(0) @binding(2) var atlasSampler: sampler;

struct Out {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs(
  @builtin(vertex_index) index: u32,
  @location(0) lngLat: vec2<f32>,
  /** Offset from the marker, in CSS pixels. */
  @location(1) offset: vec2<f32>,
  /** Label size in CSS pixels. */
  @location(2) size: vec2<f32>,
  /** Atlas rectangle: \`(u0, v0, u1, v1)\`. */
  @location(3) rect: vec4<f32>,
) -> Out {
  let projected = projectGeo(lngLat.x, lngLat.y);
  var out: Out;
  if (projected.z <= 0.0) {
    out.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.uv = vec2<f32>(0.0);
    return out;
  }
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
  );
  let corner = corners[index];
  let dpr = g.viewport.w;
  let origin = projected.xy + offset * dpr;
  out.position = toClip(origin + corner * size * dpr);
  out.uv = mix(rect.xy, rect.zw, corner);
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4<f32> {
  let sampled = textureSample(atlas, atlasSampler, in.uv);
  let alpha = g.label.a * sampled.a;
  if (alpha <= 0.0) { discard; }
  return vec4<f32>(g.label.rgb * alpha, alpha);
}
`;
}
