/**
 * #424 — the NorthGuild mark keeps its drawn shapes, carries no colour of its
 * own, and its token colours hold contrast in both themes (WCAG 2.2 SC 1.4.11
 * for the shield, a 4.5:1 house floor for the `</>` glyphs).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  darkBlock,
  hexOf,
  lightBlock,
  ratio,
  STYLES,
} from "~/test/token-contrast";

const svg = readFileSync(
  path.resolve(import.meta.dirname, "..", "assets", "northguild-logo.svg"),
  "utf8",
);
const primitives = readFileSync(
  path.join(STYLES, "gmt-primitives.css"),
  "utf8",
);

const CLASSES = [
  "gmt-ng-body",
  "gmt-ng-body-lit",
  "gmt-ng-field",
  "gmt-ng-field-lit",
  "gmt-ng-glyph",
];
const TOKENS = [
  "--gmt-logo-body",
  "--gmt-logo-body-lit",
  "--gmt-logo-field",
  "--gmt-logo-field-lit",
  "--gmt-logo-glyph",
];
const SURFACES = ["--gmt-void", "--gmt-surface", "--gmt-surface-2"];

describe("NorthGuild mark asset", () => {
  it("keeps the shield's five shapes byte for byte", () => {
    const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
    expect(paths).toHaveLength(5);
    const ds = paths.map((p) => /\sd="([^"]*)"/.exec(p)![1]!);
    expect(createHash("sha256").update(ds.join("\n")).digest("hex")).toBe(
      "0268a20c07b649905c3785c21869f72775ccf2148449468b0ef204227ca509bd",
    );
  });

  it("keeps the viewBox", () => {
    expect(svg).toContain('viewBox="0 0 1000 1317"');
  });

  it("carries no colour, role or label of its own", () => {
    expect(svg).not.toMatch(/fill=/);
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(svg).not.toMatch(/\brole=/);
    expect(svg).not.toMatch(/aria-label=/);
  });

  it("names its five parts by class, in drawing order", () => {
    const classes = [...svg.matchAll(/<path\b[^>]*\sclass="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(classes).toEqual(CLASSES);
  });
});

describe("NorthGuild mark tokens", () => {
  it("defines all five tokens for dark and the body pair for light", () => {
    for (const token of TOKENS) {
      expect(darkBlock, token).toMatch(new RegExp(`${token}:\\s*#`));
    }
    for (const token of ["--gmt-logo-body", "--gmt-logo-body-lit"]) {
      expect(lightBlock, token).toMatch(new RegExp(`${token}:\\s*#`));
    }
  });

  it("fills each class from its token", () => {
    CLASSES.forEach((cls, i) => {
      expect(primitives, cls).toMatch(
        new RegExp(`\\.${cls}\\s*\\{[^}]*fill:\\s*var\\(${TOKENS[i]}\\)`),
      );
    });
  });

  describe.each(["dark", "light"] as const)("in %s mode", (theme) => {
    it.each(["--gmt-logo-body", "--gmt-logo-body-lit"])(
      "%s clears 3:1 on every header surface",
      (token) => {
        for (const surface of SURFACES) {
          expect(
            ratio(hexOf(token, theme), hexOf(surface, theme)),
            `${token} on ${surface}`,
          ).toBeGreaterThanOrEqual(3);
        }
      },
    );

    it.each(["--gmt-logo-body", "--gmt-logo-body-lit"])(
      "the glyph clears 4.5:1 on %s",
      (body) => {
        expect(
          ratio(hexOf("--gmt-logo-glyph", theme), hexOf(body, theme)),
        ).toBeGreaterThanOrEqual(4.5);
      },
    );
  });
});
