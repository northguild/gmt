/**
 * The presenter view's DOM side: the second window on the laptop while the deck runs on the
 * projector. It shows the current slide and its builds, the next slide, the notes, the time since
 * the talk started against the plan, the pace, the local time, the demo's source and the readiness
 * check.
 *
 * The deck window is the one source of truth (`sync.ts`). The presenter never changes its own
 * state while a deck window answers: a key, button or overview link posts a `step`, and the next
 * `state` it hears is what it renders. With no deck window it works as a notes reader and steps
 * through its own copy of the state machine (`deck.ts`).
 *
 * This module is the core: the state, the sync, the stepping, the buttons and the keys. Each
 * feature is its own module:
 * - `presenter-elements.ts`: finds the page's parts;
 * - `presenter-page.ts`: the slide, notes, next slide and position line;
 * - `presenter-clock.ts`: the time, the pace, Start and Reset;
 * - `presenter-readiness.ts`: the readiness check;
 * - `deck-dialogs.ts`: the overview and the keys, the same two the deck has.
 *
 * Seconds are never announced. The pace readout announces when it crosses between behind and not
 * behind; the demo readout announces when it switches to `Recorded`.
 */
import { PRESENTER_INITIAL } from "~/widgets/builders/presenter";
import { defineElements } from "~/widgets/define";
import { createDeck } from "./deck";
import { mountDeckDialogs } from "./deck-dialogs";
import { deckSlides, readDeckParts } from "./deck-parts";
import { mountKeys } from "./keys";
import { mountPresenterClock } from "./presenter-clock";
import { findPresenterElements } from "./presenter-elements";
import { createSlideView } from "./presenter-page";
import { mountPresenterReadiness } from "./presenter-readiness";
import {
  openSync,
  type DeckEnv,
  type DemoState,
  type StepAction,
} from "./sync";

/** How long the presenter waits for a deck window to answer `hello` before it says none is open. */
export const DECK_GRACE_MS = 600;

export interface PresenterHandle {
  /** The slide shown and how many builds, wherever they came from. */
  readonly state: { slide: number; build: number };
  /** Whether a deck window is answering. */
  readonly connected: boolean;
  destroy(): void;
}

