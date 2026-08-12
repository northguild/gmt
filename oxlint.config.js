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
      ],
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.nx/**",
        "**/coverage/**",
        "**/*.tsbuildinfo",
        "**/out/**",
      ],
    },
    rules: { noUnusedImports: "error", noUnusedVariables: "warn" },
  },
]);
