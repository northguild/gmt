/**
 * What a move does, once, for every way to ask for it. A key (`keys.ts`) and a step the presenter
 * sends (`sync.ts`) reach the same moves: any move first brings a blanked stage back, and goes no
 * further.
 */
import type { CarouselHandle } from "~/widgets/builders/carousel";
import type { Deck } from "./deck";
import type { DeckBlank } from "./deck-blank";
import type { DeckKeyActions } from "./keys";
import type { SpaceStage } from "./stage";
import type { StepMessage } from "./sync";

type DeckMoves = Pick<
  DeckKeyActions,
  "step" | "slide" | "first" | "last" | "goTo" | "blank" | "home"
>;

export function createDeckMoves(o: {
  deck: Deck;
  carousel: CarouselHandle;
  /** Moves the page to the deck's state after the controller changed it. */
  apply: () => void;
  blank: DeckBlank;
  space: SpaceStage;
}): {
  moves: DeckMoves;
  /** Runs one step the presenter sent. */
  fromPresenter: (message: StepMessage) => void;
} {
  const { deck, carousel, blank } = o;
  const move = (change: () => boolean): void => {
    if (blank.on) blank.set(false);
    else if (change()) o.apply();
  };
  const moves: DeckMoves = {
    // The carousel owns the build-before-slide order, and its buttons stay in step.
    step: (delta) =>
      blank.on ? blank.set(false) : carousel.step(delta, "key"),
    slide: (delta) =>
      move(() => (delta === 1 ? deck.nextSlide() : deck.prevSlide())),
    first: () => move(() => deck.first()),
    last: () => move(() => deck.last()),
    goTo: (n) => move(() => deck.goTo(n - 1)),
    blank: () => blank.set(!blank.on),
    home: () => o.space.returnHome(),
  };
  const fromPresenter = (message: StepMessage): void => {
    if (blank.on && message.action !== "blank") return blank.set(false);
    const steps: Record<StepMessage["action"], () => void> = {
      next: () => moves.step(1),
      prev: () => moves.step(-1),
      nextSlide: () => moves.slide(1),
      prevSlide: () => moves.slide(-1),
      first: moves.first,
      last: moves.last,
      goTo: () => moves.goTo(message.n ?? 1),
      blank: moves.blank,
      home: moves.home,
    };
    steps[message.action]();
  };
  return { moves, fromPresenter };
}
