/**
 * Wires the landing hero's night sky (`HeroSpace.astro`) to the page and to the Earth.
 *
 * The hero opens as plain void: the sky draws nothing until it is true. `startHeroSky` runs with
 * the page and only fetches the star list and the Milky Way map. `followGlobe` runs when the globe has mounted and
 * measured: it draws the sky once from the globe's rotation, the Earth's centre and the clock
 * (which marks the hero `data-sky="ready"` and so fades the layers in), then keeps it following
 * the globe's frames (`sky.view`, so the sky has no loop of its own) and starts the rare meteor.
 * If the globe fails to mount, `skyWithoutGlobe` draws once at the start rotation and the anchor.
 */
import { startRotation } from "./globe-zones";
import { runHeroEntrance } from "./hero-entrance";
import { mountSky, type Sky, type SkyMap } from "./sky";
import { mountSpaceFx } from "./space-fx";
import type { GlobeHost } from "./globe";

type Clock = {
  getUnixNow: typeof import("@northguild/gmt/unix/get").getUnixNow;
  getSystemTimeZone: typeof import("@northguild/gmt/zoned/get").getSystemTimeZone;
};

let clock: Promise<Clock> | undefined;

/* Dynamic, so the Temporal polyfill behind these two stays out of the static first-paint graph. */
const loadClock = (): Promise<Clock> =>
  (clock ??= Promise.all([
    import("@northguild/gmt/unix/get"),
    import("@northguild/gmt/zoned/get"),
  ]).then(([unix, zoned]) => ({
    getUnixNow: unix.getUnixNow,
    getSystemTimeZone: zoned.getSystemTimeZone,
  })));

/** From the followGlobe call to a sky fully in: the entrance's latest start plus its fade. */
const SKY_IN_MS = 2900;

/** The sky of each hero, once its first draw is done; null if the list or the canvas failed. */
const skies = new WeakMap<HTMLElement, Promise<Sky | null>>();

/** The globe of each hero: offered once it has mounted, or `null` if it never will. */
const globes = new WeakMap<
  HTMLElement,
  {
    promise: Promise<GlobeHost | null>;
    offer: (globe: GlobeHost | null) => void;
  }
>();

function globeSlot(hero: HTMLElement) {
  let slot = globes.get(hero);
  if (!slot) {
    let offer: (globe: GlobeHost | null) => void = () => {};
    const promise = new Promise<GlobeHost | null>(
      (resolve) => (offer = resolve),
    );
    slot = { promise, offer };
    globes.set(hero, slot);
  }
  return slot;
}

/** The hero's globe has mounted (or failed to, with `null`); the entrance can wait on it. */
export function offerGlobe(hero: HTMLElement, globe: GlobeHost | null): void {
  globeSlot(hero).offer(globe);
}

/**
 * Starts the hero's entrance sequence (`hero-entrance.ts`): it begins when the sky has drawn
 * and the globe is ready to dawn, or at the deadline, and the globe's dawn starts with it.
 * The page calls this as it loads; the globe mounts later and is handed over by `offerGlobe`.
 */
export function startHeroEntrance(
  hero: HTMLElement,
  signal: AbortSignal,
): void {
  const root = hero.querySelector<HTMLElement>("[data-hero-sky]");
  const slot = globeSlot(hero);
  runHeroEntrance({
    sky: {
      ready: root
        ? (skies.get(root) ?? Promise.resolve(null)).then((sky) => sky?.ready)
        : Promise.resolve(),
    },
    globe: {
      ready: slot.promise.then((globe) => globe?.dawnReady),
      /* A globe still mounting at `t0` dawns as soon as it can. */
      startDawn: () => {
        void slot.promise.then(async (globe) => {
          if (!globe || signal.aborted) return;
          await globe.dawnReady;
          if (!signal.aborted) void globe.startDawn();
        });
      },
    },
    signal,
  });
}

const canvasOf = (root: HTMLElement, which: string): HTMLCanvasElement | null =>
  root.querySelector<HTMLCanvasElement>(`[data-sky-canvas="${which}"]`);

