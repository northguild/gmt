/**
 * Copies the generated `_redirects` to `dist/_redirects` after a build.
 *
 * Cloudflare reads `_redirects` from the root of the assets directory (`dist/`), but Astro's
 * `outDir` is `dist/gmt/`, so a file in `public/` would land at `dist/gmt/_redirects`, where
 * nothing reads it. `scripts/build-reference.ts` writes `src/generated/_redirects`; this hook
 * puts it one level above `outDir`. Build-only: `astro dev` never runs `astro:build:done`.
 */
import type { AstroIntegration } from "astro";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(
  new URL("../generated/_redirects", import.meta.url),
);

export function copyRedirects(): AstroIntegration {
  return {
    name: "gmt-copy-redirects",
    hooks: {
      "astro:build:done": ({ dir }) => {
        // A build without `generate` must not deploy without its redirects.
        if (!existsSync(source)) {
          throw new Error(
            `[copy-redirects] ${source} is missing. Run \`pnpm run generate\` before building.`,
          );
        }
        copyFileSync(source, fileURLToPath(new URL("../_redirects", dir)));
      },
    },
  };
}
