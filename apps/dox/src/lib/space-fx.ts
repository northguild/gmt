/**
 * The landing sky's one moving thing: a rare, faint meteor.
 *
 * A meteor is a short straight streak on a small canvas that fills the hero. It is rare (about one
 * a minute at most), brief (a third to a half of a second) and never over the copy, an open zone
 * drawer or the Earth. Frames are requested only while one is alive; between meteors the canvas is
 * clear and nothing runs but one `setTimeout`. No meteor falls when nobody sees it: the tab is
 * hidden, the hero is off screen, or the reader asked for reduced motion.
 *
 * The wait between meteors is exponential (a Poisson process), mean 45 s, held to 20 to 120 s.
 */

export interface SpaceFxOptions {
  canvas: HTMLCanvasElement;
  /** Aborting clears every timer, frame, listener and observer. */
  signal: AbortSignal;
  /** The boxes a meteor must not cross, in viewport pixels: the copy column, the open zone
   *  drawer and the Earth's bounding box. */
  avoid: () => DOMRect[];
  /** Injected for tests; `Math.random` otherwise. */
  random?: () => number;
  /** Injected for tests; `performance.now` otherwise. */
  now?: () => number;
}

/** Mean wait between meteors, in ms. */
const MEAN_WAIT = 45_000;
const MIN_WAIT = 20_000;
const MAX_WAIT = 120_000;

/** Extra wait before the first meteor, so none crosses the entrance. */
const FIRST_DELAY = 8_000;

/** Start points tried before giving up on a meteor. */
const TRIES = 8;

const LIFE = [350, 550] as const;
const LENGTH = [70, 140] as const;
const SLOPE = [15, 40] as const;

/** The streak is at its longest at mid-life. The head leads it along the path. */
const TRAVEL = 1.6;

interface Meteor {
  /** The streak's start, canvas pixels. */
  x: number;
  y: number;
  /** Unit direction along the path. */
  dx: number;
  dy: number;
  length: number;
  life: number;
  born: number;
}

const between = (range: readonly [number, number], r: number): number =>
  range[0] + (range[1] - range[0]) * r;

/** Distance of the head along the path, and the streak's length behind it, at `t` in 0..1. */
const headAt = (m: Meteor, t: number): number => m.length * TRAVEL * t;
const streakAt = (m: Meteor, t: number): number =>
  m.length * Math.sin(Math.PI * t);

/** The nearest and farthest points (along the path) any pixel of the streak reaches. */
function extent(m: Meteor): [number, number] {
  let low = 0;
  let high = 0;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    low = Math.min(low, headAt(m, t) - streakAt(m, t));
    high = Math.max(high, headAt(m, t));
  }
  return [low, high];
}

/** Whether the segment (`ax`,`ay`)-(`bx`,`by`) touches the rectangle (slab method). */
function crosses(
  [ax, ay, bx, by]: [number, number, number, number],
  r: { left: number; top: number; right: number; bottom: number },
): boolean {
  let enter = 0;
  let leave = 1;
  for (const [from, delta, low, high] of [
    [ax, bx - ax, r.left, r.right],
    [ay, by - ay, r.top, r.bottom],
  ] as const) {
    if (delta === 0) {
      if (from < low || from > high) return false;
      continue;
    }
    let a = (low - from) / delta;
    let b = (high - from) / delta;
    if (a > b) [a, b] = [b, a];
    enter = Math.max(enter, a);
    leave = Math.min(leave, b);
    if (enter > leave) return false;
  }
  return true;
}

