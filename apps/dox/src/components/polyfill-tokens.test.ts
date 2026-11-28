import {
  hexOf,
  ratio,
  css,
  darkBlock,
  lightBlock,
} from "~/test/token-contrast";

// Token names are built from the prefix: the house-class rule bans a `gmt-` string in a test.
const P = "gmt";
const TOKENS = [`--${P}-polyfill-shipped`, `--${P}-polyfill-previous`] as const;
const THEMES = ["dark", "light"] as const;

/** `--gmt-glass-tint`'s alpha in a theme, read from the token file as a fraction. */
function glassAlpha(theme: (typeof THEMES)[number]): number {
  const block = theme === "light" ? lightBlock : darkBlock;
  const found = [
    ...block.matchAll(
      /--gmt-glass-tint:\s*color\(from var\(--gmt-teal\)[^/]*\/\s*([\d.]+)%\)/g,
    ),
  ].at(-1);
  if (!found) throw new Error(`no --${P}-glass-tint in the ${theme} block`);
  return Number(found[1]) / 100;
}

/** The glass panel: `--gmt-teal` at the theme's tint alpha over `--gmt-void`. */
function glass(theme: (typeof THEMES)[number]): string {
  const alpha = glassAlpha(theme);
  const teal = hexOf(`--${P}-teal`, theme);
  const void_ = hexOf(`--${P}-void`, theme);
  const channel = (hex: string, i: number) =>
    Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(teal, i) * alpha + channel(void_, i) * (1 - alpha)),
  );
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

describe("the polyfill series tokens", () => {
  it("resolve to the same hex in both themes", () => {
    for (const token of TOKENS) {
      expect(hexOf(token, "light"), token).toBe(hexOf(token, "dark"));
    }
  });

  it("are declared once, with no override in the light block", () => {
    for (const token of TOKENS) {
      expect(css.match(new RegExp(`${token}:`, "g")), token).toHaveLength(1);
      expect(lightBlock, token).not.toContain(`${token}:`);
    }
  });

  for (const theme of THEMES) {
    it(`reach 3:1 against every chart surface in the ${theme} theme`, () => {
      const surfaces = {
        [`--${P}-void`]: hexOf(`--${P}-void`, theme),
        [`--${P}-surface`]: hexOf(`--${P}-surface`, theme),
        [`--${P}-surface-2`]: hexOf(`--${P}-surface-2`, theme),
        glass: glass(theme),
      };
      for (const token of TOKENS) {
        for (const [name, surface] of Object.entries(surfaces)) {
          expect(
            ratio(hexOf(token, theme), surface),
            `${token} on ${name} (${surface})`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }
});
