/**
 * What the presenter view shows of the deck: the current slide and its builds, the next slide,
 * the notes and the position line. The slides are rendered on the page as a hidden source
 * (`[data-presenter-source]`, from `Deck.astro`); this copies the current slide and its notes out
 * of it, without ids.
 */
import type { DeckPart } from "./deck-parts";
import type { PresenterElements } from "./presenter-elements";

/** A copy of `part`'s slide with no ids, notes, wall figures or scripts: safe beside the source. */
function slideCopy(part: DeckPart): HTMLElement {
  const copy = part.el.cloneNode(true) as HTMLElement;
  for (const gone of copy.querySelectorAll(
    "[data-notes], [data-wall-figures], script, link",
  ))
    gone.remove();
  for (const el of [
    copy,
    ...copy.querySelectorAll<HTMLElement>("[id], [aria-labelledby]"),
  ]) {
    el.removeAttribute("id");
    el.removeAttribute("aria-labelledby");
  }
  return copy;
}

/** The speaker notes as nodes: the notes' own heading is dropped, the page has one. */
function notesCopy(part: DeckPart): Node[] {
  const notes = part.el.querySelector<HTMLElement>("[data-notes]");
  if (!notes) return [];
  const copy = notes.cloneNode(true) as HTMLElement;
  copy.querySelector("h3")?.remove();
  for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
  return Array.from(copy.childNodes);
}

/** Shows slide `slide` at `build`; the slide, notes and next slide are redrawn only when it changes. */
export function createSlideView(
  parts: readonly DeckPart[],
  els: Pick<
    PresenterElements,
    "stage" | "position" | "notes" | "nextTitle" | "nextBuild"
  >,
): (shown: { slide: number; build: number; blanked: boolean }) => void {
  const { stage, position, notes, nextTitle, nextBuild } = els;
  let shownSlide = -1;
  return ({ slide, build, blanked }) => {
    const part = parts[slide];
    if (!part) return;
    if (slide !== shownSlide) {
      shownSlide = slide;
      stage.replaceChildren(slideCopy(part));
      notes.replaceChildren(...notesCopy(part));
      if (!notes.hasChildNodes())
        notes.textContent = "No notes for this slide.";
      const after = parts[slide + 1];
      if (after) {
        nextTitle.textContent = after.title;
        const first = after.builds[0]?.el.textContent
          ?.replace(/\s+/g, " ")
          .trim();
        nextBuild.textContent = first || "No builds on that slide.";
      } else {
        nextTitle.textContent = "End of the deck";
        nextBuild.textContent = "";
      }
    }
    const copies = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-build]"),
    );
    copies.forEach((el, i) => {
      const reached = (part.builds[i]?.n ?? 1) <= build;
      el.dataset["reached"] = String(reached);
      el.inert = !reached;
    });
    position.textContent =
      `Slide ${slide + 1} of ${parts.length}: ${part.title}` +
      (part.buildCount > 0 ? `, build ${build} of ${part.buildCount}` : "") +
      (blanked ? ", screen blanked" : "");
  };
}
