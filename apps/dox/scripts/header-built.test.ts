/**
 * @vitest-environment jsdom
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gmtVersion } from "../src/generated/versions";
import { distDirOrSkip } from "./dist-dir";

/**
 * The bar's NorthGuild link, read from the built page: its name starts with the visible text
 * (WCAG 2.2 SC 2.5.3), it is the first stop after the skip link, and the mark is hidden from
 * assistive technology. Needs a build; returns early without one and throws under
 * `DOX_DIST_REQUIRED`.
 */
const PAGES = ["index.html", "install/index.html", "dox/index.html"];

describe("the built header's NorthGuild link", () => {
  it.each(PAGES)("%s", (page) => {
    const root = distDirOrSkip();
    if (root === null) return;
    const doc = new DOMParser().parseFromString(
      readFileSync(resolve(root, "gmt", page), "utf8"),
      "text/html",
    );
    const link = doc.querySelector<HTMLAnchorElement>("a.gmt-ng-link");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("aria-label")).toBe("NorthGuild home");
    const visible = link!.textContent!.trim();
    expect(
      "NorthGuild home".toLowerCase().startsWith(visible.toLowerCase()),
    ).toBe(true);
    expect(link!.getAttribute("title")).toBeNull();
    expect(link!.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );

    const focusable = [
      ...doc.querySelectorAll<HTMLElement>("a[href], button, input, select"),
    ].filter((el) => !el.closest("[hidden], [inert]"));
    const skip = focusable.findIndex((el) =>
      el.getAttribute("href")?.startsWith("#"),
    );
    expect(focusable[skip + 1]).toBe(link);
  });
});

/**
 * The title after the NorthGuild link reads "/ gmt v‹version›", like every NorthGuild app. The
 * slash is decoration, so the link's name is the visible word "gmt" (WCAG 2.2 SC 2.5.3), and the
 * version is the released one, not a hand-typed string.
 */
describe("the built header's site title", () => {
  it.each(PAGES)("%s", (page) => {
    const root = distDirOrSkip();
    if (root === null) return;
    const doc = new DOMParser().parseFromString(
      readFileSync(resolve(root, "gmt", page), "utf8"),
      "text/html",
    );
    const title = doc.querySelector<HTMLAnchorElement>("a.site-title");
    expect(title).not.toBeNull();
    expect(
      title!.querySelector(".gmt-app-slash")?.getAttribute("aria-hidden"),
    ).toBe("true");
    const named = [...title!.childNodes]
      .filter((n) => !(n instanceof Element && n.hasAttribute("aria-hidden")))
      .map((n) => n.textContent)
      .join("")
      .trim();
    expect(named).toBe("gmt");
    expect(title!.nextElementSibling?.textContent).toBe(`v${gmtVersion}`);
    expect(doc.querySelector(".gmt-ng-divider")).toBeNull();
  });
});

/**
 * Below `md` the header's right-hand group is hidden, so the mobile menu carries the Dox link,
 * with the header button's name. Only pages with a sidebar have a mobile menu; the landing page
 * has its own Dox button and `/dox` is the chat itself.
 */
describe("the built mobile menu's Dox link", () => {
  const MENU_PAGES = [
    "install/index.html",
    "tools/zoned-earth/index.html",
    "guides/conversion/databases/index.html",
  ];
  it.each(MENU_PAGES)("%s", (page) => {
    const root = distDirOrSkip();
    if (root === null) return;
    const doc = new DOMParser().parseFromString(
      readFileSync(resolve(root, "gmt", page), "utf8"),
      "text/html",
    );
    const footer = doc.querySelector(".mobile-preferences");
    expect(footer).not.toBeNull();
    const link = footer!.querySelector<HTMLAnchorElement>('a[href$="/dox/"]');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain("Chat with Dox");
    expect(
      footer!.querySelector("select, starlight-theme-select"),
    ).not.toBeNull();
  });
});

