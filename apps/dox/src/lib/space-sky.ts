/**
 * The night sky behind the Earth, shared by the landing hero (`hero-space.ts`) and the slide
 * deck's stage (`slides/stage.ts`).
 *
 * The sky has no loop of its own. `loadSky` fetches the star list and the Milky Way map and builds
 * the sky, then, once the browser is idle, loads the bodies' maps and the planets' layer and hands the sky their painters; `followGlobe` draws it once from the globe's camera (which marks the host
 * `data-sky="ready"` and so fades the layers in) and then re-draws it on each of the globe's
 * frames; `drawWithoutGlobe` draws it once when no globe will ever mount. Each takes the caller's
 * own elements and signal, so the hero passes a signal it never aborts and the deck aborts its on
 * `destroy()`.
 */
import { watchTheme } from "./globe/globe-theme";
import { startRotation } from "./globe-zones";
import { mountSky, type Sky } from "./sky";
import type { BodyPainters } from "./sky-bodies";
import type { SkyMap } from "./sky-map";
import {
  EMPTY_POINTS,
  heldBody,
  providePoints,
  SKY_BODIES,
  watchHold,
  type SkyBody,
} from "./sky-registry";
import { whenIdle } from "./yield-to-main";

type Clock = {
  getUnixNow: typeof import("@northguild/gmt/unix/get").getUnixNow;
  getSystemTimeZone: typeof import("@northguild/gmt/zoned/get").getSystemTimeZone;
};

let clock: Promise<Clock> | undefined;

/* Dynamic, so the Temporal polyfill behind these two stays out of the static first-paint graph. */
export const loadClock = (): Promise<Clock> =>
  (clock ??= Promise.all([
    import("@northguild/gmt/unix/get"),
    import("@northguild/gmt/zoned/get"),
  ]).then(([unix, zoned]) => ({
    getUnixNow: unix.getUnixNow,
    getSystemTimeZone: zoned.getSystemTimeZone,
  })));

/** What a sky needs from the page that owns it. */
interface SkyInputs {
  /** The two canvases and the element that carries `data-sky="ready"`. */
  stars: HTMLCanvasElement;
  band: HTMLCanvasElement;
  host: HTMLElement;
  /** The star list (`hero-sky.bin`) and, optionally, the Milky Way map. */
  src: string;
  milkyWay?: string | undefined;
  /** The Sun's and the Moon's maps; fetched late, after `sky.ready` and an idle wait. */
  sunMap?: string | undefined;
  moonMap?: string | undefined;
  /** The canvas above the globe that a body nearer than the Moon is drawn on (`sky-planets.ts`), when the page has one. */
  near?: HTMLCanvasElement | null;
  /** The bodies' maps and the planets' layer are fetched only once this has settled (the landing: the Earth has its imagery). */
  after?: Promise<unknown>;
  signal: AbortSignal;
}

/** The part of a globe the sky follows. */
interface SkyGlobe {
  getRotation(): readonly [number, number];
  getZoom(): number;
  getCentre(): { x: number; y: number; radius: number };
  onFrame(callback: () => void): void;
}

/**
 * A map image's pixels, or undefined when it cannot load (absent, 404, aborted, undecodable): the
 * sky then draws without it. The one place an image is decoded to pixels.
 */
async function loadSkyMap(
  src: string | undefined,
  signal: AbortSignal,
  priority: "high" | "low" = "high",
): Promise<SkyMap | undefined> {
  if (!src) return undefined;
  try {
    const response = await fetch(src, { signal, priority });
    if (!response.ok) return undefined;
    /* The map's bytes are brightness or colour as drawn, so no colour space may change them. */
    const image = await createImageBitmap(await response.blob(), {
      colorSpaceConversion: "none",
    });
    const { width, height } = image;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx?.drawImage(image, 0, 0);
    image.close();
    return ctx?.getImageData(0, 0, width, height);
  } catch {
    return undefined;
  }
}

/**
 * The sky inputs a page declares: `data-sky-src`, `data-milky-way` and `data-moon-map` on
 * `holder`, and the two canvases inside it. Null when the page has no sky to draw.
 */
export function skyInputsOf(
  holder: HTMLElement,
  host: HTMLElement,
  signal: AbortSignal,
): SkyInputs | null {
  const canvas = (which: string) =>
    holder.querySelector<HTMLCanvasElement>(`[data-sky-canvas="${which}"]`);
  const stars = canvas("stars");
  const band = canvas("band");
  const src = holder.dataset["skySrc"];
  if (!stars || !band || !src) return null;
  return {
    stars,
    band,
    host,
    src,
    milkyWay: holder.dataset["milkyWay"],
    sunMap: holder.dataset["sunMap"],
    moonMap: holder.dataset["moonMap"],
    /* Above the globe, so beside it in the host and not in the sky's own box. */
    near: host.querySelector<HTMLCanvasElement>('[data-sky-canvas="near"]'),
    signal,
  };
}

/** The registry's discs that take a map, whose map the page declares. */
type MappedDisc = Extract<SkyBody, { kind: "disc" }>;

/**
 * Once the first paint is done and the browser idle, loads each disc's map and painter chunk and
 * the planets' layer, and hands them to the sky; a body whose map or chunk fails stays flat (the
 * planets are then left out) and the others are textured. Nothing is fetched under forced colours
 * (the sky is hidden) or after the caller has gone.
 */
