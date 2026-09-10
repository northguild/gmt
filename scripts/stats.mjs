#!/usr/bin/env node
/**
 * Published-figure tooling for the READMEs and the docs site.
 *
 *   node scripts/stats.mjs check   verify every published figure; exit 1 on drift
 *   node scripts/stats.mjs sync    rewrite them from the sources of truth
 *   node scripts/stats.mjs show    print what the sources currently say
 *
 * The READMEs and `apps/dox` publish numbers that are claims about the library — how many
 * tests it has, how many CI executions that implies, how many functions each namespace
 * exports. Nothing computed them, so they were hand-maintained and went stale twice: 16,701
 * tests and 504 functions were both two stories out of date, and the "Public functions by
 * namespace" chart was missing `precision` and `span` entirely. This is `deps.mjs` applied
 * to the same class of problem — derive it, compare it, fail the build.
 *
 * Every published figure describes `packages/gmt` and nothing else. The repo also holds
 * `apps/dox`'s and `packages/gmt-oxlint`'s suites, but those test the docs site and a lint
 * plugin — folding them into a claim about the date library would inflate it with tests
 * that never touch the shipped API. The comparison tables put GMT beside four other
 * libraries' own suites, so the subject has to be the library's own suite too.
 *
 * Sources of truth, none of them a hand-typed number:
 *
 *   tests, test files   `vitest list --json` — collection only; it never runs a test body
 *   functions/namespace `apps/dox/src/generated/reference/gmt-corpus.json`, the generated
 *                       reference corpus (`kind: "function"`, grouped by `namespace`)
 *   CI multipliers      `.github/workflows/ci.yml`'s `gmt-matrix` node/timezone matrix
 *   locales             `MustTestLocales` in `packages/gmt/src/test/localeMatrix.ts`
 *
 * A README cannot be generated at render time the way the docs site can — npm and GitHub
 * serve the committed bytes — so the numbers still live in the file. What this removes is
 * the chance of them being *wrong*: `check` runs in `validate`, and `sync` writes them.
 *
 * Two invariants keep the rewriting honest, both learned the hard way:
 *
 *   1. Every rule must match at least once in every file it claims. A reworded sentence
 *      silently stops matching otherwise, and a guard that quietly guards nothing is worse
 *      than no guard.
 *   2. A replacement may only change digits. After each substitution the non-numeric
 *      skeleton of the match must be byte-identical, so a rule can never mangle prose.
 *
 * Neither can be satisfied by a rule that rewrites a sentence, which is deliberate: prose
 * that has to change (naming a new namespace) is reported for a human, never rewritten.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const CORPUS = "apps/dox/src/generated/reference/gmt-corpus.json";
const WORKFLOW = ".github/workflows/ci.yml";
const LOCALES = "packages/gmt/src/test/localeMatrix.ts";
const VITEST_CONFIG = "packages/gmt/vitest.config.ts";

const ROOT_README = "README.md";
const PKG_README = "packages/gmt/README.md";
const READMES = [ROOT_README, PKG_README];
const DOX_INDEX = "apps/dox/src/content/docs/index.mdx";
const DOX_WHY = "apps/dox/src/content/docs/why-gmt.mdx";
const DOX_CHARTS = "apps/dox/scripts/render-charts.ts";
const DOX_LIBRARIES = "apps/dox/src/data/library-comparison.ts";

/** `regex/` exports patterns, not functions — counted and described separately. */
const PATTERN_NAMESPACE = "regex";

// ---------------------------------------------------------------- sources of truth

/**
 * The library's own suite — the subject of every published figure.
 *
 * `packages/gmt` is the only one CI's `gmt-matrix` job runs across the full Node ×
 * timezone matrix, and the only one whose tests exercise the shipped API. `apps/dox` and
 * `packages/gmt-oxlint` have suites of their own; they are deliberately not counted here.
 */
const SUITE = {
  name: "packages/gmt",
  cwd: ".",
  config: VITEST_CONFIG,
};

