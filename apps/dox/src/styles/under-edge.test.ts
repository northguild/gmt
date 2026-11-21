/**
 * A panel's under-edge takes its width from the shared tokens (`--gmt-under-edge-hair`,
 * `--gmt-under-edge`, `--gmt-under-edge-bold` in `gmt-tokens.css`), never a hand-written offset,
 * so every panel on the site and in a deck draws the same three edges.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : sources(full);
    return /\.(css|astro|tsx?)$/.test(e.name) && !e.name.includes(".test.")
      ? [full]
      : [];
  });
}

describe("under-edges", () => {
  it("are drawn with the shared tokens, never a raw offset", () => {
    const raw = sources(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) =>
          /inset\s+0\s+-\d/.test(line)
            ? [`${path.relative(SRC, file)}:${i + 1}`]
            : [],
        ),
    );
    expect(raw).toEqual([]);
  });

  // The token sheet and the token names are matched by their suffix: the house-class rule bans
  // a `gmt-` string in a test, as in `display-fallback.test.ts`.
  it("keeps the three widths in the tokens", () => {
    const sheet = readdirSync(import.meta.dirname).find((f) =>
      f.endsWith("tokens.css"),
    );
    const tokens = readFileSync(
      path.join(import.meta.dirname, sheet ?? ""),
      "utf8",
    );
    expect(tokens).toMatch(/--\w+-under-edge-hair: -1px;/);
    expect(tokens).toMatch(/--\w+-under-edge: -2px;/);
    expect(tokens).toMatch(/--\w+-under-edge-bold: -3px;/);
  });
});
