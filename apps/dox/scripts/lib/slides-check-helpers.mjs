/**
 * The pure parts of the slide-deck gate (`scripts/slides-check.mjs`): which routes it checks, the
 * walk a reader takes through a deck, and the box comparisons. No browser, so each is unit-tested
 * (`slides-check.test.ts`).
 */

/** The local-storage entry and value that unlock every slide (`src/lib/slides/unlock.ts`). */
export const DECK_UNLOCK = { key: "gmt-slides-unlocked", value: "yes" };

/**
 * Unlocks the decks for every page a browser context (or one page) opens, before its scripts run,
 * so a gate can walk past the first slide.
 *
 * @param {{ addInitScript: (script: (u: typeof DECK_UNLOCK) => void, arg: typeof DECK_UNLOCK) => Promise<void> }} target
 */
export function unlockDecks(target) {
  return target.addInitScript((u) => {
    try {
      localStorage.setItem(u.key, u.value);
    } catch {
      // Storage the page cannot write: the deck stays locked and the gate says where it stopped.
    }
  }, DECK_UNLOCK);
}

/** The site path of each deck, from the folder names under the built `slides/` (each deck's
 * presenter view sits inside its own folder). */
export function deckRoutes(folders) {
  return [...folders].sort().map((name) => `/slides/${name}/`);
}

/**
 * Every state a reader reaches by pressing next from the first slide, as hashes and as
 * `{ slide, build }`. A slide with builds shows build 0, then 1..n, before the next slide.
 *
 * @param {{ id: string, builds: number }[]} slides
 */
export function forwardWalk(slides) {
  const states = [];
  for (const [slide, s] of slides.entries()) {
    for (let build = 0; build <= s.builds; build += 1)
      states.push({
        slide,
        build,
        hash: build === 0 ? `#${s.id}` : `#${s.id}/${build}`,
      });
  }
  return states;
}

/** The walk back from the last state: the same states in reverse. */
export function backwardWalk(slides) {
  return forwardWalk(slides).reverse();
}

/** Whether `box` lies inside `outer`, to `tolerance` px. Boxes are `{ x, y, width, height }`. */
export function insideBox(box, outer, tolerance = 1) {
  return (
    box.x >= outer.x - tolerance &&
    box.y >= outer.y - tolerance &&
    box.x + box.width <= outer.x + outer.width + tolerance &&
    box.y + box.height <= outer.y + outer.height + tolerance
  );
}

