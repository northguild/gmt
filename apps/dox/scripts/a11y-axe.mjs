#!/usr/bin/env node
/**
 * axe gate: runs axe-core on every built page and fails on any violation.
 *
 * Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa. `wcag22a` is left out on purpose: the pinned
 * axe-core (4.13) tags no rule with it (`axe.getRules(["wcag22a"]).length` is 0). Only `violations`
 * count; `incomplete` (axe could not decide) is logged and never fails.
 *
 * `a11y-axe-exclusions.json` holds `{ rule, selector, pages, reason }` entries. An entry covers a
 * result only when rule, selector and page all match; `pages` is a list of site paths or "*", and
 * `reason` must give the measured evidence that the result is a false positive. A real violation is
 * fixed, never excluded.
 *
 * Usage (a built site served, as `pnpm --filter dox gates --only a11y-axe` does):
 *   node scripts/a11y-axe.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium,webkit]
 *     [--theme dark|light] [--widths 1440,390] [--pages /a/,/b/] [--list-pages] [--concurrency 4]
 *
 * The runner's contract: `--list-pages` prints every `dist` page and exits (2 when `dist` is
 * missing); with `GATE_REPORT` set every violation is a finding. Exit 0 pass, 1 any finding or
 * nothing measured, 2 usage.
 */
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exclusionProblems, isExcluded } from "./gate-checks.mjs";
import {
  distPages,
  openRail,
  parseSweep,
  settleTransitions,
  sweep,
} from "./lib/a11y-sweep.mjs";

const GATE = "a11y-axe";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const run = parseSweep({
  gate: GATE,
  pages: distPages(GATE),
  defaults: { widths: "1440,390" },
});

const exclusionsFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "a11y-axe-exclusions.json",
);
const exclusions = JSON.parse(readFileSync(exclusionsFile, "utf8"));
const bad = exclusionProblems(exclusions);
if (bad.length > 0) {
  console.error(
    `${GATE}: a11y-axe-exclusions.json is not valid:\n  ${bad.join("\n  ")}`,
  );
  process.exit(2);
}

/** A node's target as one selector: shadow and frame paths joined with ` >> `. */
function selectorOf(target) {
  return target.flat(Infinity).join(" >> ");
}

/** The first line of the failure summary that says what is wrong (not its "Fix any of…" header). */
function summaryOf(node) {
  const lines = String(node.failureSummary ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith(":"));
  return lines[0] ?? "";
}

/** Every violation on the page as it stands, minus the excluded ones. */
async function violationsOf(page, pagePath, note) {
  // An entrance fade read half way gives a colour nobody sees; axe reads the settled page.
  await settleTransitions(page, 4000);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  if (results.incomplete.length > 0) {
    const ids = [...new Set(results.incomplete.map((r) => r.id))].join(",");
    console.log(`       incomplete (not a failure) ${pagePath}${note}: ${ids}`);
  }
  const found = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const selector = selectorOf(node.target);
      if (
        isExcluded(exclusions, { rule: violation.id, selector, page: pagePath })
      )
        continue;
      // The identity key of the node axe named. Axe's own selector is kept for people; a node
      // that does not resolve (inside a shadow root or a frame) is a gate failure, never null.
      const first = node.target.length === 1 ? node.target[0] : null;
      const target = await page.evaluate((sel) => {
        const el = typeof sel === "string" ? document.querySelector(sel) : null;
        return el ? window.__gmtIdentity(el) : null;
      }, first);
      if (!target) {
        throw new Error(
          `axe named ${violation.id} on ${selector}, which does not resolve to one element in the page`,
        );
      }
      found.push({
        rule: violation.id,
        target,
        selector,
        message: [note.trim(), violation.help, summaryOf(node)]
          .filter(Boolean)
          .join(": "),
      });
    }
  }
  return found;
}

await sweep({
  gate: GATE,
  run,
  check: async ({ page, path: pagePath }) => {
    const found = await violationsOf(page, pagePath, "");
    // The chat page is the React island: once as it opens, once with a widget in the rail.
    if (pagePath === "/dox/") {
      const closed = await openRail(page);
      if (closed)
        found.push({
          rule: "rail-not-opened",
          target: "page",
          message: closed,
        });
      else found.push(...(await violationsOf(page, pagePath, " (rail open)")));
    }
    return found;
  },
});
