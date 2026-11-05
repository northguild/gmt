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
import { initHomeCarousel } from "./home-carousel";

installJsdomShims();

let aborter: AbortController;

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

function start(): Hero {
  const h = hero();
  document.documentElement.dataset["homeCarousel"] = "wait";
  initHomeCarousel(h.hero, aborter.signal);
  return h;
}

const shown = (el: HTMLElement): boolean => el.hasAttribute("data-shown");

beforeEach(() => {
  aborter = new AbortController();
});

afterEach(() => {
  aborter.abort();
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
});