/** Collect (never run) the suite. Returns { tests, files }. */
function collect(suite) {
  const args = ["vitest", "list", "--json"];
  if (suite.config) args.push("--config", suite.config);
  const raw = execFileSync("npx", args, {
    cwd: suite.cwd,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const collected = JSON.parse(raw);
  return {
    tests: collected.length,
    files: new Set(collected.map((t) => t.file)).size,
  };
}

/**
 * The library's test and file counts. Honours GMT_TEST_COUNT/GMT_TEST_FILES as an override
 * for a job that has already collected them.
 */
function suiteCounts() {
  const tests = Number(process.env.GMT_TEST_COUNT);
  const files = Number(process.env.GMT_TEST_FILES);

  if (
    Number.isInteger(tests) &&
    tests > 0 &&
    Number.isInteger(files) &&
    files > 0
  ) {
    return { tests, files };
  }
  return collect(SUITE);
}

/** Public functions per namespace, plus the regex pattern count, from the reference corpus. */
function apiSurface() {
  const corpus = JSON.parse(readFileSync(CORPUS, "utf8"));
  const functions = new Map();
  let patterns = 0;

  for (const entry of corpus) {
    if (entry.kind === "function") {
      functions.set(entry.namespace, (functions.get(entry.namespace) ?? 0) + 1);
    } else if (
      entry.namespace === PATTERN_NAMESPACE &&
      entry.kind === PATTERN_NAMESPACE
    ) {
      patterns += 1;
    }
  }

  // Descending, so the generated chart data reads in bar order.
  const byNamespace = [...functions.entries()].sort((a, b) => b[1] - a[1]);
  return {
    byNamespace,
    functions: byNamespace.reduce((sum, [, count]) => sum + count, 0),
    patterns,
  };
}

/** The CI matrix the executions figure multiplies by. */
function ciMatrix() {
  const yml = readFileSync(WORKFLOW, "utf8");
  const job = yml.slice(yml.indexOf("  gmt-matrix:"));
  const nodes = job.match(/node-version:\s*\[([^\]]+)\]/)?.[1];
  const zones = job
    .slice(job.indexOf("timezone:"))
    .match(/\[([\s\S]*?)\]/)?.[1];
  if (!nodes || !zones) {
    throw new Error(
      `${WORKFLOW}: could not read the gmt-matrix node/timezone matrix`,
    );
  }
  return {
    nodes: nodes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    timezones: (zones.match(/"[^"]+"/g) ?? []).length,
  };
}

/** Locales in the mandatory matrix. */
function localeCount() {
  const src = readFileSync(LOCALES, "utf8");
  const block = src.slice(src.indexOf("MustTestLocales"));
  return (
    block
      .slice(0, block.indexOf("}"))
      .match(/:\s*["'][a-z]{2}-[A-Z]{2}["']/g) ?? []
  ).length;
}

/** Everything the docs are allowed to claim, derived. */
function figures() {
  const counted = suiteCounts();
  const api = apiSurface();
  const { nodes, timezones } = ciMatrix();

  return {
    ...counted,
    ...api,
    nodes,
    nodeCount: nodes.length,
    timezones,
    locales: localeCount(),
    // The whole suite runs under every Node version x every timezone, so this is one
    // product rather than a weighted sum: gmt-matrix has no partial legs.
    executions: counted.tests * nodes.length * timezones,
  };
}

// ---------------------------------------------------------------- rules

const n = (value) => value.toLocaleString("en-US");

/**
 * One rule per published figure.
 *
 * `find` must capture every number it intends to replace, in order, and nothing else.
 * `values` returns those numbers as strings. The replacement is assembled from the match's
 * own text, so only the captured digits can change.
 */
function ruleSet(f) {
  return [
    {
      label: "headline executions",
      files: READMES,
      find: /(\*\*: )([\d,]+)( from )([\d,]+)( tests run in all )(\d+)( timezones × )(\d+)( Node versions)/g,
      values: [
        n(f.executions),
        n(f.tests),
        String(f.timezones),
        String(f.nodeCount),
      ],
    },
    {
      label: "test cases vs @internationalized/date",
      files: READMES,
      find: /(`@internationalized\/date`\*\*: )([\d,]+)( vs\. 386)/g,
      values: [n(f.tests)],
    },
    {
      label: "comparison table — test files",
      files: READMES,
      find: /(\| Test files +\| )([\d,]+)/g,
      values: [n(f.files)],
    },
    {
      label: "comparison table — test cases",
      files: READMES,
      find: /(\| Individual test cases +\| \*\*)([\d,]+)(\*\*)/g,
      values: [n(f.tests)],
    },
    {
      label: "comparison table — executions",
      files: READMES,
      find: /(\| \*\*)([\d,]+)(\*\*<br>\()([\d,]+)( × )(\d+)( Node<br>× )(\d+)( timezones\))/g,
      values: [
        n(f.executions),
        n(f.tests),
        String(f.nodeCount),
        String(f.timezones),
      ],
    },
    {
      label: "suite-design result line",
      files: READMES,
      find: /(\*\*Result:\*\* )([\d,]+)( tests across )([\d,]+)( files[^.]*\. They run in CI as )([\d,]+)( executions — every one of them × )(\d+)( Node versions × )(\d+)( timezones\.)/g,
      values: [
        n(f.tests),
        n(f.files),
        n(f.executions),
        String(f.nodeCount),
        String(f.timezones),
      ],
    },
    {
      label: "combined-competitors row",
      files: READMES,
      find: /(\| )([\d,]+)( vs\. 386 \+ 4,888)/g,
      values: [n(f.executions)],
    },
    {
      label: "dox landing card",
      files: [DOX_INDEX],
      find: /( {2})([\d,]+)( executions — )([\d,]+)( tests across )(\d+)( timezones × )(\d+)( Node)/g,
      values: [
        n(f.executions),
        n(f.tests),
        String(f.timezones),
        String(f.nodeCount),
      ],
    },
    {
      label: "dox executions chart caption",
      files: [DOX_WHY],
      find: /(caption="GMT: )([\d,]+)( executions \()([\d,]+)( tests × )(\d+)( timezones × )(\d+)( Node\))/g,
      values: [
        n(f.executions),
        n(f.tests),
        String(f.timezones),
        String(f.nodeCount),
      ],
    },
    {
      label: "dox summary — executions",
      files: [DOX_WHY],
      find: /(\| \*\*CI executions\*\* +\| )([\d,]+)/g,
      values: [n(f.executions)],
    },
    {
      label: "dox summary — public functions",
      files: [DOX_WHY],
      find: /(\| \*\*Public functions\*\* +\| )([\d,]+)/g,
      values: [n(f.functions)],
    },
    {
      label: "dox summary — locales",
      files: [DOX_WHY],
      find: /(\| \*\*Locales tested\*\* +\| )(\d+)/g,
      values: [String(f.locales)],
    },
    {
      label: "dox summary — timezones",
      files: [DOX_WHY],
      find: /(\| \*\*Timezones tested\*\* +\| )(\d+)/g,
      values: [String(f.timezones)],
    },
    {
      label: "dox api-surface count",
      files: [DOX_WHY],
      find: /(GMT exposes )([\d,]+)( public functions)/g,
      values: [n(f.functions)],
    },
    {
      label: "dox api-surface caption",
      files: [DOX_WHY],
      find: /(caption=")([\d,]+)( functions total, plus )(\d+)( regex patterns)/g,
      values: [n(f.functions), String(f.patterns)],
    },
    {
      // `libraryComparisons`'s first entry is gmt (isSubject). Anchored on the id so it
      // cannot drift onto a competitor's block, whose figures are external measurements
      // and are deliberately not derived here.
      label: "library-comparison — gmt stats",
      files: [DOX_LIBRARIES],
      find: /(id: "@northguild\/gmt",[\s\S]*?tests: )(\d+)(,\n {6}locales: )(\d+)(,\n {6}timezones: )(\d+)(,\n {6}nodeVersions: )(\d+)(,\n {6}executions: )(\d+)/g,
      values: [
        String(f.tests),
        "0",
        String(f.timezones),
        String(f.nodeCount),
        String(f.executions),
      ],
    },
  ];
}

/** Digits and separators removed — two texts with the same skeleton differ only in numbers. */
const skeleton = (text) => text.replace(/[\d,]+/g, "#");

/**
 * Apply one rule to one file's text.
 *
 * Returns { text, hits, drift } — `drift` lists the figures that were wrong. Throws when a
 * replacement would change anything but digits, which means the rule itself is malformed.
 */
function applyRule(rule, text, file) {
  let hits = 0;
  const drift = [];

  const next = text.replace(rule.find, (...args) => {
    const groups = args.slice(1, -2).filter((g) => typeof g === "string");
    hits += 1;

    // Odd-indexed groups are the captured numbers, in `values` order.
    let valueIndex = 0;
    const rebuilt = groups
      .map((group, i) => (i % 2 === 1 ? rule.values[valueIndex++] : group))
      .join("");
    const match = args[0];

    if (skeleton(match) !== skeleton(rebuilt)) {
      throw new Error(
        `${file}: rule "${rule.label}" would change more than digits — fix the rule, not the file`,
      );
    }
    if (match !== rebuilt) {
      const was = groups.filter((_, i) => i % 2 === 1);
      drift.push({ was, now: rule.values.slice(0, was.length) });
    }
    return rebuilt;
  });

  return { text: next, hits, drift };
}

/** Every rule against every file it claims. Returns { edits, problems }. */
function evaluate(f) {
  const rules = ruleSet(f);
  const edits = new Map();
  const problems = [];

  for (const rule of rules) {
    for (const file of rule.files) {
      const before = edits.get(file) ?? readFileSync(file, "utf8");
      const { text, hits, drift } = applyRule(rule, before, file);

      if (hits === 0) {
        problems.push(
          `${file}: rule "${rule.label}" matched nothing — the text it guards was reworded, ` +
            `so the figure is no longer checked. Update the rule in scripts/stats.mjs.`,
        );
        continue;
      }
      for (const d of drift) {
        problems.push(
          `${file}: ${rule.label} — published ${d.was.join(" / ")}, derived ${d.now.join(" / ")}`,
        );
      }
      if (text !== before) edits.set(file, text);
      else if (!edits.has(file)) edits.set(file, before);
    }
  }

  // Prose that names namespaces is reported, never rewritten — adding one needs a sentence,
  // not a substitution.
  const why = edits.get(DOX_WHY) ?? readFileSync(DOX_WHY, "utf8");
  for (const [ns] of f.byNamespace) {
    const sentence = why.slice(
      why.indexOf("GMT exposes"),
      why.indexOf("— plus"),
    );
    if (!sentence.includes(`\`${ns}\``)) {
      problems.push(
        `${DOX_WHY}: the api-surface sentence does not name the \`${ns}\` namespace`,
      );
    }
  }

  // The chart's namespace array is structural, not numeric — same treatment.
  const charts = edits.get(DOX_CHARTS) ?? readFileSync(DOX_CHARTS, "utf8");
  const expected = [...f.byNamespace, [PATTERN_NAMESPACE, f.patterns]];
  for (const [ns, count] of expected) {
    if (
      !new RegExp(`\\{ namespace: "${ns}", count: ${count} \\}`).test(charts)
    ) {
      problems.push(
        `${DOX_CHARTS}: namespace chart is missing or wrong for \`${ns}\` (expected count ${count})`,
      );
    }
  }

  return { edits, problems };
}

// ---------------------------------------------------------------- commands

function show() {
  const f = figures();
  console.log(
    `tests            ${n(f.tests)} across ${n(f.files)} files (${SUITE.name})`,
  );
  console.log(
    `CI matrix        Node ${f.nodes.join(", ")} × ${f.timezones} timezones = ${n(f.executions)} executions`,
  );
  console.log(`locale matrix    ${f.locales}`);
  console.log(
    `public functions ${n(f.functions)} across ${f.byNamespace.length} namespaces, plus ${f.patterns} regex patterns`,
  );
  for (const [ns, count] of f.byNamespace)
    console.log(`    ${ns.padEnd(10)} ${count}`);
}

function sync() {
  const f = figures();
  const { edits, problems } = evaluate(f);
  const written = [];

  for (const [file, text] of edits) {
    if (text !== readFileSync(file, "utf8")) {
      writeFileSync(file, text);
      written.push(file);
    }
  }

  console.log(
    written.length === 0
      ? "stats: figures already match the repo"
      : `stats: updated ${written.length} file${written.length === 1 ? "" : "s"}`,
  );
  for (const file of written) console.log(`  ${file}`);

  // Numeric drift is fixed by the write above; anything left needs a human.
  const remaining = problems.filter((p) => !p.includes("published"));
  if (remaining.length > 0) {
    console.log("\nstats: these need a prose edit, not a number:");
    for (const p of remaining) console.log(`  ${p}`);
  }
}

function check() {
  const { problems } = evaluate(figures());
  if (problems.length === 0) {
    console.log("stats: published figures match the repo");
    return;
  }
  console.error(
    "stats: published figures are out of date — run: pnpm stats:sync\n",
  );
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

// pnpm forwards a literal `--` separator; drop it so `pnpm stats -- show` works.
const argv = process.argv.slice(2).filter((a) => a !== "--");
const command = argv[0] ?? "check";
const commands = { check, sync, show };
if (!commands[command]) {
  console.error("Usage: node scripts/stats.mjs <check|sync|show>");
  process.exit(1);
}
commands[command]();
