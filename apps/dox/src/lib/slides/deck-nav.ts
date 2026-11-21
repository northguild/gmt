/**
 * How the deck's state reaches the page: the shown slide, the revealed builds, the buttons and the
 * address. The state lives in the controller (`deck.ts`); the kit's carousel only shows the slide
 * and draws the pager. `apply` is the single path from a changed state to the page.
 *
 * A change of slide runs as a view transition (`deck-transition.ts`); a build or a cut runs
 * through it too, in order. A slide that has not been reached stays in the layout but is neither
 * seen nor reachable (`inert`). The address is read back, a link or the owner's own edit of the
 * fragment, and one that names a slide out of reach is put back to the slide shown.
 */
import {
  markQuietFocus,
  wireCarousel,
  type CarouselBy,
  type CarouselHandle,
} from "~/widgets/builders/carousel";
import { formatHash, parseHash, type Deck, type DeckSlide } from "./deck";
import type { DeckPart } from "./deck-parts";
import { createDeckTransition } from "./deck-transition";

interface DeckNav {
  readonly carousel: CarouselHandle;
  /** Moves the page to the deck's state after the controller changed it. */
  apply(): void;
  /** Shows the builds the state has reached and settles the address, once the mount is ready. */
  start(): void;
}

export function mountDeckNav(o: {
  doc: Document;
  win: Window;
  root: HTMLElement;
  signal: AbortSignal;
  deck: Deck;
  parts: readonly DeckPart[];
  slides: readonly DeckSlide[];
  stage: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  dots: HTMLElement;
  live: HTMLElement;
  /** "Slide 3 of 21: title". */
  textFor: (index: number) => string;
  /** Tells the stage and the presenter where the deck is, after a change. */
  follow: () => void;
  /** True while a dialog covers the stage: no transition then. */
  covered: () => boolean;
}): DeckNav {
  const { doc, win, root, signal, deck, parts } = o;

  /** A build not yet reached stays in the layout but is neither seen nor reachable. */
  const showBuilds = (): void => {
    const { slide, build } = deck.state;
    parts.forEach((p, i) => {
      for (const b of p.builds) {
        const reached = i < slide || (i === slide && b.n <= build);
        b.el.dataset.reached = String(reached);
        b.el.inert = !reached;
      }
    });
  };
  const writeHash = (): void => {
    const hash = formatHash(deck.state, o.slides);
    if (win.location.hash !== hash)
      win.history.replaceState(
        win.history.state,
        "",
        `${win.location.pathname}${win.location.search}${hash}`,
      );
  };
  const settleAddress = (): void => {
    if (parseHash(win.location.hash, o.slides).slide >= deck.reach) writeHash();
  };
  /** The shown slide's layout, on the root, so the deck's sheet can style the stage around it. */
  const markLayout = (): void => {
    root.dataset.shownLayout = parts[deck.state.slide]?.el.dataset.layout ?? "";
  };
  /** The page follows the state: the builds, the address, the stage, the presenter. */
  const follow = (): void => {
    showBuilds();
    writeHash();
    o.follow();
  };

  const visual = createDeckTransition({
    doc,
    signal,
    reduced: () =>
      win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    covered: o.covered,
  });

  const carousel = wireCarousel(o.stage, {
    signal,
    pages: parts.map((p) => ({ el: p.el, label: p.title, spare: p.spare })),
    prev: o.prev,
    next: o.next,
    dots: o.dots,
    live: o.live,
    label: "Slides",
    idPrefix: "deck",
    start: deck.state.slide,
    reach: () => deck.reach,
    neighbour: (from, delta) => deck.neighbour(from, delta),
    steps: {
      count: (i) => o.slides[i].builds,
      current: () => deck.state.build,
      // A build is no transition, but it keeps its place in line behind a slide change.
      step: (delta) => {
        const changed = deck.stepBuild(delta);
        if (changed) visual.run(follow);
        return changed;
      },
    },
    announce: (_label, i) => o.textFor(i),
    // The deck's state moves at once; the page follows inside the transition.
    transition: (commit, { from, to, by }) => {
      if (by !== "api") deck.goTo(to, to < from ? "all" : 0);
      visual.run(commit, to > from ? "forward" : "back");
    },
    onSelect: (_index, _previous, by: CarouselBy) => {
      markLayout();
      if (by !== "api") follow();
    },
  });
  markLayout();

  // A slide rings only when the reader Tabs to it. Focus that comes any other way is quiet until
  // the slide loses it: the browser focuses the slide an address names, after this mount has run.
  let tabbing = false;
  doc.addEventListener(
    "keydown",
    (event) => {
      tabbing = event.key === "Tab";
    },
    { capture: true, signal },
  );
  doc.addEventListener(
    "focusin",
    (event) => {
      const slide = parts.find((p) => p.el === event.target)?.el;
      if (slide && !tabbing) markQuietFocus(slide);
      tabbing = false;
    },
    { capture: true, signal },
  );

  const apply = (): void => {
    carousel.select(deck.state.slide, "api");
    visual.run(() => {
      carousel.refresh();
      follow();
    });
  };
  // The address read back: a link or the owner's own edit of the fragment.
  win.addEventListener(
    "hashchange",
    () => {
      if (deck.goToHash(win.location.hash)) apply();
      else settleAddress();
    },
    { signal },
  );
  signal.addEventListener(
    "abort",
    () => {
      for (const p of parts)
        for (const b of p.builds) {
          delete b.el.dataset.reached;
          b.el.inert = false;
        }
    },
    { once: true },
  );

  return {
    carousel,
    apply,
    start() {
      showBuilds();
      settleAddress();
    },
  };
}
