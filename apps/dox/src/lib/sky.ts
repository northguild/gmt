/**
 * The landing's night sky: the real stars and the Milky Way behind the Earth, drawn from the
 * packed HYG v4.4 star list (`src/assets/hero-sky.bin`, made by `scripts/prepare-hero-sky.mjs`).
 *
 * It shows the sky behind the Earth for the camera and the moment: the host calls `view` from the
 * globe's frame with the camera's rotation, the Earth's centre on screen and the clock, and the
 * sky draws when the view's centre has moved by 0.01 degree or the Earth's centre by half a pixel
 * (the clock alone does not count there, since the globe calls on every tick). Otherwise it has no loop of its own: it draws once on mount, once per resize, and a check once
 * a minute catches the slow drift of the sidereal clock at rest. Two canvases: the Milky Way on
 * one at a quarter of the hero's size (the upscale softens it), the stars on another at a device
 * pixel ratio of at most 1.5. The Sun and the Moon are drawn on the stars canvas after the stars,
 * from their positions at the instant (see `sky-math.ts`).
 */
import {
  angularRadius,
  BOX,
  coverFit,
  fromGalactic,
  moonPhase,
  moonRaDec,
  projectUnit,
  skyBasis,
  SKY_ANCHOR,
  skyCentre,
  SUN_RADIUS,
  sunRaDec,
  toUnit,
  type SkyBasis,
  type Unit,
} from "./sky-math";

