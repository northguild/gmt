/**
 * The deck's DOM side: reads the slides, builds and notes from the page (`Deck.astro`, `Slide.astro`,
 * `Build.astro` are the one source), and drives them with the pure controller (`deck.ts`), the
 * keys (`keys.ts`) and the kit's carousel (`widgets/builders/carousel.ts`).
 *
 * The deck's state lives in `deck.ts`; the carousel only shows the slide and draws the pager.
 * `apply` is the single path from a changed state to the page: the shown slide, the revealed
 * builds, the buttons and the address.
 *
 * `html[data-deck]` is `wait` (or `wait-hash`) from the head script until this mount runs, then `stage`. Without
 * JavaScript the mark is never set and the page is a stacked article (`slides.css`).
 *
 * The space stage (`stage.ts`) is told where the camera belongs on every change of state: the
 * place of the highest build reached that names one, else the slide's own. The overview dialog
 * lights the whole route while it is open; W A S D, Q E and R reach the stage through the keys.
 *
 * The presenter view (`presenter.ts`) is a second window on one `BroadcastChannel` (`sync.ts`).
 * This window is the one source of truth: it posts its state after every change (a step, the blank
 * layer, fullscreen, the globe's renderer, the reduced-motion setting, the demo's source), and runs
 * the steps the presenter posts through the same moves as the keys. `T` opens the presenter.
 *
 * The lock (`unlock.ts`): until this browser has unlocked the slides, the deck reaches its first
 * slide alone. The keys, the overview, the address and the presenter all stop there, and the
 * pager is hidden; the info menu's Unlock dialog takes the secret phrase, opens every slide and
 * keeps the unlock. The same menu item then reads Lock, with a shut padlock: one click hides every slide after the first
 * again, and forgets the unlock. An unlock or a lock in another tab reaches this one.
 *
 * Seam for the live agents (slice 4b): `setDemo` publishes which demo runs and whether it plays
 * live or from its recording; the presenter shows it.
 */
import { writeDeckState } from "./deck-state";
import { createDeckTransition } from "./deck-transition";
import {
  markQuietFocus,
  wireCarousel,
  type CarouselBy,
} from "~/widgets/builders/carousel";
import { overviewItems } from "~/widgets/builders/deck-controls";
import { setHtml } from "~/widgets/builders/html";
import { createDeck, formatHash, parseHash, type DeckSlide } from "./deck";
import { mountKeys } from "./keys";
import { mountSpaceStage, type SpaceStage } from "./stage";
import {
  mountDeckSync,
  PRESENTER_WINDOW,
  type DeckEnv,
  type DemoState,
  type StateMessage,
  type StepMessage,
} from "./sync";
import { withBase } from "~/lib/site";
import {
  forgetUnlocked,
  isUnlockPhrase,
  readUnlocked,
  UNLOCK_STORAGE_KEY,
  writeUnlocked,
} from "./unlock";

export interface DeckHandle {
  /** The shown slide (zero-based) and how many of its builds are shown. */
  readonly state: { slide: number; build: number };
  /** Whether the stage is blanked. */
  readonly blanked: boolean;
  /** Tells the presenter which demo runs and where its answers come from; `null` when none does. */
  setDemo(demo: DemoState): void;
  destroy(): void;
}

interface Part {
  el: HTMLElement;
  id: string;
  title: string;
  minutes: number | null;
  /** A spare, for questions after `thanks`: no minutes, reached by Next from the last slide. */
  spare: boolean;
  builds: { el: HTMLElement; n: number }[];
}

const MARK = "deck";

