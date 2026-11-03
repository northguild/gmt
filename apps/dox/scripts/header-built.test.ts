/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    expect(link!.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    const focusable = [
      ...doc.querySelectorAll<HTMLElement>("a[href], button, input, select"),
    ].filter((el) => !el.closest("[hidden], [inert]"));
    const skip = focusable.findIndex((el) =>
      el.getAttribute("href")?.startsWith("#"),
    );
    expect(focusable[skip + 1]).toBe(link);
  });
});
