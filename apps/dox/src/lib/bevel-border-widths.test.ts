/**
 * Guard: a bevelled box never has border sides of different widths.
 *
 * Chromium paints `corner-shape: bevel` wrongly when the sides differ: the colour of the thick
 * side runs along part of the opposite edge (a 3px series-coloured bottom bar showed as a
 * partial line along the top). The house fix is one width on every side, the accent colour on
 * the one side, and the extra thickness drawn as an inset `box-shadow` (with the same amount
 * added to padding where the old border took layout room).
 *
 * A side of width 0 is ignored: it paints nothing, and a band with only side edges draws cleanly.
 *
 * The scan parses every stylesheet and every `<style>` block under `src/` with PostCSS, and
 * resolves the four side widths of each rule from `border`, `border-width`, `border-block*`,
 * `border-inline*` and the physical side forms. A rule is reported when
 *
 *   - its own sides differ and the rule, or its file, declares `corner-shape: bevel`, or
 *   - it sets only some sides (an override of one side, such as a state variant) and the
 *     value is not the hairline, in a file that declares `corner-shape: bevel`.
 *
 * The bevel can come from another rule or a shared class, so "the file declares one" is the
 * test, not "this rule does".
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import postcss, { type Declaration, type Root, type Rule } from "postcss";

const DOX = path.resolve(import.meta.dirname, "..", "..");
const SRC = path.join(DOX, "src");

// `postcss` is pinned to the version `postcss-html` (stylelint's HTML syntax) resolves, so the
// scan parses with the same version the CSS gate uses.
const htmlSyntax = createRequire(import.meta.url)("postcss-html") as {
  parse: (css: string, opts: { from: string }) => Root;
};

type Slot = "bs" | "be" | "is" | "ie";
const SLOTS: readonly Slot[] = ["bs", "be", "is", "ie"];

/** The longhand and side-shorthand properties, mapped to the sides they set. */
const SIDE: Record<string, Slot[]> = {
  "border-top": ["bs"],
  "border-block-start": ["bs"],
  "border-bottom": ["be"],
  "border-block-end": ["be"],
  "border-left": ["is"],
  "border-inline-start": ["is"],
  "border-right": ["ie"],
  "border-inline-end": ["ie"],
  "border-block": ["bs", "be"],
  "border-inline": ["is", "ie"],
  "border-top-width": ["bs"],
  "border-block-start-width": ["bs"],
  "border-bottom-width": ["be"],
  "border-block-end-width": ["be"],
  "border-left-width": ["is"],
  "border-inline-start-width": ["is"],
  "border-right-width": ["ie"],
  "border-inline-end-width": ["ie"],
  "border-block-width": ["bs", "be"],
  "border-inline-width": ["is", "ie"],
};