/** Wires the presenter view under `root`. Returns `null` when the page lacks the parts. */
export function mountPresenter(
  root: HTMLElement,
  o: {
    signal: AbortSignal;
    slug: string;
    /** The deck page's address, read for its preloads. */
    deckUrl: string;
    /** The address of `/api/brains`. */
    brainsUrl: string;
  },
): PresenterHandle | null {
  defineElements();
  const doc = root.ownerDocument;
  const els = findPresenterElements(root);
  const parts = els ? readDeckParts(els.source) : [];
  if (!doc.defaultView || !els || parts.length < 2 || o.signal.aborted)
    return null;

  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);
  const slides = deckSlides(parts);
  const local = createDeck(slides);

  // What the deck window last said, or nothing yet.
  let connected = false;
  let remote = { slide: 0, build: 0 };
  let blanked = false;
  let demo: DemoState = null;
  let env: DeckEnv | null = null;

  const current = (): { slide: number; build: number } =>
    connected ? remote : local.state;

  // The line the page speaks has two parts, so a readiness result does not wipe out the news
  // about the deck window, and the other way round.
  let note = "";
  let checkNote = "";
  const speak = (): void => {
    els.status.textContent = [note, checkNote].filter(Boolean).join(". ");
  };
  const say = (text: string): void => {
    note = text;
    speak();
  };

  const clock = mountPresenterClock({
    doc,
    signal,
    els,
    plan: parts,
    slide: () => current().slide,
    begun: () => current().slide > 0 || current().build > 0,
    say,
  });
  const showSlide = createSlideView(parts, els);

  const render = (): void => {
    const { slide, build } = current();
    if (!parts[slide]) return;
    showSlide({ slide, build, blanked });
    if (slide > 0 || build > 0) clock.start();
    clock.paint();
  };

  const showDemo = (next: DemoState): void => {
    const before = demo?.source;
    demo = next;
    if (!next) els.demoOut.setEmpty(PRESENTER_INITIAL.demo);
    else
      els.demoOut.value =
        next.source === "live"
          ? "Live"
          : next.source === "recorded"
            ? "Recorded"
            : "Waiting";
    if (next?.source === "recorded" && before !== "recorded")
      els.demoOut.announce();
  };

  // ---- Sync ----
  const link = openSync(o.slug, {
    signal,
    onMessage(message) {
      if (message.type === "state") {
        const first = !connected;
        connected = true;
        remote = { slide: message.slide, build: message.build };
        blanked = message.blanked;
        env = message.env;
        showDemo(message.demo);
        if (first) say("Deck window connected");
        render();
      } else if (message.type === "bye" && connected) {
        connected = false;
        // Carry on from where the deck stopped.
        local.goTo(remote.slide, remote.build);
        say("Deck window closed: stepping here only");
        render();
      }
    },
  });
  if (!link)
    say("This browser cannot reach the deck window: stepping here only");

  const stepLocally: Record<StepAction, (n?: number) => boolean> = {
    next: () => local.next(),
    prev: () => local.prev(),
    nextSlide: () => local.nextSlide(),
    prevSlide: () => local.prevSlide(),
    first: () => local.first(),
    last: () => local.last(),
    goTo: (n) => local.goTo((n ?? 1) - 1),
    blank: () => {
      blanked = !blanked;
      return true;
    },
    home: () => false,
  };

  const step = (action: StepAction, n?: number): void => {
    if (connected && link) {
      link.post(
        n === undefined
          ? { type: "step", action }
          : { type: "step", action, n },
      );
      return;
    }
    if (stepLocally[action](n)) render();
  };

  const readiness = mountPresenterReadiness({
    doc,
    signal,
    slug: o.slug,
    deckUrl: o.deckUrl,
    brainsUrl: o.brainsUrl,
    rows: els.rows,
    button: els.checkButton,
    env: () => env,
    report: (text) => {
      checkNote = text;
      speak();
    },
  });

  // The deck gets a moment to answer `hello`; then the presenter says whether one did.
  const grace = setTimeout(() => {
    if (!connected) say("Deck window not open: stepping here only");
    readiness.run();
  }, DECK_GRACE_MS);
  signal.addEventListener("abort", () => clearTimeout(grace), { once: true });
  link?.post({ type: "hello" });

  // ---- Buttons ----
  const click = (selector: string, fn: () => void): void =>
    root.querySelector(selector)?.addEventListener("click", fn, { signal });
  click("#pv-prev", () => step("prev"));
  click("#pv-next", () => step("next"));
  click("#pv-blank", () => step("blank"));

  // ---- Dialogs ----
  const dialogs = mountDeckDialogs({
    doc,
    scope: doc,
    signal,
    names: ["overview", "help"],
    slide: () => current().slide,
    onGoto: (id) => {
      const index = slides.findIndex((s) => s.id === id);
      if (index >= 0) step("goTo", index + 1);
    },
  });
  dialogs.fillOverview(parts);
  click("#pv-overview", () => dialogs.open("overview"));
  click("#pv-help", () => dialogs.open("help"));

  // ---- Keys: the deck's table, sending steps; a clicker works in either window ----
  const deckOnly = (): void => say("That is for the deck window");
  mountKeys(doc, {
    signal,
    actions: {
      step: (delta) => step(delta === 1 ? "next" : "prev"),
      slide: (delta) => step(delta === 1 ? "nextSlide" : "prevSlide"),
      first: () => step("first"),
      last: () => step("last"),
      goTo: (n) => step("goTo", n),
      overview: () => dialogs.open("overview"),
      help: () => dialogs.open("help"),
      blank: () => step("blank"),
      fullscreen: deckOnly,
      present: deckOnly,
      presenter: () => say("This is the presenter view"),
      fly: () => {},
      home: () => step("home"),
    },
  });

  render();
  signal.addEventListener("abort", dialogs.closeAll, { once: true });

  return {
    get state() {
      const { slide, build } = current();
      return { slide, build };
    },
    get connected() {
      return connected;
    },
    destroy: () => own.abort(),
  };
}
