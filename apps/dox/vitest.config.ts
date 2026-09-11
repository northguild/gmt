import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Mirrors `wrangler.jsonc`'s `{ "type": "Text", "globs": ["**\/*.md"] }` rule.
 *
 * The Worker prompt is assembled from real Markdown — `worker/core-rules.ts`
 * imports the package README, `worker/vocabulary.ts` imports the SKILL.md
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
    name: "dox",
    globals: true,
    root: ".",
    include: [
      "scripts/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "worker/**/*.test.ts",
    ],
    environment: "node",
  },
});