/** Split a value on top-level spaces, keeping `var(--a, 1px)` whole. */
function tokens(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const STYLES = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/** The width a border shorthand sets: the first non-style, non-colour token; `none` is 0. */
function shorthandWidth(value: string): string {
  const parts = tokens(value);
  if (parts.some((t) => t === "none" || t === "hidden")) return "0";
  const width = parts.find(
    (t) =>
      !STYLES.has(t) && /^(?:[\d.]|thin|medium|thick|var\(|calc\()/.test(t),
  );
  // A shorthand with no width resets it to `medium`; treat as the hairline-equal default.
  return width ?? "medium";
}

type Widths = Partial<Record<Slot, string>>;

function ruleWidths(rule: Rule): Widths {
  const widths: Widths = {};
  rule.each((node) => {
    if (node.type !== "decl") return;
    const { prop, value } = node as Declaration;
    const p = prop.toLowerCase();
    if (p === "border") {
      const w = shorthandWidth(value);
      for (const s of SLOTS) widths[s] = w;
    } else if (p === "border-width") {
      const v = tokens(value);
      const [t, r = t, b = t, l = r] = v;
      widths.bs = t;
      widths.ie = r;
      widths.be = b;
      widths.is = l;
    } else if (SIDE[p]) {
      const isWidthOnly = p.endsWith("-width");
      const v = isWidthOnly ? tokens(value) : [shorthandWidth(value)];
      const [first, second = first] = v;
      SIDE[p].forEach((s, i) => {
        widths[s] = i === 0 ? first : second;
      });
    }
  });
  return widths;
}

const norm = (w: string) =>
  w === "0px" ? "0" : w.replace(/\s+/g, "").toLowerCase();
/** A side with no border paints nothing, so a `0` beside a thick side (a band with only side edges)
    renders cleanly in Chromium: checked with `border-width: 0 2px` on a bevelled box. */
const HAIRLINE = new Set(["1px", "0"]);

function declaresBevel(rule: Rule): boolean {
  let found = false;
  rule.each((n) => {
    if (n.type === "decl" && n.prop === "corner-shape" && /bevel/.test(n.value))
      found = true;
  });
  return found;
}

/** A nested selector with every `&` replaced by its parent's, so the last compound is visible. */
function resolved(rule: Rule): string {
  const parent = rule.parent;
  const own = rule.selector.replace(/\s+/g, " ");
  if (parent?.type !== "rule") return own;
  const outer = resolved(parent as Rule);
  return own.includes("&") ? own.replace(/&/g, outer) : `${outer} ${own}`;
}

interface Target {
  /** The classes and pseudo-element: `.chip::after` is not `.chip`. */
  base: string;
  /** The attribute selectors, `[data-kind="bar"]`, that narrow the element. */
  attrs: string[];
}

/** The element each part of a rule's selector styles, read from its last compound. */
function targets(rule: Rule): Target[] {
  let plain = resolved(rule);
  // Drop pseudo-class arguments (`:not(...)`, `:where(...)`) so only the compound itself is read.
  for (let prev = ""; prev !== plain;) {
    prev = plain;
    plain = plain.replace(/\((?:[^()]|\[[^\]]*\])*\)/g, "");
  }
  return plain.split(",").flatMap((part) => {
    const compound =
      part
        .trim()
        .split(/\s+(?![^[]*\])|\s*[>+~]\s*/)
        .pop() ?? "";
    const classes = [...compound.matchAll(/\.[\w-]+/g)].map((m) => m[0]);
    if (classes.length === 0) return [];
    const pseudo = /::[\w-]+/.exec(compound)?.[0] ?? "";
    const attrs = [...compound.matchAll(/\[[^\]]*\]/g)].map((m) => m[0]);
    return [{ base: `${classes.join("")}${pseudo}`, attrs }];
  });
}

/** Two rules style the same box when the bevelled one is no narrower than the other. */
function reaches(bevelled: Target, other: Target): boolean {
  return (
    bevelled.base === other.base &&
    bevelled.attrs.every((a) => other.attrs.includes(a))
  );
}

export interface Finding {
  selector: string;
  line: number;
  detail: string;
}

/** Every rule in `css` (file text, `.astro` included) that breaks the guard. */
export function findUnequalBevelBorders(css: string, file: string): Finding[] {
  const root = file.endsWith(".astro")
    ? htmlSyntax.parse(css, { from: file })
    : postcss.parse(css, { from: file });
  const rules: Rule[] = [];
  root.walkRules((r) => {
    rules.push(r);
  });
  const bevelled = rules.filter(declaresBevel).flatMap((r) => targets(r));
  const findings: Finding[] = [];
  for (const rule of rules) {
    const widths = ruleWidths(rule);
    const set = SLOTS.filter((s) => widths[s] !== undefined);
    if (set.length === 0) continue;
    const values = new Set(
      set.map((s) => norm(widths[s] as string)).filter((v) => v !== "0"),
    );
    const bevel =
      declaresBevel(rule) ||
      targets(rule).some((t) => bevelled.some((b) => reaches(b, t)));
    if (!bevel) continue;
    const line = rule.source?.start?.line ?? 0;
    const selector = resolved(rule);
    if (set.length === 4 && values.size > 1) {
      findings.push({
        selector,
        line,
        detail: `sides differ: ${set.map((s) => `${s}=${widths[s]}`).join(", ")}`,
      });
    } else if (set.length < 4) {
      // A rule that sets some sides to a non-hairline width makes them differ from the rest.
      const odd = [...values].filter((v) => !HAIRLINE.has(v));
      if (odd.length > 0)
        findings.push({
          selector,
          line,
          detail: `overrides ${set.join("+")} to ${odd.join(", ")}`,
        });
    }
  }
  return findings;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(?:css|astro)$/.test(name) ? [full] : [];
  });
}

describe("bevelled boxes keep one border width on every side", () => {
  const files = walk(SRC).map((f) => path.relative(DOX, f));

  it("scans the stylesheets", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("finds the bug in a rule that has it", () => {
    const css =
      ".a { border: 1px solid red; border-block-end: 3px solid blue; border-radius: 4px; corner-shape: bevel; }";
    expect(findUnequalBevelBorders(css, "x.css")).toHaveLength(1);
  });

  it("finds a state variant that thickens one side of a bevelled file", () => {
    const css =
      ".a { border: 1px solid red; corner-shape: bevel; } .a:hover { border-block-end-width: 3px; }";
    expect(findUnequalBevelBorders(css, "x.css")).toHaveLength(1);
  });

  it("finds the bug inside nested rules and astro style blocks", () => {
    const css =
      "<style>.a { corner-shape: bevel; &:hover { border: 1px solid red; border-top-width: 4px; } }</style>";
    expect(findUnequalBevelBorders(css, "x.astro")).toHaveLength(1);
  });

  it("leaves an even border, and an uneven one with no bevel, alone", () => {
    expect(
      findUnequalBevelBorders(
        ".a { border: 1px solid red; border-block-end-color: blue; corner-shape: bevel; }",
        "x.css",
      ),
    ).toEqual([]);
    expect(
      findUnequalBevelBorders(
        ".a { border: 1px solid red; border-block-end: 3px solid blue; }",
        "x.css",
      ),
    ).toEqual([]);
  });

  it("has no bevelled rule with unequal border side widths", () => {
    const report: string[] = [];
    for (const file of files) {
      const css = readFileSync(path.join(DOX, file), "utf8");
      for (const f of findUnequalBevelBorders(css, file)) {
        report.push(`${file}:${f.line} ${f.selector} (${f.detail})`);
      }
    }
    expect(report).toEqual([]);
  });
});
