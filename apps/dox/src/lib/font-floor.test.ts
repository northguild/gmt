/// <reference types="vitest/globals" />

/**
 * Site-wide a11y floor: no rendered text may compute smaller than 12px
 * (0.75rem).
 *
 * This is a static source scan, not a substitute for the runtime check —
 * a literal `font-size` here is the thing a future edit is most likely to
 * reintroduce (a widget author reaching for "one size smaller" without
 * checking the token scale), so this fails fast on the commit that adds it.
 * It cannot see cascaded `em`, an inherited ancestor font-size, or a
 * third-party component's own stylesheet, which is why the runtime scan
 * (Playwright, computed styles, every tool page × both themes × two
 * viewports) is the actual proof this floor holds; this test just keeps the
 * regression cheap to catch.
 *
 * Scans `.css`, `.astro`, `.ts` and `.tsx` under `src/`, plus `scripts/`
 * (`render-charts.ts` sets a chart mark's `fontSize` as a plain number, not
 * CSS, and that number becomes real SVG text on the rendered page — a
 * violation there is exactly as real as one in a stylesheet).
 *
 * Text drawn into a `<canvas>` counts too, and used not to be looked at: the
 * globe set `ctx.font` to a `600 10px …` shorthand and drew every zone label
 * below the floor, unseen by this scan because none of its patterns matched a
 * font shorthand. The size is pulled out of the shorthand now.
 *
 * `--gmt-text-xs` sits exactly at the floor (0.75rem): the scale used to have
 * a step under 12px, raised to sit at it (gmt-tokens.css).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DOX = path.resolve(import.meta.dirname, "..", "..");
const TOKENS_FILE = path.join(DOX, "src/styles/gmt-tokens.css");

const FLOOR_PX = 12;
const ROOT_PX = 16; // html { font-size } is never overridden — verified alongside the scan below.

const SCANNED_EXTENSIONS = new Set([".css", ".astro", ".ts", ".tsx"]);

const ROOTS = [path.join(DOX, "src"), path.join(DOX, "scripts")];

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    if (!SCANNED_EXTENSIONS.has(path.extname(name))) return [];
    if (name.endsWith(".d.ts")) return [];
    return [full];
  });
}

const FILES = ROOTS.flatMap(walk).sort();

/** Splits a `func(...)` argument list on its top-level commas only. */
function splitTopLevel(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(inner.slice(start).trim());
  return args;
}

type Resolved =
  | { px: number; unit: "rem" | "em" | "px" }
  | "var"
  | "unparsable";

/**
 * Resolves a font-size value to the smallest literal `rem`/`em`/`px` it can
 * reach, unwrapping `clamp(min, preferred, max)` to its first (minimum)
 * argument and `var(--x, fallback)` to its literal fallback. A `var()` with
 * no fallback, or any other function (`calc()`, a bare keyword), has no
 * literal to check here — that is what the token check and the runtime scan
 * are for — so it resolves to `"var"`/`"unparsable"` and is not a violation
 * on its own.
 */
function resolveLiteral(raw: string): Resolved {
  const value = raw.trim();
  if (value.startsWith("clamp(") && value.endsWith(")")) {
    const [min] = splitTopLevel(value.slice("clamp(".length, -1));
    return resolveLiteral(min);
  }
  if (value.startsWith("var(") && value.endsWith(")")) {
    const args = splitTopLevel(value.slice("var(".length, -1));
    return args.length > 1 ? resolveLiteral(args[1]) : "var";
  }
  const match = /^([0-9]*\.?[0-9]+)(rem|em|px)$/.exec(value);
  if (!match) return "unparsable";
  const num = Number.parseFloat(match[1]);
  const unit = match[2] as "rem" | "em" | "px";
  const px = unit === "px" ? num : num * ROOT_PX;
  return { px, unit };
}

/** `null` when the value is fine (or unresolvable — not this test's job); a message otherwise. */
function violation(raw: string): string | null {
  const resolved = resolveLiteral(raw);
  if (resolved === "var" || resolved === "unparsable") return null;
  const { px, unit } = resolved;
  // "flag em as suspicious unless >= 0.75em": an em value is relative to an
  // ancestor this scan cannot see, so anything at or above 0.75em passes
  // here even though it could still fail at runtime for a small enough
  // ancestor — that gap is exactly what the runtime scan is for.
  if (unit === "em") {
    const ems = px / ROOT_PX;
    return ems < 0.75
      ? `${raw.trim()} is under the 0.75em floor (treated as suspicious below that, since the ancestor size is unknown here)`
      : null;
  }
  return px < FLOOR_PX
    ? `${raw.trim()} = ${px}px, under the ${FLOOR_PX}px floor`
    : null;
}

