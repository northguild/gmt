/**
 * The clock breaking away from in front of the Earth, the way the ice wall breaks (`ice-wall/`):
 * cracks run across the dial along a seeded Voronoi diagram (`cells`), and after `CRACK_HOLD_MS`
 * each shard flies out from the centre and towards the camera, turning, and fades by
 * `SHATTER_MS`, on the wall's own flight (`shardPose`). The cells crowd the middle, so the shards
 * round the hands are small and the ones at the rim large.
 *
 * Each shard is a copy of the dial clipped to its cell, so the hands, the date and the glow break
 * exactly as they stood, and the Web Animations API moves it on the compositor: one transform and
 * one opacity per shard, sampled from `shardPose`, with nothing to draw per frame. The keyframes
 * are pure (`shardKeyframes`), so the same break plays every time.
 *
 * A copy keeps only the parts of the dial that reach its cell (`leafBoxes`), in a box that is its
 * cell's box, not the dial's (`shardBox`). Twenty whole copies were 6,000 elements, styled on the
 * break's first frame and again on the next, when the wall's state changes on the layer above:
 * 30 ms each at 1280x720, over `frame-budget`.
 *
 * The copies go in a few a frame (`COPIES_PER_FRAME`), over the dial while it still shows, so no
 * one frame of the camera's flight clones and styles them all: twenty in one task were 40 ms of
 * script and 30 ms of style at four times CPU throttle. The cracks show at once; the dial hides
 * when the last copy is in (`broken`), and the shards fly what is left of the crack's hold later.
 */
import { afterFrames, type Frames } from "./frames";
import { FADE_END_MS, shardPose } from "./ice-wall/shards";
import { cells, hashSeed, type Cell } from "./ice-wall/voronoi";

/** The pieces the dial breaks into. */
export const SHARD_COUNT = 20;
/** The cracks show this long, the dial still whole, before the shards fly. */
export const CRACK_HOLD_MS = 140;
/** From the first crack until the last shard has faded. */
export const SHATTER_MS = CRACK_HOLD_MS + FADE_END_MS;
/** Keyframes sampled along each shard's flight; linear between them. */
const SAMPLES = 24;
/** The camera's distance for the shards' turn and lift, in dial widths. */
const PERSPECTIVE = 3;
/** The dial's rim as a share of its box: the cracks run inside it only (`earth-clock.ts`). */
const RIM_SHARE = 0.4;
/** The copies of the dial put in a frame: all twenty land well inside the crack's hold. */
const COPIES_PER_FRAME = 4;

const SEED = hashSeed("earth-clock");

/** The cells the dial breaks into: the same every time. */
export const shatterCells = (): Cell[] => cells(SEED, SHARD_COUNT);

const num = (n: number): string => String(Number(n.toFixed(4)));
const pct = (n: number): string => `${num(n * 100)}%`;