function readParts(root: HTMLElement): Part[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-slide]")).map(
    (el) => {
      const heading = el.querySelector("h2");
      const minutes = Number(el.dataset.minutes);
      return {
        el,
        id: el.id,
        title: heading?.textContent?.trim() || el.id,
        minutes:
          Number.isFinite(minutes) && el.dataset.minutes ? minutes : null,
        spare: el.hasAttribute("data-spare"),
        builds: Array.from(
          el.querySelectorAll<HTMLElement>("[data-build]"),
        ).map((b) => ({ el: b, n: Number(b.dataset.build) || 1 })),
      };
    },
  );
}

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
  const stage = root.querySelector<HTMLElement>("[data-deck-stage]");
  const prev = root.querySelector<HTMLButtonElement>('[data-deck-step="-1"]');
  const next = root.querySelector<HTMLButtonElement>('[data-deck-step="1"]');
  const dots = root.querySelector<HTMLElement>("[data-deck-dots]");
  const live = root.querySelector<HTMLElement>("[data-deck-live]");
  const blankLayer = root.querySelector<HTMLElement>("[data-deck-blank]");
  const parts = readParts(root);
  const fullscreenButton =
    root.querySelector<HTMLButtonElement>("#deck-fullscreen");
  const blankButton = root.querySelector<HTMLButtonElement>("#deck-blank");
  if (
    !win ||
    !stage ||
    !prev ||
    !next ||
    !dots ||
    !live ||
    parts.length < 2 ||
    o.signal.aborted
  ) {
    if (html.dataset[MARK]?.startsWith("wait")) delete html.dataset[MARK];
    return null;
  }

  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);
  const slides: DeckSlide[] = parts.map((p) => ({
    id: p.id,
    builds: p.builds.reduce((max, b) => Math.max(max, b.n), 0),
    spare: p.spare,
  }));
  const mainCount = parts.filter((p) => !p.spare).length;
  const spareCount = parts.length - mainCount;
  /** "Slide 3 of 21: title" for a main slide, "Spare 1 of 2: title" for a spare. */
  const textFor = (i: number): string =>
    parts[i].spare
      ? `Spare ${i + 1 - mainCount} of ${spareCount}: ${parts[i].title}`
      : `Slide ${i + 1} of ${mainCount}: ${parts[i].title}`;
  const deck = createDeck(
    slides,
    parseHash(win.location.hash, slides),
    readUnlocked(win) ? slides.length : 1,
  );

  const space = (o.space ?? mountSpaceStage)(root, { signal });

  /** Where the camera belongs now: the highest reached build that names a place, else the slide's. */
  const flyToState = (hop: boolean): void => {
    const { slide, build } = deck.state;
    const part = parts[slide];
    let place = part.el.dataset["place"];
    for (const b of part.builds)
      if (b.n <= build && b.el.dataset["place"]) place = b.el.dataset["place"];
    if (place) space.goTo(place, { hop, at: { slide, build } });
    // Time moves inside a section: the highest reached build that names a lapse, else the slide's.
    let lapse = part.el.dataset["lapse"];
    for (const b of part.builds)
      if (b.n <= build && b.el.dataset["lapse"]) lapse = b.el.dataset["lapse"];
    space.lapse(lapse || null);
    space.pinFilings(part.el.dataset["pins"] === "filings");
    // The slides' own visuals (`bug-visuals.ts`) play from this.
    writeDeckState(root, { id: part.id, build });
    root.dispatchEvent(
      new CustomEvent("gmt-deck-state", {
        detail: { slide, build, id: part.id },
      }),
    );
  };

  let blanked = false;
  /** Tells the presenter window the state; set once the channel is open (`The presenter window`). */
  let publish: () => void = () => {};

  const writeHash = (): void => {
    const hash = formatHash(deck.state, slides);
    if (win.location.hash !== hash)
      win.history.replaceState(
        win.history.state,
        "",
        `${win.location.pathname}${win.location.search}${hash}`,
      );
  };

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

  const slideText = (): string => {
    return textFor(deck.state.slide);
  };

  const setBlank = (on: boolean): void => {
    if (on === blanked) return;
    blanked = on;
    root.toggleAttribute("data-blank", on);
    if (blankLayer) blankLayer.hidden = !on;
    blankButton?.setAttribute("aria-pressed", String(on));
    live.textContent = on ? "Screen blanked" : slideText();
  };

  /** The change of slide as a view transition; a build or a cut runs through it too, in order. */
  const visual = createDeckTransition({
    doc,
    signal,
    reduced: () =>
      win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    covered: () => dialogs.some((d) => d.open),
  });

  const carousel = wireCarousel(stage, {
    signal,
    pages: parts.map((p) => ({ el: p.el, label: p.title, spare: p.spare })),
    prev,
    next,
    dots,
    live,
    label: "Slides",
    idPrefix: "deck",
    start: deck.state.slide,
    reach: () => deck.reach,
    neighbour: (from, delta) => deck.neighbour(from, delta),
    steps: {
      count: (i) => slides[i].builds,
      current: () => deck.state.build,
      step: (delta) => {
        const changed = deck.stepBuild(delta);
        // A build is no transition, but it keeps its place in line behind a slide change.
        if (changed)
          visual.run(() => {
            showBuilds();
            writeHash();
            flyToState(true);
            publish();
          });
        return changed;
      },
    },
    announce: (_label, i) => textFor(i),
    // The deck's state moves at once; the page follows inside the transition.
    transition: (commit, { from, to, by }) => {
      if (by !== "api") deck.goTo(to, to < from ? "all" : 0);
      visual.run(commit, to > from ? "forward" : "back");
    },
    onSelect: (_index, _previous, by: CarouselBy) => {
      if (by === "api") return;
      showBuilds();
      writeHash();
      flyToState(true);
      publish();
    },
  });

  /** Moves the page to the deck's state after the controller changed it. */
  const apply = (): void => {
    carousel.select(deck.state.slide, "api");
    visual.run(() => {
      showBuilds();
      carousel.refresh();
      writeHash();
      flyToState(true);
      publish();
    });
  };

  /** A move: any move first brings a blanked stage back, and goes no further. */
  const move = (change: () => boolean): void => {
    if (blanked) {
      setBlank(false);
      return;
    }
    if (change()) apply();
  };

  // ---- Dialogs ----
  const dialogs = Array.from(
    root.querySelectorAll<HTMLDialogElement>("dialog[data-deck-dialog]"),
  );
  const dialogOf = (name: string): HTMLDialogElement | undefined =>
    dialogs.find((d) => d.dataset.deckDialog === name);
  const overview = dialogOf("overview");
  const help = dialogOf("help");
  const unlock = dialogOf("unlock");
  const list = overview?.querySelector<HTMLElement>("[data-deck-overview]");
  const spareSection = overview?.querySelector<HTMLElement>(
    "[data-deck-overview-spares]",
  );
  const spareList = overview?.querySelector<HTMLElement>(
    "[data-deck-overview-spare]",
  );
  /** The overview lists the slides in reach. */
  const fillOverview = (): void => {
    const reached = parts.slice(0, deck.reach).map((p) => ({
      id: p.id,
      title: p.title,
      minutes: p.minutes,
      spare: p.spare,
    }));
    if (list) setHtml(list, overviewItems(reached.filter((p) => !p.spare)));
    const spares = reached.filter((p) => p.spare);
    if (spareList) {
      setHtml(spareList, overviewItems(spares));
      spareList.hidden = spares.length === 0;
    }
    if (spareSection) spareSection.hidden = spares.length === 0;
  };
  fillOverview();

  // The info button and its popover of tools (`deckControls`).
  const menuButton = root.querySelector<HTMLButtonElement>("#deck-menu");
  const menu = root.querySelector<HTMLElement>("#deck-menu-panel");
  const closeMenu = (): void => {
    if (menu?.matches(":popover-open")) menu.hidePopover();
  };

  let opener: HTMLElement | null = null;
  const openDialog = (d: HTMLDialogElement | undefined): void => {
    if (!d || d.open) return;
    const active =
      doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    // A tool in the menu is hidden once the menu closes, so focus comes back to the info button.
    opener = active !== null && menu?.contains(active) ? menuButton : active;
    closeMenu();
    d.showModal();
    if (d === overview) {
      space.overview(true);
      const links = Array.from(
        d.querySelectorAll<HTMLAnchorElement>("a[data-deck-goto]"),
      );
      links.forEach((a, i) => {
        if (i === deck.state.slide) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      links[deck.state.slide]?.focus();
    }
    if (d === unlock) {
      clearPhrase();
      phraseField?.focus();
    }
  };
  for (const d of dialogs) {
    d.addEventListener(
      "close",
      () => {
        if (d === overview) space.overview(false);
        if (opener?.isConnected) opener.focus();
        opener = null;
      },
      { signal },
    );
    d.querySelector<HTMLElement>('[id$="-close"]')?.addEventListener(
      "click",
      () => d.close(),
      { signal },
    );
  }
  list?.addEventListener(
    "click",
    (event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[data-deck-goto]",
      );
      if (!link) return;
      event.preventDefault();
      // Closing first returns focus to the opener, so the new slide's panel is not left behind.
      overview?.close();
      setBlank(false);
      if (deck.goToId(link.dataset.deckGoto ?? "")) apply();
    },
    { signal },
  );

  const click = (el: Element | null, fn: () => void): void =>
    el?.addEventListener("click", fn, { signal });

  // ---- The lock: the menu's Unlock (or Lock) tool and the Unlock dialog ----
  const unlockTool = root.querySelector<HTMLButtonElement>("#deck-unlock");
  const unlockLabel =
    unlockTool?.querySelector("[data-deck-tool-label]") ?? null;
  const phraseField =
    unlock?.querySelector<HTMLInputElement>("#deck-unlock-code") ?? null;
  const phraseAlert =
    unlock?.querySelector<HTMLElement>("[data-deck-unlock-error]") ?? null;
  const unlocked = (): boolean => deck.reach === parts.length;
  /** Names the tool for what a click does next; `data-unlocked` picks its padlock (`slides.css`). */
  const nameUnlockTool = (open: boolean): void => {
    unlockTool?.toggleAttribute("data-unlocked", open);
    if (unlockLabel) unlockLabel.textContent = open ? "Lock" : "Unlock";
  };
  /** Marks the root locked (the stylesheet hides the pager) and names the tool. */
  const showLock = (): void => {
    root.toggleAttribute("data-locked", !unlocked());
    nameUnlockTool(unlocked());
  };
  showLock();
  /** Opens every slide, or only the first, and moves the stage back to the first when it was past it. */
  const setLock = (open: boolean): void => {
    if (open === unlocked()) return;
    const before = deck.state;
    deck.setReach(open ? parts.length : 1);
    fillOverview();
    const after = deck.state;
    if (after.slide !== before.slide || after.build !== before.build) apply();
    else carousel.refresh();
    showLock();
    live.textContent = open
      ? "Every slide is unlocked"
      : "The slides are locked: only the first one shows";
  };
  function clearPhrase(): void {
    if (phraseField) {
      phraseField.value = "";
      phraseField.removeAttribute("aria-invalid");
    }
    if (phraseAlert) phraseAlert.textContent = "";
  }
  const tryUnlock = (): void => {
    if (!phraseField || !phraseAlert) return;
    if (!isUnlockPhrase(phraseField.value)) {
      phraseAlert.textContent =
        "That secret phrase does not unlock the slides.";
      phraseField.setAttribute("aria-invalid", "true");
      phraseField.select();
      return;
    }
    writeUnlocked(win);
    clearPhrase();
    unlock?.close();
    setLock(true);
  };
  const lock = (): void => {
    closeMenu();
    forgetUnlocked(win);
    setLock(false);
  };
  // An unlock or a lock in another tab of this site reaches this one too.
  win.addEventListener(
    "storage",
    (event) => {
      if (event.key === UNLOCK_STORAGE_KEY || event.key === null)
        setLock(readUnlocked(win));
    },
    { signal },
  );
  click(unlock?.querySelector("#deck-unlock-go") ?? null, tryUnlock);
  phraseField?.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      tryUnlock();
    },
    { signal },
  );

  /** An address that names a slide out of reach is put back to the slide shown. */
  const settleAddress = (): void => {
    const named = parseHash(win.location.hash, slides);
    if (named.slide >= deck.reach) writeHash();
  };

  // ---- Fullscreen: the deck root alone, so the site header is not in it ----
  const inFullscreen = (): boolean => doc.fullscreenElement === root;
  const canFullscreen = typeof root.requestFullscreen === "function";
  if (!canFullscreen && fullscreenButton) fullscreenButton.disabled = true;
  const enterFullscreen = (): void => {
    if (!canFullscreen || inFullscreen()) return;
    root.requestFullscreen().catch(() => {
      live.textContent = "Fullscreen is not available here";
    });
  };
  const toggleFullscreen = (): void => {
    if (inFullscreen()) void doc.exitFullscreen();
    else enterFullscreen();
  };
  doc.addEventListener(
    "fullscreenchange",
    () => {
      root.toggleAttribute("data-fullscreen", inFullscreen());
      fullscreenButton?.setAttribute("aria-pressed", String(inFullscreen()));
    },
    { signal },
  );

  // ---- Buttons ----
  click(root.querySelector("#deck-overview"), () => openDialog(overview));
  click(root.querySelector("#deck-help"), () => openDialog(help));
  click(unlockTool, () => (unlocked() ? lock() : openDialog(unlock)));
  click(blankButton, () => {
    closeMenu();
    setBlank(!blanked);
  });
  click(fullscreenButton, () => {
    closeMenu();
    toggleFullscreen();
  });
  blankButton?.setAttribute("aria-pressed", "false");
  fullscreenButton?.setAttribute("aria-pressed", "false");

  // ---- The presenter window ----
  const slug = root.dataset["deckSlug"] ?? "";
  let demo: DemoState = null;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const spaceHost = root.querySelector<HTMLElement>("[data-deck-space]");

  /** The globe's renderer as the stage published it. */
  const renderer = (): DeckEnv["renderer"] => {
    const globe = spaceHost?.dataset["globe"];
    if (globe === "none") return "sky";
    if (globe !== "ready") return "pending";
    return spaceHost?.dataset["globeRenderer"] === "webgpu"
      ? "webgpu"
      : "canvas2d";
  };
  const snapshot = (): StateMessage => ({
    type: "state",
    slide: deck.state.slide,
    build: deck.state.build,
    blanked,
    demo,
    env: {
      renderer: renderer(),
      reducedMotion: reducedMotion?.matches ?? false,
      fullscreen: inFullscreen(),
    },
  });

  /** Runs a presenter's step through the same moves as the keys. */
  const stepsFrom: Record<StepMessage["action"], (n?: number) => void> = {
    next: () => carousel.step(1, "key"),
    prev: () => carousel.step(-1, "key"),
    nextSlide: () => move(() => deck.nextSlide()),
    prevSlide: () => move(() => deck.prevSlide()),
    first: () => move(() => deck.first()),
    last: () => move(() => deck.last()),
    goTo: (n) => move(() => deck.goTo((n ?? 1) - 1)),
    blank: () => setBlank(!blanked),
    home: () => space.returnHome(),
  };
  const sync = mountDeckSync({
    slug,
    signal,
    snapshot,
    step: (message) => {
      if (blanked && message.action !== "blank") return setBlank(false);
      stepsFrom[message.action](message.n);
    },
  });
  publish = (): void => sync?.publish();
  // Every change goes out through one path: the carousel's own steps and the controller's moves
  // both end in a change of the page's mark, which the observers below see.
  const watch = new MutationObserver(publish);
  for (const el of [spaceHost, root])
    if (el)
      watch.observe(el, {
        attributes: true,
        attributeFilter: [
          "data-globe",
          "data-globe-renderer",
          "data-fullscreen",
          "data-blank",
        ],
      });
  signal.addEventListener("abort", () => watch.disconnect(), { once: true });
  reducedMotion?.addEventListener("change", publish, { signal });

  const openPresenter = (): void => {
    win.open(withBase(`/slides/${slug}/presenter/`), PRESENTER_WINDOW);
  };

  // ---- Keys ----
  mountKeys(doc, {
    signal,
    actions: {
      step: (delta) => {
        if (blanked) return setBlank(false);
        // The carousel owns the build-before-slide order, and its buttons stay in step.
        carousel.step(delta, "key");
      },
      slide: (delta) =>
        move(() => (delta === 1 ? deck.nextSlide() : deck.prevSlide())),
      first: () => move(() => deck.first()),
      last: () => move(() => deck.last()),
      goTo: (n) => move(() => deck.goTo(n - 1)),
      overview: () => openDialog(overview),
      help: () => openDialog(help),
      blank: () => setBlank(!blanked),
      fullscreen: toggleFullscreen,
      present: () => {
        setBlank(false);
        enterFullscreen();
      },
      presenter: openPresenter,
      fly: (vector) => space.steer(vector),
      home: () => space.returnHome(),
    },
  });

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

  // The address read back: a link or the owner's own edit of the fragment.
  win.addEventListener(
    "hashchange",
    () => {
      if (deck.goToHash(win.location.hash)) apply();
      else settleAddress();
    },
    { signal },
  );

  showBuilds();
  settleAddress();
  flyToState(false);
  html.dataset[MARK] = "stage";

  signal.addEventListener(
    "abort",
    () => {
      delete html.dataset[MARK];
      root.removeAttribute("data-blank");
      root.removeAttribute("data-fullscreen");
      root.removeAttribute("data-locked");
      nameUnlockTool(false);
      if (blankLayer) blankLayer.hidden = true;
      for (const p of parts)
        for (const b of p.builds) {
          delete b.el.dataset.reached;
          b.el.inert = false;
        }
      for (const d of dialogs) if (d.open) d.close();
    },
    { once: true },
  );

  /** The live panels announce their demo on the deck root: `{ id, source }`, or `null` when it ends. */
  root.addEventListener(
    "gmt-demo",
    (e) => {
      demo = (e as CustomEvent<DemoState>).detail ?? null;
      publish();
    },
    { signal },
  );

  return {
    get state() {
      return deck.state;
    },
    get blanked() {
      return blanked;
    },
    setDemo(next) {
      demo = next;
      publish();
    },
    destroy: () => own.abort(),
  };
}