export interface SkyOptions {
  stars: HTMLCanvasElement;
  band: HTMLCanvasElement;
  /** The hero; its size sets both canvases. */
  host: HTMLElement;
  /** `hero-sky.bin`. */
  data: ArrayBuffer;
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
   * the hero's CSS pixels. Does nothing if the view's centre moved under 0.01 degree and the
   * Earth's centre under half a pixel since the last draw, whatever the clock says: the sidereal
   * drift is drawn by the minute check, so a caller that ticks every second costs no draws. The
   * first call always draws, then sets `data-sky="ready"` on the host. A null `centre` draws at the
   * anchor: for a globe that never mounted. `zoom` is the globe's own zoom factor (1 at rest),
   * which scales the whole sky to match the Earth's current size on screen.
   */
  view(
    rotation: readonly [number, number],
    centre: SkyPoint | null,
    instantMs: number,
    zoom?: number,
  ): void;
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

/** The band canvas holds this fraction of the hero's size, each way. */
const BAND_SCALE = 0.25;

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

/** The Milky Way's half-widths (degrees of galactic latitude) and their total alpha at the middle. */
const WIDE = { half: 7, layers: [1, 0.75, 0.5, 0.25], alpha: 0.032 } as const;
const CORE = { half: 3, layers: [1, 0.7, 0.4], alpha: 0.0256 } as const;

/** The smallest a Sun or Moon disc is drawn, in CSS pixels, so it never vanishes. */
const MIN_BODY = 2.5;

/** The Sun's glare reaches this far from its disc, in CSS pixels; a Sun this deep inside the Earth's disc is hidden. */
const GLARE = 90;

const SUN_CORE = "#fffaf0";
const SUN_GLARE: Rgb = [255, 244, 214];
const MOON_LIT = "#f4f6ff";
/** The dark part of the Moon shows earthshine: this strong at a new Moon, fading to nothing at a full one. */
const EARTHSHINE = 0.08;

const clamp = (low: number, value: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export interface StarList {
  count: number;
  /** Right ascension and declination, degrees. */
  ra: Float64Array;
  dec: Float64Array;
  mag: Float32Array;
  /** B-V class, 0 to 3. */
  cls: Uint8Array;
  /** Unit vectors, three numbers per star. */
  unit: Float64Array;
}

/** Decodes the packed list. */
export function decodeStars(data: ArrayBuffer): StarList {
  const count = Math.floor(data.byteLength / RECORD);
  const view = new DataView(data);
  const list: StarList = {
    count,
    ra: new Float64Array(count),
    dec: new Float64Array(count),
    mag: new Float32Array(count),
    cls: new Uint8Array(count),
    unit: new Float64Array(count * 3),
  };
  for (let i = 0; i < count; i++) {
    const at = i * RECORD;
    const ra = (view.getUint16(at, true) / 65536) * 360;
    const dec = (view.getInt16(at + 2, true) / 32767) * 90;
    list.ra[i] = ra;
    list.dec[i] = dec;
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

/** The galactic plane sampled every degree of l: the plane and the edges of the two bands. */
interface Plane {
  middle: Unit;
  wide: [Unit, Unit];
  core: [Unit, Unit];
}

function samplePlane(): Plane[] {
  const at = (l: number, b: number): Unit => {
    const { ra, dec } = fromGalactic(l, b);
    return toUnit(ra, dec);
  };
  const samples: Plane[] = [];
  for (let l = 0; l <= 360; l++)
    samples.push({
      middle: at(l, 0),
      wide: [at(l, WIDE.half), at(l, -WIDE.half)],
      core: [at(l, CORE.half), at(l, -CORE.half)],
    });
  return samples;
}

interface Fit {
  scale: number;
  originX: number;
  originY: number;
}

export function mountSky(options: SkyOptions): Sky {
  const { stars: starsCanvas, band: bandCanvas, host, signal, now } = options;
  const list = decodeStars(options.data);
  const starsCtx = starsCanvas.getContext("2d");
  const bandCtx = bandCanvas.getContext("2d");
  const plane = samplePlane();
  const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR);
  const queries = [
    "(prefers-contrast: more)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ].map((query) => globalThis.matchMedia?.(query));
  const point = { x: 0, y: 0 };
  const edge = { x: 0, y: 0 };

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
  let drawn: {
    ra: number;
    dec: number;
    x: number;
    y: number;
    zoom: number;
  } | null = null;
  /** The instant of the last draw. */
  let drawnAt: number | null = null;
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

  function drawStars(basis: SkyBasis, fit: Fit): void {
    if (!starsCtx) return;
    const { scale, originX, originY } = fit;
    const tint = iceColour();
    starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    starsCtx.clearRect(0, 0, width, height);
    const paths = new Map<number, Path2D>();
    let haloAt: [number, number] | null = null;
    for (let i = 0; i < list.count; i++) {
      const unit: Unit = [
        list.unit[i * 3]!,
        list.unit[i * 3 + 1]!,
        list.unit[i * 3 + 2]!,
      ];
      if (!projectUnit(basis, unit, point)) continue;
      const x = originX + scale * (point.x - BOX.width / 2);
      const y = originY + scale * (point.y - BOX.height / 2);
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

  /** Draws the Moon and then the Sun; returns what the gate reads: their places and the Moon's lit part. */
  function drawBodies(
    basis: SkyBasis,
    fit: Fit,
    instantMs: number,
    earth: SkyPoint,
  ): string {
    if (!starsCtx) return "none";
    const { scale, originX, originY } = fit;
    const at = (body: { ra: number; dec: number }, degrees: number) => {
      const unit = toUnit(body.ra, body.dec);
      if (!projectUnit(basis, unit, point)) return null;
      return {
        x: originX + scale * (point.x - BOX.width / 2),
        y: originY + scale * (point.y - BOX.height / 2),
        r: Math.max(MIN_BODY, angularRadius(basis, unit, degrees) * scale),
      };
    };
    const sun = sunRaDec(instantMs);
    const moon = moonRaDec(instantMs);
    const phase = moonPhase(sun, moon);
    const tint = iceColour();
    const moonAt = at(moon, moon.radius);
    if (moonAt) {
      const { x, y, r } = moonAt;
      const shine = EARTHSHINE * (1 - phase.lit);
      if (shine >= 0.0005) {
        starsCtx.fillStyle = rgba(tint, shine);
        starsCtx.beginPath();
        starsCtx.arc(x, y, r, 0, Math.PI * 2);
        starsCtx.fill();
      }
      /* The bright limb points toward the Sun along the great circle: a step that way, projected, gives its direction on screen. */
      const chi = (phase.limb * Math.PI) / 180;
      const step = 0.5;
      const ahead = at(
        {
          ra:
            moon.ra +
            (step * Math.sin(chi)) / Math.cos((moon.dec * Math.PI) / 180),
          dec: moon.dec + step * Math.cos(chi),
        },
        0,
      );
      const angle = ahead ? Math.atan2(ahead.y - y, ahead.x - x) : 0;
      const across = Math.abs(2 * phase.lit - 1) * r;
      starsCtx.save();
      starsCtx.translate(x, y);
      starsCtx.rotate(angle);
      starsCtx.beginPath();
      starsCtx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      if (phase.lit > 0.5)
        starsCtx.ellipse(0, 0, across, r, 0, Math.PI / 2, Math.PI * 1.5, false);
      else
        starsCtx.ellipse(0, 0, across, r, 0, Math.PI / 2, -Math.PI / 2, true);
      starsCtx.fillStyle = MOON_LIT;
      starsCtx.fill();
      starsCtx.restore();
    }
    const sunAt = at(sun, SUN_RADIUS);
    const hidden =
      sunAt !== null &&
      Math.hypot(sunAt.x - earth.x, sunAt.y - earth.y) <
        (earth.radius ?? 0) - GLARE;
    if (sunAt && !hidden) {
      const { x, y, r } = sunAt;
      if (!queries.some((query) => query?.matches)) {
        const glow = starsCtx.createRadialGradient(x, y, r, x, y, r + GLARE);
        glow.addColorStop(0, rgba(SUN_GLARE, 0.35));
        glow.addColorStop(1, rgba(SUN_GLARE, 0));
        starsCtx.fillStyle = glow;
        starsCtx.fillRect(
          x - r - GLARE,
          y - r - GLARE,
          2 * (r + GLARE),
          2 * (r + GLARE),
        );
      }
      starsCtx.fillStyle = SUN_CORE;
      starsCtx.beginPath();
      starsCtx.arc(x, y, r, 0, Math.PI * 2);
      starsCtx.fill();
    }
    const place = (found: { x: number; y: number } | null): string =>
      found ? `${found.x.toFixed(1)} ${found.y.toFixed(1)}` : "none none";
    return `${place(hidden ? null : sunAt)} ${place(moonAt)} ${phase.lit.toFixed(3)}`;
  }

  function drawBand(basis: SkyBasis, fit: Fit): void {
    if (!bandCtx) return;
    const { scale, originX, originY } = fit;
    const tint = iceColour();
    const k = BAND_SCALE * scale;
    const toX = (x: number): number =>
      BAND_SCALE * originX + k * (x - BOX.width / 2);
    const toY = (y: number): number =>
      BAND_SCALE * originY + k * (y - BOX.height / 2);
    bandCtx.clearRect(0, 0, bandCanvas.width, bandCanvas.height);
    const runs: { x: number; y: number; wide: number; core: number }[][] = [];
    let run: { x: number; y: number; wide: number; core: number }[] = [];
    for (const sample of plane) {
      if (!projectUnit(basis, sample.middle, point)) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      const span = (pair: [Unit, Unit]): number => {
        const a = projectUnit(basis, pair[0], edge) ? { ...edge } : null;
        const b = a && projectUnit(basis, pair[1], edge) ? edge : null;
        return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      };
      run.push({
        x: toX(point.x),
        y: toY(point.y),
        wide: span(sample.wide) * k,
        core: span(sample.core) * k,
      });
    }
    if (run.length > 1) runs.push(run);
    /* Each layer is one filled ribbon, so no seams show where segments meet. */
    for (const points of runs) {
      for (const band of [
        { ...WIDE, key: "wide" as const },
        { ...CORE, key: "core" as const },
      ]) {
        for (const layer of band.layers) {
          bandCtx.fillStyle = rgba(
            tint,
            (band.alpha * BAND_GAIN) / band.layers.length,
          );
          bandCtx.beginPath();
          const side = (sign: number, index: number): [number, number] => {
            const before = points[Math.max(0, index - 1)]!;
            const after = points[Math.min(points.length - 1, index + 1)]!;
            const length =
              Math.hypot(after.x - before.x, after.y - before.y) || 1;
            const half = (points[index]![band.key] * layer) / 2;
            return [
              points[index]!.x - (sign * (after.y - before.y) * half) / length,
              points[index]!.y + (sign * (after.x - before.x) * half) / length,
            ];
          };
          for (let i = 0; i < points.length; i++)
            bandCtx[i ? "lineTo" : "moveTo"](...side(1, i));
          for (let i = points.length - 1; i >= 0; i--)
            bandCtx.lineTo(...side(-1, i));
          bandCtx.fill();
        }
      }
    }
  }

  /** Where the Earth's centre is: reported by the globe, or the anchor until it has. */
  const centreOf = (): SkyPoint =>
    latest.centre ?? { x: SKY_ANCHOR.x * width, y: SKY_ANCHOR.y * height };

  function draw(): void {
    if (!begun || width === 0 || height === 0) return;
    const started = performance.now();
    const view = skyCentre(latest.rotation, latest.instantMs);
    const centre = centreOf();
    drawn = {
      ra: view.ra,
      dec: view.dec,
      x: centre.x,
      y: centre.y,
      zoom: latest.zoom,
    };
    drawnAt = latest.instantMs;
    const basis = skyBasis(view);
    const fit = coverFit(width, height, centre, latest.zoom);
    if (visible(starsCanvas)) {
      drawStars(basis, fit);
      starsCanvas.dataset["skyBodies"] = drawBodies(
        basis,
        fit,
        latest.instantMs,
        centre,
      );
      starsCanvas.dataset["skyDraws"] = String(
        Number(starsCanvas.dataset["skyDraws"] ?? 0) + 1,
      );
    }
    if (visible(bandCanvas)) drawBand(basis, fit);
    /* What the gate reads: the view drawn, how many draws, and how long the last one took (ms). */
    starsCanvas.dataset["skyView"] =
      `${view.ra.toFixed(3)} ${view.dec.toFixed(3)} ${latest.instantMs}`;
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
    const next = skyCentre(rotation, instantMs);
    const at = centre ?? centreOf();
    return (
      !drawn ||
      Math.abs(((next.ra - drawn.ra + 540) % 360) - 180) >= MIN_VIEW ||
      Math.abs(next.dec - drawn.dec) >= MIN_VIEW ||
      Math.abs(at.x - drawn.x) >= MIN_SHIFT ||
      Math.abs(at.y - drawn.y) >= MIN_SHIFT ||
      Math.abs(zoom - drawn.zoom) >= MIN_ZOOM
    );
  }

  /**
   * The camera moved: the clock alone does not redraw here (the globe's own once-a-second tick
   * would), so the camera is judged at the instant last drawn; the minute check owns the clock.
   * `zoom` defaults to the last one given, so a caller that only tracks rotation and centre (the
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
    const changed = moved(rotation, centre, drawnAt ?? instantMs, zoom);
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

  /* At rest nothing calls `view`, but the sky turns: once a minute the clock is asked again. */
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
