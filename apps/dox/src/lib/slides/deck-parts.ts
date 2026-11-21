/**
 * The slides as the page holds them: `Deck.astro`, `Slide.astro` and `Build.astro` are the one
 * source, and both the deck window (`deck-mount.ts`) and the presenter view (`presenter.ts`) read
 * them back from the DOM with `readDeckParts`.
 */
import type { DeckSlide } from "./deck";

export interface DeckPart {
  el: HTMLElement;
  id: string;
  title: string;
  minutes: number | null;
  /** A spare, for questions after `thanks`: no minutes, reached by Next from the last slide. */
  spare: boolean;
  /** Each `[data-build]` and the build number that reveals it. */
  builds: { el: HTMLElement; n: number }[];
  /** The most builds the slide has: the highest build number. */
  buildCount: number;
}

/** Every `[data-slide]` under `root`, in order. */
export function readDeckParts(root: ParentNode): DeckPart[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-slide]")).map(
    (el, i) => {
      const minutes = Number(el.dataset["minutes"]);
      const builds = Array.from(
        el.querySelectorAll<HTMLElement>("[data-build]"),
      ).map((b) => ({ el: b, n: Number(b.dataset["build"]) || 1 }));
      return {
        el,
        id: el.id || String(i),
        title: el.querySelector("h2")?.textContent?.trim() || el.id,
        minutes:
          Number.isFinite(minutes) && el.dataset["minutes"] ? minutes : null,
        spare: el.hasAttribute("data-spare"),
        builds,
        buildCount: builds.reduce((max, b) => Math.max(max, b.n), 0),
      };
    },
  );
}

/** What the controller (`deck.ts`) needs of each part. */
export const deckSlides = (parts: readonly DeckPart[]): DeckSlide[] =>
  parts.map((p) => ({ id: p.id, builds: p.buildCount, spare: p.spare }));

/** The deck's frame: the stage, the pager's two buttons and dots, and the live region; or `null`. */
export function readDeckFrame(root: HTMLElement): {
  stage: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  dots: HTMLElement;
  live: HTMLElement;
} | null {
  const stage = root.querySelector<HTMLElement>("[data-deck-stage]");
  const prev = root.querySelector<HTMLButtonElement>('[data-deck-step="-1"]');
  const next = root.querySelector<HTMLButtonElement>('[data-deck-step="1"]');
  const dots = root.querySelector<HTMLElement>("[data-deck-dots]");
  const live = root.querySelector<HTMLElement>("[data-deck-live]");
  return stage && prev && next && dots && live
    ? { stage, prev, next, dots, live }
    : null;
}

/** "Slide 3 of 21: title" for a main slide, "Spare 1 of 2: title" for a spare. */
export function slideTextFor(
  parts: readonly DeckPart[],
): (index: number) => string {
  const main = parts.filter((p) => !p.spare).length;
  const spares = parts.length - main;
  return (i) =>
    parts[i].spare
      ? `Spare ${i + 1 - main} of ${spares}: ${parts[i].title}`
      : `Slide ${i + 1} of ${main}: ${parts[i].title}`;
}