async function loadBodyMaps(
  sky: Sky,
  stars: HTMLElement,
  inputs: Pick<SkyInputs, "sunMap" | "moonMap" | "near" | "after" | "signal">,
): Promise<void> {
  const { signal } = inputs;
  if (globalThis.matchMedia?.("(forced-colors: active)")?.matches) return;
  const wanted = SKY_BODIES.filter(
    (row): row is MappedDisc => row.kind === "disc" && !!inputs[row.map],
  );
  await sky.ready;
  /* What the first view needs is on its way or drawn first; the bodies' maps wait their turn. */
  await inputs.after?.catch(() => {});
  await whenIdle();
  if (signal.aborted) return;
  let again = (): void => {};
  const [made, planets] = await Promise.all([
    Promise.all(
      wanted.map(async ({ map, make }) => {
        const loaded = await loadSkyMap(inputs[map]!, signal, "low");
        return loaded ? make(loaded).catch(() => null) : null;
      }),
    ),
    import("./sky-planets")
      .then((chunk) =>
        chunk.createPlanetLayer({
          near: inputs.near,
          signal,
          /* A pass's states arrive late: the sky draws again once they have. */
          redraw: () => again(),
          held: heldBody,
        }),
      )
      .catch(() => null),
  ]);
  if (signal.aborted) return;
  const painters: BodyPainters = {};
  wanted.forEach(({ id }, i) => {
    if (made[i]) Object.assign(painters, { [id]: made[i] });
  });
  if (wanted.length)
    stars.dataset["skyMaps"] = made.some(Boolean) ? "ready" : "failed";
  /* The sky's own signal ends the source with it; a failed chunk leaves an empty one, so the list stops waiting. */
  providePoints(planets ?? EMPTY_POINTS);
  signal.addEventListener("abort", () => providePoints(null), { once: true });
  const layer = planets ?? undefined;
  sky.maps(painters, layer);
  again = () => sky.maps(painters, layer);
  /* The ring of a held faint body comes and goes with the Look at view, also while the sky is at rest. */
  watchHold(() => again());
  signal.addEventListener("abort", () => watchHold(null), { once: true });
  /* A look change repaints the discs: their cache keys carry the look, so one redraw is enough. */
  watchTheme(() => sky.maps(painters, layer), signal);
}

/**
 * Fetches the star list and the Milky Way and builds the sky; the first draw waits for the globe
 * (`followGlobe`) or for `drawWithoutGlobe`. Resolves null when the list or the canvas fails: the
 * page does not depend on the sky.
 */
export async function loadSky(inputs: SkyInputs): Promise<Sky | null> {
  const { stars, band, host, src, milkyWay, signal } = inputs;
  try {
    const [response, map, time] = await Promise.all([
      fetch(src),
      loadSkyMap(milkyWay, signal),
      loadClock(),
    ]);
    if (!response.ok || signal.aborted) return null;
    const data = await response.arrayBuffer();
    const sky = mountSky({
      stars,
      band,
      host,
      data,
      milkyWay: map,
      signal,
      rotation: startRotation(time.getSystemTimeZone()),
      now: time.getUnixNow,
    });
    stars.dataset["skyMaps"] = "flat";
    void loadBodyMaps(sky, stars, inputs);
    return sky;
  } catch {
    return null;
  }
}

/** No globe will mount: draw the sky once at the start rotation, at the anchor. */
export async function drawWithoutGlobe(
  sky: Promise<Sky | null> | undefined,
  host: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const built = await sky;
  if (!built || host.dataset["sky"] === "ready" || signal.aborted) return;
  const time = await loadClock();
  if (signal.aborted) return;
  built.view(startRotation(time.getSystemTimeZone()), null, time.getUnixNow());
}

/**
 * Draws the sky for the globe's first camera and makes it follow the Earth's camera and the clock.
 * The globe reports the Earth's centre in its `surface`'s pixels; the sky wants `origin`'s.
 * Resolves once the first draw is done (true) or when there is no sky (false).
 */
export async function followGlobe(parts: {
  sky: Promise<Sky | null> | undefined;
  globe: SkyGlobe;
  origin: HTMLElement;
  surface: HTMLElement;
  signal: AbortSignal;
  /** The instant the sky shows, epoch milliseconds; gmt's `getUnixNow` when absent. */
  instant?: () => number;
}): Promise<boolean> {
  const { globe, origin, surface, signal } = parts;
  const sky = await parts.sky;
  if (!sky || signal.aborted) return false;
  const time = await loadClock();
  if (signal.aborted) return false;
  /* The surface's offset in the origin's pixels. One element (the deck's stage) is no offset, so
     nothing is measured: a measure on a globe frame forces any layout the page has pending, such as
     a slide's panel just shown, into that frame. */
  const offset = (): { x: number; y: number } => {
    if (origin === surface) return { x: 0, y: 0 };
    const from = origin.getBoundingClientRect();
    const box = surface.getBoundingClientRect();
    return { x: box.left - from.left, y: box.top - from.top };
  };
  const follow = (): void => {
    if (signal.aborted) return;
    const shift = offset();
    const centre = globe.getCentre();
    sky.view(
      globe.getRotation(),
      {
        x: centre.x + shift.x,
        y: centre.y + shift.y,
        radius: centre.radius,
      },
      (parts.instant ?? time.getUnixNow)(),
      globe.getZoom(),
    );
  };
  /* The first draw does not wait for a globe frame. */
  follow();
  globe.onFrame(follow);
  return true;
}
