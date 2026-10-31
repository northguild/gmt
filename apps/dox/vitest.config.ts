import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { configDefaults, defineConfig, type Plugin } from "vitest/config";
import { splitTestFiles, TEST_GLOBS } from "./src/test/isolation.ts";

/**
 * Mirrors `wrangler.jsonc`'s `{ "type": "Text", "globs": ["**\/*.md"] }` rule.
 *
 * The Worker prompt is assembled from real Markdown — `worker/core-rules.ts`
 * imports `worker/core-rules.md`, `worker/vocabulary.ts` imports the SKILL.md
 * files — and Wrangler turns those into plain strings at bundle time. Vitest
 * has no such rule, so importing `worker/index.ts` (which reaches both) failed
 * at transform time with "content contains invalid JS syntax". That is why the
 * entry point went untested for so long; the rest of `worker/` avoids the
 * problem only by never importing it.
 */
function markdownAsText(): Plugin {
  return {
    name: "gmt-markdown-as-text",
    enforce: "pre",
    async load(id) {
      const [file] = id.split("?");
      if (!file.endsWith(".md")) return null;
      const source = await readFile(file, "utf8");
      return `export default ${JSON.stringify(source)};`;
    },
  };
}

// A file that replaces a module or a global runs in a worker module graph of its own. Every other
// file shares one with its neighbours, so it skips re-importing the library, the polyfill and React.
const { isolated } = splitTestFiles(import.meta.dirname);

export default defineConfig({
  plugins: [markdownAsText()],
  resolve: {
    // DOX-C0 (#171): mirrors tsconfig.json's `~/*` path mapping, which Astro
    // resolves on its own but Vitest does not. Without this, tests reach
    // generated files by absolute path instead of `~/...` — wire it rather
    // than keep doing that by accident.
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    globals: true,
    root: ".",
    environment: "node",
    // A no-op in node; in jsdom files it adds the jest-dom matchers.
    setupFiles: ["./src/test/setup-dom.ts"],
    // Vitest's default is 5 s, which was never chosen for this suite. Several tests here are
    // import-bound rather than slow: they `await import()` a GMT namespace, which pulls in
    // `@js-temporal/polyfill` and costs ~3.9 s in a fresh worker on an idle machine
    // (`dst-inspector.test.ts`'s instant-format test, measured). `pnpm run validate` then runs
    // this suite alongside `packages/gmt`'s 36k tests through `pnpm -r run test`, and on a shared
    // CPU that 3.9 s crossed 5 s and failed the whole gate. 20 s leaves five times the measured
    // cost while still failing a test that has genuinely hung.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Blocks every non-loopback connection, so no test can reach Gemini or
    // Workers AI and spend real budget. Preloaded with `--import` so it is in
    // place before any test, setup file or dependency loads. Proven live by
    // src/test/no-network.test.ts.
    // `--no-experimental-webstorage`: Node 25+ defines its own `localStorage` global, which is
    // `undefined` without `--localstorage-file` and shadows jsdom's `window.localStorage` in
    // `@vitest-environment jsdom` files (HeaderClock, ResetClock). Nothing here uses Node's own
    // storage. The flag is accepted by every Node in the CI matrix (22, 24, 26).
    execArgv: [
      `--import=${pathToFileURL(path.resolve(import.meta.dirname, "src/test/no-network.mjs")).href}`,
      "--no-experimental-webstorage",
    ],
    // `extends: true` carries the plugin, alias, setup file, timeouts and `execArgv` above into
    // both projects; each adds its name, its file set and `isolate`. The file set is never set
    // above: `include` arrays merge, so a shared one would put every file in both projects.
    projects: [
      {
        extends: true,
        test: { name: "isolated", include: isolated, isolate: true },
      },
      {
        extends: true,
        test: {
          name: "shared",
          include: TEST_GLOBS,
          exclude: [...configDefaults.exclude, ...isolated],
          isolate: false,
        },
      },
    ],
  },
});
