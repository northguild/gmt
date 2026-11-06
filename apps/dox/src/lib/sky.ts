/**
 * The landing's night sky: the real stars and the Milky Way behind the Earth, drawn from the
 * packed HYG v4.4 star list (`src/assets/hero-sky.bin`, made by `scripts/prepare-hero-sky.mjs`)
 * and ESO's all-sky Milky Way panorama (`src/assets/hero-milkyway.webp`, made by
 * `scripts/prepare-hero-milkyway.mjs`).
 *
 * It shows the sky behind the Earth through the globe's own camera (`globe/pinhole.ts`, gnomonic,
 * one pinhole for the Earth and the sky): the host calls `view` from the globe's frame with the
 * camera's rotation, the Earth's centre and radius on screen and the clock, and the sky draws when
 * the view's centre has moved by 0.01 degree, by the camera or by the sidereal clock, or the
 * Earth's centre or radius by half a pixel. The globe calls on every frame, including its
 * once-a-second clock tick at rest, so the drawn Sun keeps up with the globe's shading. The field
 * of view is whatever the hero shows. Otherwise it has no loop of its own: it draws once on mount,
 * once per resize, and a check once a minute catches the clock when nothing calls `view` (a globe
 * that never mounted). Two canvases: the Milky Way on one at an eighth of the hero's size, each
 * pixel looked up in the map through the camera (the upscale smooths it), the stars on another at
 * a device pixel ratio of at most 1.5. The Sun and
 * the Moon are drawn on the stars canvas after the stars, the Moon in front of the Sun, from their
 * positions at the instant (see `sky-math.ts`). Nothing is drawn inside the solid Earth's disc,
 * which the translucent globe would let show through; the Sun's glare past the limb stays, as
 * light through the atmosphere.
 */
import { directionAt, type Vec3 } from "./globe/pinhole";
import {
  bodyOnScreen,
  limbOnScreen,
  moonFromCamera,
  skyCentre,
  skyLens,
  skyToScreen,
  starViewMatrix,
  SUN_RADIUS,
  sunRaDec,
  toUnit,
  turnOf,
  viewMatrix,
  type SkyLens,
  type Unit,
} from "./sky-math";

export interface SkyOptions {
  stars: HTMLCanvasElement;
  band: HTMLCanvasElement;
  /** The hero; its size sets both canvases. */
  host: HTMLElement;
  /** `hero-sky.bin`. */
  data: ArrayBuffer;
  /**
   * `hero-milkyway.webp` decoded: an equirectangular all-sky map, row 0 at the north pole, right
   * ascension 0 at the left edge and growing to the right, brightness in the red channel. Without
   * it no Milky Way is drawn.
   */
  milkyWay?: SkyMap;
  /** Aborting disconnects the observer, cancels a pending frame and stops the minute check. */
  signal: AbortSignal;
  /** The camera for the first draw, before the globe reports one: `[λ, φ]` as `getRotation` gives it. */
  rotation: readonly [number, number];
  /** The clock, in Unix milliseconds: the same one that shades the Earth. */
  now: () => number;
}

export interface Sky {
  /**
   * Resolves once the first draw is done. Nothing is drawn, and the hero's `data-sky` stays unset,
   * until the first `view`: the sky appears only at its true place, never at a guessed one.
   */
  readonly ready: Promise<void>;
  /**
   * Draw the sky for a camera: `rotation` is the globe's `[λ, φ]`, `centre` the Earth's centre in
   * the hero's CSS pixels. Does nothing if, since the last draw, the view's centre (the camera
   * turned by the sidereal clock at `instantMs`) moved under 0.01 degree, the Earth's centre and
   * radius under half a pixel and `zoom` under 0.002, so a caller that ticks every second draws
   * every 3 s at rest (the clock turns the sky 0.0042 degree a second). The first call always
   * draws, then sets `data-sky="ready"` on the host. A null `centre` draws at the anchor: for a
   * globe that never mounted. `zoom` is the globe's own zoom factor (1 at rest),
   * which scales the stars' dots; the sky's own scale follows `centre.radius`.
   */
  view(
    rotation: readonly [number, number],
    centre: SkyPoint | null,
    instantMs: number,
    zoom?: number,
  ): void;
}

