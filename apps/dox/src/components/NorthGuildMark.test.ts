/**
 * @vitest-environment jsdom
 *
 * #424 — the NorthGuild mark keeps its drawn shapes, carries no colour of its
 * own, and its token colours hold contrast in both themes (WCAG 2.2 SC 1.4.11
 * for the shield, a 4.5:1 house floor for the `</>` glyphs).
 *
 * The mark is an inlined SVG whose paths are painted by the style sheet, so the
 * contract lives in the asset and the sheet together. The test reads the asset
 * as a document and finds each part's class, the token that paints it and the
 * surfaces it sits on from the sheets themselves, so a rename moves the test
 * with it and a part left unpainted fails.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  darkBlock,
  hexOf,
  lightBlock,
  ratio,
  STYLES,
} from "~/test/token-contrast";

const svgSource = readFileSync(
  path.resolve(import.meta.dirname, "..", "assets", "northguild-logo.svg"),
  "utf8",
);
/* A parsed document has no window of its own, which jest-dom needs to recognise an
   element, so the mark is adopted into the test's document. */
const mark = document.adoptNode(
  new DOMParser()
    .parseFromString(svgSource, "text/html")
    .getElementsByTagName("svg")[0]!,
);
document.body.append(mark);
afterAll(() => mark.remove());
const parts = [...mark.getElementsByTagName("path")];

const primitivesFile = readdirSync(STYLES).find((name) =>
  name.endsWith("primitives.css"),
);
if (!primitivesFile) throw new Error("the primitives style sheet is missing");
const primitives = readFileSync(path.join(STYLES, primitivesFile), "utf8");

/** A part's class, in drawing order. */
const classOf = (part: Element) => part.getAttribute("class") ?? "";
/** The part's role in the mark: the class without its namespace prefix. */
const roleOf = (cls: string) => /^[a-z]+-ng-(.+)$/.exec(cls)?.[1] ?? cls;

/** The token a class paints its fill from, read from the primitives sheet. */
function fillTokenOf(cls: string): string | undefined {
  const rule = new RegExp(`\\.${cls}\\s*\\{[^}]*fill:\\s*var\\((--[\\w-]+)\\)`);
  return rule.exec(primitives)?.[1];
}

/** The header surfaces the mark can sit on, named by the token sheet. */
const SURFACES = [
  ...new Set(
    [...darkBlock.matchAll(/(--[a-z]+-(?:void|surface-2|surface))\s*:/g)].map(
      (m) => m[1]!,
    ),
  ),
];

const BODY_ROLES = ["body", "body-lit"];

describe("NorthGuild mark asset", () => {
  it("keeps the shield's five shapes byte for byte", () => {
    expect(parts).toHaveLength(5);
    const ds = parts.map((part) => part.getAttribute("d") ?? "");
    expect(createHash("sha256").update(ds.join("\n")).digest("hex")).toBe(
      "0268a20c07b649905c3785c21869f72775ccf2148449468b0ef204227ca509bd",
    );
  });

  it("keeps the viewBox", () => {
    expect(mark).toHaveAttribute("viewBox", "0 0 1000 1317");
  });

  it("carries no colour, role or label of its own", () => {
    for (const el of [mark, ...parts]) {
      expect(el).not.toHaveAttribute("fill");
      expect(el).not.toHaveAttribute("role");
      expect(el).not.toHaveAttribute("aria-label");
      for (const attr of el.getAttributeNames()) {
        expect(el.getAttribute(attr)).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    }
  });

  it("names its five parts by class, in drawing order", () => {
    expect(parts.map((part) => roleOf(classOf(part)))).toEqual([
      "body",
      "body-lit",
      "field",
      "field-lit",
      "glyph",
    ]);
  });
});

describe("NorthGuild mark tokens", () => {
  const classes = parts.map(classOf);

  it("paints every part from its own token", () => {
    const tokens = classes.map(fillTokenOf);
    expect(tokens.every((token) => token !== undefined)).toBe(true);
    expect(new Set(tokens).size).toBe(classes.length);
  });

  it("defines every token for dark and the body pair for light", () => {
    for (const cls of classes) {
      const token = fillTokenOf(cls)!;
      expect(darkBlock, token).toMatch(new RegExp(`${token}:\\s*#`));
      if (BODY_ROLES.includes(roleOf(cls))) {
        expect(lightBlock, token).toMatch(new RegExp(`${token}:\\s*#`));
      }
    }
  });

  it("finds the three header surfaces", () => {
    expect(SURFACES).toHaveLength(3);
  });

  describe.each(["dark", "light"] as const)("in %s mode", (theme) => {
    const bodyTokens = classes
      .filter((cls) => BODY_ROLES.includes(roleOf(cls)))
      .map((cls) => fillTokenOf(cls)!);
    const glyphToken = fillTokenOf(
      classes.find((cls) => roleOf(cls) === "glyph")!,
    )!;

    it.each(bodyTokens)("%s clears 3:1 on every header surface", (token) => {
      for (const surface of SURFACES) {
        expect(
          ratio(hexOf(token, theme), hexOf(surface, theme)),
          `${token} on ${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it.each(bodyTokens)("the glyph clears 4.5:1 on %s", (body) => {
      expect(
        ratio(hexOf(glyphToken, theme), hexOf(body, theme)),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
});
