import { defineConfig } from "oxlint";
import plugin, { recommendedRules } from "./packages/gmt-oxlint/dist/index.js";

export default defineConfig([
  { plugins: [plugin], rules: recommendedRules },
  {
    root: true,
    files: {
      include: [
        "packages/**/*.{ts,tsx,js,jsx,json,jsonc}",
        "docs/**/*.{ts,tsx,js,jsx,md,mdx}",
        "context/**/*.{ts,tsx,md}",
        "scripts/**/*.{ts,tsx,js,mjs}",
        // .astro and .mdx are deliberately absent — oxlint cannot parse either.
        "apps/**/*.{ts,tsx,js,jsx,mjs}",
      ],
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.tsbuildinfo",
        "**/out/**",
        "apps/dox/.astro/**",
        "apps/dox/src/generated/**",
        "apps/dox/src/content/docs/reference/**",
      ],
    },
    rules: { noUnusedImports: "error", noUnusedVariables: "warn" },
  },
]);
