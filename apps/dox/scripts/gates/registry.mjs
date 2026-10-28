/**
 * The gates the runner (`scripts/gates.mjs`) knows, as data. One entry per gate:
 *
 *   id            the name on the screen, in `--only`, and in the log file names
 *   script        the file in `apps/dox/scripts/` that runs it
 *   tier          `pr`, `nightly` or `local`; tiers nest (`--tier pr` < `nightly` < `local`)
 *   browsers      the engines the gate can run in; a requested browser outside it is dropped
 *   fullBrowsers  under `--all`, the browsers that get every page (the others get the sample);
 *                 null means all of them
 *   themes        true runs the gate once per theme with `--theme`
 *   needs         null, "gpu" or "baseline" (a tree built from the base commit)
 *
 * and, where the script departs from the common contract:
 *
 *   args          fixed extra arguments; `{gates}` is the absolute `.gates` folder
 *   base          false when the script loads no page from the runner's server
 *   browserArg    false when the script takes no `--browsers`
 *   pages         "dist" when the gate lists every built page (`a11y-axe`, `a11y-media`), so the
 *                 runner reads `dist` itself; the default asks the script with `--list-pages`
 *                 (`a11y-tab-walk` lists a subset, so it answers for itself)
 *
 * The page lists are not here: the runner asks each script with `--list-pages`, so nothing is
 * copied out of a gate.
 */

/** The pages every sampled run covers; each must exist in `dist` (`registry.test.ts`). */
export const SAMPLE = [
  "/",
  "/why-gmt/",
  "/tools/dwell-ledger/",
  "/tools/dst-inspector/",
  "/check/canada-2026-clock-change/",
  "/dox/",
];

export const TIERS = ["pr", "nightly", "local"];

const ENGINES = ["chromium", "webkit", "firefox"];

/**
 * @typedef {object} Gate
 * @property {string} id
 * @property {string} script
 * @property {"pr" | "nightly" | "local"} tier
 * @property {string[]} browsers
 * @property {string[] | null} fullBrowsers
 * @property {boolean} themes
 * @property {null | "gpu" | "baseline"} needs
 * @property {string[]} [args]
 * @property {boolean} [base]
 * @property {boolean} [browserArg]
 * @property {"dist"} [pages]
 */

/** @type {Gate[]} */
export const GATES = [
  {
    id: "contrast-measure",
    script: "contrast-measure.mjs",
    tier: "pr",
    browsers: ["chromium"],
    fullBrowsers: null,
    themes: true,
    needs: null,
    browserArg: false,
  },
  {
    id: "grow-measure",
    script: "grow-measure.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: null,
    themes: false,
    needs: null,
    args: ["--out", "{gates}/grow-measure"],
  },
  {
    id: "readout-still",
    script: "readout-still.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: null,
    themes: false,
    needs: null,
  },
  {
    id: "data-credits-check",
    script: "data-credits-check.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: null,
    themes: false,
    needs: null,
  },
  {
    id: "canada-layout-check",
    script: "canada-layout-check.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: null,
    themes: false,
    needs: null,
  },
  {
    id: "a11y-axe",
    script: "a11y-axe.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: ["chromium"],
    themes: true,
    needs: null,
    pages: "dist",
  },
  {
    id: "a11y-tab-walk",
    script: "a11y-tab-walk.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: ["chromium"],
    themes: true,
    needs: null,
  },
  {
    id: "a11y-media",
    script: "a11y-media.mjs",
    tier: "pr",
    browsers: ENGINES,
    fullBrowsers: ["chromium"],
    themes: true,
    needs: null,
    pages: "dist",
  },
  {
    id: "canada-clock-still",
    script: "canada-clock-still.mjs",
    tier: "nightly",
    browsers: ENGINES,
    fullBrowsers: null,
    themes: false,
    needs: null,
  },
  {
    id: "canada-stored-still",
    script: "canada-stored-still.mjs",
    tier: "nightly",
    browsers: ENGINES,
    fullBrowsers: null,
    themes: false,
    needs: null,
  },
  {
    id: "globe-smoke",
    script: "globe-smoke.mjs",
    tier: "local",
    browsers: ["chromium"],
    fullBrowsers: null,
    themes: false,
    needs: "gpu",
    base: false,
    browserArg: false,
  },
  {
    id: "html-diff",
    script: "html-diff.mjs",
    tier: "local",
    browsers: [],
    fullBrowsers: null,
    themes: false,
    needs: "baseline",
    base: false,
    browserArg: false,
  },
  {
    id: "visual-diff",
    script: "visual-snapshot.mjs",
    tier: "local",
    browsers: ["chromium"],
    fullBrowsers: null,
    themes: false,
    needs: "baseline",
    browserArg: false,
  },
];

/** Whether `gate` runs at `tier` (`pr` gates run at every tier, `local` gates only at `local`). */
export function inTier(gate, tier) {
  return TIERS.indexOf(gate.tier) <= TIERS.indexOf(tier);
}

/** `{ "readout-still.mjs": "readout-still", … }` for `select.mjs`. */
export function scriptIndex() {
  return Object.fromEntries(GATES.map((g) => [g.script, g.id]));
}

/**
 * A data file a gate reads, mapped to that gate, so a change to it runs the gate on the sample.
 * The axe exclusion list is the only one: editing it changes what `a11y-axe` reports.
 */
export function inputIndex() {
  return { "a11y-axe-exclusions.json": "a11y-axe" };
}
