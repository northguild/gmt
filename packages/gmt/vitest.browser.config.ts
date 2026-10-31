import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig, type Plugin } from "vitest/config";
import { REPO_FILES, repoFile, sourceTree } from "./src/test/sourceTree.ts";
import { baseConfig as base, testInclude } from "./vitest.config.ts";

// The same suite in Chromium, Firefox and WebKit. By default the polyfill's specifier resolves to the
// native-Temporal shim, so each browser runs on its own engine. `GMT_TEMPORAL=polyfill` removes
// that alias: the control pass of the native-suite runner, which shows which failures belong to
// the browser (its locale data, its time zone data) and not to its Temporal.

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

const native = process.env.GMT_TEMPORAL !== "polyfill";

export default mergeConfig(
  base,
  defineConfig({
    plugins: [browserTwinsPlugin()],
    resolve: {
      alias: native
        ? [
            {
              find: /^@js-temporal\/polyfill$/,
              replacement: path.resolve(testDir, "nativeTemporal.ts"),
            },
          ]
        : [],
    },
    test: {
      include: testInclude,
      env: native ? { GMT_NATIVE_TEMPORAL: "1" } : {},
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
