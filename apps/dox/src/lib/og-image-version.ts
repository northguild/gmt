/**
 * Puts `?v=<hash>` on the share image URLs of the built pages.
 *
 * Facebook caches an image by its URL, so a redrawn card under the same URL stays stale there. The
 * hash is the first 12 hex digits of the SHA-256 of the PNG's bytes, so the URL changes exactly
 * when the image does. The PNGs and the pages render in the same build in no fixed order, so the
 * rewrite runs afterwards, on `astro:build:done`, over the HTML in `dist/gmt`.
 *
 * `versionOgImages` is that integration. It is listed before `starlight()` in `astro.config.mjs`:
 * hooks run in the order of the list, and Starlight's Pagefind step, like every dist gate, must
 * read the final HTML.
 */
import type { AstroIntegration } from "astro";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL } from "./site";

/** The first 12 hex digits of the SHA-256 of a file's bytes. */
export function imageHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

/** A start tag of `<meta property="og:image">` or `<meta name="twitter:image">`. */
const IMAGE_META =
  /<meta\b(?=[^>]*\b(?:property="og:image"|name="twitter:image"))[^>]*>/g;

/** The `content` attribute of a start tag. */
const CONTENT = /(\bcontent=")([^"]*)(")/;

/**
 * `html` with `?v=<hash>` after the URL in `og:image` and `twitter:image`, and every other byte
 * unchanged. `hashOf` gets the PNG's path under `/og/` (`reference/zoned.png`) and returns its
 * hash, or undefined when there is no such file. Throws for a URL that is not a PNG of this site's
 * `/og/` folder, one that already has a query, and a PNG `hashOf` does not know.
 */
export function versionImageUrls(
  html: string,
  siteUrl: string,
  hashOf: (path: string) => string | undefined,
): string {
  const prefix = `${siteUrl}/og/`;
  return html.replace(IMAGE_META, (tag) =>
    tag.replace(CONTENT, (_all, open: string, url: string, close: string) => {
      if (!url.startsWith(prefix) || !url.endsWith(".png")) {
        throw new Error(
          `share image URL "${url}" is not a PNG under ${prefix}`,
        );
      }
      const path = url.slice(prefix.length);
      const hash = hashOf(path);
      if (hash === undefined) {
        throw new Error(`share image ${url} is not in the build (og/${path})`);
      }
      return `${open}${url}?v=${hash}${close}`;
    }),
  );
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

/** Build only: versions the share image URLs in every built page. */
export function versionOgImages(): AstroIntegration {
  return {
    name: "gmt-version-og-images",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        const hashes = new Map<string, string | undefined>();
        const hashOf = (path: string): string | undefined => {
          if (!hashes.has(path)) {
            const file = join(root, "og", path);
            hashes.set(
              path,
              existsSync(file) ? imageHash(readFileSync(file)) : undefined,
            );
          }
          return hashes.get(path);
        };
        for (const file of htmlFiles(root)) {
          const html = readFileSync(file, "utf8");
          let next: string;
          try {
            next = versionImageUrls(html, SITE_URL, hashOf);
          } catch (error) {
            throw new Error(
              `[og-image-version] ${file}: ${(error as Error).message}`,
              { cause: error },
            );
          }
          if (next !== html) writeFileSync(file, next);
        }
      },
    },
  };
}
