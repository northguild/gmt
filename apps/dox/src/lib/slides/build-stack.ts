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
import { drawnScale } from "~/lib/drawn-scale";
import { onDeckState } from "./deck-state";

/** The room under the stack's top edge: down to the slide's padding at its foot. */
function room(stack: HTMLElement, win: Window): number {
  const slide = stack.closest<HTMLElement>("[data-slide]");
  if (!slide) return Number.POSITIVE_INFINITY;
  const foot = Number.parseFloat(win.getComputedStyle(slide).paddingBlockEnd);
  const box = slide.getBoundingClientRect();
  // The boxes are drawn pixels and the pieces' offsets are layout pixels; a scaled stage (a phone,
  // `slides-phone.css`) makes them differ, so the room is turned back into layout pixels.
  const scale = drawnScale(slide, "block");
  return (
    (box.bottom - stack.getBoundingClientRect().top) / scale -
    (Number.isFinite(foot) ? foot : 0)
  );
}

const pieces = (track: HTMLElement): HTMLElement[] =>
  Array.from(track.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );

/** One piece of the column: its top from the column's top, its height, and whether it is reached. */
interface StackPiece {
  readonly top: number;
  readonly height: number;
  readonly reached: boolean;
}

/** Whether less than half of `piece` is left under the top edge once the column is up `shift`. */
const gone = (piece: StackPiece, shift: number): boolean =>
  piece.top + piece.height - shift < piece.height / 2;

/**
 * How far the column goes up with `room` px under its top edge, and which pieces fade out. It goes
 * up just far enough for the newest reached piece to end at the foot; when that leaves a piece
 * more than half gone, it goes on up to the first piece still shown, so no empty band is left
 * where the faded ones were.
 */
export function stackShift(
  column: readonly StackPiece[],
  room: number,
): { shift: number; gone: boolean[] } {
  const last = column.filter((piece) => piece.reached).at(-1);
  const least = Math.max(0, (last ? last.top + last.height : 0) - room);
  const kept = column.find((piece) => !gone(piece, least));
  const shift = Math.max(least, kept?.top ?? 0);
  return { shift, gone: column.map((piece) => gone(piece, shift)) };
}

/** Reads the column off the page, moves it, and marks what has left the top. */
function settle(stack: HTMLElement, track: HTMLElement, win: Window): void {
  const space = room(stack, win);
  if (Number.isFinite(space))
    stack.style.setProperty("--gmt-stack-room", `${space}px`);
  const els = pieces(track);
  const { shift, gone: faded } = stackShift(
    els.map((el) => ({
      top: el.offsetTop,
      height: el.offsetHeight,
      reached: el.dataset["reached"] !== "false",
    })),
    space,
  );
  track.style.setProperty("--gmt-stack-shift", `${-shift}px`);
  stack.toggleAttribute("data-shifted", shift > 0);
  els.forEach((el, i) => el.toggleAttribute("data-stack-gone", faded[i]!));
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
