#!/usr/bin/env node
/**
 * Published-figure tooling for the READMEs and the docs site.
 *
 *   node scripts/stats.mjs check   verify every published figure; exit 1 on drift
 *   node scripts/stats.mjs sync    rewrite them from the sources of truth
 *   node scripts/stats.mjs show    print what the sources currently say
 *
 * The READMEs and `apps/dox` publish numbers that are claims: how many tests the library has,
 * how many times CI runs them, how many functions it exports, and the same counts for the other
 * libraries it is set beside. A number typed by hand goes stale and nothing fails, so each one
 * is derived here, compared with what is published, and the build fails on a difference. This
 * is `deps.mjs` applied to the same class of problem.
 *
 * GMT's figures describe `packages/gmt` and nothing else. The repo also holds `apps/dox`'s and
 * `packages/gmt-oxlint`'s suites, but those test the docs site and a lint plugin — folding them
 * into a claim about the date library would inflate it with tests that never touch the shipped
 * API. The comparison table puts GMT beside other libraries' own suites, so the subject has to
 * be the library's own suite too.
 *
 * Sources of truth, none of them a number typed in this script:
 *
 *   tests, test files   `vitest list --json` — collection only; it never runs a test body
 *   functions/namespace `apps/dox/src/generated/reference/gmt-corpus.json`, the generated
 *                       reference corpus (`kind: "function"`, grouped by `namespace`)
 *   industry layers     `apps/dox/src/content/docs/guides/industries/`, one guide per layer,
 *                       each named for its namespace (`transport-legs-and-dwell.mdx`)
 *   CI multipliers      `.github/workflows/ci.yml`'s `gmt-matrix` node/timezone matrix
 *   locales             `MustTestLocales` in `packages/gmt/src/test/localeMatrix.ts`
 *   other libraries     `apps/dox/src/data/library-measurements.json`, one entry per library:
 *                       its name, its tests, its CI executions and the day it was measured.
 *                       The docs site reads the same file (`library-comparison.ts`), so a
 *                       re-measurement is an edit to that file and nothing else
 *
 * The docs site renders its figures: `sync` writes `apps/dox/src/data/gmt-stats.json`, and
 * every dox page, chart and comparison imports from it, so dox copy holds no GMT number to
 * rewrite. A README cannot do that — npm and GitHub serve the committed bytes — so its numbers
 * live in the file. `README.md` and `packages/gmt/README.md` are one text, byte for byte, which
 * this script also checks, and in each of them it guards:
 *
 *   the opening         the other libraries it names, which are exactly the measured ones
 *   paragraph
 *   the fact lines      tests, CI test runs, time zones and Node versions; the multiple of
 *                       GMT's CI test runs over the other libraries' combined, and the count of
 *                       those libraries, spelled as a word; functions and locales
 *   the comparison      GMT's row, and one row per other library, found by the library's name
 *   table               in the first column. The rows are GMT's, then exactly the measured
 *                       libraries, by tests, most first
 *   the sentence        the earliest and the latest day a library was measured
 *   under the table
 *   the namespace       one `/reference/<namespace>/` link per namespace that exports a
 *   links               function, each labelled with its namespace, with the industry layers
 *                       on the "By industry" line
 *
 * Three invariants keep the rewriting honest:
 *
 *   1. Every rule must match at least once in every file it claims. A reworded sentence
 *      silently stops matching otherwise, and a guard that quietly guards nothing is worse
 *      than no guard.
 *   2. A replacement may only change digits. After each substitution the non-numeric skeleton
 *      of the match must be byte-identical, so a rule can never mangle prose. The one other
 *      thing `sync` writes is the padding of the comparison table, so that a figure which
 *      gains a digit leaves the columns lined up.
 *   3. Anything else is reported for a person and never rewritten: a library to name, a count
 *      spelled as a word, a row to add, remove or move, a namespace link to add, remove or
 *      relabel, a line the two READMEs do not share. `check` fails on it, and `sync` lists it as
 *      needing an edit by hand.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

import { formatJson } from "./lib/format-json.mjs";

const CORPUS = "apps/dox/src/generated/reference/gmt-corpus.json";
const WORKFLOW = ".github/workflows/ci.yml";
const LOCALES = "packages/gmt/src/test/localeMatrix.ts";
const INDUSTRY_GUIDES = "apps/dox/src/content/docs/guides/industries";
const VITEST_CONFIG = "packages/gmt/vitest.config.ts";

const ROOT_README = "README.md";
const PKG_README = "packages/gmt/README.md";
const READMES = [ROOT_README, PKG_README];
/** Every GMT figure apps/dox renders is imported from this file — see statsObject(). */
const DOX_STATS = "apps/dox/src/data/gmt-stats.json";