/** An all-sky map's pixels, four bytes each, as `getImageData` gives them. */
export interface SkyMap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** A place in the hero, in CSS pixels; `radius` is the Earth's disc, when the host knows it. */
export interface SkyPoint {
  x: number;
  y: number;
  radius?: number;
}

/** Bytes per star in the list (see the generator). */
const RECORD = 6;

/** The view's movement, in degrees, and the Earth's, in CSS pixels, below which a draw is not worth it. */
const MIN_VIEW = 0.01;
const MIN_SHIFT = 0.5;
/** The globe's zoom factor's movement below which a draw is not worth it. */
const MIN_ZOOM = 0.002;

/** How often the sidereal drift is checked at rest, milliseconds. */
const MINUTE = 60_000;

/** The densest the stars canvas gets, however sharp the screen. */
const MAX_DPR = 1.5;

/** The band canvas holds this fraction of the hero's size, each way: two looks per map cell at rest. */
const BAND_SCALE = 0.125;

/** The band is drawn this many times brighter and the canvas dimmed back by the same factor in CSS, so the faint glow has more than a handful of 8-bit steps. */
const BAND_GAIN = 8;

/** The colour of a star by B-V class: blue-white, white, yellow-white, orange. */
const CLASS_COLOURS = ["#cfe0ff", "#f2f6ff", "#fff4e0", "#ffd9b0"];

/** How far each star's colour is mixed toward the ice token. */
const ICE_MIX = 0.6;

const FALLBACK_ICE = "#cfeaf2";

/** The faintest star magnitude, and the brightness steps a path is shared by. */
const FAINT = 5.5;
const ALPHA_STEPS = 8;

/** A star brighter than this gets a soft halo: Sirius alone. */
const HALO_MAGNITUDE = -1;

/** The Milky Way's alpha where the map is brightest. */
const BAND_PEAK = 0.09;

/**
 * The Sun's glare reaches this many of its own radii past its disc, so it grows with the zoom as the
 * disc does. In a vacuum the Sun has no halo of its own; this is a short bloom that reads as bright.
 * A Sun whose glare lies wholly inside the Earth's disc is left out.
 */
const GLARE_RADII = 2;

const SUN_CORE = "#fffaf0";
const SUN_GLARE: Rgb = [255, 244, 214];
const MOON_LIT = "#f4f6ff";
/** The dark part of the Moon shows earthshine: this strong at a new Moon, fading to nothing at a full one. */
const EARTHSHINE = 0.08;

