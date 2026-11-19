/**
 * "Every filing" as pins. Each upstream filing lights up in the order it was filed while a count
 * runs up; a filing whose own data names a zone (`zone` in `upstream-filings.json`) lights a pin
 * there, and one without still adds to the count and is listed in the slide's legend.
 *
 * `planFilingPins` is pure. The slide carries the plan as data (`data-filing-steps`) so the stage
 * can read it without importing the data file, and `runCount` plays it.
 */

import { play, type Frames } from "./frames";
import { ROLL_MS } from "./type-out";

interface FilingInput {
  key: string;
  createdAt: string;
  zone?: string | undefined;
}

export interface FilingStep {
  key: string;
  /** The zone the filing names, or `null`. */
  zone: string | null;
}

interface FilingPinPlan {
  total: number;
  pinned: number;
  unpinned: number;
  /** In filing order, oldest first; a tie keeps the key order. */
  steps: readonly FilingStep[];
}

export function planFilingPins(list: readonly FilingInput[]): FilingPinPlan {
  const steps = [...list]
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key),
    )
    .map((f): FilingStep => ({ key: f.key, zone: f.zone ?? null }));
  const pinned = steps.filter((s) => s.zone !== null).length;
  return {
    total: steps.length,
    pinned,
    unpinned: steps.length - pinned,
    steps,
  };
}

/** How many filings sit at each zone once `n` steps have played. */
export function pinsAfter(
  steps: readonly FilingStep[],
  n: number,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const step of steps.slice(0, Math.max(0, n)))
    if (step.zone !== null)
      counts.set(step.zone, (counts.get(step.zone) ?? 0) + 1);
  return counts;
}

/** The steps as the slide stores them: `key|zone` pairs, `zone` empty for none, joined by `;`. */
export const encodeSteps = (steps: readonly FilingStep[]): string =>
  steps.map((s) => `${s.key}|${s.zone ?? ""}`).join(";");

export function decodeSteps(text: string): FilingStep[] {
  if (text === "") return [];
  return text.split(";").map((part) => {
    const cut = part.lastIndexOf("|");
    const zone = part.slice(cut + 1);
    return { key: part.slice(0, cut), zone: zone === "" ? null : zone };
  });
}

/** How long the count runs on stage: as long as a split-flap row takes to land (`ROLL_MS`). */
export const COUNT_MS = ROLL_MS;

/**
 * Plays the count: `onStep(n)` for n = 0 up to `total`, evenly over `COUNT_MS`. With `reduced` it
 * calls once with `total`. Returns a function that stops it.
 */
export function runCount(o: {
  total: number;
  win: Frames;
  reduced: boolean;
  onStep: (n: number) => void;
}): () => void {
  if (o.reduced) {
    o.onStep(o.total);
    return () => {};
  }
  let shown = -1;
  return play(o.win, COUNT_MS, (t) => {
    const next = t >= 1 ? o.total : Math.floor(t * o.total);
    if (next === shown) return;
    shown = next;
    o.onStep(next);
  });
}