/** `regex/` exports patterns, not functions — counted and described separately. */
const PATTERN_NAMESPACE = "regex";

/** The other libraries' measurements. The docs site's `library-comparison.ts` reads it too. */
const MEASUREMENTS = "apps/dox/src/data/library-measurements.json";
/** The docs site's API reference; a namespace's index page is `<REFERENCE><namespace>/`. */
const REFERENCE = "https://gmt-dox.northguild.workers.dev/reference/";
/** How the line that links the industry namespaces starts. */
const INDUSTRY_LINE = "By industry:";
/**
 * A count the READMEs spell as a word, by its value. A count past the end is reported, not
 * guessed.
 */
const COUNT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

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

  // The config's `include` also carries a bare `src/**/*.test.ts`, which means this package
  // only when resolved from the repo root. Refuse to publish a count that picked up another
  // package's or apps/dox's tests.
  const scope = resolve(suite.name) + sep;
  const stray = collected.find((t) => !t.file.startsWith(scope));
  if (stray) {
    throw new Error(
      `${suite.config}: collected ${stray.file}, outside ${suite.name} — published figures count ${suite.name}'s tests only`,
    );
  }

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
  const industries = industryLayers(new Set(functions.keys()));
  return {
    byNamespace,
    industries: byNamespace
      .map(([namespace]) => namespace)
      .filter((namespace) => industries.has(namespace)),
    functions: byNamespace.reduce((sum, [, count]) => sum + count, 0),
    patterns,
  };
}

/**
 * The namespaces that are industry layers rather than core primitives. Every layer ships with a
 * guide under INDUSTRY_GUIDES named `<namespace>-<topic>.mdx`, so the guides are the list — a new
 * layer joins the /why-gmt industry chart when its guide lands, with nothing typed here.
 */
function industryLayers(namespaces) {
  const layers = new Set();
  for (const file of readdirSync(INDUSTRY_GUIDES)) {
    if (!file.endsWith(".mdx") || file === "index.mdx") continue;
    const namespace = file.slice(0, file.indexOf("-"));
    if (!namespaces.has(namespace)) {
      throw new Error(
        `${INDUSTRY_GUIDES}/${file}: an industry guide is named for its namespace, and \`${namespace}\` exports no function`,
      );
    }
    layers.add(namespace);
  }
  return layers;
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
  const timezoneList = (zones.match(/"[^"]+"/g) ?? []).map((s) =>
    s.slice(1, -1),
  );
  return {
    nodes: nodes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    timezones: timezoneList.length,
    timezoneList,
  };
}