/** Whether two boxes have the same position and size, to `tolerance` px. */
export function sameBox(a, b, tolerance = 0.5) {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

/** Whether the stage is 16:9 to a pixel of rounding. */
export function isSixteenByNine(box, tolerance = 1.5) {
  return Math.abs(box.width / 16 - box.height / 9) <= tolerance / 9;
}

/** The budget for frames while the camera flies: the median, and the worst frame, in ms. */
const FRAME_BUDGET = { median: 17.5, worst: 34 };

/** A `"lng lat"` pair as numbers, or null when it is not one. */
export function parsePair(text) {
  const m = /^(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)$/.exec(text ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** The great-circle distance in degrees between two `[lng, lat]` points in degrees. */
export function angularDistance(a, b) {
  const rad = Math.PI / 180;
  const [lng1, lat1] = [a[0] * rad, a[1] * rad];
  const [lng2, lat2] = [b[0] * rad, b[1] * rad];
  const cos =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

/** Median and worst of a list of frame times (ms); zeros for an empty list. */
export function frameStats(deltas) {
  if (deltas.length === 0) return { count: 0, median: 0, worst: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { count: sorted.length, median, worst: sorted[sorted.length - 1] };
}

/** How many times the step that holds a tour's worst frame is flown again before that frame counts. */
const REFLIGHTS = 3;

/**
 * What is wrong with a tour's frame times against the budget, or null when nothing is. The median is
 * the tour's own. The worst frame is a single `requestAnimationFrame` gap in a long tour, so one pause
 * on the runner can put it over: when it is, `refly` flies the step it fell in again and resolves to
 * that flight's frame times, up to `tries` times, and the worst frame counts only if a flight goes over
 * again. A slow frame that comes back on the same step comes from the deck; one that does not, from
 * the runner. A flight that draws no frame cannot clear it.
 */
export async function frameVerdict(
  deltas,
  refly,
  { budget = FRAME_BUDGET, tries = REFLIGHTS } = {},
) {
  const stats = frameStats(deltas);
  if (stats.count === 0) return "no frame was drawn while the camera flew";
  const over = [];
  if (stats.median > budget.median)
    over.push(
      `the median frame took ${stats.median.toFixed(1)} ms, over ${budget.median}`,
    );
  if (stats.worst > budget.worst) {
    const worst = `the worst frame took ${stats.worst.toFixed(1)} ms, over ${budget.worst}`;
    for (let flight = 1; flight <= tries; flight += 1) {
      const again = frameStats(await refly());
      if (again.count === 0) {
        over.push(`${worst}, and flying that step again drew no frame`);
        break;
      }
      if (again.worst > budget.worst) {
        over.push(
          `${worst}, and ${again.worst.toFixed(1)} ms when that step was flown again (flight ${flight} of ${tries})`,
        );
        break;
      }
    }
  }
  return over.length ? over.join("; ") : null;
}

/** `"x,y x,y"` as `[[x, y], ...]`, or null when it is empty or not that shape. */
export function parseCentres(text) {
  const parts = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const centres = [];
  for (const part of parts) {
    const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(part);
    if (!m) return null;
    centres.push([Number(m[1]), Number(m[2])]);
  }
  return centres;
}

/** The mean `[r, g, b]` of an RGBA byte array (alpha ignored), or null for no pixels. */
export function meanColour(rgba) {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return null;
  const sum = [0, 0, 0];
  for (let i = 0; i < pixels; i++)
    for (let c = 0; c < 3; c++) sum[c] += rgba[i * 4 + c];
  return sum.map((v) => v / pixels);
}

/** The largest difference in any one channel between two `[r, g, b]` colours. */
export function colourDistance(a, b) {
  return Math.max(...a.map((v, i) => Math.abs(v - b[i])));
}

/** How far a drawn pane may be from its capture, per channel (0 to 255). */
const WALL_COLOUR_TOLERANCE = 48;

/**
 * The panes whose drawn centre does not match their capture. Each pair is `{ id, drawn, capture }`
 * with `[r, g, b]` colours; `drawn` is null for a centre that could not be read.
 */
export function wallMismatches(pairs, tolerance = WALL_COLOUR_TOLERANCE) {
  const bad = [];
  for (const { id, drawn, capture } of pairs) {
    if (!drawn || !capture) {
      bad.push({ id, why: "its centre could not be read" });
      continue;
    }
    const distance = colourDistance(drawn, capture);
    if (distance > tolerance)
      bad.push({
        id,
        why: `its centre is rgb(${drawn.map(Math.round).join(", ")}) against the capture's rgb(${capture.map(Math.round).join(", ")}), ${Math.round(distance)} apart, over ${tolerance}`,
      });
  }
  return bad;
}

/** How far, in CSS pixels, a pane may be drawn from the centre of its caption's figure. */
const PANE_PLACE_TOLERANCE = 1;

/**
 * The panes drawn away from their captions. `ids` names each pane; `drawn` is each pane's centre
 * where it lands on the page (the wall canvas's origin plus the centre the wall publishes) and
 * `boxes` each caption figure's centre, both `[x, y]` from the space layer's corner, in one order.
 */
export function paneOffsets(
  ids,
  drawn,
  boxes,
  tolerance = PANE_PLACE_TOLERANCE,
) {
  const bad = [];
  ids.forEach((id, i) => {
    const d = drawn[i];
    const b = boxes[i];
    if (!d || !b) {
      bad.push({ id, why: "its pane or its caption could not be measured" });
      return;
    }
    const dx = d[0] - b[0];
    const dy = d[1] - b[1];
    if (Math.abs(dx) > tolerance || Math.abs(dy) > tolerance)
      bad.push({
        id,
        why: `it is drawn ${dx.toFixed(1)} px across and ${dy.toFixed(1)} px down from its caption's figure, over ${tolerance}`,
      });
  });
  return bad;
}

/**
 * The deck's layers that have a margin. Each row is `{ name, margins }`, the four computed margins
 * in px. A layer placed by inset and measured from its parent's corner must have none: Starlight's
 * flow rule gives an element after a sibling a top margin, which moved the wall off its captions.
 */
export function marginedLayers(rows) {
  return rows
    .filter((r) => r.margins.some((m) => m !== 0))
    .map((r) => `${r.name} has a margin of ${r.margins.join(" ")} px`);
}
