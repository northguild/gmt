/**
 * Which checks a change needs: a list of changed paths in, a set of check ids out.
 *
 * `pnpm run validate` and `.github/workflows/ci.yml` both use this, so a change runs the same
 * checks in both places. Each path is matched against `RULES` in order and the first match
 * names the checks that read it. A change gets the union over its paths, so a mixed change
 * takes the larger set. A path that no rule names gets every check: an unknown file is never
 * assumed safe.
 *
 * A rule lists a check because that check reads the path. `pnpm run affected:audit` measures
 * this: it runs every check with each repo file read and folder listed recorded, and fails on any
 * read the rules miss. Run it after a check starts reading something new. It cannot see what the
 * native tools read (tsdown, esbuild, oxlint, Astro's bundler), so those are added by hand: the
 * library's sources feed its build, bundle-size and lint:gmt, and every Dox file feeds the Dox
 * build and lint:dox. The toolchain files (the lockfile, the root package.json and tsconfig, the
 * Node version, CI itself, and these rules) run every check.
 *
 * The audit also cannot see a check that reads generated output. The audit counts reads of tracked
 * files only, and generated files are gitignored. So when a check reads a file a generator writes,
 * add that check to the rule for the generator's inputs by hand. For example, build-guides.mjs
 * copies docs/dst-disambiguation.md into the Dox content, and api-surface reads the copy.
 *
 * Pure: no file system, no git, no process. `scripts/affected.mjs` is the command line.
 */

/**
 * Every check, in the order `validate` runs them. `run` is the local command; `needs` names
 * checks whose output this one reads (a build), so asking for it adds them; `local: false`
 * marks a check only CI runs.
 */
export const CHECKS = [
  { id: "deps", run: "node scripts/deps.mjs check" },
  { id: "markers", run: "node scripts/test-markers.mjs check" },
  { id: "licences", run: "node scripts/licences.mjs check" },
  { id: "docs-check", run: "pnpm dox:docs-check" },
  { id: "upstream", run: "node scripts/upstream.mjs check" },
  { id: "bundle-size", run: "node scripts/bundle-size.mjs check" },
  {
    id: "build:gmt-oxlint",
    run: "pnpm --filter @northguild/gmt-oxlint run build",
  },
  { id: "build:gmt", run: "pnpm --filter @northguild/gmt run build" },
  {
    id: "dox-pages",
    run: [
      "node apps/dox/scripts/build-guides.mjs",
      "node apps/dox/scripts/build-scenario-index.mjs",
      "pnpm --filter @gmt/dox exec tsx scripts/build-tool-index.ts",
      "pnpm --filter @gmt/dox exec tsx scripts/build-industry-pages.ts",
    ].join(" && "),
  },
  {
    id: "build:dox",
    run: "pnpm --filter @gmt/dox run build",
    needs: ["build:gmt"],
  },
  { id: "stats", run: "node scripts/stats.mjs check", needs: ["build:gmt"] },
  {
    id: "compat",
    run: "node scripts/temporal-compat.mjs snapshot --check",
    needs: ["build:gmt"],
  },
  {
    id: "api-surface",
    run: "node scripts/api-surface.mjs check",
    needs: ["build:gmt", "dox-pages"],
  },
  {
    id: "dox-dist",
    local: false,
    run: "DOX_DIST_REQUIRED=1 pnpm --filter @gmt/dox exec vitest run scripts/llms.test.ts scripts/dist-base.test.ts scripts/head-tags.test.ts",
    needs: ["build:dox"],
  },
  {
    id: "lint:gmt",
    run: "pnpm --filter @northguild/gmt run lint",
    needs: ["build:gmt-oxlint"],
  },
  {
    id: "lint:dox",
    run: "pnpm --filter @gmt/dox run lint",
    needs: ["build:gmt-oxlint"],
  },
  {
    id: "typecheck:gmt-oxlint",
    run: "pnpm --filter @northguild/gmt-oxlint run typecheck",
  },
  { id: "typecheck:gmt", run: "pnpm --filter @northguild/gmt run typecheck" },
  {
    id: "typecheck:dox",
    run: "pnpm --filter @gmt/dox run typecheck",
    needs: ["build:gmt"],
  },
  {
    id: "test:gmt-oxlint",
    run: "pnpm --filter @northguild/gmt-oxlint run test",
  },
  {
    id: "test:dox",
    run: "pnpm --filter @gmt/dox run test",
    needs: ["build:gmt"],
  },
  { id: "test:gmt", run: "pnpm --filter @northguild/gmt run test" },
];

const ALL = CHECKS.map((c) => c.id);
const ids = new Set(ALL);

/** Every check whose id starts with one of `prefixes`, so `"lint:"` names each package's lint. */
const every = (...prefixes) =>
  ALL.filter((id) => prefixes.some((p) => id.startsWith(p)));