/** Locales in the mandatory matrix, in declaration order. */
function localeList() {
  const src = readFileSync(LOCALES, "utf8");
  const block = src.slice(src.indexOf("MustTestLocales"));
  return (
    block.slice(0, block.indexOf("}")).match(/["'][a-z]{2}-[A-Z]{2}["']/g) ?? []
  ).map((s) => s.slice(1, -1));
}

/**
 * What was measured about each other library, in the order the measurements file lists them.
 * Refuses an entry the READMEs could not be written from.
 */
function otherLibraries() {
  const { libraries } = JSON.parse(readFileSync(MEASUREMENTS, "utf8"));
  if (!Array.isArray(libraries) || libraries.length === 0) {
    throw new Error(`${MEASUREMENTS}: \`libraries\` lists no library`);
  }
  return libraries.map(({ id, name, tests, executions, measuredOn }) => {
    const valid =
      typeof name === "string" &&
      name !== "" &&
      Number.isInteger(tests) &&
      tests > 0 &&
      Number.isInteger(executions) &&
      executions > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(measuredOn);
    if (!valid) {
      throw new Error(
        `${MEASUREMENTS}: ${id ?? name ?? "an entry"} needs a \`name\`, whole \`tests\` and \`executions\` above 0, and a \`measuredOn\` date written YYYY-MM-DD`,
      );
    }
    return { name, tests, executions, measuredOn };
  });
}

/** Everything the docs are allowed to claim, derived. */
function figures() {
  const counted = suiteCounts();
  const api = apiSurface();
  const { nodes, timezones, timezoneList } = ciMatrix();
  const locales = localeList();
  const others = otherLibraries();
  // The whole suite runs under every Node version x every timezone, so this is one product
  // rather than a weighted sum: gmt-matrix has no partial legs.
  const executions = counted.tests * nodes.length * timezones;
  const othersExecutions = others.reduce((sum, l) => sum + l.executions, 0);
  // ISO dates sort as text.
  const measuredOn = others.map((l) => l.measuredOn).sort();

  return {
    ...counted,
    ...api,
    nodes,
    nodeCount: nodes.length,
    timezones,
    timezoneList,
    locales: locales.length,
    localeList: locales,
    executions,
    others,
    othersExecutions,
    // The arithmetic of `executionRatio(combinedCompetitorExecutions())` in
    // apps/dox/src/data/library-comparison.ts, so a README and the site show one number.
    executionMultiple: Math.round(executions / othersExecutions),
    measuredFrom: measuredOn[0],
    measuredTo: measuredOn[measuredOn.length - 1],
  };
}

/** What apps/dox renders, as written to DOX_STATS. Every GMT figure on the site comes from here. */
function statsObject(f) {
  return {
    suite: SUITE.name,
    tests: f.tests,
    files: f.files,
    executions: f.executions,
    nodes: f.nodes,
    timezones: f.timezones,
    timezoneList: f.timezoneList,
    locales: f.locales,
    localeList: f.localeList,
    functions: f.functions,
    patterns: f.patterns,
    byNamespace: f.byNamespace.map(([namespace, count]) => ({
      namespace,
      count,
    })),
    industries: f.industries,
  };
}

// ---------------------------------------------------------------- rules

const n = (value) => value.toLocaleString("en-US");

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One rule per published figure.
 *
 * `find` must capture every number it intends to replace, in order, and nothing else.
 * `values` returns those numbers as strings. The replacement is assembled from the match's
 * own text, so only the captured digits can change. `missing`, where a rule has one, is what
 * to report in place of the general message when the rule matches nothing.
 */
function ruleSet(f) {
  return [
    {
      label: "tests and CI test runs",
      files: READMES,
      find: /(- \*\*)([\d,]+)( tests, run )([\d,]+)( times in CI\.\*\* Every test runs in )(\d+)( time zones on )(\d+)( Node versions\.)/g,
      values: [
        n(f.tests),
        n(f.executions),
        String(f.timezones),
        String(f.nodeCount),
      ],
    },
    {
      // Written without a thousands separator, as the site writes the same multiple.
      label: "multiple of the other libraries' CI test runs",
      files: READMES,
      find: /(- \*\*)(\d+)(× the CI test runs\*\* of the )/g,
      values: [String(f.executionMultiple)],
    },
    {
      label: "functions and locales",
      files: READMES,
      find: /(- \*\*)([\d,]+)( functions, to the nanosecond\*\*, tested in )(\d+)( locales\.)/g,
      values: [n(f.functions), String(f.locales)],
    },
    {
      label: "comparison table — GMT's row",
      files: READMES,
      find: /^(\| \*\*`@northguild\/gmt`\*\* +\| \*\*)([\d,]+)(\*\* +\| \*\*)([\d,]+)(\*\* +\|)/gm,
      values: [n(f.tests), n(f.executions)],
    },
    // One row per measured library, found by its name in the first column.
    ...f.others.map((library) => ({
      label: `comparison table — ${library.name}'s row`,
      files: READMES,
      find: new RegExp(
        `^(\\| \`?${escapeRegExp(library.name)}\`? +\\| )([\\d,]+)( +\\| )([\\d,]+)( +\\|)`,
        "gm",
      ),
      values: [n(library.tests), n(library.executions)],
      missing:
        `the comparison table has no row for ${library.name}, which ${MEASUREMENTS} lists. ` +
        `Add the row by hand, then run: pnpm stats:sync`,
    })),
    {
      label: "days the other libraries were measured",
      files: READMES,
      find: /(The other libraries were measured from )(\d{4}-\d{2}-\d{2})( to )(\d{4}-\d{2}-\d{2})(,)/g,
      values: [f.measuredFrom, f.measuredTo],
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

// ---------------------------------------------------------------- checks a person fixes

/** The comparison table: the header row that starts `| Library`, and the rows under it. */
function comparisonTable(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^\| Library +\|/.test(line));
  if (start === -1) return null;
  let end = start;
  while (end < lines.length && lines[end].startsWith("|")) end++;
  return { lines, start, end };
}

/** One table row's cells, unpadded. */
const cellsOf = (line) =>
  line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
/** A cell of the row under the header: dashes, with a colon where the column is aligned. */
const isDelimiterCell = (cell) => /^:?-+:?$/.test(cell);
/** A first-column cell as a library's name: `**\`@northguild/gmt\`**` is `@northguild/gmt`. */
const rowName = (cell) => cell.replace(/[*`]/g, "");

/** The paragraph under the title: the first run of text lines after the `# ` heading. */
function openingParagraph(text) {
  const lines = text.split("\n");
  let start = lines.findIndex((line) => line.startsWith("# ")) + 1;
  if (start === 0) return null;
  while (start < lines.length && lines[start].trim() === "") start++;
  let end = start;
  while (end < lines.length && lines[end].trim() !== "") end++;
  return start === end ? null : lines.slice(start, end).join(" ");
}

/**
 * The opening paragraph lists the libraries GMT stands in for ("in place of A, B and C."). The
 * list must name the measured libraries, each by its name, and no other.
 */
function openingNamesProblems(text, f) {
  const list = openingParagraph(text)?.match(
    / in place of (.+?)\.(?= |$)/,
  )?.[1];
  if (list === undefined) {
    return [
      'the opening paragraph has no "in place of …" list of the other libraries — it was reworded, ' +
        "so the names are no longer checked. Update openingNamesProblems in scripts/stats.mjs",
    ];
  }
  const named = list.split(/,? and |, /).map((name) => rowName(name).trim());
  const measured = f.others.map((l) => l.name);
  return [
    ...measured
      .filter((name) => !named.includes(name))
      .map(
        (name) =>
          `the opening paragraph does not name ${name}, which ${MEASUREMENTS} lists. Add it to the "in place of" list`,
      ),
    ...named
      .filter((name) => !measured.includes(name))
      .map(
        (name) =>
          `the opening paragraph names ${name}, and ${MEASUREMENTS} lists no library of that name. Take it out of the "in place of" list`,
      ),
  ];
}

/** The fact line's count of other libraries must be the number the measurements file lists. */
function libraryCountProblems(text, f) {
  const count = f.others.length;
  const word = COUNT_WORDS[count];
  if (word === undefined) {
    return [
      `${MEASUREMENTS} lists ${count} libraries, and COUNT_WORDS in scripts/stats.mjs has no word for ${count}. Add it there`,
    ];
  }
  const written = [
    ...text.matchAll(
      /× the CI test runs\*\* of the (\S+) libraries below, combined\./g,
    ),
  ].map((m) => m[1]);
  if (written.length === 0) {
    return [
      `no fact line says how many libraries the multiple is over ("of the ${word} libraries below, combined.") — ` +
        `the line was reworded, so the count is no longer checked. Update libraryCountProblems in scripts/stats.mjs`,
    ];
  }
  return written
    .filter((found) => found !== word)
    .map(
      (found) =>
        `the fact line says "the ${found} libraries below", and ${MEASUREMENTS} lists ${count}. ` +
        `Write "${word}", and give the comparison table one row for each`,
    );
}

/**
 * The comparison table holds GMT's row first, then the measured libraries and no other, by
 * tests with the most first. A measured library with no row is its digit rule's to report.
 */
function tableRowProblems(text, f) {
  const table = comparisonTable(text);
  if (!table) {
    return [
      "no table has a header row that starts `| Library` — the comparison table was reworded, " +
        "so its rows are no longer checked. Update comparisonTable in scripts/stats.mjs",
    ];
  }
  const names = table.lines
    .slice(table.start + 1, table.end)
    .map(cellsOf)
    .filter((cells) => !cells.every(isDelimiterCell))
    .map((cells) => rowName(cells[0] ?? ""));
  const measured = new Map(f.others.map((l) => [l.name, l]));
  const problems = [];

  if (names[0] !== "@northguild/gmt") {
    problems.push(
      "the comparison table's first row is not `@northguild/gmt`'s. Move GMT's row to the top",
    );
  }
  const others = names.filter((name) => name !== "@northguild/gmt");
  for (const name of new Set(others)) {
    if (!measured.has(name)) {
      problems.push(
        `the comparison table has a row for ${name}, and ${MEASUREMENTS} lists no library of that name. ` +
          `Delete the row, or add its measurement to that file`,
      );
    } else if (others.filter((other) => other === name).length > 1) {
      problems.push(
        `the comparison table has more than one row for ${name}. Keep one`,
      );
    }
  }
  const tests = others
    .filter((name) => measured.has(name))
    .map((name) => measured.get(name).tests);
  if (tests.some((count, i) => i > 0 && count > tests[i - 1])) {
    const order = [...f.others]
      .sort((a, b) => b.tests - a.tests)
      .map((l) => `${l.name} (${n(l.tests)})`);
    problems.push(
      `the comparison table's rows are out of order. After GMT's row they go by tests, most first: ${order.join(", ")}. ` +
        `Reorder the rows by hand; sync does not move a row`,
    );
  }
  return problems;
}

/**
 * The namespace index pages a README links must be those of the namespaces that export a
 * function, each at least once, with the industry layers on the "By industry" line and nothing
 * else there. A Markdown link to one is labelled with the namespace its URL names. A link
 * deeper than a namespace's index page is not one of these.
 */
function namespaceLinkProblems(text, f) {
  const link = new RegExp(
    `${escapeRegExp(REFERENCE)}([\\w-]+)\\/?(?![\\w/-])`,
    "g",
  );
  const linked = new Set();
  const onIndustryLine = new Set();
  for (const line of text.split("\n")) {
    for (const [, namespace] of line.matchAll(link)) {
      linked.add(namespace);
      if (line.startsWith(INDUSTRY_LINE)) onIndustryLine.add(namespace);
    }
  }
  const namespaces = f.byNamespace.map(([namespace]) => namespace);
  const industries = new Set(f.industries);
  const problems = [];

  for (const namespace of namespaces) {
    if (linked.has(namespace)) continue;
    problems.push(
      `no link to ${REFERENCE}${namespace}/ — \`${namespace}\` exports functions, so it needs one. ` +
        `Add it to ${industries.has(namespace) ? `the "${INDUSTRY_LINE}" line` : "the list of namespaces"}`,
    );
  }
  for (const namespace of linked) {
    if (namespaces.includes(namespace)) continue;
    problems.push(
      `links ${REFERENCE}${namespace}/, and \`${namespace}\` is not a namespace that exports functions. Remove the link`,
    );
  }
  const labelled = new RegExp(
    `\\[([^\\]]*)\\]\\(${escapeRegExp(REFERENCE)}([\\w-]+)\\/?\\)`,
    "g",
  );
  for (const [, label, namespace] of text.matchAll(labelled)) {
    if (rowName(label) === namespace) continue;
    problems.push(
      `the link labelled "${label}" goes to ${REFERENCE}${namespace}/. ` +
        `A namespace link is labelled with its namespace: write [${namespace}], or correct the URL`,
    );
  }
  for (const namespace of namespaces) {
    if (!linked.has(namespace)) continue;
    if (industries.has(namespace) && !onIndustryLine.has(namespace)) {
      problems.push(
        `\`${namespace}\` is an industry namespace, and its link is not on the "${INDUSTRY_LINE}" line. Move it there`,
      );
    }
    if (!industries.has(namespace) && onIndustryLine.has(namespace)) {
      problems.push(
        `the "${INDUSTRY_LINE}" line links \`${namespace}\`, which is not an industry namespace. Move it to the list of namespaces`,
      );
    }
  }
  return problems;
}

/**
 * What a digit rule cannot hold: a list of names, a count spelled as a word, the rows a table
 * has and their order, a set of links. `read` takes one file's text and returns a message for
 * each thing a person has to edit. `sync` rewrites none of it.
 */
function proseChecks(f) {
  return [
    {
      label: "libraries the opening paragraph names",
      files: READMES,
      read: (text) => openingNamesProblems(text, f),
    },
    {
      label: "count of the other libraries",
      files: READMES,
      read: (text) => libraryCountProblems(text, f),
    },
    {
      label: "comparison table rows",
      files: READMES,
      read: (text) => tableRowProblems(text, f),
    },
    {
      label: "namespace links",
      files: READMES,
      read: (text) => namespaceLinkProblems(text, f),
    },
  ];
}

/**
 * Pad the comparison table's cells so its columns line up; a figure that gained or lost a digit
 * leaves them ragged. Changes spaces and the dashes of the delimiter row, and throws if it
 * would change anything else.
 */
function alignComparisonTable(text, file) {
  const table = comparisonTable(text);
  if (!table) return text;
  const { lines, start, end } = table;
  const rows = lines.slice(start, end).map(cellsOf);
  const isDelimiterRow = (row) => row.every(isDelimiterCell);
  const width = (column) =>
    Math.max(
      3,
      ...rows
        .filter((row) => !isDelimiterRow(row))
        .map((row) => (row[column] ?? "").length),
    );
  const aligned = rows.map((row) => {
    const cells = row.map((cell, column) =>
      isDelimiterRow(row)
        ? `${cell.startsWith(":") ? ":" : ""}${"-".repeat(width(column) - cell.replace(/-/g, "").length)}${cell.endsWith(":") ? ":" : ""}`
        : cell.padEnd(width(column)),
    );
    return `| ${cells.join(" | ")} |`;
  });

  const unpadded = (line) => line.replace(/[ -]+/g, "");
  if (
    aligned.map(unpadded).join("\n") !==
    lines.slice(start, end).map(unpadded).join("\n")
  ) {
    throw new Error(
      `${file}: aligning the comparison table would change more than its padding — fix alignComparisonTable, not the file`,
    );
  }
  return [...lines.slice(0, start), ...aligned, ...lines.slice(end)].join("\n");
}

/**
 * Where the two READMEs first differ, as a message, or `null` when they are byte-identical.
 * Each side is quoted around the first character that differs.
 */
function firstDifference(root, pkg) {
  if (root === pkg) return null;
  const left = root.split("\n");
  const right = pkg.split("\n");
  const found = left.findIndex((line, i) => line !== right[i]);
  const at = found === -1 ? left.length : found;
  const [a, b] = [left[at], right[at]];
  let column = 0;
  while (a !== undefined && b !== undefined && a[column] === b[column])
    column++;
  const from = Math.max(0, column - 30);
  const quote = (line) =>
    line === undefined
      ? "no such line"
      : JSON.stringify(
          `${from > 0 ? "…" : ""}${line.slice(from, from + 70)}${line.length > from + 70 ? "…" : ""}`,
        );
  return `${ROOT_README} and ${PKG_README} are one text, and they differ at line ${at + 1}: ${ROOT_README} has ${quote(a)}, ${PKG_README} has ${quote(b)}`;
}

// ---------------------------------------------------------------- evaluation

/**
 * Every rule and every prose check against every file it claims.
 *
 * Returns { edits, drift, prose }: `edits` is each file's text as `sync` writes it, `drift` the
 * stale figures those edits correct, and `prose` what only a person can correct.
 */
function evaluate(f) {
  const edits = new Map();
  const textOf = (file) => edits.get(file) ?? readFileSync(file, "utf8");
  const drift = [];
  const prose = [];

  for (const rule of ruleSet(f)) {
    for (const file of rule.files) {
      const { text, hits, drift: stale } = applyRule(rule, textOf(file), file);

      if (hits === 0) {
        prose.push(
          `${file}: ${
            rule.missing ??
            `rule "${rule.label}" matched nothing — the text it guards was reworded, ` +
              `so the figure is no longer checked. Update the rule in scripts/stats.mjs.`
          }`,
        );
        continue;
      }
      for (const d of stale) {
        drift.push(
          `${file}: ${rule.label} — published ${d.was.join(" / ")}, derived ${d.now.join(" / ")}`,
        );
      }
      edits.set(file, text);
    }
  }

  for (const check of proseChecks(f)) {
    for (const file of check.files) {
      for (const message of check.read(textOf(file))) {
        prose.push(`${file}: ${message}`);
      }
    }
  }

  // Padding is not a figure: `sync` writes it, and `check` does not fail on it.
  for (const file of READMES) {
    edits.set(file, alignComparisonTable(textOf(file), file));
  }

  // The two READMEs are one text. A difference that `sync` removes (a stale figure, ragged
  // padding) is drift; one that it leaves needs a person.
  const left = firstDifference(textOf(ROOT_README), textOf(PKG_README));
  const onDisk = firstDifference(
    readFileSync(ROOT_README, "utf8"),
    readFileSync(PKG_README, "utf8"),
  );
  if (left) {
    prose.push(`${left}. Make the two files the same by hand`);
  } else if (onDisk) {
    drift.push(`${onDisk} — a figure or table padding, which sync writes`);
  }

  // The dox data file is compared by value, not bytes, so reformatting it is not drift.
  const stats = statsObject(f);
  const current = existsSync(DOX_STATS)
    ? JSON.parse(readFileSync(DOX_STATS, "utf8"))
    : {};
  const stale = Object.keys(stats).filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(stats[key]),
  );
  for (const key of stale) {
    drift.push(
      `${DOX_STATS}: ${key} — published ${JSON.stringify(current[key]) ?? "nothing"}, derived ${JSON.stringify(stats[key])}`,
    );
  }
  if (stale.length > 0) {
    edits.set(DOX_STATS, formatJson(stats));
  }

  return { edits, drift, prose };
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
    console.log(
      `    ${ns.padEnd(10)} ${count}${f.industries.includes(ns) ? "  (industry)" : ""}`,
    );
  console.log(
    `other libraries  ${f.others.length}, measured ${f.measuredFrom} to ${f.measuredTo} (${MEASUREMENTS})`,
  );
  const nameWidth = Math.max(...f.others.map((l) => l.name.length));
  for (const l of [...f.others].sort((a, b) => b.tests - a.tests))
    console.log(
      `    ${l.name.padEnd(nameWidth)} ${n(l.tests).padStart(7)} tests, ${n(l.executions).padStart(7)} CI executions`,
    );
  console.log(
    `combined         ${n(f.othersExecutions)} CI executions; GMT's are ${f.executionMultiple}× that`,
  );
}

function sync() {
  const f = figures();
  const { edits, prose } = evaluate(f);
  const written = [];

  for (const [file, text] of edits) {
    if (!existsSync(file) || text !== readFileSync(file, "utf8")) {
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

  // Stale figures are fixed by the write above; anything left needs a person.
  if (prose.length > 0) {
    console.log("\nstats: these need a prose edit, not a number:");
    for (const p of prose) console.log(`  ${p}`);
  }
}

function check() {
  const { drift, prose } = evaluate(figures());
  if (drift.length === 0 && prose.length === 0) {
    console.log("stats: published figures match the repo");
    return;
  }
  if (drift.length > 0) {
    console.error(
      "stats: published figures are out of date — run: pnpm stats:sync\n",
    );
    for (const p of drift) console.error(`  ${p}`);
  }
  if (prose.length > 0) {
    console.error(
      `${drift.length > 0 ? "\n" : ""}stats: these need a prose edit, which sync does not make:\n`,
    );
    for (const p of prose) console.error(`  ${p}`);
  }
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
