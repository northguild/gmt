/**
 * Names in the landing sky: a pointer over bare sky near a body of `SKY_BODIES` (the Sun, the
 * Moon, a planet) shows its name in a small glass label above it, and a planet's name says so
 * ("Mars · Planet"). A mouse names what is within 12 px of the pointer; a touch, what is within
 * 28 px of the tap, and the name stays until the next tap. The label follows its body as the sky
 * turns, on the globe's own frames, and goes when the body does.
 *
 * Only what the sky draws is named: a planet the layer leaves out (too faint, or not loaded yet),
 * a body wholly behind the Earth, and a planet behind the Moon are not. Bare sky is the hero and
 * the globe's layers, outside the Earth's disc; the copy, the controls and the drawer are not.
 * The label is decorative (`aria-hidden`): the Look at bar names the same bodies to every reader.
 * With forced colours the sky is not drawn, so nothing is named.
 */
import styles from "~/widgets/tools/sky-names.module.css";
import { aimLens, bodyAt, type AimFrame, type CameraView } from "./sky-aim";
import { pointSource, SKY_BODIES, type SkyBodyId } from "./sky-registry";

/** What the names ask of the globe: a `GlobeHost` serves. */
export interface SkyNamesEngine {
  getView(): CameraView;
  /** The Earth on screen, in the surface's pixels. */
  getCentre(): { x: number; y: number; radius: number };
  onFrame(callback: () => void): void;
}

interface SkyNamesOptions {
  engine: SkyNamesEngine;
  /** The hero: the label lives in it, so it keeps the hero's theme. */
  hero: HTMLElement;
  /** The element the engine's pixels are measured in. */
  surface: HTMLElement;
  /** The hero's frame (`heroAimFrame`); only its size and shift are read. */
  frame: () => AimFrame;
  /** The instant the sky shows, epoch milliseconds. */
  now: () => number;
  signal: AbortSignal;
}

export interface SkyNames {
  /** Take the label away (the reader is working the globe). */
  hide(): void;
}

/** How far from a body the pointer may be and still name it, px: a mouse is exact, a finger is not. */
const REACH = { mouse: 12, other: 28 } as const;
/** A label closer than this to the window's top sits below its body. */
const TOP_ROOM = 48;
/** A label keeps this far inside the window's sides, px. */
const SIDE = 4;

interface Seen {
  id: SkyBodyId;
  /** In the window's pixels. */
  x: number;
  y: number;
  r: number;
}

export function mountSkyNames(options: SkyNamesOptions): SkyNames {
  const { engine, hero, surface, frame, now, signal } = options;
  const doc = hero.ownerDocument;
  const view = doc.defaultView;
  const tip = doc.createElement("div");
  tip.className = styles.tip!;
  tip.setAttribute("aria-hidden", "true");
  tip.dataset["gate"] = "sky-name";
  tip.hidden = true;
  hero.append(tip);
  /* In the top layer, like the globe's card (`globe.ts`), so no transform or clip of the hero's moves it. */
  if (typeof tip.showPopover === "function") {
    tip.popover = "manual";
    tip.showPopover();
  }
  signal.addEventListener("abort", () => tip.remove(), { once: true });

  const forced = (): boolean =>
    view?.matchMedia?.("(forced-colors: active)").matches ?? false;
  const bareSky = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    hero.contains(target) &&
    (target === hero ||
      target.matches('[data-space], [data-gate="globe-hit"]'));

  /** Every body the sky draws now, in the window's pixels, Sun and Moon first. */
  function visible(): Seen[] {
    const at = now();
    const camera = engine.getView();
    const box = frame();
    const lens = aimLens(camera, box);
    const page = surface.getBoundingClientRect();
    const [left, top] = [page.left - box.shift.x, page.top - box.shift.y];
    const earth = engine.getCentre();
    const [ex, ey] = [page.left + earth.x, page.top + earth.y];
    const drawn = new Set(
      pointSource()
        ?.drawn(at, camera.rotation)
        .map(({ id }) => id),
    );
    const seen: Seen[] = [];
    let moon: Seen | undefined;
    for (const row of SKY_BODIES) {
      if (row.kind === "point" && !drawn.has(row.id)) continue;
      const disc = bodyAt(row.id, at, lens, camera.zoom);
      if (!disc) continue;
      const body = { id: row.id, x: left + disc.x, y: top + disc.y, r: disc.r };
      /* Every body is farther than the Earth, and every planet farther than the Moon. */
      if (Math.hypot(body.x - ex, body.y - ey) + body.r <= earth.radius)
        continue;
      if (moon && Math.hypot(body.x - moon.x, body.y - moon.y) <= moon.r)
        continue;
      if (row.id === "moon") moon = body;
      seen.push(body);
    }
    return seen;
  }

  /** The body nearest the pointer within `reach` of its disc. A later row wins a tie, so the Moon wins over the Sun it covers. */
  function nearest(x: number, y: number, reach: number): Seen | null {
    let best: Seen | null = null;
    let gap = reach;
    for (const body of visible()) {
      const off = Math.max(0, Math.hypot(body.x - x, body.y - y) - body.r);
      if (off <= gap) [best, gap] = [body, off];
    }
    return best;
  }

  let naming: SkyBodyId | null = null;

  function place(body: Seen): void {
    const half = tip.offsetWidth / 2 + SIDE;
    const width = doc.documentElement.clientWidth;
    const below = body.y - body.r < TOP_ROOM;
    tip.style.left = `${Math.min(Math.max(body.x, half), width - half)}px`;
    tip.style.top = `${below ? body.y + body.r : body.y - body.r}px`;
    tip.toggleAttribute("data-below", below);
  }

  function show(body: Seen | null): void {
    if (!body) return hide();
    if (body.id !== naming) {
      naming = body.id;
      const row = SKY_BODIES.find(({ id }) => id === body.id)!;
      const note = doc.createElement("span");
      note.textContent = "Planet";
      tip.replaceChildren(row.name, ...(row.kind === "point" ? [note] : []));
      tip.hidden = false;
      /* A new name plays the site's entrance again. */
      tip.classList.remove("gmt-enter");
      void tip.offsetWidth;
      tip.classList.add("gmt-enter");
    }
    place(body);
  }

  function hide(): void {
    if (naming === null) return;
    naming = null;
    tip.hidden = true;
    tip.classList.remove("gmt-enter");
  }

  function pick(event: PointerEvent): void {
    if (forced() || !bareSky(event.target)) return hide();
    const reach = event.pointerType === "mouse" ? REACH.mouse : REACH.other;
    show(nearest(event.clientX, event.clientY, reach));
  }

  doc.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      /* A drag works the globe; the name waits for the pointer to come to rest. */
      if (event.buttons !== 0) return hide();
      pick(event);
    },
    { passive: true, signal },
  );
  doc.addEventListener("pointerdown", pick, { passive: true, signal });
  /* A touch "leaves" as the finger lifts, just after its tap; its name stays until the next tap. */
  doc.documentElement.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType !== "touch") hide();
    },
    { signal },
  );
  /* The label is placed in the window's pixels, so a scroll would leave it behind. */
  view?.addEventListener("scroll", hide, { passive: true, signal });

  engine.onFrame(() => {
    if (naming === null || signal.aborted) return;
    show(visible().find(({ id }) => id === naming) ?? null);
  });

  return { hide };
}
