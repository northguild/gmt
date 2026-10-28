/**
 * The 7:1 body-text target for the text colours a widget reads from tokens.
 *
 * Resolves each token to a hex through the stylesheet (one level of `var()`),
 * per theme, and measures it against the opaque surfaces text sits on. A text
 * colour on a translucent fill is measured against the page behind it, which is
 * the lighter case in light mode and the darker in dark mode; the surfaces below
 * are the extremes.
 */

import { hexOf, ratio } from "~/test/token-contrast";

const SURFACES: Record<"dark" | "light", string[]> = {
  dark: ["--gmt-void", "--gmt-surface", "--gmt-surface-2"],
  light: ["--gmt-void", "--gmt-surface", "--gmt-surface-2"],
};

// Every token a widget colours text with that this change touched.
const TEXT_TOKENS: Array<[string, "dark" | "light"]> = [
  ["--gmt-cyan-ink", "light"],
  ["--gmt-cyan-ink", "dark"],
  ["--gmt-syntax-num", "light"],
  ["--gmt-syntax-num", "dark"],
  ["--gmt-ice", "dark"],
  ["--gmt-ice", "light"],
];

describe("text tokens against the surfaces they sit on", () => {
  it.each(TEXT_TOKENS)("%s in %s mode clears 7:1", (token, theme) => {
    const fg = hexOf(token, theme);
    /* Code is drawn on a 6% teal wash over the page, never on `--gmt-surface-2`
       (#ececec, the hover and popover fill), so a syntax colour is measured
       against the page and card surfaces only. */
    const surfaces = token.startsWith("--gmt-syntax")
      ? SURFACES[theme].slice(0, 2)
      : SURFACES[theme];
    for (const surface of surfaces) {
      expect(
        ratio(fg, hexOf(surface, theme)),
        `${token} on ${surface}`,
      ).toBeGreaterThanOrEqual(7);
    }
  });
});
