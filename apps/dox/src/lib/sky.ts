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
import { BAND_SCALE, drawBand } from "./sky-band";
import {
  drawBodies,
  parseHex,
  type Disc,
  type BodyPainters,
  type Rgb,
} from "./sky-bodies";
import type { SkyMap } from "./sky-map";
import {
  skyCentre,
  skyLens,
  starViewMatrix,
  turnOf,
  viewMatrix,
  type SkyLens,
} from "./sky-math";
import { decodeStars, drawStars } from "./sky-stars";

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
  /** Hands the sky the textured Moon's painter, or null when its map failed to load, and draws again. */
  maps(painters: BodyPainters): void;
}

/** A place in the hero, in CSS pixels; `radius` is the Earth's disc, when the host knows it. */
export interface SkyPoint {
  x: number;
  y: number;
  radius?: number;
}

/** The view's movement, in degrees, and the Earth's, in CSS pixels, below which a draw is not worth it. */
const MIN_VIEW = 0.01;
const MIN_SHIFT = 0.5;
/** The globe's zoom factor's movement below which a draw is not worth it. */
const MIN_ZOOM = 0.002;

/** How often the sidereal drift is checked at rest, milliseconds. */
const MINUTE = 60_000;

/** The densest the stars canvas gets, however sharp the screen. */
const MAX_DPR = 1.5;

const FALLBACK_ICE = "#cfeaf2";

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
  /** The band canvas's pixels, made again after a resize. */
  let glow: ImageData | undefined;
  let pending: number | undefined;
  /** The textured Moon's painter, once its map has loaded. */
  let paint: BodyPainters = {};
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

  /* The layers the reader's settings hide (src/styles/gmt-space.css): a forced palette drops both,
     either of the other two the Milky Way. Asked of the queries and not of the page, since
     `checkVisibility` forces a style and layout pass inside the globe's frame, on every frame of a
     flight. */
  const forcedColors = queries[2];

  function draw(): void {
    if (!begun || width === 0 || height === 0) return;
    const started = performance.now();
    const view = skyCentre(latest.rotation, latest.instantMs);
    const lens = skyLens(width, height, latest.centre);
    drawn = { ...latest, lens };
    const m = viewMatrix(latest.rotation, latest.instantMs);
    /* The stars and the Milky Way map are in J2000 axes, the Sun and the Moon in axes of date. */
    const stars = starViewMatrix(latest.rotation, latest.instantMs);
    const tint = iceColour();
    /* Any of the three settings hides the Milky Way and the Sun's glare. */
    const dimmed = queries.some((query) => query?.matches);
    /* The solid Earth's disc radius, CSS pixels: 0 with no globe on screen, so nothing is kept out. */
    const earth = latest.centre?.radius ? lens.radius : 0;
    let moon: Disc | null = null;
    if (!forcedColors?.matches) {
      let text = "none";
      if (starsCtx) {
        const frame: [number, number, number, number] = [
          width,
          height,
          earth,
          dpr,
        ];
        drawStars(starsCtx, list, lens, stars, frame, tint);
        [text, moon] = drawBodies(
          starsCtx,
          lens,
          m,
          frame,
          latest.rotation,
          latest.instantMs,
          dimmed,
          tint,
          paint,
        );
        starsCtx.restore();
      }
      starsCanvas.dataset["skyBodies"] = text;
      starsCanvas.dataset["skyDraws"] = String(
        Number(starsCanvas.dataset["skyDraws"] ?? 0) + 1,
      );
    }
    if (bandCtx && !dimmed)
      glow = drawBand(
        lens,
        stars,
        [earth, moon],
        tint,
        bandCtx,
        bandCanvas,
        options.milkyWay,
        glow,
      );
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
    const at = skyLens(width, height, centre ?? latest.centre);
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
    /** The Moon's painter arrives: the flat Moon is replaced. */
    maps: (next: BodyPainters) => {
      paint = next;
      draw();
    },
  };
}
