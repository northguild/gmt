/**
 * @vitest-environment jsdom
 *
 * The NorthGuild mark draws the same six paths as the northguild.dev header, takes its paint from
 * the style sheet, and gives each copy on a page gradient ids of its own.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MARK_VIEW_BOX, markInner, nextMarkInstance } from "~/lib/ng-mark";
import { STYLES } from "~/test/token-contrast";

const PANE =
  "M500 0 L0 179.1 L0 709.1 C0 1018.6 373.1 1206.2 500 1317 C626.9 1206.2 1000 1018.6 1000 709.1 L1000 179.1 Z";
const PATHS = {
  pane: PANE,
  sheen: "M500 0 L0 179.1 L0 709.1 C0 1018.6 373.1 1206.2 500 1317 Z",
  inner:
    "M93.3 243.9 L500 99 L906.7 243.9 L906.7 686.5 L709.3 390.2 L654.9 470.3 L500 239.5 L345.1 470.3 L290.7 390.2 L93.3 686.5 Z",
  edge: PANE,
  ridge:
    "M93.3 686.5 L290.7 390.2 L345.1 470.3 L500 239.5 L654.9 470.3 L709.3 390.2 L906.7 686.5",
  glyph:
    "M366 640 L212 736.5 L366 833 M634 640 L788 736.5 L634 833 M560 560 L443 910",
};

/** A copy of the mark in the test's document, as the component renders it. */
function render(instance: number): SVGSVGElement {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEW_BOX}" aria-hidden="true" focusable="false">${markInner(instance)}</svg>`,
    "image/svg+xml",
  );
  const svg = document.adoptNode(
    doc.documentElement,
  ) as unknown as SVGSVGElement;
  document.body.append(svg);
  return svg;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("NorthGuild mark asset", () => {
  it("keeps the viewBox", () => {
    expect(MARK_VIEW_BOX).toBe("0 0 1000 1317");
  });

  it("draws the six paths, verbatim and in order", () => {
    const drawn = [...render(1).querySelectorAll("path")].map((p) =>
      p.getAttribute("d"),
    );
    expect(drawn).toEqual([
      PATHS.pane,
      PATHS.sheen,
      PATHS.inner,
      PATHS.edge,
      PATHS.ridge,
      PATHS.glyph,
    ]);
  });

  it("is hidden from assistive technology and takes no focus", () => {
    const svg = render(1);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("gives each copy gradient ids of its own", () => {
    const ids = (svg: SVGSVGElement) =>
      [...svg.querySelectorAll("[id]")].map((el) => el.id);
    const first = ids(render(1));
    const second = ids(render(2));
    expect(first).toEqual(["ng-mark-pane-1", "ng-mark-sheen-1"]);
    expect(second).toEqual(["ng-mark-pane-2", "ng-mark-sheen-2"]);
  });

  it("points every url(#…) at an id in the same SVG", () => {
    for (const instance of [1, 2]) {
      const svg = render(instance);
      const refs = [...svg.querySelectorAll("[fill^='url(']")].map(
        (el) => /url\(#([^)]+)\)/.exec(el.getAttribute("fill") ?? "")?.[1],
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(svg.querySelector(`[id="${ref}"]`), String(ref)).not.toBeNull();
      }
    }
  });

  it("counts copies per page", () => {
    const pageA = {};
    const pageB = {};
    expect([
      nextMarkInstance(pageA),
      nextMarkInstance(pageA),
      nextMarkInstance(pageB),
    ]).toEqual([1, 2, 1]);
  });
});

describe("NorthGuild mark paint", () => {
  const primitives = readFileSync(
    path.join(
      STYLES,
      readdirSync(STYLES).find((f) => f.endsWith("primitives.css")) ?? "",
    ),
    "utf8",
  );
  const section = primitives.slice(
    primitives.indexOf("---- NorthGuild mark and wordmark"),
    primitives.indexOf("---- The Dox mark"),
  );

  it("paints every part the asset names", () => {
    for (const part of render(1).querySelectorAll("path, stop")) {
      const name = part.getAttribute("class") ?? "";
      // The two gradient fills are attributes; every other part is painted by the sheet.
      if (part.hasAttribute("fill")) continue;
      expect(section, name).toContain(`.${name}`);
    }
  });

  it("draws from the ice token, with no colour literal", () => {
    expect(section).toMatch(/var\(--[a-z]+-ice\)/);
    expect(section).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});
