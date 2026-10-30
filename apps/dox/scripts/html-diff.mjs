#!/usr/bin/env node
/**
 * Structural HTML diff for the Tier 2 widget pages.
 *
 * `visual:diff` is a perceptual pixel diff with a 0.2% tolerance, by deliberate
 * design (see visual-snapshot.mjs). That makes it blind to exactly the class of
 * mistake the DOX-C3b refactor can introduce: a dropped `selected` attribute, a
 * reordered attribute pair, a missing hook attribute, a lost comment node. Each
 * renders identically and breaks a control silently, because every lookup in
 * the widget scripts is a null-tolerant `q()`.
 *
 * So this compares the built markup instead.
 *
 *   node scripts/html-diff.mjs capture <dir>   # save the widget pages
 *   node scripts/html-diff.mjs compare <dir>   # compare dist/gmt/ against them
 *
 * A change that renames classes on purpose compares against the old baseline with
 * HTML_DIFF_RENAME, a comma-separated list of `from:to` pairs. Each is applied to the new
 * markup before it is normalised: every `from` becomes `to` (an empty `to` deletes it). The
 * markup is then compared as if it still carried the old names, so only a change nobody
 * named shows as a difference:
 *
 *   HTML_DIFF_RENAME="gmt-clockcheck-:gmt-canada-" node scripts/html-diff.mjs compare <dir>
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
 *
 * The runner's contract (`pnpm --filter dox gates`, `scripts/gates/`), after the mode and folder:
 * `--list-pages` prints the widget pages and exits; `--pages /tools/dwell-ledger/,...` captures
 * and compares only those (an unknown path exits 2); with `GATE_REPORT` set, every changed widget
 * is also a finding and the run ends with the count it compared. The runner runs `capture` in the
 * base tree and `compare` here.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";

const GATE = "html-diff";

const PAGES = [
  {
    path: "reference/zoned/get/getDstTransitions",
    widget: "dst-inspector",
  },
  {
    path: "reference/zoned/interval/intervalIntersectionZoned",
    widget: "interval-visualizer",
  },
  {
    path: "reference/zoned/convert/convertZonedToZoned",
    widget: "converter-bench",
  },
  {
    path: "tools/dwell-ledger",
    widget: "dwell-ledger",
  },
  {
    path: "tools/free-time-ledger",
    widget: "free-time-ledger",
  },
  {
    path: "tools/billing-deadlines",
    widget: "billing-deadlines",
  },
  {
    path: "tools/delivery-scheduler",
    widget: "delivery-scheduler",
  },
  {
    path: "tools/connection-checker",
    widget: "connection-checker",
  },
  {
    path: "tools/timetable-reader",
    widget: "timetable-reader",
  },
  {
    path: "tools/crossing-clock",
    widget: "crossing-clock",
  },
  {
    path: "tools/cutoff-stack",
    widget: "cutoff-stack",
  },
  {
    path: "tools/cutoff-ruler",
    widget: "cutoff-ruler",
  },
  {
    path: "tools/cutoff-countdown",
    widget: "cutoff-countdown",
  },
  {
    path: "tools/punctuality-board",
    widget: "punctuality-board",
  },
  {
    path: "tools/eta-drift",
    widget: "eta-drift",
  },
  {
    path: "tools/departure-board",
    widget: "departure-board",
  },
  {
    path: "tools/dtm-decoder",
    widget: "dtm-decoder",
  },
  {
    path: "tools/x12-time-reader",
    widget: "x12-time-reader",
  },
  {
    path: "tools/demurrage-clock",
    widget: "demurrage-clock",
  },
  {
    path: "tools/bl-date-stamp",
    widget: "bl-date-stamp",
  },
  {
    path: "tools/epcis-event-reader",
    widget: "epcis-event-reader",
  },
  {
    path: "tools/journey-split",
    widget: "journey-split",
  },
  {
    path: "tools/gnss-week-decoder",
    widget: "gnss-week-decoder",
  },
  {
    path: "tools/satellite-clock-converter",
    widget: "satellite-clock-converter",
  },
  {
    path: "tools/gnss-rollover-checker",
    widget: "gnss-rollover-checker",
  },
  {
    path: "tools/leap-second-timeline",
    widget: "leap-second-timeline",
  },
  {
    path: "tools/elapsed-vs-clock-difference",
    widget: "elapsed-vs-clock",
  },
  {
    path: "tools/stored-time-audit",
    widget: "stored-time-audit",
  },
  {
    path: "tools/holiday-rule-builder",
    widget: "holiday-rule-builder",
  },
  {
    path: "tools/observance-comparator",
    widget: "observance-comparator",
  },
  {
    path: "tools/moving-feasts",
    widget: "moving-feasts",
  },
  {
    path: "check/canada-2026-clock-change",
    widget: "canada-clock-change",
  },
  {
    path: "check/morocco-2026-clock-change",
    widget: "morocco-clock-change",
  },
  {
    path: "tools/duration-parser-bench",
    widget: "duration-parser-bench",
  },
  {
    path: "tools/id-timestamp-decoder",
    widget: "id-timestamp-decoder",
  },
  {
    path: "tools/column-timestamp-bridge",
    widget: "column-timestamp-bridge",
  },
  {
    path: "tools/cron-in-a-zone",
    widget: "cron-in-a-zone",
  },
  {
    path: "tools/leap-day-birthday",
    widget: "leap-day-birthday",
  },
  /* Content pages with a table: no widget, so the whole page is compared. They police the
     `data-col` the table plugin writes on every cell (src/lib/rehype-table-scroll.ts). */
  { path: "reference/zoned/get/getTimeZoneOffset" },
  { path: "guides/core-date-operations/comparisons" },
];

