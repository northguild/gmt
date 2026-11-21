/**
 * A slide's gaps, padding and margins come from the deck scale in `gmt-tokens.css`
 * (`--gmt-deck-space-*`, and `--gmt-deck-pad-*` and `--gmt-deck-clock-room` for the frame), so a
 * second deck composes the same spacing instead of copying or guessing numbers.
 *
 * A position that mirrors a drawing (the ice wall's panes from `paneLayout`) is not spacing: the
 * deck names it as its own custom property and the rule reads that.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "..");
const SHEETS = [
  "components/slides",
  "slides",
  "widgets/builders/presenter.module.css",
];

function sheets(rel: string): string[] {
  const full = path.join(SRC, rel);
  if (rel.endsWith(".css")) return [rel];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sheets(path.join(rel, e.name))
      : e.name.endsWith(".css")
        ? [path.join(rel, e.name)]
        : [],
  );
}

const SPACING =
  /(?:^|[;{\s])(gap|row-gap|column-gap|padding(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|inset(?:-[a-z-]+)?|border-spacing|--ec-codePad(?:Blk|Inl))\s*:\s*([^;{}]*)/g;

describe("slide spacing", () => {
  it("uses the deck scale, never a raw container size", () => {
    const raw = SHEETS.flatMap(sheets).flatMap((rel) => {
      const css = readFileSync(path.join(SRC, rel), "utf8").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );
      return [...css.matchAll(SPACING)].flatMap(([, prop, value]) =>
        [...value!.matchAll(/(?<![\w.(-])\d*\.?\d+cqi\b/g)].map(
          ([v]) => `${rel}: ${v} (${prop})`,
        ),
      );
    });
    expect(raw).toEqual([]);
  });
});
