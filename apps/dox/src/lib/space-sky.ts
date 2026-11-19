/**
 * The night sky behind the Earth, shared by the landing hero (`hero-space.ts`) and the slide
 * deck's stage (`slides/stage.ts`).
 *
 * The sky has no loop of its own. `loadSky` fetches the star list and the Milky Way map and builds
 * the sky; `followGlobe` draws it once from the globe's camera (which marks the host
 * `data-sky="ready"` and so fades the layers in) and then re-draws it on each of the globe's
 * frames; `drawWithoutGlobe` draws it once when no globe will ever mount. Each takes the caller's
 * own elements and signal, so the hero passes a signal it never aborts and the deck aborts its on
 * `destroy()`.
 */
import { startRotation } from "./globe-zones";
import { mountSky, type Sky, type SkyMap } from "./sky";

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
export interface SkyInputs {
  /** The two canvases and the element that carries `data-sky="ready"`. */
  stars: HTMLCanvasElement;
  band: HTMLCanvasElement;
  host: HTMLElement;
  /** The star list (`hero-sky.bin`) and, optionally, the Milky Way map. */
  src: string;
  milkyWay?: string | undefined;
  signal: AbortSignal;
}

/** The part of a globe the sky follows. */
export interface SkyGlobe {
  getRotation(): readonly [number, number];
  getZoom(): number;
  getCentre(): { x: number; y: number; radius: number };
  onFrame(callback: () => void): void;
}

/** The Milky Way map's pixels, or undefined when it cannot load: the sky then draws the stars alone. */
export async function loadMilkyWay(
  src: string | undefined,
): Promise<SkyMap | undefined> {
  if (!src) return undefined;
  try {
    const response = await fetch(src);
    if (!response.ok) return undefined;
    /* The map's bytes are brightness, not colour, so no colour space may change them. */
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
 * Fetches the star list and the Milky Way and builds the sky; the first draw waits for the globe
 * (`followGlobe`) or for `drawWithoutGlobe`. Resolves null when the list or the canvas fails: the
 * page does not depend on the sky.
 */
export async function loadSky(inputs: SkyInputs): Promise<Sky | null> {
  const { stars, band, host, src, milkyWay, signal } = inputs;
  try {
    const [response, map, time] = await Promise.all([
      fetch(src),
      loadMilkyWay(milkyWay),
      loadClock(),
    ]);
    if (!response.ok || signal.aborted) return null;
    const data = await response.arrayBuffer();
    return mountSky({
      stars,
      band,
      host,
      data,
      milkyWay: map,
      signal,
      rotation: startRotation(time.getSystemTimeZone()),
      now: time.getUnixNow,
    });
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
  const follow = (): void => {
    if (signal.aborted) return;
    const from = origin.getBoundingClientRect();
    const box = surface.getBoundingClientRect();
    const centre = globe.getCentre();
    sky.view(
      globe.getRotation(),
      {
        x: centre.x + box.left - from.left,
        y: centre.y + box.top - from.top,
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
