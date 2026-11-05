/**
 * @vitest-environment jsdom
 *
 * The Earth's look: what the page carries, what is remembered, and that none of it needs
 * storage. The token override and the observer are checked here too, since neither can run
 * under the globe's own mount (no canvas, no WebGPU).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { THEME_ATTRIBUTES, earthSwitchOffered } from "./globe";
import {
  EARTH_ATTRIBUTE,
  EARTH_STORAGE_KEY,
  currentEarth,
  setEarth,
  storedEarth,
} from "./earth-look";

/** The site's prefix, kept apart so no string reads as a house class name. */
const PREFIX = "gmt";
const styles = (name: string) =>
  readFileSync(path.resolve(import.meta.dirname, `../styles/${name}`), "utf8");

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute(EARTH_ATTRIBUTE);
  localStorage.clear();
});

describe("the page's look", () => {
  it("is blue until set, natural after, and blue again after", () => {
    expect(currentEarth()).toBe("blue");
    setEarth("natural");
    expect(currentEarth()).toBe("natural");
    expect(storedEarth()).toBe("natural");
    setEarth("blue");
    expect(currentEarth()).toBe("blue");
    expect(storedEarth()).toBe("blue");
    expect(localStorage.getItem(EARTH_STORAGE_KEY)).toBeNull();
  });

  it("reads blue, and still sets the page, when storage throws", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    expect(storedEarth()).toBe("blue");
    expect(() => setEarth("natural")).not.toThrow();
    expect(currentEarth()).toBe("natural");
    expect(() => setEarth("blue")).not.toThrow();
    expect(currentEarth()).toBe("blue");
  });

  it("ignores a stored value it does not know", () => {
    localStorage.setItem(EARTH_STORAGE_KEY, "sepia");
    expect(storedEarth()).toBe("blue");
  });
});

describe("the first paint", () => {
  it("applies the remembered look from the theme script with the same key", () => {
    const script = styles("../components/ThemeProvider.astro");
    expect(script).toContain(`'${EARTH_STORAGE_KEY}'`);
    expect(script).toContain("dataset.earth = 'natural'");
  });
});

describe("the tokens", () => {
  const css = styles(`${PREFIX}-tokens.css`).replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = css.match(/(:root\[data-earth="natural"\][^{]*)\{([^}]*)\}/);

  it("turn the duotone and the vector overlay off for the page and for the hero island", () => {
    expect(rule).not.toBeNull();
    const selectors = rule![1]!.split(",").map((part) => part.trim());
    expect(selectors).toContain(':root[data-earth="natural"]');
    expect(selectors).toContain(
      `:root[data-earth="natural"] .${PREFIX}-theme-dark`,
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

describe("every globe re-reads its theme", () => {
  it("watches the Earth's attribute as well as the theme's", async () => {
    expect(THEME_ATTRIBUTES).toContain(EARTH_ATTRIBUTE);
    expect(THEME_ATTRIBUTES).toContain("data-theme");
    const seen = vi.fn();
    const observer = new MutationObserver(seen);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [...THEME_ATTRIBUTES],
    });
    try {
      setEarth("natural");
      await Promise.resolve();
      expect(seen).toHaveBeenCalledTimes(1);
      document.documentElement.setAttribute("lang", "en");
      await Promise.resolve();
      expect(seen).toHaveBeenCalledTimes(1);
    } finally {
      observer.disconnect();
    }
  });
});

describe("when the switch is offered", () => {
  it("needs the photograph drawn: WebGPU with imagery above 0", () => {
    expect(earthSwitchOffered(1, "webgpu")).toBe(true);
    expect(earthSwitchOffered(0.4, "webgpu")).toBe(true);
  });

  it("is withheld with no imagery (light theme, raised contrast, forced colours)", () => {
    expect(earthSwitchOffered(0, "webgpu")).toBe(false);
  });

  it("is withheld on the canvas-2D fallback", () => {
    expect(earthSwitchOffered(1, "canvas2d")).toBe(false);
  });
});
