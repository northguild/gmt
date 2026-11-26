/**
 * Copies the generated `_redirects` and the tracked `_headers` to `dist/` after a build.
 *
 * Cloudflare reads both from the root of the assets directory (`dist/`), but Astro's `outDir` is
 * `dist/gmt/`, so a file in `public/` would land at `dist/gmt/_redirects`, where nothing reads it.
 * `scripts/build-reference.ts` writes `src/generated/_redirects`; `src/assets-root/_headers` is
 * kept in the tree. This hook puts each one level above `outDir`. Build-only: `astro dev` never
 * runs `astro:build:done`.
 */
import type { AstroIntegration } from "astro";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Each file to copy: where it is kept, the name it has in `dist/`, and how to produce it. */
const files = [
  {
    name: "_redirects",
    source: fileURLToPath(new URL("../generated/_redirects", import.meta.url)),
    fix: "Run `pnpm run generate` before building.",
  },
  {
    name: "_headers",
    source: fileURLToPath(new URL("../assets-root/_headers", import.meta.url)),
    fix: "It is tracked in the repository; restore it.",
  },
] as const;

export function copyRedirects(): AstroIntegration {
  return {
    name: "gmt-copy-redirects",
    hooks: {
      "astro:build:done": ({ dir }) => {
        // A build without `generate` must not deploy without its redirects, nor one without its headers.
        for (const { name, source, fix } of files) {
          if (!existsSync(source)) {
            throw new Error(`[copy-redirects] ${source} is missing. ${fix}`);
          }
          copyFileSync(source, fileURLToPath(new URL(`../${name}`, dir)));
        }
      },
    },
  };
}
