import { readFileSync } from "node:fs";
import { TOKENS_CSS, syntaxPalette } from "./code-themes";

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