/** Every check but the named ones. */
const allBut = (...skip) => ALL.filter((id) => !skip.includes(id));

/** What the library's source feeds: its build, everything built from it, and its own checks. */
const GMT_LIB = allBut(
  "deps",
  "lint:dox",
  "typecheck:gmt-oxlint",
  "test:gmt-oxlint",
);

/** What the Dox app feeds: its build, checks and tests, and the root checks that read the site. */
const DOX_APP = [
  "markers",
  "docs-check",
  "dox-pages",
  "build:dox",
  "api-surface",
  "dox-dist",
  "lint:dox",
  "typecheck:dox",
  "test:dox",
];

/** What a Dox content page feeds: the generated pages, the build and the checks that read pages. */
const DOX_CONTENT = [
  "dox-pages",
  "build:dox",
  "api-surface",
  "dox-dist",
  "typecheck:dox",
  "test:dox",
];

/** The lint plugin: its own build, checks and tests, and the two lints that load it. */
const OXLINT = [
  ...every(
    "build:gmt-oxlint",
    "typecheck:gmt-oxlint",
    "test:gmt-oxlint",
    "lint:",
  ),
  "markers",
];

/** The tests of the repo scripts live in apps/dox/scripts and run with the Dox tests. */
const SCRIPT_TESTS = ["test:dox"];

/**
 * Path rules, first match wins. `test` is a RegExp against the repo-relative path with `/`
 * separators. `checks` is what to run when the file is changed; `listed` is what else to run
 * when the file is added or deleted, for the checks that list its directory without reading the
 * file (stats counts the guides by listing their folder). A path no rule matches gets every check.
 */
