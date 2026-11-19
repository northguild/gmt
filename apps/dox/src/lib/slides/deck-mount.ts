/**
 * The deck's DOM side: reads the slides, builds and notes from the page (`deck-parts.ts`) and
 * drives them with the pure controller (`deck.ts`), the keys (`keys.ts`) and the kit's carousel.
 * This module is the core: it finds the page's parts and composes one module for each feature.
 *
 * - `deck-nav.ts`: the state's way to the page (the carousel, builds, address, transition);
 * - `deck-stage-follow.ts`: tells the space stage where the camera belongs;
 * - `deck-dialogs.ts`: the overview, the keys and the unlock dialog;
 * - `deck-lock.ts`, `deck-blank.ts`, `deck-fullscreen.ts`: the menu's tools;
 * - `deck-presenter-link.ts`: the presenter window.
 *
 * `html[data-deck]` is `wait` (or `wait-hash`) from the head script until this mount runs, then `stage`. Without
 * JavaScript the mark is never set and the page is a stacked article (`slides.css`).
 *
 * The space stage (`stage.ts`) is told where the camera belongs on every change of state: the
 * place of the highest build reached that names one, else the slide's own. The overview dialog
 * lights the whole route while it is open; W A S D, Q E and R reach the stage through the keys.
 *
 * This window is the presenter's one source of truth; `T` opens the presenter. Until this browser
 * has unlocked the slides, the deck reaches its first slide alone: the keys, the overview, the
 * address and the presenter all stop there.
 *
 * Seam for the live agents (slice 4b): `setDemo` publishes which demo runs and whether it plays
 * live or from its recording; the presenter shows it.
 */
import { createDeck, parseHash } from "./deck";
import { mountDeckBlank } from "./deck-blank";
import { mountDeckDialogs } from "./deck-dialogs";
import { mountDeckFullscreen } from "./deck-fullscreen";
import { mountDeckLock } from "./deck-lock";
import { createDeckMoves } from "./deck-moves";
import { createDeckMenu, wireDeckTools } from "./deck-menu";
import { mountDeckNav } from "./deck-nav";
import {
  deckSlides,
  readDeckFrame,
  readDeckParts,
  slideTextFor,
} from "./deck-parts";
import { mountPresenterLink } from "./deck-presenter-link";
import { followStage } from "./deck-stage-follow";
import { mountKeys } from "./keys";
import type { SpaceStage } from "./stage";
import { mountDeckStage } from "./stage-deferred";
import type { DemoState } from "./sync";
import { readUnlocked } from "./unlock";

export interface DeckHandle {
  /** The shown slide (zero-based) and how many of its builds are shown. */
  readonly state: { slide: number; build: number };
  /** Whether the stage is blanked. */
  readonly blanked: boolean;
  /** Tells the presenter which demo runs and where its answers come from; `null` when none does. */
  setDemo(demo: DemoState): void;
  destroy(): void;
}

const MARK = "deck";

/** Wires the deck under `root`. Returns `null`, leaving the article as it is, when it cannot. */
export function mountDeck(
  root: HTMLElement,
  o: {
    signal: AbortSignal;
    /** The space stage's constructor; a test passes a fake. */
    space?: (root: HTMLElement, o: { signal: AbortSignal }) => SpaceStage;
  },
): DeckHandle | null {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const html = doc.documentElement;
  const frame = readDeckFrame(root);
  const parts = readDeckParts(root);
  if (!win || !frame || parts.length < 2 || o.signal.aborted) {
    if (html.dataset[MARK]?.startsWith("wait")) delete html.dataset[MARK];
    return null;
  }
  const { live } = frame;

  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);
  const slides = deckSlides(parts);
  const textFor = slideTextFor(parts);
  const deck = createDeck(
    slides,
    parseHash(win.location.hash, slides),
    readUnlocked(win) ? slides.length : 1,
  );
  const space = (o.space ?? mountDeckStage)(root, { signal });

  const menu = createDeckMenu(root);
  const blank = mountDeckBlank({
    root,
    signal,
    layer: root.querySelector<HTMLElement>("[data-deck-blank]"),
    button: root.querySelector<HTMLButtonElement>("#deck-blank"),
    live,
    restored: () => textFor(deck.state.slide),
  });
  const fullscreen = mountDeckFullscreen({
    root,
    doc,
    signal,
    button: root.querySelector<HTMLButtonElement>("#deck-fullscreen"),
    live,
  });
  const dialogs = mountDeckDialogs({
    doc,
    scope: root,
    signal,
    names: ["overview", "help", "unlock"],
    slide: () => deck.state.slide,
    onGoto: (id) => {
      blank.set(false);
      if (deck.goToId(id)) nav.apply();
    },
    opener: menu.opener,
  });
  dialogs.listen("overview", {
    open: () => space.overview(true),
    close: () => space.overview(false),
  });
  /** The overview lists the slides in reach. */
  const fillOverview = (): void =>
    dialogs.fillOverview(parts.slice(0, deck.reach));
  fillOverview();

  /** Tells the presenter window the state; set once the channel is open. */
  let publish: () => void = () => {};
  const flyToState = followStage({
    root,
    parts,
    space,
    state: () => deck.state,
  });
  const nav = mountDeckNav({
    doc,
    win,
    root,
    signal,
    deck,
    parts,
    slides,
    ...frame,
    textFor,
    follow: () => {
      flyToState(true);
      publish();
    },
    covered: dialogs.anyOpen,
  });

  const { moves, fromPresenter } = createDeckMoves({
    deck,
    carousel: nav.carousel,
    apply: nav.apply,
    blank,
    space,
  });

  mountDeckLock({
    root,
    win,
    signal,
    dialogs,
    total: parts.length,
    reach: () => deck.reach,
    // Opens every slide, or only the first, and moves the stage back to the first when it was past it.
    setReach: (open) => {
      const before = deck.state;
      deck.setReach(open ? parts.length : 1);
      fillOverview();
      const after = deck.state;
      if (after.slide !== before.slide || after.build !== before.build)
        nav.apply();
      else nav.carousel.refresh();
    },
    closeMenu: menu.close,
    live,
  });

  const link = mountPresenterLink({
    root,
    win,
    signal,
    slug: root.dataset["deckSlug"] ?? "",
    state: () => deck.state,
    blanked: () => blank.on,
    fullscreen: fullscreen.active,
    step: fromPresenter,
  });
  publish = link.publish;

  wireDeckTools({ root, signal, menu, dialogs, blank, fullscreen });

  mountKeys(doc, {
    signal,
    actions: {
      ...moves,
      overview: () => dialogs.open("overview"),
      help: () => dialogs.open("help"),
      fullscreen: fullscreen.toggle,
      present: () => {
        blank.set(false);
        fullscreen.enter();
      },
      presenter: link.open,
      fly: (vector) => space.steer(vector),
    },
  });

  nav.start();
  flyToState(false);
  html.dataset[MARK] = "stage";
  signal.addEventListener(
    "abort",
    () => {
      delete html.dataset[MARK];
      dialogs.closeAll();
    },
    { once: true },
  );

  return {
    get state() {
      return deck.state;
    },
    get blanked() {
      return blank.on;
    },
    setDemo: link.setDemo,
    destroy: () => own.abort(),
  };
}
