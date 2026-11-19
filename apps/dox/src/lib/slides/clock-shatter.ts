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
 */
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

const SEED = hashSeed("earth-clock");

/** The cells the dial breaks into: the same every time. */
export const shatterCells = (): Cell[] => cells(SEED, SHARD_COUNT);

const num = (n: number): string => String(Number(n.toFixed(4)));
const pct = (n: number): string => `${num(n * 100)}%`;

/** A cell as a CSS `clip-path`, in percentages of the dial's box. */
export function shardClip(cell: Cell): string {
  return `polygon(${cell.poly.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(", ")})`;
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

/**
 * Breaks `dial` (the clock's `<svg>`) into shards inside `into`, which covers it, and plays the
 * break when the browser animates. The dial itself is left for the caller to hide; its `<defs>`
 * stay in it, so the copies, which drop theirs, still find their gradients.
 */
export function shatter(dial: SVGSVGElement, into: HTMLElement): void {
  const doc = into.ownerDocument;
  const size = into.getBoundingClientRect().width;
  into.style.perspective = `${num(size * PERSPECTIVE)}px`;
  for (const cell of shatterCells()) {
    const shard = doc.createElement("div");
    shard.setAttribute("data-shard", "");
    shard.style.clipPath = shardClip(cell);
    shard.style.transformOrigin = `${pct(cell.centroid[0])} ${pct(cell.centroid[1])}`;
    const copy = dial.cloneNode(true) as SVGSVGElement;
    copy.querySelector("defs")?.remove();
    shard.append(copy, crack(doc, cell));
    into.append(shard);
    if (typeof shard.animate !== "function") continue;
    shard.animate(shardKeyframes(cell, size), {
      delay: CRACK_HOLD_MS,
      duration: FADE_END_MS,
      fill: "both",
    });
    shard.lastElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: CRACK_HOLD_MS,
      easing: "ease-out",
      fill: "both",
    });
  }
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
