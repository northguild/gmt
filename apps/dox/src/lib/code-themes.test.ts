import { readFileSync } from "node:fs";
import { TOKENS_CSS, codeSurface, syntaxPalette } from "./code-themes";
import { ratio } from "../test/token-contrast";

const css = readFileSync(TOKENS_CSS, "utf8");

describe("syntaxPalette", () => {
  it("reads a hex value for each role in both themes", () => {
    const { dark, light } = syntaxPalette(css);
    for (const value of [...Object.values(dark), ...Object.values(light)]) {
      expect(value).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it("reads the same palette from a CRLF checkout", () => {
    expect(syntaxPalette(css.replace(/\n/g, "\r\n"))).toEqual(
      syntaxPalette(css),
    );
  });
});

describe("codeSurface", () => {
  it("draws the see-through code wash on the page background in each mode", () => {
    // Dark: --gmt-teal #0e7490 at 8% on --gmt-void #03080c. Light: #22d3ee at 6% on #ffffff.
    expect(codeSurface(css)).toEqual({ dark: "#041117", light: "#f2fcfe" });
  });
});

describe("the code-frame floor", () => {
  // Expressive Code does not adjust the colours (`minSyntaxHighlightingColorContrast: 0`), so
  // each role reaches the page as written and has to clear 7:1 on the surface it is drawn on.
  it.for(["dark", "light"] as const)(
    "holds every syntax role to 7:1 on the %s code surface",
    (mode) => {
      const surface = codeSurface(css)[mode];
      for (const [role, value] of Object.entries(syntaxPalette(css)[mode])) {
        expect(ratio(value, surface), role).toBeGreaterThanOrEqual(7);
      }
    },
  );
});
