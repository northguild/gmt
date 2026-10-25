/**
 * The compat check in a browser: the same probes `scripts/temporal-compat.mjs check` runs on Node,
 * run on each browser engine the native suite covers, against the `@js-temporal/polyfill` GMT
 * ships. A workaround group with `engines` (D17, say) is a defect only that engine's `Intl` shows;
 * only that engine can show whether it is still needed, and Node cannot. The runner writes one
 * `temporal-compat-<leg>` verdict per browser leg; `canary-issues.mjs` reports a group removable
 * only when every engine in its scope says so.
 *
 * The page is served from a virtual origin through Playwright's request routing: no HTTP server,
 * no port, no file written. An import map points the polyfill's bare imports at that origin, and
 * the page loads GMT's compiled repros from `packages/gmt/dist` as the Node check does.
 *
 * Node built-ins, `./workarounds.mjs`, `./workaround-state.mjs` and `./canary-verdict.mjs` only;
 * Playwright is passed in, so a test runs the pure parts without a browser.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { browserCompatVerdict } from "./canary-verdict.mjs";
import { workaroundState } from "./workaround-state.mjs";
import {
  ENGINE_IDS,
  WORKAROUNDS,
  polyfillEntry,
  polyfillVersion,
} from "./workarounds.mjs";

/** The browsers' names as the verdicts and reports print them. */
export const BROWSER_LABELS = Object.freeze({
  chromium: "Chromium",
  firefox: "Firefox",
  webkit: "WebKit",
});

/** The origin the compat page is served from; nothing listens there, routing answers it. */
export const COMPAT_ORIGIN = "http://gmt.local";
/** The page's path for the polyfill's ESM build and for its one dependency. */
const POLYFILL_PATH = "/polyfill.js";
const JSBI_PATH = "/jsbi.js";
/** The page's prefix for files under `packages/gmt/dist`. */
const DIST_PREFIX = "/dist/";
const REPROS = "internal/temporalCompat/repros.js";
const CAPABILITIES = "internal/temporalCompat/capabilities.js";
/** How long the page may take to run every probe (Node takes well under a second). */
const PAGE_TIMEOUT_MS = 60 * 1000;
/** The time zone and locale the page runs in: the ones CI's Node has. */
const PAGE_ZONE = "UTC";
const PAGE_LOCALE = "en-US";

/**
 * @typedef {"chromium" | "firefox" | "webkit"} BrowserLeg
 * @typedef {{ defect: string, calendar: string, name: string, output: string, passes: boolean }} ProbeResult
 * @typedef {{ dist: string, polyfill: string, jsbi: string }} Paths
 */

/**
 * The page: an import map for the polyfill's bare imports, then a module that runs every repro
 * and leaves `window.__compat` as `{ results }` or `{ error }`.
 * @returns {string}
 */
export function compatPage() {
  const importMap = JSON.stringify({
    imports: { "@js-temporal/polyfill": POLYFILL_PATH, jsbi: JSBI_PATH },
  });
  return `<!doctype html>
<meta charset="utf-8">
<title>GMT compat check</title>
<script type="importmap">${importMap}</script>
<script type="module">
try {
  const { repros } = await import(${JSON.stringify(DIST_PREFIX + REPROS)});
  const { runRepro, reproPasses } = await import(${JSON.stringify(DIST_PREFIX + CAPABILITIES)});
  window.__compat = {
    results: repros.map((repro) => {
      const output = runRepro(repro);
      return {
        defect: repro.defect,
        calendar: repro.calendar,
        name: repro.name,
        output: String(output),
        passes: reproPasses(repro, output),
      };
    }),
  };
} catch (error) {
  window.__compat = { error: String(error && error.stack || error) };
}
</script>
`;
}

/**
 * The file behind a request path, or null for a path the page may not have: anything outside
 * `packages/gmt/dist`, anything but a `.js` file there, or a name nothing in the page uses.
 * @param {string} pathname
 * @param {Paths} paths
 * @returns {{ path: string, contentType: string } | null}
 */
export function compatFile(pathname, paths) {
  if (pathname === POLYFILL_PATH) {
    return { path: paths.polyfill, contentType: "text/javascript" };
  }
  if (pathname === JSBI_PATH) {
    return { path: paths.jsbi, contentType: "text/javascript" };
  }
  if (!pathname.startsWith(DIST_PREFIX) || !pathname.endsWith(".js")) {
    return null;
  }
  const path = resolve(paths.dist, pathname.slice(DIST_PREFIX.length));
  const inside = relative(paths.dist, path);
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
    return null;
  }
  return { path, contentType: "text/javascript" };
}

