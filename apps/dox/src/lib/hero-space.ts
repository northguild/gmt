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
import { runHeroEntrance } from "./hero-entrance";
import type { Sky } from "./sky";
import {
  drawWithoutGlobe,
  followGlobe as followSky,
  loadSky,
  skyInputsOf,
} from "./space-sky";
import { mountSpaceFx } from "./space-fx";
import type { GlobeHost } from "./globe";
import type { AimFrame } from "./sky-aim";

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

/**
 * The boxes the meteor and the sky view keep clear of, in viewport pixels: the copy, an open zone
 * drawer, and whatever else the caller names (the meteor adds the Earth's stage, the view the
 * zoom stack). On the stacked landing the copy column is `display: contents` and has no box: its
 * cells (the intro, the buttons, the pages) are laid out in the hero's grid, so each is a box.
 */
function heroAvoidRects(
  hero: HTMLElement,
  ...extra: (Element | null)[]
): DOMRect[] {
  const copy = hero.querySelector('[data-gate="hero-copy"]');
  const cells =
    copy && getComputedStyle(copy).display === "contents"
      ? [...copy.children]
      : [copy];
  const drawer = hero.querySelector('[data-drawer][data-open="true"]');
  return [...cells, drawer, ...extra]
    .filter((el): el is Element => el !== null)
    .map((el) => el.getBoundingClientRect());
}

/**
 * What the sky view aims into, in the pixels of the Earth's area (the hero's `[data-space]`):
 * its size, the globe surface's place in it, and `heroAvoidRects` in it. Side by side the area is
 * the hero right of the copy, under the header; stacked it is the row under the buttons, which
 * ends at the fold, so a body is never put down the page under the pages.
 */
export function heroAimFrame(
  hero: HTMLElement,
  surface: HTMLElement,
  ...extra: (Element | null)[]
): AimFrame {
  const box = (
    hero.querySelector(":scope > [data-space]") ?? hero
  ).getBoundingClientRect();
  const at = surface.getBoundingClientRect();
  return {
    width: box.width,
    height: box.height,
    shift: { x: at.left - box.left, y: at.top - box.top },
    rects: heroAvoidRects(hero, ...extra).map((r) => ({
      left: r.left - box.left,
      top: r.top - box.top,
      right: r.right - box.left,
      bottom: r.bottom - box.top,
    })),
  };
}

/** Fetches the star list and the Milky Way; the first draw waits for the globe (or for `skyWithoutGlobe`). */
export function startHeroSky(root: HTMLElement): void {
  if (skies.has(root)) return;
  const host = root.parentElement;
  /* The landing's sky lives as long as the page, so its signal is never aborted. */
  const inputs = host && skyInputsOf(root, host, new AbortController().signal);
  if (inputs) skies.set(root, loadSky(inputs));
}

/** The globe could not mount: draw the sky once at the start rotation, at the anchor. */
export async function skyWithoutGlobe(root: HTMLElement): Promise<void> {
  const hero = heroOf(root);
  const sky = hero?.querySelector<HTMLElement>("[data-hero-sky]");
  if (!hero || !sky) return;
  await drawWithoutGlobe(skies.get(sky), hero, new AbortController().signal);
}

/**
 * Draws the sky for the globe's first camera (`space-sky.ts`), makes it follow the Earth's camera and the clock, and starts the meteor. The meteor keeps clear of the copy
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
  await followSky({
    sky: skies.get(root),
    globe,
    origin: hero,
    surface,
    signal,
  });
  if (signal.aborted) return;

  /* The meteor waits for the sky to be revealed, and for the entrance to have brought it in. */
  if (hero.dataset["sky"] !== "ready") return;
  const entrance = document.documentElement.dataset["entrance"];
  if (entrance === "wait" || entrance === "run") {
    await new Promise<void>((resolve) => setTimeout(resolve, SKY_IN_MS));
  }
  if (signal.aborted) return;
  const meteor = canvasOf(root, "meteor");
  if (!meteor) return;
  mountSpaceFx({
    canvas: meteor,
    signal,
    avoid: () => heroAvoidRects(hero, stage),
  });
}
