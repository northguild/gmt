/**
 * @vitest-environment jsdom
 *
 * The page's look: what the page carries, what is remembered, and that none of it needs
 * storage. The token override and the first-paint script are checked here too, since neither
 * can run under the globe's own mount (no canvas, no WebGPU).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  LOOK_ATTRIBUTE,
  LOOK_STORAGE_KEY,
  currentLook,
  paintLook,
  setLook,
} from "./look";

/** The site's prefix, kept apart so no string reads as a house class name. */
const PREFIX = "gmt";
const styles = (name: string) =>
  readFileSync(path.resolve(import.meta.dirname, `../styles/${name}`), "utf8");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(LOOK_ATTRIBUTE);
  localStorage.clear();
});

describe("the page's look", () => {
  it("is ice until set, natural after, and ice again after, with the key removed", () => {
    expect(currentLook()).toBe("ice");
    setLook("natural");
    expect(currentLook()).toBe("natural");
    expect(localStorage.getItem(LOOK_STORAGE_KEY)).toBe("natural");
    setLook("ice");
    expect(currentLook()).toBe("ice");
    expect(document.documentElement).not.toHaveAttribute(LOOK_ATTRIBUTE);
    expect(localStorage.getItem(LOOK_STORAGE_KEY)).toBeNull();
  });

  it("still sets the page, and throws nothing, when storage throws", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    expect(() => setLook("natural")).not.toThrow();
    expect(currentLook()).toBe("natural");
    expect(() => setLook("ice")).not.toThrow();
    expect(currentLook()).toBe("ice");
  });

  it("ignores an attribute value it does not know", () => {
    document.documentElement.setAttribute(LOOK_ATTRIBUTE, "sepia");
    expect(currentLook()).toBe("ice");
  });
});

describe("the look a body paints", () => {
  it("is the page's look, and ice under raised contrast", () => {
    setLook("natural");
    expect(paintLook()).toBe("natural");
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-contrast: more)",
    }));
    expect(paintLook()).toBe("ice");
  });
});

describe("the first paint", () => {
  it("applies the remembered look from the theme script with the same key", () => {
    const script = styles("../components/ThemeProvider.astro");
    expect(script).toContain(`'${LOOK_STORAGE_KEY}'`);
    expect(script).toContain("dataset.look = 'natural'");
  });
});

describe("the tokens", () => {
  const css = styles(`${PREFIX}-tokens.css`).replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = css.match(/(:root\[data-look="natural"\][^{]*)\{([^}]*)\}/);

  it("turn the duotone and the vector overlay off for the page and for the hero island", () => {
    expect(rule).not.toBeNull();
    const selectors = rule![1]!.split(",").map((part) => part.trim());
    expect(selectors).toContain(':root[data-look="natural"]');
    expect(selectors).toContain(
      `:root[data-look="natural"] .${PREFIX}-theme-dark`,
    );
    expect(rule![2]).toMatch(
      new RegExp(`--${PREFIX}-globe-imagery-duotone:\\s*0;`),
    );
    expect(rule![2]).toMatch(
      new RegExp(`--${PREFIX}-globe-vector-overlay:\\s*0;`),
    );
  });

  it("leave the imagery's own opacity to the theme and the preferences", () => {
    expect(rule![2]).not.toContain("imagery-alpha");
  });
});