/**
 * Where the files the page serves live. The polyfill's ESM build sits beside the `require`
 * entry the package resolves to, and `jsbi` (its one import) resolves from there, so the browser
 * gets the very same install Node's check uses.
 * @param {string} root
 * @returns {Paths}
 */
export function compatPaths(root) {
  const dist = join(root, "packages/gmt/dist");
  if (!existsSync(join(dist, REPROS))) {
    throw new Error("packages/gmt/dist is missing: run pnpm build first");
  }
  const entry = realpathSync(polyfillEntry());
  const polyfill = join(dirname(entry), "index.esm.js");
  const jsbi = join(dirname(createRequire(entry).resolve("jsbi")), "jsbi.mjs");
  for (const file of [polyfill, jsbi]) {
    if (!existsSync(file)) {
      throw new Error(`the installed polyfill has no ESM build at ${file}`);
    }
  }
  return { dist, polyfill, jsbi };
}

/**
 * The page's results grouped by workaround, each group with its state on this engine: the shape
 * `compatCheckVerdict` and `browserCompatVerdict` take. Throws on a repro whose defect no group
 * claims, as `temporal-compat.mjs` stops on one: the canary and the script have drifted apart.
 * @param {ProbeResult[]} results
 * @param {string} installed  the installed `@js-temporal/polyfill` version
 * @param {string} engineId  the engine the results came from (`ENGINE_IDS`)
 */
export function groupResults(results, installed, engineId) {
  const covered = new Set(WORKAROUNDS.flatMap((w) => w.defects));
  const unknown = [
    ...new Set(
      results.filter((r) => !covered.has(r.defect)).map((r) => r.defect),
    ),
  ];
  if (unknown.length > 0) {
    throw new Error(
      `repros with no workaround group in scripts/lib/workarounds.mjs: ${unknown.join(", ")}`,
    );
  }
  return WORKAROUNDS.map((workaround) => {
    const own = results
      .filter((r) => workaround.defects.includes(r.defect))
      .map(({ defect, calendar, name, output, passes }) => ({
        repro: { defect, calendar, name },
        output,
        passes,
      }));
    const passing = own.filter((r) => r.passes).length;
    return {
      workaround,
      results: own,
      passing,
      ...workaroundState(
        {
          probes: own.length,
          failing: own.length - passing,
          guard: workaround.guard,
          engines: workaround.engines,
        },
        installed,
        engineId,
      ),
    };
  });
}

/**
 * Runs the compat check in one browser and returns its verdict. Throws with the reason when it
 * cannot (no Playwright, no dist, the page failed); the runner turns that into a could-not-run
 * verdict for the `temporal-compat-<leg>` source.
 * @param {BrowserLeg} leg
 * @param {string} root
 * @param {{ playwright: () => Promise<any> }} deps  loads the `playwright` module
 */
export async function runBrowserCompat(leg, root, { playwright: load }) {
  const paths = compatPaths(root);
  const page = compatPage();
  let playwright;
  try {
    playwright = await load();
  } catch (error) {
    throw new Error(
      `playwright is not installed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const playwrightVersion = JSON.parse(
    readFileSync(
      createRequire(import.meta.url).resolve("playwright/package.json"),
      "utf8",
    ),
  ).version;
  const browser = await playwright[leg].launch();
  try {
    const context = await browser.newContext({
      timezoneId: PAGE_ZONE,
      locale: PAGE_LOCALE,
    });
    await context.route(`${COMPAT_ORIGIN}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") {
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body: page,
        });
      }
      const file = compatFile(pathname, paths);
      if (!file) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({
        status: 200,
        contentType: file.contentType,
        body: readFileSync(file.path),
      });
    });
    const tab = await context.newPage();
    await tab.goto(`${COMPAT_ORIGIN}/`);
    await tab.waitForFunction(() => "__compat" in window, null, {
      timeout: PAGE_TIMEOUT_MS,
    });
    /** @type {{ results: ProbeResult[] } | { error: string }} */
    const outcome = await tab.evaluate(
      () => /** @type {any} */ (window).__compat,
    );
    if ("error" in outcome) {
      throw new Error(`the compat page failed in ${leg}: ${outcome.error}`);
    }
    const engineId = ENGINE_IDS[leg];
    const polyfill = polyfillVersion();
    return browserCompatVerdict({
      leg,
      engine: `${BROWSER_LABELS[leg]} ${browser.version()}`,
      engineId,
      runtime: {
        polyfill,
        node: process.version,
        playwright: playwrightVersion,
      },
      groups: groupResults(outcome.results, polyfill, engineId),
    });
  } finally {
    await browser.close();
  }
}