export function mountSpaceFx(options: SpaceFxOptions): void {
  const { canvas, signal, avoid } = options;
  const random = options.random ?? Math.random;
  const now = options.now ?? (() => performance.now());
  const ctx = canvas.getContext("2d");
  if (!ctx || signal.aborted) return;

  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  let inView = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;
  let meteor: Meteor | undefined;
  let first = true;
  /** The `--gmt-ice` token, read once per meteor. */
  let ice = "currentColor";

  const eligible = (): boolean =>
    !document.hidden && inView && reduced?.matches !== true;

  const clear = (): void => ctx.clearRect(0, 0, canvas.width, canvas.height);

  const stopMeteor = (): void => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    meteor = undefined;
    clear();
  };

  const stopTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  /** A path that misses every avoided box and stays on the canvas, or `undefined`. */
  const place = (): Meteor | undefined => {
    const box = canvas.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return undefined;
    const keepOut = avoid().map((r) => ({
      left: r.left - box.left,
      top: r.top - box.top,
      right: r.right - box.left,
      bottom: r.bottom - box.top,
    }));
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const length = between(LENGTH, random());
      const slope = (between(SLOPE, random()) * Math.PI) / 180;
      const side = random() < 0.5 ? -1 : 1;
      const candidate: Meteor = {
        x: random() * box.width,
        y: random() * box.height,
        dx: side * Math.cos(slope),
        dy: Math.sin(slope),
        length,
        life: between(LIFE, random()),
        born: 0,
      };
      const [low, high] = extent(candidate);
      const path: [number, number, number, number] = [
        candidate.x + candidate.dx * low,
        candidate.y + candidate.dy * low,
        candidate.x + candidate.dx * high,
        candidate.y + candidate.dy * high,
      ];
      const onCanvas =
        [path[0], path[2]].every((x) => x >= 0 && x <= box.width) &&
        [path[1], path[3]].every((y) => y >= 0 && y <= box.height);
      if (onCanvas && !keepOut.some((r) => crosses(path, r))) return candidate;
    }
    return undefined;
  };

  const draw = (): void => {
    if (!meteor) return;
    const t = Math.min(1, (now() - meteor.born) / meteor.life);
    if (t >= 1) {
      stopMeteor();
      schedule();
      return;
    }
    const head = headAt(meteor, t);
    const tail = head - streakAt(meteor, t);
    const hx = meteor.x + meteor.dx * head;
    const hy = meteor.y + meteor.dy * head;
    const tx = meteor.x + meteor.dx * tail;
    const ty = meteor.y + meteor.dy * tail;
    clear();
    const fade = ctx.createLinearGradient(tx, ty, hx, hy);
    fade.addColorStop(0, `color-mix(in srgb, ${ice} 0%, transparent)`);
    fade.addColorStop(1, `color-mix(in srgb, ${ice} 45%, transparent)`);
    ctx.lineCap = "round";
    ctx.lineWidth = 1;
    ctx.strokeStyle = fade;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = ice;
    ctx.fillRect(hx - 0.5, hy - 0.5, 1, 1);
    frame = requestAnimationFrame(draw);
  };

  const launch = (): void => {
    timer = undefined;
    if (!eligible()) return;
    const box = canvas.getBoundingClientRect();
    /* DPR 1: the canvas holds one pixel per CSS pixel, however sharp the screen. */
    if (canvas.width !== Math.round(box.width))
      canvas.width = Math.round(box.width);
    if (canvas.height !== Math.round(box.height))
      canvas.height = Math.round(box.height);
    const placed = place();
    if (!placed) {
      schedule();
      return;
    }
    ice =
      getComputedStyle(canvas).getPropertyValue("--gmt-ice").trim() ||
      "currentColor";
    meteor = { ...placed, born: now() };
    frame = requestAnimationFrame(draw);
  };

  /** One `setTimeout` at a time, never while a meteor lives or when nobody would see one. */
  function schedule(): void {
    stopTimer();
    if (meteor || !eligible()) return;
    const wait = clampWait(-Math.log(1 - random()) * MEAN_WAIT);
    timer = setTimeout(launch, wait + (first ? FIRST_DELAY : 0));
    first = false;
  }

  /** The reader or the page changed what is seen: stop what is running and start again to match. */
  const refresh = (): void => {
    if (eligible()) {
      if (!meteor && timer === undefined) schedule();
    } else {
      stopTimer();
      stopMeteor();
    }
  };

  const observer =
    typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver((entries) => {
          const last = entries[entries.length - 1];
          if (!last) return;
          inView = last.isIntersecting;
          refresh();
        });
  /* The canvas fills the hero, so it is in view exactly when the hero is. */
  observer?.observe(canvas);
  document.addEventListener("visibilitychange", refresh, { signal });
  reduced?.addEventListener("change", refresh, { signal });
  signal.addEventListener(
    "abort",
    () => {
      observer?.disconnect();
      stopTimer();
      stopMeteor();
    },
    { once: true },
  );

  schedule();
}

const clampWait = (ms: number): number =>
  Math.min(MAX_WAIT, Math.max(MIN_WAIT, ms));
