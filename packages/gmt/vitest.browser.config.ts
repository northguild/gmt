import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import {
  configDefaults,
  defineConfig,
  mergeConfig,
  type Plugin,
} from "vitest/config";
import { REPO_FILES, repoFile, sourceTree } from "./src/test/sourceTree.ts";
import { baseConfig as base, testInclude } from "./vitest.config.ts";
import { CANDIDATE_ENTRY } from "./vitest.swap.config.ts";

// The same suite in Chromium, Firefox and WebKit. By default the polyfill's specifier resolves to the
// native-Temporal shim, so each browser runs on its own engine. `GMT_TEMPORAL=polyfill` removes
// that alias: the control pass of the native-suite runner, which runs the pinned `temporal-polyfill`
// and shows which failures belong to the browser (its locale data, its time zone data) and not to
// its Temporal. `GMT_TEMPORAL=candidate` aliases the specifier to the candidate release instead: the
// swap pass of the upgrade check (`temporal-polyfill-candidate`, installed by the job alone).

const here = import.meta.dirname;
const testDir = path.resolve(here, "src/test");
const VIRTUAL_ID = "virtual:gmt-source-tree";

// Test helpers that use Node built-ins have a browser twin next to them; the plugin serves the
// twin wherever the Node file is imported.
const BROWSER_TWINS = new Map(
  ["sourceTree", "boundedChild"].map((name) => [
    path.join(testDir, `${name}.ts`),
    path.join(testDir, `${name}.browser.ts`),
  ]),
);

function browserTwinsPlugin(): Plugin {
  return {
    name: "gmt-browser-twins",
    enforce: "pre",
    // fallow-ignore-next-line complexity -- build-time plugin hook, exercised by every browser run
    async resolveId(source, importer, options) {
      if (source === VIRTUAL_ID) return `\0${VIRTUAL_ID}`;
      if (!source.startsWith(".")) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      return (resolved && BROWSER_TWINS.get(resolved.id)) ?? null;
    },
    load(id) {
      if (id !== `\0${VIRTUAL_ID}`) return null;
      // The Node implementation decides what the tree holds; the browser gets a copy.
      const data = {
        trees: {
          src: Object.fromEntries(sourceTree("src")),
          bench: Object.fromEntries(sourceTree("bench")),
        },
        repo: Object.fromEntries(
          REPO_FILES.map((file) => [file, repoFile(file)]),
        ),
      };
      return `export default ${JSON.stringify(data)};`;
    },
  };
}

const MODES = ["", "polyfill", "candidate"];
const mode = process.env.GMT_TEMPORAL ?? "";
if (!MODES.includes(mode)) {
  throw new Error(
    `GMT_TEMPORAL=${JSON.stringify(mode)} is not a mode: use unset (native), "polyfill" or "candidate"`,
  );
}
const native = mode === "";
const swap = mode === "candidate";
const alias = native
  ? [
      {
        find: /^temporal-polyfill\/full\/implementation$/,
        replacement: path.resolve(testDir, "nativeTemporal.ts"),
      },
    ]
  : swap
    ? [
        {
          find: /^temporal-polyfill\/full\/implementation$/,
          replacement: CANDIDATE_ENTRY,
        },
      ]
    : [];

// These test the Node-only harness (child processes, `process`, the file system). A browser has
// no such harness, so they cannot load or run there. Like `testInclude`, each is listed from the
// package and from the repository root, where scripts/native-suite.mjs starts Vitest.
const NODE_ONLY_TESTS = [
  "src/test/boundedChild.test.ts",
  "src/test/isolationGroups.test.ts",
  "src/test/sharedState.test.ts",
].flatMap((file) => [file, `packages/gmt/${file}`]);

export default mergeConfig(
  base,
  defineConfig({
    plugins: [browserTwinsPlugin()],
    resolve: {
      alias,
    },
    // `src/test/swapEntry.ts` imports `temporal-polyfill-candidate`, which only the swap job
    // installs. Outside the swap pass the scan cannot resolve it, gives up pre-bundling, and Vite
    // then optimizes the candidate mid-run and reloads the page.
    optimizeDeps: swap ? {} : { exclude: [CANDIDATE_ENTRY] },
    test: {
      include: testInclude,
      exclude: [...configDefaults.exclude, ...NODE_ONLY_TESTS],
      // The swap pass tells `src/test/swapEntry.test.ts` to run. A browser has no bounded child
      // process, so the entry itself is not read from this variable here.
      env: native
        ? { GMT_NATIVE_TEMPORAL: "1" }
        : swap
          ? { GMT_SWAP_ENTRY: CANDIDATE_ENTRY }
          : {},
      // A test that starts a bounded worker needs room for the worker's first, cold load of GMT
      // on top of its 10 s limit (`src/test/boundedChild.browser.ts`).
      testTimeout: 30_000,
      attachmentsDir: path.resolve(
        here,
        "../../node_modules/.cache/gmt-vitest-attachments",
      ),
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        screenshotFailures: false,
        instances: [
          { browser: "chromium" },
          { browser: "firefox" },
          { browser: "webkit" },
        ],
      },
    },
  }),
);
