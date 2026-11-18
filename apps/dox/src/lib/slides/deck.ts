/**
 * The deck's state machine: which slide shows and how many of its builds are revealed. No DOM, no
 * clock. `deck-mount.ts` reads the slides and their builds from the page and drives this.
 *
 * A state is `{ slide, build }`: `slide` is the zero-based index, `build` is how many of that
 * slide's builds are shown, from 0 (none) to the slide's `builds` (all). A step reveals the next
 * build, then moves to the next slide at build 0. A step back hides a build, then moves to the
 * previous slide with every build shown, so a reader going back sees the slide as it was left.
 *
 * Every move returns whether the state changed. A move past either end changes nothing.
 *
 * The reach is how many slides, from the first, can be shown: a locked deck reaches only its first
 * slide (`deck-mount.ts` keeps the lock). Every move stays inside it, and a move to a slide past it
 * changes nothing; `last` is the last slide in reach.
 */

export interface DeckSlide {
  /** The section's id, and the fragment that links to it. */
  id: string;
  /** How many builds the slide has. */
  builds: number;
}

export interface DeckState {
  slide: number;
  build: number;
}

export interface Deck {
  readonly slides: readonly DeckSlide[];
  /** A copy: changing it changes nothing. */
  readonly state: DeckState;
  /** How many slides, from the first, can be shown. */
  readonly reach: number;
  /** Sets the reach (clamped to 1 and the deck); a shown slide past it gives way to the first. */
  setReach(reach: number): void;
  /** The next build, else the next slide at build 0. */
  next(): boolean;
  /** The previous build, else the previous slide with every build shown. */
  prev(): boolean;
  /** One build forward or back, never leaving the slide. */
  stepBuild(delta: 1 | -1): boolean;
  nextSlide(): boolean;
  prevSlide(): boolean;
  first(): boolean;
  last(): boolean;
  /** Slide `index` (clamped to the deck; nothing when past the reach) at `build` (clamped; default 0, `"all"` for every build). */
  goTo(index: number, build?: number | "all"): boolean;
  /** The slide with this id, or false when there is none. */
  goToId(id: string, build?: number | "all"): boolean;
  /** Reads a fragment (`#id`, `#id/2`); false when it names no slide or changes nothing. */
  goToHash(hash: string): boolean;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/**
 * The state a fragment names. `#`, an empty string and an id no slide has give the first slide; a
 * build past the slide's last (or not a whole number) clamps to a valid build. Never throws.
 */
export function parseHash(
  hash: string,
  slides: readonly DeckSlide[],
): DeckState {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  const cut = body.indexOf("/");
  const rawId = cut === -1 ? body : body.slice(0, cut);
  const rawBuild = cut === -1 ? "" : body.slice(cut + 1);
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // A fragment that is not percent-encoding names nothing.
  }
  const slide = slides.findIndex((s) => s.id === id);
  if (slide === -1) return { slide: 0, build: 0 };
  const wanted = /^\d+$/.test(rawBuild) ? Number(rawBuild) : 0;
  return { slide, build: clamp(wanted, 0, slides[slide]!.builds) };
}

/** The fragment for a state: `#id` at build 0, else `#id/n`. */
export function formatHash(
  state: DeckState,
  slides: readonly DeckSlide[],
): string {
  const s = slides[clamp(state.slide, 0, slides.length - 1)];
  if (!s) return "#";
  const build = clamp(state.build, 0, s.builds);
  return build === 0 ? `#${s.id}` : `#${s.id}/${build}`;
}

/** `reach` defaults to every slide. */
export function createDeck(
  input: readonly DeckSlide[],
  start?: DeckState,
  reach?: number,
): Deck {
  if (input.length === 0) throw new Error("a deck needs at least one slide");
  const slides = input.map((s) => ({
    id: s.id,
    builds: Math.max(0, Math.trunc(s.builds)),
  }));
  const whole = (n: number): number => (Number.isNaN(n) ? 0 : Math.trunc(n));
  const reachOf = (n: number | undefined): number =>
    n === undefined ? slides.length : clamp(whole(n), 1, slides.length);
  let reached = reachOf(reach);
  /** The last slide in reach. */
  let last = reached - 1;
  let slide = 0;
  let build = 0;

  const set = (to: number, b: number): boolean => {
    const s = clamp(whole(to), 0, slides.length - 1);
    if (s > last) return false;
    const nb = clamp(whole(b), 0, slides[s]!.builds);
    if (s === slide && nb === build) return false;
    slide = s;
    build = nb;
    return true;
  };
  if (start) set(start.slide, start.build);

  const at = (wanted: number | "all"): number =>
    wanted === "all" ? Number.POSITIVE_INFINITY : wanted;

  return {
    slides,
    get state() {
      return { slide, build };
    },
    get reach() {
      return reached;
    },
    setReach(n) {
      reached = reachOf(n);
      last = reached - 1;
      if (slide > last) set(0, 0);
    },
    next: () =>
      build < slides[slide]!.builds
        ? set(slide, build + 1)
        : slide < last && set(slide + 1, 0),
    prev: () =>
      build > 0
        ? set(slide, build - 1)
        : slide > 0 && set(slide - 1, slides[slide - 1]!.builds),
    stepBuild: (delta) => set(slide, build + delta),
    nextSlide: () => slide < last && set(slide + 1, 0),
    prevSlide: () => slide > 0 && set(slide - 1, 0),
    first: () => set(0, 0),
    last: () => set(last, 0),
    goTo: (index, wanted = 0) => set(index, at(wanted)),
    goToId(id, wanted = 0) {
      const index = slides.findIndex((s) => s.id === id);
      return index !== -1 && set(index, at(wanted));
    },
    goToHash(hash) {
      const body = hash.startsWith("#") ? hash.slice(1) : hash;
      if (body === "") return false;
      const named = parseHash(hash, slides);
      let id = body.split("/")[0]!;
      try {
        id = decodeURIComponent(id);
      } catch {
        return false;
      }
      return slides[named.slide]!.id === id && set(named.slide, named.build);
    },
  };
}
