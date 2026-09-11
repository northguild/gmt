#!/usr/bin/env node
/**
 * Structural HTML diff for the Tier 2 widget pages.
 *
 * `visual:diff` is a perceptual pixel diff with a 0.2% tolerance, by deliberate
 * design (see visual-snapshot.mjs). That makes it blind to exactly the class of
 * mistake the DOX-C3b refactor can introduce: a dropped `selected` attribute, a
 * reordered attribute pair, a missing `data-role`, a lost comment node. Each
 * renders identically and breaks a control silently, because every lookup in
 * the widget scripts is a null-tolerant `q()`.
 *
 * So this compares the built markup instead.
 *
 *   node scripts/html-diff.mjs capture <dir>   # save the widget pages
 *   node scripts/html-diff.mjs compare <dir>   # compare dist/ against them
 *
 * Two verdicts, deliberately distinct:
 *
 *   ✗  the WIDGET's own markup changed — the failure this gate exists for.
 *   ~  the widget is identical and the surrounding page changed.
 *
 * The split earns its keep. Adding three entries to the sidebar changed
 * Starlight's `sl-sidebar-state-persist` hash on every page in the site: a real
 * change, correctly detected, and nothing whatever to do with the extraction
 * these pages are here to police. Without the distinction the only way to tell
 * the two apart was to read the diff by hand and decide — which is precisely
 * the judgement a gate is supposed to make for you.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PAGES = [
  {
    path: "reference/zoned/get/getDstTransitions",
    widget: "gmt-dst gmt-widget",
  },
  {
    path: "reference/zoned/interval/intervalIntersectionZoned",
    widget: "gmt-interval gmt-widget",
  },
  {
    path: "reference/zoned/convert/convertZonedToZoned",
    widget: "gmt-converter gmt-widget",
  },
];

const slug = (p) => p.replaceAll("/", "_") + ".html";

/**
 * Collapse whitespace between tags (never inside <pre>/<textarea>), and mask
 * Vite's content-addressed asset hashes.
 *
 * Whitespace has to go: `set:html` injects a template string verbatim, while
 * Astro's `compressHTML` minifies compiled template output, so the two differ
 * on whitespace even when nothing about the page has changed.
 *
 * The hashes have to go too: touching a module changes the hash of every chunk
 * that imports it, so extracting `CodeFrame`'s markup into a `.ts` renamed
 * `PlaygroundForm…js` on three pages that were otherwise byte-identical. Only
 * the hash segment is masked, not the base name — swapping a page from one
 * script to a genuinely different one still shows up.
 */
function normalise(html) {
  const parts = html.split(
    /(<pre[\s\S]*?<\/pre>|<textarea[\s\S]*?<\/textarea>)/i,
  );
  return parts
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(/>\s+</g, "><").replace(/\s+/g, " "),
    )
    .join("")
    .replace(/\.[A-Za-z0-9_-]{8}\.(js|css)\b/g, ".<hash>.$1")
    .trim();
}

/** The widget's own subtree, found by matching `<div>` depth from its root. */
function widgetSubtree(html, cls) {
  const start = html.indexOf(`<div class="${cls}">`);
  if (start < 0) return null;
  let depth = 0;
  let end = start;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      end = m.index + m[0].length;
      break;
    }
  }
  return html.slice(start, end);
}

function firstDivergence(before, after) {
  let i = 0;
  while (i < before.length && before[i] === after[i]) i += 1;
  return [
    `    before: …${before.slice(Math.max(0, i - 90), i + 90)}…`,
    `    after:  …${after.slice(Math.max(0, i - 90), i + 90)}…`,
  ].join("\n");
}

const [mode, dir] = process.argv.slice(2);
if (!mode || !dir) {
  console.error("usage: html-diff.mjs <capture|compare> <dir>");
  process.exit(2);
}

if (mode === "capture") {
  mkdirSync(dir, { recursive: true });
  for (const p of PAGES) {
    writeFileSync(
      path.join(dir, slug(p.path)),
      readFileSync(`dist/${p.path}/index.html`, "utf8"),
    );
  }
  console.log(`captured ${PAGES.length} widget pages to ${dir}`);
  process.exit(0);
}

let widgetChanged = 0;
let pageChanged = 0;

for (const p of PAGES) {
  const beforeRaw = readFileSync(path.join(dir, slug(p.path)), "utf8");
  const afterRaw = readFileSync(`dist/${p.path}/index.html`, "utf8");

  const beforeWidget = widgetSubtree(beforeRaw, p.widget);
  const afterWidget = widgetSubtree(afterRaw, p.widget);

  if (!beforeWidget || !afterWidget) {
    widgetChanged += 1;
    console.log(`✗ ${p.path} — widget subtree not found (class "${p.widget}")`);
    continue;
  }

  const bw = normalise(beforeWidget);
  const aw = normalise(afterWidget);
  if (bw !== aw) {
    widgetChanged += 1;
    console.log(`✗ ${p.path} — WIDGET markup changed`);
    console.log(firstDivergence(bw, aw));
    continue;
  }

  const bp = normalise(beforeRaw);
  const ap = normalise(afterRaw);
  if (bp !== ap) {
    pageChanged += 1;
    console.log(`~ ${p.path} — widget identical; surrounding page changed`);
    console.log(firstDivergence(bp, ap));
    continue;
  }

  console.log(`✓ ${p.path}`);
}

if (widgetChanged > 0) {
  console.log(
    `\n${widgetChanged} widget(s) changed. This is the failure this gate exists for.`,
  );
  process.exit(1);
}
if (pageChanged > 0) {
  console.log(
    `\nAll widget markup identical. ${pageChanged} page(s) changed elsewhere — ` +
      `review the diffs above, then re-capture the baseline if intended.`,
  );
  process.exit(0);
}
console.log("\nAll widget pages structurally identical.");
