/**
 * The night sky behind the Earth, shared by the landing hero (`hero-space.ts`) and the slide
 * deck's stage (`slides/stage.ts`).
 *
 * The sky has no loop of its own. `loadSky` fetches the star list and the Milky Way map and builds
 * the sky, then, once the browser is idle, loads the Moon's map and hands the sky its painter; `followGlobe` draws it once from the globe's camera (which marks the host
 * `data-sky="ready"` and so fades the layers in) and then re-draws it on each of the globe's
 * frames; `drawWithoutGlobe` draws it once when no globe will ever mount. Each takes the caller's
 * own elements and signal, so the hero passes a signal it never aborts and the deck aborts its on
 * `destroy()`.
 */
import { startRotation } from "./globe-zones";
import { mountSky, type Sky } from "./sky";
import type { BodyPainters } from "./sky-bodies";
import type { SkyMap } from "./sky-map";
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
): Promise<SkyMap | undefined> {
  if (!src) return undefined;
  try {
    const response = await fetch(src, { signal });
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
    signal,
  };
}

/**
 * The bodies that take a map: the `SkyInputs` field that names it and the painter its lazy chunk
 * makes from it. Sun first, as it is drawn first. Each chunk loads with its map, off the first paint.
 */
const SKY_BODIES = [
  {
    id: "sun",
    map: "sunMap",
    make: async (map: SkyMap) =>
      (await import("./sun-paint")).createSunPainter(map),
  },
  {
    id: "moon",
    map: "moonMap",
    make: async (map: SkyMap) =>
      (await import("./body-paint")).createMoonPainter(map),
  },
] as const satisfies readonly {
  id: keyof BodyPainters;
  map: "sunMap" | "moonMap";
  make: (map: SkyMap) => Promise<BodyPainters[keyof BodyPainters]>;
}[];

/**
 * Once the first paint is done and the browser idle, loads each body's map and painter chunk and
 * hands the painters to the sky; a body whose map or chunk fails stays flat and the others are
 * textured. Nothing is fetched under forced colours (the sky is hidden) or after the caller has gone.
 */
async function loadBodyMaps(
  sky: Sky,
  stars: HTMLElement,
  inputs: Pick<SkyInputs, "sunMap" | "moonMap" | "signal">,
): Promise<void> {
  const { signal } = inputs;
  const wanted = SKY_BODIES.filter((body) => inputs[body.map]);
  if (
    !wanted.length ||
    globalThis.matchMedia?.("(forced-colors: active)")?.matches
  ) {
    return;
  }
  await sky.ready;
  await whenIdle();
  if (signal.aborted) return;
  const made = await Promise.all(
    wanted.map(async ({ map, make }) => {
      const loaded = await loadSkyMap(inputs[map]!, signal);
      return loaded ? make(loaded).catch(() => null) : null;
    }),
  );
  if (signal.aborted) return;
  const painters: BodyPainters = {};
  wanted.forEach(({ id }, i) => {
    if (made[i]) Object.assign(painters, { [id]: made[i] });
  });
  stars.dataset["skyMaps"] = made.some(Boolean) ? "ready" : "failed";
  sky.maps(painters);
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
