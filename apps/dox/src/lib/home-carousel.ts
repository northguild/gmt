/**
 * The landing's carousel (`HeroGlobe.astro`, `gmt-home-carousel.css`).
 *
 * The hero's copy column holds the landing's pages, the intro first, and under them the hero's
 * buttons and the pager: the previous arrow, a dot per page and the next arrow. One page shows at
 * a time. This module wires the kit's carousel (`widgets/builders/carousel.ts`) and adds
 * what is the page's own: the hash, the wheel on a wide screen, and the motion.
 *
 * On a landscape screen 64rem wide and up the page never scrolls: the sky and the Earth fill the
 * viewport, and a page taller than its place scrolls inside it. Elsewhere (narrower, or portrait)
 * the stage stacks and the page scrolls, so the wheel scrolls the page and never steps.
 *
 * `arrival.ts` has already set `data-home-carousel="wait"` before the first paint, so the paged
 * layout is the first layout. This module writes `on`, or removes the mark when it cannot wire.
 */
import {
  wireCarousel,
  type CarouselHandle,
} from "../widgets/builders/carousel";

const MARK = "homeCarousel";
const REDUCED = "(prefers-reduced-motion: reduce)";

/** The screens where the landing never scrolls, and the wheel steps the pages. */
export const HOME_LOCKED_QUERY =
  "(width >= 64rem) and (orientation: landscape)";

/** Wires the carousel for a hero; returns nothing, and tears down with `signal`. */
export function initHomeCarousel(hero: HTMLElement, signal: AbortSignal): void {
  const doc = hero.ownerDocument;
  const win = doc.defaultView;
  const root = doc.documentElement;
  const column = hero.querySelector<HTMLElement>('[data-gate="hero-copy"]');
  const pages = column
    ? Array.from(column.querySelectorAll<HTMLElement>("[data-page]"))
    : [];
  const prev = hero.querySelector<HTMLButtonElement>('[data-hero-step="-1"]');
  const next = hero.querySelector<HTMLButtonElement>('[data-hero-step="1"]');
  const dots = hero.querySelector<HTMLElement>("[data-hero-dots]");
  const live = hero.querySelector<HTMLElement>("[data-hero-live]");
  if (
    !win ||
    !column ||
    pages.length < 2 ||
    !prev ||
    !next ||
    !dots ||
    !live ||
    signal.aborted
  ) {
    if (root.dataset[MARK] === "wait") delete root.dataset[MARK];
    return;
  }

  const locked = win.matchMedia?.(HOME_LOCKED_QUERY);
  const reduced = (): boolean => win.matchMedia?.(REDUCED).matches ?? false;

  /**
   * The page that holds the element the hash names, or -1. `_top` is the intro. A hash that is
   * not valid percent-encoding (`#100%`, which the browser keeps as typed) names nothing.
   */
  const pageOfHash = (): { page: number; target: HTMLElement | null } => {
    if (!win.location.hash) return { page: -1, target: null };
    let id: string;
    try {
      id = decodeURIComponent(win.location.hash.slice(1));
    } catch {
      return { page: -1, target: null };
    }
    if (id === "_top") return { page: 0, target: null };
    const target = id === "" ? null : doc.getElementById(id);
    const page = target ? pages.findIndex((p) => p.contains(target)) : -1;
    return { page, target: page === -1 ? null : target };
  };

  const play = (el: HTMLElement, kind: "in" | "out"): void => {
    el.removeAttribute("data-motion");
    void el.offsetWidth;
    el.dataset["motion"] = kind;
  };
  const clearMotion = (el: HTMLElement, kind: string): void => {
    if (el.dataset["motion"] === kind) el.removeAttribute("data-motion");
  };

  /** Drops a hash that names a place on a page that is no longer shown. */
  const clearHash = (shown: number): void => {
    const { page } = pageOfHash();
    if (page === -1 || page === shown) return;
    win.history.replaceState(
      win.history.state,
      "",
      win.location.pathname + win.location.search,
    );
  };

  const first = pageOfHash();
  const carousel: CarouselHandle = wireCarousel(column, {
    signal,
    pages: pages.map((el) => ({ el, label: el.dataset["page"] ?? "" })),
    prev,
    next,
    dots,
    live,
    keyArea: column,
    wheelArea: column,
    wheel: () => locked?.matches === true,
    label: "About gmt",
    idPrefix: "home",
    start: Math.max(0, first.page),
    leave: (el, hide) => {
      if (reduced()) {
        el.removeAttribute("data-motion");
        hide();
        return;
      }
      play(el, "out");
      const running = el.getAnimations?.() ?? [];
      const done = (): void => {
        hide();
        clearMotion(el, "out");
      };
      if (running.length === 0) done();
      else void Promise.allSettled(running.map((a) => a.finished)).then(done);
    },
    onSelect: (to, _from, by) => {
      const el = pages[to];
      if (by !== "wheel") el.scrollTop = 0;
      play(el, "in");
      const running = el.getAnimations?.() ?? [];
      void Promise.allSettled(running.map((a) => a.finished)).then(() =>
        clearMotion(el, "in"),
      );
      clearHash(to);
    },
  });
  root.dataset[MARK] = "on";

  /** Puts `target` at the top of its page, which scrolls inside itself on a wide screen. */
  const reveal = (page: HTMLElement, target: HTMLElement | null): void => {
    if (!target) return;
    page.scrollTop +=
      target.getBoundingClientRect().top - page.getBoundingClientRect().top;
  };

  /**
   * Drops `load` once the page has frozen in. It waits while the entrance waits; once the entrance
   * runs (or there is none), it goes when the page's animation ends or is cancelled.
   */
  const settleLoad = (el: HTMLElement): void => {
    const settle = (): boolean => {
      if (root.dataset["entrance"] === "wait") return false;
      const running = el.getAnimations?.() ?? [];
      void Promise.allSettled(running.map((a) => a.finished)).then(() =>
        clearMotion(el, "load"),
      );
      return true;
    };
    if (settle()) return;
    const watch = new MutationObserver(() => {
      if (settle()) watch.disconnect();
    });
    watch.observe(root, {
      attributes: true,
      attributeFilter: ["data-entrance"],
    });
    signal.addEventListener("abort", () => watch.disconnect(), { once: true });
  };

  // A link to a place on a later page opens that page with the landing: it freezes in with the
  // entrance, after the first beat.
  if (first.page > 0) {
    pages[first.page].dataset["motion"] = "load";
    reveal(pages[first.page], first.target);
    settleLoad(pages[first.page]);
  }

  /** Opens what a new hash names. Unknown ids are ignored. */
  win.addEventListener(
    "hashchange",
    () => {
      const { page, target } = pageOfHash();
      if (page === -1) return;
      carousel.select(page, "api");
      reveal(pages[page], target);
    },
    { signal },
  );

  signal.addEventListener(
    "abort",
    () => {
      for (const p of pages) p.removeAttribute("data-motion");
      delete root.dataset[MARK];
    },
    { once: true },
  );
}
