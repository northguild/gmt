/**
 * @vitest-environment jsdom
 *
 * The landing's carousel on a stand-in hero: the intro and two more pages share the column, with
 * the hero's buttons and the pager under them. What is tested is what the page adds to the kit's
 * carousel: the mark on the root, the pager, and the address.
 */
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { setHtml } from "~/widgets/builders";
import { html } from "~/widgets/builders/html";
import { installJsdomShims } from "../test/jsdom-shims";
import { HOME_LOCKED_QUERY, initHomeCarousel } from "./home-carousel";

installJsdomShims();

let aborter: AbortController;

/** The locked-layout query as a `MediaQueryList` the test flips and whose listeners it counts. */
interface Screen {
  set: (locked: boolean) => void;
  listeners: () => number;
}

function screenOf(locked: boolean): Screen {
  let matches = locked;
  const listeners = new Set<() => void>();
  const list = {
    get matches() {
      return matches;
    },
    media: HOME_LOCKED_QUERY,
    addEventListener: (
      _type: string,
      listener: () => void,
      options?: { signal?: AbortSignal },
    ) => {
      listeners.add(listener);
      options?.signal?.addEventListener("abort", () =>
        listeners.delete(listener),
      );
    },
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  };
  const idle = {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  vi.spyOn(window, "matchMedia").mockImplementation(((query: string) =>
    query === HOME_LOCKED_QUERY
      ? list
      : idle) as unknown as typeof window.matchMedia);
  return {
    set: (value) => {
      matches = value;
      for (const listener of listeners) listener();
    },
    listeners: () => listeners.size,
  };
}

interface Hero {
  hero: HTMLElement;
  intro: HTMLElement;
  why: HTMLElement;
  more: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
}

function hero(): Hero {
  const el = document.createElement("div");
  setHtml(
    el,
    html`<div data-gate="hero-copy">
      <div data-page="Intro"><h1>Give Me Temporal</h1></div>
      <section data-page="Why gmt"><h2 id="tested-and-precise">Tested and precise</h2></section>
      <section data-page="More"><p>More text</p></section>
      <div data-hero-nav>
        <div><a href="/install/">Get started</a></div>
        <div>
          <button type="button" data-hero-step="-1" aria-label="Previous page"></button>
          <div data-hero-dots></div>
          <button type="button" data-hero-step="1" aria-label="Next page"></button>
        </div>
        <p data-hero-live aria-live="polite"></p>
      </div>
    </div>`,
  );
  document.body.append(el);
  // The pages have no role until the carousel gives them one: found the way the page finds them.
  const [intro, why, more] = Array.from(
    // oxlint-disable-next-line dox-test/no-class-query, testing-library/no-node-access
    el.querySelectorAll<HTMLElement>("[data-page]"),
  );
  return {
    hero: el,
    intro,
    why,
    more,
    prev: screen.getByRole<HTMLButtonElement>("button", {
      name: "Previous page",
    }),
    next: screen.getByRole<HTMLButtonElement>("button", { name: "Next page" }),
  };
}

/** The hero on a locked screen, as `arrival.ts` leaves it: marked `wait`. */
function start(): Hero {
  const h = hero();
  screenOf(true);
  document.documentElement.dataset["homeCarousel"] = "wait";
  initHomeCarousel(h.hero, aborter.signal);
  return h;
}

/** The hero on a stacked screen, which `arrival.ts` leaves unmarked. */
function startStacked(): Hero & { screen: Screen } {
  const h = hero();
  const screen = screenOf(false);
  initHomeCarousel(h.hero, aborter.signal);
  return { ...h, screen };
}

const shown = (el: HTMLElement): boolean => el.hasAttribute("data-shown");

beforeEach(() => {
  aborter = new AbortController();
});

afterEach(() => {
  aborter.abort();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
  delete document.documentElement.dataset["homeCarousel"];
  document.body.replaceChildren();
});

describe("initHomeCarousel", () => {
  it("takes over the wait mark and shows the intro first", () => {
    const h = start();
    expect(document.documentElement.dataset["homeCarousel"]).toBe("on");
    expect(shown(h.intro)).toBe(true);
    expect(shown(h.why)).toBe(false);
    expect(
      screen.getByRole("region", { name: "About gmt" }),
    ).toBeInTheDocument();
  });

  it("puts a dot per page between the arrows", () => {
    start();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Intro",
      "Why gmt",
      "More",
    ]);
  });

  it("steps from the arrows and takes an arrow out of the tab order at either end", async () => {
    const user = userEvent.setup();
    const h = start();
    expect(h.prev).toHaveAttribute("tabindex", "-1");
    await user.click(h.next);
    expect(shown(h.why)).toBe(true);
    expect(h.prev).not.toHaveAttribute("tabindex");
    expect(h.prev).toHaveAccessibleName("Previous: Intro");
    await user.click(h.next);
    expect(shown(h.more)).toBe(true);
    expect(h.next).toHaveAttribute("tabindex", "-1");
  });

  it("opens the page on load when the address names a place in it", () => {
    window.history.replaceState(null, "", "/#tested-and-precise");
    const h = start();
    expect(shown(h.why)).toBe(true);
    expect(shown(h.intro)).toBe(false);
  });

  it("ignores an address that names nothing on a page", () => {
    window.history.replaceState(null, "", "/#nowhere");
    const h = start();
    expect(shown(h.intro)).toBe(true);
  });

  it("starts on the intro when the hash is not valid percent-encoding, and ignores one later", async () => {
    window.history.replaceState(null, "", "/#100%");
    const h = start();
    expect(document.documentElement.dataset["homeCarousel"]).toBe("on");
    expect(shown(h.intro)).toBe(true);
    window.location.hash = "#tested-and-precise";
    await waitFor(() => expect(shown(h.why)).toBe(true));
    const errors: unknown[] = [];
    const note = (e: ErrorEvent): void => {
      errors.push(e.error);
      e.preventDefault();
    };
    window.addEventListener("error", note);
    window.location.hash = "#50%zz";
    await new Promise((r) => setTimeout(r, 0));
    window.removeEventListener("error", note);
    expect(errors).toEqual([]);
    expect(shown(h.why)).toBe(true);
  });

  it("clears the address when it leaves the page it names, and keeps the query", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?a=1#tested-and-precise");
    const h = start();
    await user.click(h.prev);
    expect(shown(h.intro)).toBe(true);
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?a=1");
  });

  it("follows a later change of the hash", async () => {
    const h = start();
    window.location.hash = "#tested-and-precise";
    await waitFor(() => expect(shown(h.why)).toBe(true));
    window.location.hash = "#_top";
    await waitFor(() => expect(shown(h.intro)).toBe(true));
  });

  it("clears the wait mark when the hero lacks a part", () => {
    const h = hero();
    screenOf(true);
    h.next.remove();
    document.documentElement.dataset["homeCarousel"] = "wait";
    initHomeCarousel(h.hero, aborter.signal);
    expect(document.documentElement.dataset["homeCarousel"]).toBeUndefined();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("leaves nothing behind when the page tears it down", () => {
    const h = start();
    aborter.abort();
    expect(document.documentElement.dataset["homeCarousel"]).toBeUndefined();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(h.prev).not.toHaveAttribute("tabindex");
    expect(h.prev).toHaveAccessibleName("Previous page");
  });

  it("does not wire on a stacked screen: the pages read in order", () => {
    const h = startStacked();
    expect(document.documentElement.dataset["homeCarousel"]).toBeUndefined();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    for (const page of [h.intro, h.why, h.more]) {
      expect(page).not.toHaveAttribute("inert");
      expect(page).not.toHaveAttribute("aria-hidden");
      expect(page).not.toHaveAttribute("role");
    }
  });

  it("clears the wait mark when the screen is stacked by the time it runs", () => {
    const h = hero();
    screenOf(false);
    document.documentElement.dataset["homeCarousel"] = "wait";
    initHomeCarousel(h.hero, aborter.signal);
    expect(document.documentElement.dataset["homeCarousel"]).toBeUndefined();
  });

  it("takes everything back when the screen becomes stacked, and the keys do nothing", async () => {
    const user = userEvent.setup();
    const h = hero();
    const screenList = screenOf(true);
    document.documentElement.dataset["homeCarousel"] = "wait";
    initHomeCarousel(h.hero, aborter.signal);
    await user.click(h.next);
    screenList.set(false);
    expect(document.documentElement.dataset["homeCarousel"]).toBeUndefined();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    for (const page of [h.intro, h.why, h.more]) {
      expect(page).not.toHaveAttribute("inert");
      expect(page).not.toHaveAttribute("role");
      expect(page).not.toHaveAttribute("aria-label");
      expect(shown(page)).toBe(false);
    }
    expect(h.prev).not.toHaveAttribute("tabindex");
    expect(h.prev).toHaveAccessibleName("Previous page");
    h.next.focus();
    await user.keyboard("{ArrowRight}");
    expect(shown(h.more)).toBe(false);
  });

  describe("wiring again when the screen becomes locked", () => {
    /** Places the pages at `tops`. */
    const place = (tops: Map<HTMLElement, number>): void => {
      for (const [page, top] of tops)
        page.getBoundingClientRect = () => ({ top }) as DOMRect;
    };
    let frames: FrameRequestCallback[];
    /** A scroll, then the browser's next frame. */
    const scroll = (): void => {
      // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom has no layout and its scrollTo fires nothing; the event is the input
      window.dispatchEvent(new Event("scroll"));
      for (const frame of frames.splice(0)) frame(0);
    };
    beforeEach(() => {
      frames = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) =>
        frames.push(frame),
      );
    });

    it("opens the page the reader scrolled to, though the resize moves every page first", () => {
      const h = startStacked();
      place(
        new Map([
          [h.intro, -500],
          [h.why, -100],
          [h.more, 900],
        ]),
      );
      scroll();
      // The locked layout is in place before the change event: here it puts `more` at the top.
      place(
        new Map([
          [h.intro, -900],
          [h.why, -400],
          [h.more, 0],
        ]),
      );
      h.screen.set(true);
      expect(document.documentElement.dataset["homeCarousel"]).toBe("on");
      expect(shown(h.why)).toBe(true);
      expect(shown(h.more)).toBe(false);
    });

    it("counts a page as reached where a jump stops, below the top quarter", () => {
      const h = startStacked();
      const real = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
        const style = real(el);
        if (el === document.documentElement)
          return {
            ...style,
            scrollPaddingBlockStart: "79px",
          } as CSSStyleDeclaration;
        return el === h.more
          ? ({
              ...style,
              scrollMarginBlockStart: "71px",
            } as CSSStyleDeclaration)
          : style;
      });
      /* A jump to `more` on a landscape phone, 390 tall with the quarter at 97.5, stops at the
         root's 79 px scroll padding (the header) and the page's 71 px scroll margin. */
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(390);
      place(
        new Map([
          [h.intro, -900],
          [h.why, -300],
          [h.more, 150],
        ]),
      );
      scroll();
      h.screen.set(true);
      expect(shown(h.more)).toBe(true);
      expect(shown(h.why)).toBe(false);
    });
  });

  it("leaves no listener on the screen after teardown, wired or stacked", () => {
    const wired = hero();
    const first = screenOf(true);
    document.documentElement.dataset["homeCarousel"] = "wait";
    const one = new AbortController();
    initHomeCarousel(wired.hero, one.signal);
    expect(first.listeners()).toBe(1);
    one.abort();
    expect(first.listeners()).toBe(0);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    document.body.replaceChildren();
    const stacked = hero();
    const second = screenOf(false);
    const two = new AbortController();
    initHomeCarousel(stacked.hero, two.signal);
    expect(second.listeners()).toBe(1);
    two.abort();
    expect(second.listeners()).toBe(0);
  });
});