/** The hero that holds the sky and the globe. */
export const heroOf = (element: Element): HTMLElement | null =>
  element.closest<HTMLElement>('[data-gate="hero-stage"]');

/** The Milky Way map's pixels, or undefined when it cannot load: the sky then draws the stars alone. */
async function loadMilkyWay(
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

/** Fetches the star list and the Milky Way; the first draw waits for the globe (or for `skyWithoutGlobe`). */
export function startHeroSky(root: HTMLElement): void {
  if (skies.has(root)) return;
  const stars = canvasOf(root, "stars");
  const band = canvasOf(root, "band");
  const host = root.parentElement;
  const src = root.dataset["src"];
  if (!stars || !band || !host || !src) return;

  const sky = (async (): Promise<Sky | null> => {
    try {
      const [response, milkyWay, time] = await Promise.all([
        fetch(src),
        loadMilkyWay(root.dataset["milkyWay"]),
        loadClock(),
      ]);
      if (!response.ok) return null;
      const data = await response.arrayBuffer();
      const sky = mountSky({
        stars,
        band,
        host,
        data,
        milkyWay,
        signal: new AbortController().signal,
        rotation: startRotation(time.getSystemTimeZone()),
        now: time.getUnixNow,
      });
      return sky;
    } catch {
      /* A sky that cannot load leaves the plain void: the page does not depend on it. */
      return null;
    }
  })();
  skies.set(root, sky);
}

/** The globe could not mount: draw the sky once at the start rotation, at the anchor. */
export async function skyWithoutGlobe(root: HTMLElement): Promise<void> {
  const hero = heroOf(root);
  const sky = hero
    ? await skies.get(hero.querySelector("[data-hero-sky]")!)
    : null;
  if (!sky || hero?.dataset["sky"] === "ready") return;
  const time = await loadClock();
  sky.view(startRotation(time.getSystemTimeZone()), null, time.getUnixNow());
}

/**
 * Draws the sky for the globe's first camera, makes it follow the Earth's camera and the clock, and starts the meteor. The meteor keeps clear of the copy
 * column, an open zone drawer and the Earth's box.
 */
export async function followGlobe(
  hero: HTMLElement,
  globe: GlobeHost,
  stage: HTMLElement,
  surface: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const root = hero.querySelector<HTMLElement>("[data-hero-sky]");
  if (!root) return;
  const sky = await skies.get(root);
  if (signal.aborted) return;
  if (sky) {
    const time = await loadClock();
    if (signal.aborted) return;
    const follow = (): void => {
      /* The globe reports the Earth's centre in its surface's pixels; the sky wants the hero's. */
      const origin = hero.getBoundingClientRect();
      const box = surface.getBoundingClientRect();
      const centre = globe.getCentre();
      sky.view(
        globe.getRotation(),
        {
          x: centre.x + box.left - origin.left,
          y: centre.y + box.top - origin.top,
          radius: centre.radius,
        },
        time.getUnixNow(),
        globe.getZoom(),
      );
    };
    /* The first draw does not wait for a globe frame. */
    follow();
    globe.onFrame(follow);
  }

  /* The meteor waits for the sky to be revealed, and for the entrance to have brought it in. */
  if (hero.dataset["sky"] !== "ready") return;
  const entrance = document.documentElement.dataset["entrance"];
  if (entrance === "wait" || entrance === "run") {
    await new Promise<void>((resolve) => setTimeout(resolve, SKY_IN_MS));
  }
  if (signal.aborted) return;
  const meteor = canvasOf(root, "meteor");
  if (!meteor) return;
  const copy = hero.querySelector<HTMLElement>('[data-gate="hero-copy"]');
  mountSpaceFx({
    canvas: meteor,
    signal,
    avoid: () => {
      const drawer = hero.querySelector<HTMLElement>(
        '[data-drawer][data-open="true"]',
      );
      return [copy, drawer, stage]
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => el.getBoundingClientRect());
    },
  });
}