/** A cell's bounding box, as shares of the dial's box. */
interface ShardBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The smallest box round `cell`: a shard's box, so its layer holds that cell's pixels only. */
export function shardBox(cell: Cell): ShardBox {
  const xs = cell.poly.map(([x]) => x);
  const ys = cell.poly.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A cell as a CSS `clip-path`, in percentages of its own box (`shardBox`). */
export function shardClip(cell: Cell): string {
  const b = shardBox(cell);
  return `polygon(${cell.poly.map(([x, y]) => `${pct((x - b.x) / b.w)} ${pct((y - b.y) / b.h)}`).join(", ")})`;
}

/** How far past its cell's box a part may reach and still be kept: its shadow and its stroke. */
const KEEP_MARGIN = 0.02;

/** A part of the dial with no element inside it, by its place among the dial's elements. */
interface Leaf {
  index: number;
  box: ShardBox;
}

/**
 * Where a square drawing sits in a `w` by `h` box, centred and fitted (the `<svg>` default):
 * its left and top and its side, in pixels.
 */
export function drawnSquare(w: number, h: number): [number, number, number] {
  const side = Math.min(w, h);
  return [(w - side) / 2, (h - side) / 2, side];
}

/**
 * The dial's parts that draw, each with its box as shares of `into`'s box, where the copies draw
 * the dial: measured on the dial, as shares of its drawing, then placed in the copy's. None when
 * either has no size (not laid out), so every copy is kept whole.
 */
function leafBoxes(dial: SVGSVGElement, into: HTMLElement): Leaf[] {
  const from = dial.getBoundingClientRect();
  const to = into.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return [];
  const [fx, fy, fs] = drawnSquare(from.width, from.height);
  const [tx, ty, ts] = drawnSquare(to.width, to.height);
  const leaves: Leaf[] = [];
  dial.querySelectorAll("*").forEach((el, index) => {
    if (el.childElementCount > 0 || el.closest("defs")) return;
    const r = el.getBoundingClientRect();
    const u = (r.left - from.left - fx) / fs;
    const v = (r.top - from.top - fy) / fs;
    leaves.push({
      index,
      box: {
        x: (tx + u * ts) / to.width,
        y: (ty + v * ts) / to.height,
        w: (r.width / fs) * (ts / to.width),
        h: (r.height / fs) * (ts / to.height),
      },
    });
  });
  return leaves;
}

/** Whether a part's box reaches a shard's box, give or take `KEEP_MARGIN`. */
export function reaches(part: ShardBox, shard: ShardBox): boolean {
  const m = KEEP_MARGIN;
  return (
    part.x - m < shard.x + shard.w &&
    part.x + part.w + m > shard.x &&
    part.y - m < shard.y + shard.h &&
    part.y + part.h + m > shard.y
  );
}

/** Lays `el` out at the dial's size and place inside a shard whose box is `b`. */
function placeInShard(el: SVGSVGElement, b: ShardBox): void {
  el.style.left = pct(-b.x / b.w);
  el.style.top = pct(-b.y / b.h);
  el.style.width = pct(1 / b.w);
  el.style.height = pct(1 / b.h);
}

/**
 * A shard's flight as keyframes for a dial `size` pixels wide: out, towards the camera and turning
 * about its own centre, then faded. The first frame is the dial as it stood.
 */
export function shardKeyframes(cell: Cell, size: number): Keyframe[] {
  return Array.from({ length: SAMPLES + 1 }, (_, k) => {
    const pose = shardPose(cell, SEED, (k / SAMPLES) * FADE_END_MS);
    const [ax, ay, az] = pose.axis;
    return {
      offset: k / SAMPLES,
      opacity: num(pose.opacity),
      transform:
        `translate3d(${num(pose.dx * size)}px, ${num(pose.dy * size)}px, ${num(pose.dz * size)}px) ` +
        `rotate3d(${num(ax)}, ${num(ay)}, ${num(az)}, ${num(pose.angle)}rad)`,
    };
  });
}

/** How the break is driven: the frames its copies go in on, when to stop, and when it is whole. */
interface ShatterOptions {
  win: Pick<Frames, "requestAnimationFrame">;
  /** Aborted when the break is swept away: no copy goes in after it. */
  signal: AbortSignal;
  /** Called once every shard holds its copy: the caller hides the dial then. */
  broken(): void;
}

/**
 * Breaks `dial` (the clock's `<svg>`) into shards inside `into`, which covers it: the cracks at
 * once, the copies over the next frames, then the flight. The dial itself is left for the caller
 * to hide (`broken`); its `<defs>` stay in it, so the copies, which drop theirs, still find their
 * gradients.
 */
export function shatter(
  dial: SVGSVGElement,
  into: HTMLElement,
  o: ShatterOptions,
): void {
  const doc = into.ownerDocument;
  const clock = doc.defaultView?.performance ?? performance;
  const begun = clock.now();
  const size = into.getBoundingClientRect().width;
  into.style.perspective = `${num(size * PERSPECTIVE)}px`;
  const leaves = leafBoxes(dial, into);
  const shards = shatterCells().map((cell) => {
    const box = shardBox(cell);
    const shard = doc.createElement("div");
    shard.setAttribute("data-shard", "");
    shard.style.left = pct(box.x);
    shard.style.top = pct(box.y);
    shard.style.width = pct(box.w);
    shard.style.height = pct(box.h);
    shard.style.transformOrigin = `${pct((cell.centroid[0] - box.x) / box.w)} ${pct((cell.centroid[1] - box.y) / box.h)}`;
    // The cell's outline clips what the shard holds, not the shard: on the layer that moves, a
    // clip is a mask the compositor draws through on every frame, twenty of them as the shards
    // near the camera; inside it, it is painted into the layer once.
    const cut = doc.createElement("div");
    cut.setAttribute("data-shard-cut", "");
    cut.style.clipPath = shardClip(cell);
    const edge = crack(doc, cell);
    placeInShard(edge, box);
    cut.append(edge);
    shard.append(cut);
    into.append(shard);
    // Backwards only: once in, the crack is as it stands, with no animation left to keep it a
    // layer of its own inside the cut.
    if (typeof edge.animate === "function")
      edge.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: CRACK_HOLD_MS,
        easing: "ease-out",
        fill: "backwards",
      });
    return { cell, box, cut, shard };
  });

  let next = 0;
  const copyIn = (): void => {
    if (o.signal.aborted) return;
    const end = Math.min(next + COPIES_PER_FRAME, shards.length);
    for (; next < end; next++) {
      const { box, cut } = shards[next]!;
      const copy = dial.cloneNode(true) as SVGSVGElement;
      const parts = copy.querySelectorAll("*");
      for (const leaf of leaves)
        if (!reaches(leaf.box, box)) parts[leaf.index]?.remove();
      copy.querySelector("defs")?.remove();
      placeInShard(copy, box);
      // Under the crack, which stays on top.
      cut.prepend(copy);
    }
    if (next < shards.length) {
      afterFrames(o.win, 1, copyIn, o.signal);
      return;
    }
    o.broken();
    const delay = Math.max(0, CRACK_HOLD_MS - (clock.now() - begun));
    for (const { cell, shard } of shards)
      if (typeof shard.animate === "function")
        shard.animate(shardKeyframes(cell, size), {
          delay,
          duration: FADE_END_MS,
          fill: "both",
        });
  };
  copyIn();
}

/** The crack round one shard: its cell's edge, inside the dial's rim, moving with the shard. */
function crack(doc: Document, cell: Cell): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 1 1");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("data-crack", "");
  svg.style.clipPath = `circle(${pct(RIM_SHARE)} at 50% 50%)`;
  const edge = doc.createElementNS(ns, "polygon");
  edge.setAttribute(
    "points",
    cell.poly.map(([x, y]) => `${num(x)},${num(y)}`).join(" "),
  );
  svg.append(edge);
  return svg;
}