const clamp = (low: number, value: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export interface StarList {
  count: number;
  mag: Float32Array;
  /** B-V class, 0 to 3. */
  cls: Uint8Array;
  /** Unit vectors in J2000 axes, three numbers per star. */
  unit: Float64Array;
}

/** Decodes the packed list. */
export function decodeStars(data: ArrayBuffer): StarList {
  const count = Math.floor(data.byteLength / RECORD);
  const view = new DataView(data);
  const list: StarList = {
    count,
    mag: new Float32Array(count),
    cls: new Uint8Array(count),
    unit: new Float64Array(count * 3),
  };
  for (let i = 0; i < count; i++) {
    const at = i * RECORD;
    const ra = (view.getUint16(at, true) / 65536) * 360;
    const dec = (view.getInt16(at + 2, true) / 32767) * 90;
    list.mag[i] = view.getUint8(at + 4) / 20 - 2;
    list.cls[i] = view.getUint8(at + 5);
    const [x, y, z] = toUnit(ra, dec);
    list.unit[i * 3] = x;
    list.unit[i * 3 + 1] = y;
    list.unit[i * 3 + 2] = z;
  }
  return list;
}

type Rgb = [number, number, number];

function parseHex(value: string): Rgb | null {
  const found = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!found) return null;
  const n = parseInt(found[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = ([r, g, b]: Rgb, a: number): string =>
  `rgba(${r}, ${g}, ${b}, ${a})`;

export function mountSky(options: SkyOptions): Sky {
  const { stars: starsCanvas, band: bandCanvas, host, signal, now } = options;
  const list = decodeStars(options.data);
  const starsCtx = starsCanvas.getContext("2d");
  const bandCtx = bandCanvas.getContext("2d");
  const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR);
  const queries = [
    "(prefers-contrast: more)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ].map((query) => globalThis.matchMedia?.(query));
  const point = { x: 0, y: 0 };
  const ray: Vec3 = [0, 0, 0];

  /** Each star's path: its colour class and brightness step. */
  const group = new Uint8Array(list.count);
  let halo = -1;
  for (let i = 0; i < list.count; i++) {
    const alpha = clamp(0.3, 0.3 + 0.14 * (FAINT - list.mag[i]!), 1);
    const step = Math.round(alpha * 10) - 3;
    group[i] = list.cls[i]! * ALPHA_STEPS + step;
    if (list.mag[i]! < HALO_MAGNITUDE) halo = i;
  }

  let ice: Rgb | null = null;
  let width = 0;
  let height = 0;
  /** The camera of the last draw request, for a redraw that has no new one. */
  let latest: {
    rotation: readonly [number, number];
    centre: SkyPoint | null;
    instantMs: number;
    zoom: number;
  } = { rotation: options.rotation, centre: null, instantMs: now(), zoom: 1 };
  /** The camera of the last draw, its rotation unclamped, and the lens it made. */
  let drawn: (typeof latest & { lens: SkyLens }) | null = null;
  /** The Moon's disc in the last draw of the stars, for the band to leave out too. */
  let moonDisc: { x: number; y: number; r: number } | null = null;
  /** The band canvas's pixels, made again after a resize. */
  let glow: ImageData | undefined;
  let pending: number | undefined;
  /** Set by the first `view`: until then nothing draws, whatever resizes or changes. */
  let begun = false;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const iceColour = (): Rgb => {
    if (!ice)
      ice =
        parseHex(getComputedStyle(host).getPropertyValue("--gmt-ice")) ??
        parseHex(FALLBACK_ICE)!;
    return ice;
  };

  const visible = (canvas: HTMLCanvasElement): boolean =>
    canvas.checkVisibility?.() !== false;

  /** The solid Earth's disc radius, CSS pixels: 0 with no globe on screen, so nothing is kept out. */
  const earthRadius = (lens: SkyLens): number =>
    latest.centre?.radius ? lens.radius : 0;

  /**
   * Keeps what the stars canvas draws next out of the solid Earth's disc; the caller restores. The
   * globe's ocean is translucent, so a star, the Moon or the Sun drawn there would show through the
   * land; the Sun's glare past the limb is the atmosphere and stays.
   */
  function behindEarth(ctx: CanvasRenderingContext2D, lens: SkyLens): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(lens.centreX, lens.centreY, earthRadius(lens), 0, 7);
    ctx.clip("evenodd");
  }

  function drawStars(lens: SkyLens, m: Float64Array): void {
    if (!starsCtx) return;
    const scale = lens.dots;
    const tint = iceColour();
    starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    starsCtx.clearRect(0, 0, width, height);
    behindEarth(starsCtx, lens);
    const paths = new Map<number, Path2D>();
    let haloAt: [number, number] | null = null;
    for (let i = 0; i < list.count; i++) {
      const unit: Unit = [
        list.unit[i * 3]!,
        list.unit[i * 3 + 1]!,
        list.unit[i * 3 + 2]!,
      ];
      if (!skyToScreen(lens, m, unit, point)) continue;
      const { x, y } = point;
      if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
      const radius =
        clamp(0.45, 0.45 + 0.42 * (FAINT - list.mag[i]!), 2.4) * scale;
      let path = paths.get(group[i]!);
      if (!path) paths.set(group[i]!, (path = new Path2D()));
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, Math.PI * 2);
      if (i === halo) haloAt = [x, y];
    }
    if (haloAt) {
      const reach = 6 * scale;
      const glow = starsCtx.createRadialGradient(
        haloAt[0],
        haloAt[1],
        0,
        haloAt[0],
        haloAt[1],
        reach,
      );
      glow.addColorStop(0, rgba(tint, 0.25));
      glow.addColorStop(1, rgba(tint, 0));
      starsCtx.fillStyle = glow;
      starsCtx.fillRect(
        haloAt[0] - reach,
        haloAt[1] - reach,
        reach * 2,
        reach * 2,
      );
    }
    for (const [key, path] of paths) {
      const base = parseHex(CLASS_COLOURS[Math.floor(key / ALPHA_STEPS)]!)!;
      const mixed = base.map((c, k) =>
        Math.round(c * (1 - ICE_MIX) + tint[k]! * ICE_MIX),
      ) as Rgb;
      starsCtx.fillStyle = rgba(mixed, ((key % ALPHA_STEPS) + 3) / 10);
      starsCtx.fill(path);
    }
  }

  /**
   * Clears the Moon's disc on the stars canvas: the Moon is solid, so no star or Sun behind it
   * shows; at an eclipse it covers the Sun.
   */
  function erase(
    ctx: CanvasRenderingContext2D,
    { x, y, r }: { x: number; y: number; r: number },
  ): void {
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * Draws the Sun and then the Moon in front of it; returns what the gate reads: their places and
   * the Moon's lit part.
   */
  function drawBodies(lens: SkyLens, m: Float64Array): string {
    if (!starsCtx) return "none";
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
    const sun = sunRaDec(latest.instantMs);
    const moon = moonFromCamera(latest.instantMs, latest.rotation);
    const tint = iceColour();
    const sunAt = at(sun, SUN_RADIUS, GLARE_RADII);
    const reach = sunAt ? sunAt.r * (1 + GLARE_RADII) : 0;
    const hidden =
      sunAt !== null &&
      Math.hypot(sunAt.x - lens.centreX, sunAt.y - lens.centreY) <
        earthRadius(lens) - reach;
    if (sunAt && !hidden) {
      const { x, y, r } = sunAt;
      if (!queries.some((query) => query?.matches)) {
        const glow = starsCtx.createRadialGradient(x, y, r, x, y, reach);
        glow.addColorStop(0, rgba(SUN_GLARE, 0.35));
        glow.addColorStop(1, rgba(SUN_GLARE, 0));
        starsCtx.fillStyle = glow;
        starsCtx.fillRect(x - reach, y - reach, 2 * reach, 2 * reach);
      }
      starsCtx.fillStyle = SUN_CORE;
      starsCtx.beginPath();
      starsCtx.arc(x, y, r, 0, Math.PI * 2);
      starsCtx.fill();
    }
    const moonAt = at(moon, moon.radius, 0);
    moonDisc = moonAt;
    if (moonAt) {
      const { x, y, r } = moonAt;
      erase(starsCtx, moonAt);
      const shine = EARTHSHINE * (1 - moon.lit);
      /* The cleared disc is still the path: fill it again for the earthshine. */
      if (shine >= 0.0005) {
        starsCtx.fillStyle = rgba(tint, shine);
        starsCtx.fill();
      }
      /* The bright limb points toward the Sun along the great circle: a step that way, projected, gives its direction on screen. */
      const angle = limbOnScreen(lens, m, moon, moonAt);
      const across = Math.abs(2 * moon.lit - 1) * r;
      starsCtx.save();
      starsCtx.translate(x, y);
      starsCtx.rotate(angle);
      starsCtx.beginPath();
      starsCtx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      /* The terminator: half an ellipse, bulging into the dark half past half lit and into the lit half before it. */
      starsCtx.ellipse(
        0,
        0,
        across,
        r,
        0,
        Math.PI / 2,
        -Math.PI / 2,
        moon.lit <= 0.5,
      );
      starsCtx.fillStyle = MOON_LIT;
      starsCtx.fill();
      starsCtx.restore();
    }
    const place = (found: { x: number; y: number } | null): string =>
      found ? `${found.x.toFixed(1)} ${found.y.toFixed(1)}` : "none none";
    return `${place(hidden ? null : sunAt)} ${place(moonAt)} ${moon.lit.toFixed(3)}`;
  }

  /**
   * Looks each band pixel up in the Milky Way map: the camera's ray through the pixel's centre,
   * turned into the sky, gives a right ascension and declination, and the map is read there
   * between its four nearest cells. Pixels on the solid Earth's disc or the Moon's are left clear.
   */
  function drawBand(lens: SkyLens, m: Float64Array): void {
    if (!bandCtx) return;
    bandCtx.clearRect(0, 0, bandCanvas.width, bandCanvas.height);
    const map = options.milkyWay;
    if (!map) return;
    const out = (glow ??= bandCtx.createImageData(
      bandCanvas.width,
      bandCanvas.height,
    ));
    const { width: mw, height: mh, data: src } = map;
    const read = (row: number, column: number): number =>
      src[(row * mw + column) * 4]!;
    const [r, g, b] = iceColour();
    const earth = earthRadius(lens) ** 2;
    const moon = moonDisc;
    const gain = BAND_PEAK * BAND_GAIN;
    for (let j = 0, o = 0; j < out.height; j++) {
      const y = (j + 0.5) / BAND_SCALE;
      for (let i = 0; i < out.width; i++, o += 4) {
        const x = (i + 0.5) / BAND_SCALE;
        let alpha = 0;
        if (
          (x - lens.centreX) ** 2 + (y - lens.centreY) ** 2 >= earth &&
          !(moon && (x - moon.x) ** 2 + (y - moon.y) ** 2 < moon.r ** 2)
        ) {
          directionAt(lens, x, y, ray);
          /* The camera's rotation is orthonormal, so its transpose turns the ray into the sky. */
          const sx = m[0]! * ray[0] + m[3]! * ray[1] + m[6]! * ray[2];
          const sy = m[1]! * ray[0] + m[4]! * ray[1] + m[7]! * ray[2];
          const sz = m[2]! * ray[0] + m[5]! * ray[1] + m[8]! * ray[2];
          const u = (Math.atan2(sy, sx) / (2 * Math.PI) + 1) * mw - 0.5;
          const v =
            (Math.acos(sz / Math.hypot(sx, sy, sz)) / Math.PI) * mh - 0.5;
          const u0 = Math.floor(u);
          const v0 = clamp(0, Math.floor(v), mh - 2);
          const du = u - u0;
          const dv = clamp(0, v - v0, 1);
          const c0 = u0 % mw;
          const c1 = (u0 + 1) % mw;
          alpha =
            ((read(v0, c0) * (1 - du) + read(v0, c1) * du) * (1 - dv) +
              (read(v0 + 1, c0) * (1 - du) + read(v0 + 1, c1) * du) * dv) *
            gain;
        }
        out.data[o] = r;
        out.data[o + 1] = g;
        out.data[o + 2] = b;
        out.data[o + 3] = alpha;
      }
    }
    bandCtx.putImageData(out, 0, 0);
  }

  function draw(): void {
    if (!begun || width === 0 || height === 0) return;
    const started = performance.now();
    const view = skyCentre(latest.rotation, latest.instantMs);
    const lens = skyLens(width, height, latest.centre, latest.zoom);
    const m = viewMatrix(latest.rotation, latest.instantMs);
    /* The stars and the Milky Way map are in J2000 axes, the Sun and the Moon in axes of date. */
    const stars = starViewMatrix(latest.rotation, latest.instantMs);
    drawn = { ...latest, lens };
    moonDisc = null;
    if (visible(starsCanvas)) {
      drawStars(lens, stars);
      starsCanvas.dataset["skyBodies"] = drawBodies(lens, m);
      starsCtx?.restore();
      starsCanvas.dataset["skyDraws"] = String(
        Number(starsCanvas.dataset["skyDraws"] ?? 0) + 1,
      );
    }
    if (visible(bandCanvas)) drawBand(lens, stars);
    /* What the gate reads: the view drawn, how many draws, and how long the last one took (ms). */
    starsCanvas.dataset["skyView"] =
      `${view.ra.toFixed(3)} ${view.dec.toFixed(3)} ${latest.instantMs}`;
    starsCanvas.dataset["skyCamera"] =
      `${lens.centreX.toFixed(1)} ${lens.centreY.toFixed(1)} ${lens.radius.toFixed(1)}`;
    starsCanvas.dataset["skyMs"] = (performance.now() - started).toFixed(2);
    /* The first draw is the reveal: the page fades the layers in from `data-sky`. */
    if (host.dataset["sky"] !== "ready") {
      host.dataset["sky"] = "ready";
      resolveReady();
    }
  }

  function size(): boolean {
    const box = host.getBoundingClientRect();
    if (Math.round(box.width) === width && Math.round(box.height) === height)
      return false;
    width = Math.round(box.width);
    height = Math.round(box.height);
    starsCanvas.width = Math.round(width * dpr);
    starsCanvas.height = Math.round(height * dpr);
    bandCanvas.width = Math.max(1, Math.round(width * BAND_SCALE));
    bandCanvas.height = Math.max(1, Math.round(height * BAND_SCALE));
    glow = undefined;
    return true;
  }

  size();

  /* A resize arrives as a burst; one frame later it is drawn once. */
  const observer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (pending !== undefined) return;
          pending = requestAnimationFrame(() => {
            pending = undefined;
            if (size()) draw();
          });
        });
  observer?.observe(host);

  /* A layer the reader's settings hide is not drawn, so it needs drawing when they change. */
  const redraw = (): void => draw();
  for (const query of queries)
    query?.addEventListener("change", redraw, { signal });

  /** Whether the sky as it would look is far enough from the one drawn to be worth a draw. */
  function moved(
    rotation: readonly [number, number],
    centre: SkyPoint | null,
    instantMs: number,
    zoom: number,
  ): boolean {
    const at = skyLens(width, height, centre ?? latest.centre, zoom);
    return (
      !drawn ||
      Math.abs(
        ((turnOf(rotation, instantMs) -
          turnOf(drawn.rotation, drawn.instantMs) +
          540) %
          360) -
          180,
      ) >= MIN_VIEW ||
      Math.abs(rotation[1] - drawn.rotation[1]) >= MIN_VIEW ||
      [
        at.centreX - drawn.lens.centreX,
        at.centreY - drawn.lens.centreY,
        at.radius - drawn.lens.radius,
      ].some((shift) => Math.abs(shift) >= MIN_SHIFT) ||
      Math.abs(zoom - drawn.zoom) >= MIN_ZOOM
    );
  }

  /**
   * The camera or the clock moved: the globe's frame, including its once-a-second tick at rest,
   * keeps the sky within 0.01 degree of the shaded Earth. `zoom` defaults to the last one given, so a caller that only tracks rotation and centre (the
   * pre-globe draws) keeps whatever scale is already in effect.
   */
  function view(
    rotation: readonly [number, number],
    centre: SkyPoint | null,
    instantMs: number,
    zoom: number = latest.zoom,
  ): void {
    if (signal.aborted) return;
    if (!begun) {
      begun = true;
      size();
    }
    const changed = moved(rotation, centre, instantMs, zoom);
    latest = { rotation, centre, instantMs, zoom };
    if (changed) draw();
  }

  /** The clock moved: draw if the stars have drifted far enough. */
  function refresh(): void {
    if (!begun) return;
    latest = { ...latest, instantMs: now() };
    if (moved(latest.rotation, latest.centre, latest.instantMs, latest.zoom))
      draw();
  }

  /* Without a globe nothing calls `view`, but the sky turns: once a minute the clock is asked again. */
  let minute: ReturnType<typeof setTimeout> | undefined;
  const tick = (): void => {
    minute = undefined;
    if (signal.aborted || document.hidden) return;
    refresh();
    minute = setTimeout(tick, MINUTE);
  };
  const resume = (): void => {
    if (minute === undefined && !signal.aborted && !document.hidden)
      minute = setTimeout(tick, MINUTE);
  };
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        clearTimeout(minute);
        minute = undefined;
      } else {
        refresh();
        resume();
      }
    },
    { signal },
  );
  resume();

  signal.addEventListener(
    "abort",
    () => {
      observer?.disconnect();
      if (pending !== undefined) cancelAnimationFrame(pending);
      pending = undefined;
      clearTimeout(minute);
      minute = undefined;
    },
    { once: true },
  );

  return {
    ready,
    view,
  };
}
