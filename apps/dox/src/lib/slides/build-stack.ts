/**
 * A step that adds to the one before it (`Stack.astro`): each build appears under the last, and
 * once the column runs past the slide's foot, it slides up until the newest reached piece ends
 * there. What leaves the top goes under the stack's clipped top edge (`data-shifted` while any
 * has), and a piece more than half gone fades out whole (`data-stack-gone`), so no strip of an
 * empty frame is left at the edge; the column then starts at the first piece still shown.
 * Stepping back slides it down again. The stack's own box ends at the foot (`--gmt-stack-room`).
 *
 * The deck marks each build reached or not (`deck-nav.ts`) before it announces the state, so the
 * shift is read from those marks on every `gmt-deck-state`, and again whenever the column or the
 * slide changes size (a window resize, a late font).
 */
import { onDeckState } from "./deck-state";

/** The room under the stack's top edge: down to the slide's padding at its foot. */
function room(stack: HTMLElement, win: Window): number {
  const slide = stack.closest<HTMLElement>("[data-slide]");
  if (!slide) return Number.POSITIVE_INFINITY;
  const foot = Number.parseFloat(win.getComputedStyle(slide).paddingBlockEnd);
  return (
    slide.getBoundingClientRect().bottom -
    (Number.isFinite(foot) ? foot : 0) -
    stack.getBoundingClientRect().top
  );
}

const pieces = (track: HTMLElement): HTMLElement[] =>
  Array.from(track.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );

/** Where the newest reached piece ends, from the column's top (unmoved by the shift). */
function reachedEnd(track: HTMLElement): number {
  const last = pieces(track)
    .filter((c) => c.dataset["reached"] !== "false")
    .at(-1);
  return last ? last.offsetTop + last.offsetHeight : 0;
}

/** Whether less than half of `piece` is left under the top edge once the column is up `shift`. */
const gone = (piece: HTMLElement, shift: number): boolean =>
  piece.offsetTop + piece.offsetHeight - shift < piece.offsetHeight / 2;

/**
 * The column goes up just far enough for the newest reached piece to end at the foot; when that
 * leaves a piece more than half gone, it goes on up to the first piece still shown, so no empty
 * band is left where the faded ones were.
 */
function settle(stack: HTMLElement, track: HTMLElement, win: Window): void {
  const space = room(stack, win);
  if (Number.isFinite(space))
    stack.style.setProperty("--gmt-stack-room", `${space}px`);
  const least = Math.max(0, reachedEnd(track) - space);
  const kept = pieces(track).find((piece) => !gone(piece, least));
  const shift = Math.max(least, kept?.offsetTop ?? 0);
  track.style.setProperty("--gmt-stack-shift", `${-shift}px`);
  stack.toggleAttribute("data-shifted", shift > 0);
  for (const piece of pieces(track)) {
    piece.toggleAttribute("data-stack-gone", gone(piece, shift));
  }
}

/** Slides each stack under `root` to its reached builds, until `signal` aborts. */
export function mountBuildStacks(
  root: HTMLElement,
  o: { signal: AbortSignal; win: Window },
): void {
  const stacks = Array.from(
    root.querySelectorAll<HTMLElement>("[data-stack]"),
  ).flatMap((stack) => {
    const track = stack.querySelector<HTMLElement>("[data-stack-track]");
    return track ? [{ stack, track }] : [];
  });
  if (stacks.length === 0) return;
  const settleAll = (): void => {
    for (const { stack, track } of stacks) settle(stack, track, o.win);
  };
  onDeckState(root, o.signal, settleAll);
  if (typeof ResizeObserver === "undefined") return;
  const resized = new ResizeObserver(settleAll);
  for (const { stack, track } of stacks) {
    resized.observe(track);
    const slide = stack.closest("[data-slide]");
    if (slide) resized.observe(slide);
  }
  o.signal.addEventListener("abort", () => resized.disconnect(), {
    once: true,
  });
}
