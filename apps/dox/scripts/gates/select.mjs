/**
 * Which pages a diff touches: pure `(changed files, pages, options) → plan`.
 *
 * `pages` come from `graph.mjs` (`{ path, file, closure, gmt }`), `changed` are repository-root
 * relative paths from git. Nothing here reads the disk or runs git, so the tests feed it plain data.
 *
 * - A changed file selects every page whose closure holds it.
 * - A change under `packages/gmt/src/<namespace>/<module>/` selects the pages that import
 *   `@northguild/gmt/<namespace>/<module>`, and the sample: a page that reaches the module through
 *   another one, or imports the package whole, is not in the graph. Any other library change
 *   selects the sample.
 * - Chrome (the Starlight shell, its stylesheets and component overrides, `astro.config.mjs`,
 *   `apps/dox/package.json`, `pnpm-lock.yaml`) selects the sample.
 * - A changed gate script selects that gate on the sample (`gateScripts` names the scripts and the data files a gate reads).
 * - Any other `apps/dox/` file that no page's closure holds selects the sample, never nothing: a
 *   component the chrome imports, a generator of the `/reference/` pages, a file in `public/`.
 * - Over `CAP` pages, only the sample and `CAP_REST` evenly picked others are kept.
 */

export const CAP = 12;
export const CAP_REST = 6;

const CHROME_EXACT = new Set([
  "apps/dox/astro.config.mjs",
  "apps/dox/package.json",
  "pnpm-lock.yaml",
]);
const CHROME_COMPONENTS = new Set([
  "Head",
  "Header",
  "Footer",
  "ThemeProvider",
  "ThemeSelect",
  "Hero",
  "PageTitle",
  "Sidebar",
  "SocialIcons",
]);

/** Gate-runner files whose change means "run every gate on the sample". */
const RUNNER_PREFIXES = [
  "apps/dox/scripts/gates/",
  "apps/dox/scripts/gates.mjs",
  "apps/dox/scripts/gate-checks.mjs",
  "apps/dox/scripts/lib/",
];

/** Whether a changed file is worth a build at all (the early exit). */
export function isRelevant(file) {
  if (file.endsWith(".test.ts")) return false;
  return (
    file.startsWith("apps/dox/") ||
    file.startsWith("packages/gmt/src/") ||
    file === "pnpm-lock.yaml"
  );
}

function isChrome(file) {
  if (CHROME_EXACT.has(file)) return true;
  if (file.startsWith("apps/dox/src/styles/")) return true;
  const component = /^apps\/dox\/src\/components\/([^/]+)\.astro$/.exec(file);
  return Boolean(component && CHROME_COMPONENTS.has(component[1]));
}

/** `count` items picked evenly from a sorted list. */
export function pickEvenly(list, count) {
  if (list.length <= count) return [...list];
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(list[Math.floor(((i + 0.5) * list.length) / count)]);
  }
  return [...new Set(picked)];
}

/**
 * `gateScripts` maps a script file name to its gate id.
 *
 * @param {{
 *   changed: string[],
 *   pages: { path: string, file: string, closure: string[], gmt: string[] }[],
 *   sample: string[],
 *   gateScripts?: Record<string, string>,
 *   all?: boolean,
 * }} input
 */
export function selectPages({
  changed,
  pages,
  sample,
  gateScripts = {},
  all = false,
}) {
  const known = new Set(pages.map((p) => p.path));
  const sampleHere = sample.filter((p) => known.has(p));
  const reasons = new Map();
  const why = (page, reason) => {
    const list = reasons.get(page) ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(page, list);
  };
  const addSample = (reason) => {
    for (const p of sampleHere) why(p, reason);
  };
  const gatesOnSample = new Set();
  const relevant = changed.filter(isRelevant);

  for (const file of relevant) {
    const script = /^apps\/dox\/scripts\/([^/]+\.(?:mjs|json))$/.exec(file);
    if (script && gateScripts[script[1]]) {
      gatesOnSample.add(gateScripts[script[1]]);
      continue;
    }
    if (RUNNER_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      gatesOnSample.add("*");
      continue;
    }
    if (isChrome(file)) {
      addSample(`chrome: ${file}`);
      continue;
    }
    const library = /^packages\/gmt\/src\/([^/]+)\/([^/]+)\//.exec(file);
    if (library) {
      const module = `${library[1]}/${library[2]}`;
      const hit = pages.filter((p) => p.gmt.includes(module));
      for (const p of hit) why(p.path, `imports @northguild/gmt/${module}`);
      addSample(`library: ${file}`);
      continue;
    }
    if (file.startsWith("packages/gmt/src/")) {
      addSample(`library: ${file}`);
      continue;
    }
    const reached = pages.filter((p) => p.closure.includes(file));
    for (const p of reached) why(p.path, file);
    if (reached.length === 0 && file.startsWith("apps/dox/")) {
      addSample(`no page imports it: ${file}`);
    }
  }

  let selected = [...reasons.keys()].sort();
  let capped = null;
  if (all) {
    selected = pages.map((p) => p.path).sort();
  } else if (selected.length > CAP) {
    const inSample = selected.filter((p) => sampleHere.includes(p));
    const rest = selected.filter((p) => !sampleHere.includes(p));
    const kept = [
      ...new Set([...sampleHere, ...pickEvenly(rest, CAP_REST)]),
    ].sort();
    capped = { from: selected.length, to: kept.length };
    for (const p of kept) {
      if (!inSample.includes(p) && !reasons.has(p)) why(p, "cap");
    }
    selected = kept;
  }

  return {
    pages: selected,
    reasons: Object.fromEntries(
      selected.map((p) => [p, reasons.get(p) ?? ["--all"]]),
    ),
    capped,
    sample: sampleHere,
    gatesOnSample: [...gatesOnSample].sort(),
    relevant: relevant.length > 0,
  };
}