/**
 * Starlight hides the sidebar pane with `--sl-sidebar-visibility: hidden` and shows it from a rule
 * that keys on the menu button's custom element. `aria-expanded` lives on the inner button here, so
 * that rule never matches and the menu opens onto nothing. The page's own rule keys on the body
 * flag the toggle sets, and it has to name the element the pane really is.
 */
describe("the built mobile menu opens the sidebar pane", () => {
  const MENU_PAGES = [
    "install/index.html",
    "tools/zoned-earth/index.html",
    "guides/conversion/databases/index.html",
  ];
  const CSS_RULE =
    /\[data-mobile-menu-expanded\]\s*\.sidebar-pane\s*\{[^}]*--sl-sidebar-visibility:\s*visible/;

  /** The page's inline styles plus every stylesheet it links, as one string. */
  const cssOf = (root: string, html: string, doc: Document): string => {
    const inline = [...doc.querySelectorAll("style")].map(
      (el) => el.textContent,
    );
    const linked = [
      ...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ].map((el) => {
      const href = el.getAttribute("href") ?? "";
      const name = href.split("/").pop() ?? "";
      const dir = resolve(root, "gmt", "_astro");
      return readdirSync(dir).includes(name)
        ? readFileSync(resolve(dir, name), "utf8")
        : "";
    });
    return [html, ...inline, ...linked].join("\n");
  };

  it.each(MENU_PAGES)("%s", (page) => {
    const root = distDirOrSkip();
    if (root === null) return;
    const html = readFileSync(resolve(root, "gmt", page), "utf8");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pane = doc.querySelector("#starlight__sidebar");
    expect(pane).not.toBeNull();
    expect(pane!.classList.contains("sidebar-pane")).toBe(true);
    expect(
      doc.querySelector("starlight-menu-button button[aria-expanded]"),
    ).not.toBeNull();
    expect(CSS_RULE.test(cssOf(root, html, doc))).toBe(true);
  });
});

/**
 * A second element with the same `view-transition-name` makes the browser skip the whole
 * cross-document transition, so each named selector must match exactly one element on a built
 * page. A bare `.header` also matched the override's inner `div.header` and every code frame's
 * `figcaption.header`.
 */
describe("the view-transition names", () => {
  const css = readFileSync(
    resolve(import.meta.dirname, "../src/styles/gmt-view-transitions.css"),
    "utf8",
  );
  const selectors = [
    ...css.matchAll(/^([^{}@/*\s][^{}]*?)\s*\{[^{}]*view-transition-name:/gm),
  ].map((match) => match[1]!);

  it("names at least the header and the sidebar", () => {
    expect(selectors.length).toBeGreaterThanOrEqual(2);
  });

  it.each(PAGES)("%s names each element once", (page) => {
    const root = distDirOrSkip();
    if (root === null) return;
    const doc = new DOMParser().parseFromString(
      readFileSync(resolve(root, "gmt", page), "utf8"),
      "text/html",
    );
    for (const selector of selectors) {
      expect(
        doc.querySelectorAll(selector).length,
        selector,
      ).toBeLessThanOrEqual(1);
    }
    expect(doc.querySelectorAll(".page > .header")).toHaveLength(1);
  });
});

/**
 * Chromium reads the opt-in to cross-document view transitions at the first reveal. In a linked
 * stylesheet it was missed on the landing, so every built page carries it inline in the head.
 */
describe("the view-transition opt-in", () => {
  it.each(PAGES)("%s carries it inline in the head", (page) => {
    const root = distDirOrSkip();
    if (root === null) return;
    const doc = new DOMParser().parseFromString(
      readFileSync(resolve(root, "gmt", page), "utf8"),
      "text/html",
    );
    const inline = [...doc.head.querySelectorAll("style")].filter((style) =>
      style.textContent?.includes("@view-transition{navigation:auto}"),
    );
    expect(inline).toHaveLength(1);
  });
});