const slug = (p) => p.replaceAll("/", "_") + ".html";

/** A page entry's site path, as the other gates write it. */
const sitePath = (p) => `/${p.path}/`;
const PAGES_ARG = applyPageContract({
  gate: GATE,
  pages: PAGES.map(sitePath),
});
const SELECTED = PAGES.filter(
  (p) => !PAGES_ARG || PAGES_ARG.includes(sitePath(p)),
);

/** A changed widget or a missing subtree, as a finding. */
function widgetFinding(p, rule, message) {
  recordFinding({
    gate: GATE,
    rule,
    page: sitePath(p),
    target: `widget:${p.path.split("/").pop()}`,
    selector: p.widget ?? "main",
    message,
  });
}

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
function widgetSubtree(html, name) {
  /* The root is the element that carries `data-widget="<name>"`, whatever its tag
     or classes: the component kit renames classes, so the diff never keys on one. */
  const rootRe = new RegExp(
    `<([a-z][a-z0-9-]*)\\b[^>]*\\sdata-widget="${name}"[^>]*>`,
  );
  const root = rootRe.exec(html);
  if (!root) return null;
  const start = root.index;
  const tag = root[1];
  let depth = 0;
  let end = start;
  const re = new RegExp(`<\\/?${tag}\\b[^>]*>`, "g");
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

/** The `from:to` pairs of HTML_DIFF_RENAME, in order. */
const RENAMES = (process.env.HTML_DIFF_RENAME ?? "")
  .split(",")
  .filter((pair) => pair.length > 0)
  .map((pair) => {
    const at = pair.indexOf(":");
    return at < 0 ? [pair, ""] : [pair.slice(0, at), pair.slice(at + 1)];
  });

function renamed(html) {
  return RENAMES.reduce((out, [from, to]) => out.split(from).join(to), html);
}

// Positional mode and folder; the contract flags (`--pages x`, `--list-pages`) are not positional.
const positional = [];
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--pages") i++;
  else if (!arg.startsWith("--")) positional.push(arg);
}
const [mode, dir] = positional;
if (!mode || !dir) {
  console.error("usage: html-diff.mjs <capture|compare> <dir>");
  process.exit(2);
}

if (mode === "capture") {
  mkdirSync(dir, { recursive: true });
  let captured = 0;
  for (const p of SELECTED) {
    const source = `dist/gmt/${p.path}/index.html`;
    // A page the base does not have yet is reported by `compare` as "+", not a crash here.
    if (!existsSync(source)) {
      console.log(`- ${p.path} — not in the base build, not captured`);
      continue;
    }
    writeFileSync(path.join(dir, slug(p.path)), readFileSync(source, "utf8"));
    captured++;
  }
  console.log(`captured ${captured} widget pages to ${dir}`);
  process.exit(0);
}

let widgetChanged = 0;
let pageChanged = 0;
let compared = 0;

for (const p of SELECTED) {
  /* A widget page added since the baseline was captured has nothing to be
     compared against. Say so, rather than crash or pass it silently; the
     visual gate still covers what it looks like. */
  if (!existsSync(path.join(dir, slug(p.path)))) {
    console.log(`+ ${p.path} — new widget page, no baseline to compare`);
    continue;
  }
  compared += 1;
  const beforeRaw = readFileSync(path.join(dir, slug(p.path)), "utf8");
  const afterRaw = renamed(
    readFileSync(`dist/gmt/${p.path}/index.html`, "utf8"),
  );

  if (p.widget === undefined) {
    const bp = normalise(beforeRaw);
    const ap = normalise(afterRaw);
    if (bp !== ap) {
      widgetChanged += 1;
      console.log(`✗ ${p.path} — page markup changed`);
      console.log(firstDivergence(bp, ap));
      widgetFinding(
        p,
        "page-markup-changed",
        firstDivergence(bp, ap).replace(/\s+/g, " ").trim(),
      );
    } else console.log(`✓ ${p.path}`);
    continue;
  }

  const beforeWidget = widgetSubtree(beforeRaw, p.widget);
  const afterWidget = widgetSubtree(afterRaw, p.widget);

  if (!beforeWidget || !afterWidget) {
    widgetChanged += 1;
    console.log(
      `✗ ${p.path} — widget subtree not found (data-widget="${p.widget}")`,
    );
    widgetFinding(
      p,
      "widget-not-found",
      `widget subtree not found (data-widget="${p.widget}")`,
    );
    continue;
  }

  const bw = normalise(beforeWidget);
  const aw = normalise(afterWidget);
  if (bw !== aw) {
    widgetChanged += 1;
    console.log(`✗ ${p.path} — WIDGET markup changed`);
    console.log(firstDivergence(bw, aw));
    widgetFinding(
      p,
      "widget-markup-changed",
      firstDivergence(bw, aw).replace(/\s+/g, " ").trim(),
    );
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

recordMeasured(GATE, compared);
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