export const RULES = [
  // The rules themselves, CI and the toolchain: anything can change, so everything runs.
  {
    test: /^(?:scripts\/affected\.mjs|scripts\/lib\/(?:affected|read-tracer)\.mjs|\.github\/workflows\/ci\.yml)$/,
    checks: ALL,
  },
  {
    test: /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.node-version|tsconfig\.base\.json)$/,
    checks: ALL,
  },
  { test: /^(?:packages\/[^/]+|apps\/dox)\/package\.json$/, checks: ALL },

  // The licence files. licences.mjs reads the root LICENSE, each top-level folder's LICENSE and
  // each package's LICENSE, and lists every tracked file to find the top-level folders.
  { test: /^(?:[^/]+\/)?LICENSE$/, checks: ["licences"] },
  { test: /^packages\/[^/]+\/LICENSE$/, checks: ["licences"], listed: ALL },

  // Notes for people and agents, and the changesets (CI checks those on every run).
  {
    test: /^(?:\.agents|\.claude|\.vscode|\.changeset)\//,
    checks: [],
  },
  {
    test: /^(?:AGENTS\.md|CLAUDE\.md|PUBLISHING\.md|SECURITY\.md|\.gitignore|\.fallowrc\.jsonc|\.oxfmtrc\.json|context7\.json|skills-lock\.json|pyproject\.toml|uv\.lock|tsconfig\.json|vitest\.config\.ts)$/,
    checks: [],
  },
  { test: /^\.github\//, checks: [] },
  {
    test: /^context\/domination\/js-temporal-polyfill-bugs\.md$/,
    checks: ["deps", ...SCRIPT_TESTS],
  },
  { test: /^context\/(?:domination\/|dox\/tracker\.md$)/, checks: ["deps"] },
  { test: /^context\//, checks: [] },
  { test: /^CONTRIBUTING\.md$/, checks: ["test:dox"] },
  { test: /^oxlint\.config\.mts$/, checks: ["test:dox"] },
  {
    test: /^(?:packages\/gmt\/)?README\.md$/,
    checks: ["api-surface", "stats", "test:dox"],
    listed: ALL,
  },
  // build-guides.mjs copies docs/ into the Dox content, so it runs what a content page runs.
  { test: /^docs\//, checks: DOX_CONTENT },

  // A README, changelog or licence at a package root is read by no check, but the builds and
  // pnpm list the folder it sits in.
  {
    test: /^(?:packages\/[^/]+|apps\/dox)\/(?:README\.md|CHANGELOG\.md|LICENSE|\.gitignore|\.npmignore)$/,
    checks: [],
    listed: ALL,
  },

  // The library.
  {
    test: /^packages\/gmt\/src\/.*\.test\.ts$/,
    checks: [
      "markers",
      "stats",
      "lint:gmt",
      "typecheck:gmt",
      "test:gmt",
      "test:dox",
    ],
    listed: [
      "build:gmt",
      "docs-check",
      "api-surface",
      "build:dox",
      "typecheck:dox",
    ],
  },
  { test: /^packages\/gmt\/src\/.*\.md$/, checks: [], listed: GMT_LIB },
  { test: /^packages\/gmt\/src\//, checks: GMT_LIB },
  {
    test: /^packages\/gmt\/(?:tsconfig(?:\.build)?\.json|tsdown\.config\.ts)$/,
    checks: GMT_LIB,
    listed: ALL,
  },
  {
    test: /^packages\/gmt\/bench\//,
    checks: ["markers", "lint:gmt", "typecheck:gmt", "test:gmt"],
  },
  {
    test: /^packages\/gmt\/skills\//,
    checks: ["markers", "api-surface", "test:dox"],
    // apps/dox/worker/vocabulary.ts imports the SKILL.md files; the type check resolves them.
    listed: ["typecheck:dox"],
  },
  {
    test: /^packages\/gmt\/oxlint\.config\.mts$/,
    checks: ["markers", "lint:gmt"],
    listed: ALL,
  },
  {
    test: /^packages\/gmt\/vitest\.config\.ts$/,
    checks: ["markers", "stats", "lint:gmt", "test:gmt"],
    listed: ALL,
  },
  {
    test: /^packages\/gmt\/vitest\.\w+\.config\.ts$/,
    checks: ["markers", "lint:gmt"],
    listed: ALL,
  },

  // The lint plugins.
  {
    test: /^packages\/gmt-oxlint\/(?:src\/|config\/|tsconfig\.json$|tsup\.config\.ts$)/,
    checks: OXLINT,
    listed: ALL,
  },
  {
    test: /^packages\/gmt-oxlint\/vitest\.config\.ts$/,
    checks: ["markers", "test:gmt-oxlint"],
    listed: ALL,
  },
  { test: /^packages\/gmt-oxlint\/skills\//, checks: [], listed: OXLINT },
  {
    test: /^packages\/gmt-(?:biome|eslint)\/(?:eslint|plugins|skills)\//,
    checks: ["markers"],
  },

  // The Dox site. Content is Markdown: the lint and the library's own checks do not read it.
  {
    test: /^apps\/dox\/src\/content\//,
    checks: DOX_CONTENT,
    listed: ["markers", "stats"],
  },
  {
    test: /^apps\/dox\/src\/data\//,
    checks: [...DOX_APP, "stats", "compat", "upstream"],
  },
  {
    test: /^apps\/dox\/src\/generated\//,
    checks: [...DOX_APP, "stats", "test:gmt"],
  },
  { test: /^apps\/dox\/[^/]+$/, checks: DOX_APP, listed: ALL },
  { test: /^apps\/dox\//, checks: DOX_APP },

  // The repo scripts. Each runs as its own check, and the Dox tests cover them all.
  { test: /^scripts\/deps\.mjs$/, checks: ["deps", ...SCRIPT_TESTS] },
  { test: /^scripts\/licences\.mjs$/, checks: ["licences"] },
  // The behaviour matrix runner is run by hand; the Dox tests walk and copy scripts/.
  { test: /^scripts\/behaviour-matrix\//, checks: SCRIPT_TESTS },
  {
    test: /^scripts\/test-markers\.mjs$/,
    checks: ["markers", ...SCRIPT_TESTS],
  },
  {
    test: /^scripts\/api-surface\.mjs$/,
    checks: ["api-surface", ...SCRIPT_TESTS],
  },
  {
    test: /^scripts\/bundle-size\.(?:mjs|budgets\.json)$/,
    // The Dox generate step runs `bundle-size.mjs report` for the bundle-size page.
    checks: [
      "bundle-size",
      "build:dox",
      "dox-dist",
      "typecheck:dox",
      ...SCRIPT_TESTS,
    ],
  },
  { test: /^scripts\/stats\.mjs$/, checks: ["stats", ...SCRIPT_TESTS] },
  {
    test: /^scripts\/upstream\.mjs$/,
    checks: [
      "upstream",
      "build:dox",
      "dox-dist",
      "typecheck:dox",
      ...SCRIPT_TESTS,
    ],
  },
  {
    test: /^scripts\/temporal-compat(?:\.mjs$|\/)/,
    checks: ["compat", ...SCRIPT_TESTS],
  },
  {
    test: /^scripts\/lib\/(?:format-json|gmt)\.mjs$/,
    checks: [
      "stats",
      "compat",
      "upstream",
      "build:dox",
      "dox-dist",
      "typecheck:dox",
      ...SCRIPT_TESTS,
    ],
  },
  {
    test: /^scripts\/lib\/(?:canary-verdict|workaround-state|workarounds)\.mjs$/,
    checks: ["compat", "typecheck:dox", ...SCRIPT_TESTS],
  },
  {
    test: /^scripts\/(?:canary-report|native-suite|lib\/(?:canary-issues|canary-summary|native-suite-[\w-]+))\.mjs$/,
    checks: ["typecheck:dox", ...SCRIPT_TESTS],
  },
  {
    test: /^scripts\/(?:leap-seconds|release-announcement|release-notes|sync-intent-version|unshipped-deps)\.mjs$/,
    checks: SCRIPT_TESTS,
  },
];

/**
 * Which checks a set of changed paths needs, and which paths asked for each. A path is a string
 * or `{ path, status }` with git's status letter. Only `M` skips a rule's `listed` checks: a bare
 * string may be a new file, so it gets them too.
 */
export function affected(changes) {
  /** @type {Map<string, string[]>} check id → the paths that asked for it */
  const reasons = new Map();
  const ask = (id, why) => {
    if (!reasons.has(id)) reasons.set(id, []);
    reasons.get(id).push(why);
  };
  for (const change of changes) {
    const { path: raw, status } =
      typeof change === "string" ? { path: change } : change;
    const path = raw.replaceAll("\\", "/");
    if (path === "") continue;
    const rule = ruleFor(path);
    if (!rule) {
      for (const id of ALL) ask(id, `${path} (no rule)`);
      continue;
    }
    for (const id of rule.checks) ask(id, path);
    if (status !== "M") {
      for (const id of rule.listed ?? []) {
        if (!rule.checks.includes(id))
          ask(id, `${path} (${status === "D" ? "deleted" : "added"})`);
      }
    }
  }
  return withNeeds(reasons);
}

/** The first rule that matches `path`, or undefined. */
export function ruleFor(path) {
  return RULES.find((r) => r.test.test(path));
}

/**
 * Adds the checks the asked-for ones need. CHECKS lists every build before the checks that
 * need it, so one pass in reverse order also reaches a build that needs a build (build:dox
 * needs build:gmt).
 */
export function withNeeds(reasons) {
  for (const check of [...CHECKS].reverse()) {
    if (!reasons.has(check.id)) continue;
    for (const need of check.needs ?? []) {
      if (!reasons.has(need)) reasons.set(need, []);
      reasons.get(need).push(`needed by ${check.id}`);
    }
  }
  const checks = ALL.filter((id) => reasons.has(id));
  return { checks, reasons, full: checks.length === ALL.length };
}

/**
 * What the rules miss, from the reads `node scripts/affected.mjs audit` recorded. `traces` maps a
 * check id to its `R <path>`, `S <path>` and `D <dir>` lines; `tracked` is every tracked file. A
 * tracked file a check read must name that check in its rule's `checks`. A tracked file the check
 * stat'ed, or one directly inside a folder the check listed, must name it in `checks` or `listed`:
 * adding or deleting the file changes what the check sees. A stat counts like a listing because
 * most stats only ask whether a path exists or is a folder (a walk, an import resolved); a check
 * that compares mtimes also reads the file whenever it is out of date.
 */
export function uncovered(traces, tracked) {
  const isTracked = new Set(tracked);
  const children = new Map();
  for (const file of tracked) {
    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
    if (!children.has(dir)) children.set(dir, []);
    children.get(dir).push(file);
  }
  const misses = [];
  for (const [check, lines] of traces) {
    const seen = new Set();
    for (const line of lines) {
      const kind = line[0];
      const target = line.slice(2).replace(/\/$/, "");
      const files =
        kind === "D"
          ? (children.get(target) ?? [])
          : isTracked.has(target)
            ? [target]
            : [];
      for (const file of files) {
        if (seen.has(`${kind} ${file}`)) continue;
        seen.add(`${kind} ${file}`);
        const rule = ruleFor(file);
        if (!rule) continue; // no rule: every check runs
        const covered =
          kind === "R" ? rule.checks : [...rule.checks, ...(rule.listed ?? [])];
        if (!covered.includes(check)) {
          const via =
            { R: "reads", S: "stats" }[kind] ?? `lists ${target || "."}`;
          misses.push({ check, path: file, via });
        }
      }
    }
  }
  return misses;
}

/** Throws when a rule names a check that does not exist. Run by the tests and the command line. */
export function assertRulesValid() {
  for (const rule of RULES) {
    for (const id of [...rule.checks, ...(rule.listed ?? [])]) {
      if (!ids.has(id))
        throw new Error(`Rule ${rule.test} names an unknown check "${id}".`);
    }
  }
  for (const check of CHECKS) {
    for (const need of check.needs ?? []) {
      if (!ids.has(need))
        throw new Error(`Check ${check.id} needs an unknown check "${need}".`);
      if (ALL.indexOf(need) > ALL.indexOf(check.id)) {
        throw new Error(
          `Check ${check.id} needs ${need}, which CHECKS lists after it.`,
        );
      }
    }
  }
}

export { ALL as ALL_CHECKS, every };