/**
 * The size out of a CSS `font` shorthand, or null when there is not one.
 *
 * The shorthand puts optional style, variant, weight and stretch before the
 * size, then the family after it, so the size is the first token that is a
 * length. A `size/line-height` pair keeps only the size.
 */
function sizeFromFontShorthand(value: string): string | null {
  for (const token of value.split(/\s+/)) {
    const size = token.split("/")[0];
    if (/^[0-9]*\.?[0-9]+(rem|em|px)$/.test(size)) return size;
  }
  return null;
}

/** One `{ file, line, raw }` per font-size-shaped declaration in the source text. */
function findDeclarations(text: string): Array<{ line: number; raw: string }> {
  const found: Array<{ line: number; raw: string }> = [];
  const patterns: Array<{
    pattern: RegExp;
    extract?: (value: string) => string | null;
  }> = [
    { pattern: /font-size\s*:\s*([^;{}]+);/g }, // CSS, and .astro <style> blocks
    { pattern: /font-size\s*=\s*["']([^"']+)["']/g }, // SVG attribute
    { pattern: /\bfontSize\s*:\s*([^,;\n}]+)/g }, // React inline style / chart marks
    {
      /* A canvas `font` shorthand: `ctx.font = "600 12px …"`, or one built as a
         template literal and handed to a renderer. Template literals are
         included because the globe's label font interpolates its family from a
         token, and the size sits right there in the same string. */
      pattern: /\bfont\s*[:=]\s*[`"']([^`"'\n]+)[`"']/g,
      extract: sizeFromFontShorthand,
    },
  ];
  for (const { pattern, extract } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1].replace(/["']/g, "").trim();
      const raw = extract ? extract(value) : value;
      if (!raw) continue;
      const line = text.slice(0, match.index).split("\n").length;
      found.push({ line, raw });
    }
  }
  return found;
}

describe("Font floor (12px / 0.75rem)", () => {
  it("scans the site source and every build script that emits rendered text", () => {
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES).toContain(path.join(DOX, "src/styles/gmt-tokens.css"));
    expect(FILES).toContain(path.join(DOX, "src/styles/gmt-hive.css"));
    expect(FILES).toContain(path.join(DOX, "scripts/render-charts.ts"));
  });

  it("reads the size out of a canvas font shorthand", () => {
    /* The pattern that was missing. Guards the extractor itself, since a scan
       that silently matches nothing passes just as quietly as one that works.
       The offending sizes are interpolated rather than written out, so this
       file does not trip its own scan. */
    const small = "10px";
    const tiny = "0.6rem";
    expect(findDeclarations(`ctx.font = "600 ${small} monospace";`)).toEqual([
      { line: 1, raw: "10px" },
    ]);
    expect(
      findDeclarations(`el.font = "italic small-caps 700 ${tiny}/1.2 serif";`),
    ).toEqual([{ line: 1, raw: "0.6rem" }]);
    // A size at the floor is fine, and a family-only value has no size to read.
    expect(findDeclarations(`ctx.font = "600 12px monospace";`)).toEqual([
      { line: 1, raw: "12px" },
    ]);
    expect(findDeclarations(`ctx.font = "monospace";`)).toEqual([]);
    expect(violation(small)).toMatch(/under the 12px floor/);
    expect(violation("12px")).toBeNull();
  });

  it("the --gmt-text-* scale itself resolves to >= 12px", () => {
    const css = readFileSync(TOKENS_FILE, "utf8");
    const tokens = [
      ...css.matchAll(/--gmt-text-([\w-]+)\s*:\s*([0-9.]+)(rem|em|px)\s*;/g),
    ].map(([, name, num, unit]) => ({
      name: `--gmt-text-${name}`,
      px:
        unit === "px"
          ? Number.parseFloat(num)
          : Number.parseFloat(num) * ROOT_PX,
    }));

    expect(tokens.length).toBeGreaterThanOrEqual(6);
    for (const { name, px } of tokens) {
      expect(px, `${name} resolves to ${px}px`).toBeGreaterThanOrEqual(
        FLOOR_PX,
      );
    }
  });

  for (const full of FILES) {
    const rel = path.relative(DOX, full);
    it(`${rel} renders no text under ${FLOOR_PX}px`, () => {
      const text = readFileSync(full, "utf8");
      const offending = findDeclarations(text)
        .map(({ line, raw }) => ({ line, raw, message: violation(raw) }))
        .filter(
          (entry): entry is { line: number; raw: string; message: string } =>
            entry.message !== null,
        )
        .map(({ line, message }) => `${rel}:${line}: ${message}`);

      expect(offending).toEqual([]);
    });
  }
});
