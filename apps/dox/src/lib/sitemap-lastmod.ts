/**
 * The `<lastmod>` of a sitemap URL: the date in the footer of the page it names.
 *
 * Starlight writes a page's last-updated date into its footer as
 * `<footer>…<time datetime="2026-10-19T05:35:38.000Z">`. The sitemap copies that value, so a
 * page's footer and its `<lastmod>` cannot disagree, and a page without a footer date has no
 * `<lastmod>`. `astro.config.mjs` passes `sitemapLastmod` to `sitemap({ serialize })`, which runs
 * when the pages are already on disk.
 *
 * Free of `astro:` imports, so Vitest reads it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_BASE } from "./site";

/** The `datetime` of the last-updated `<time>` in a page's footer, or undefined when it has none. */
export function footerDate(html: string): string | undefined {
  return /<footer\b[^>]*>(?:(?!<\/footer>)[\s\S])*?<time datetime="([^"]+)"/.exec(
    html,
  )?.[1];
}

/** The built file of a sitemap URL under `outDir` (`dist/gmt`), or undefined when there is none. */
export function builtPage(outDir: string, url: string): string | undefined {
  const { pathname } = new URL(url);
  if (pathname !== SITE_BASE && !pathname.startsWith(`${SITE_BASE}/`)) {
    return undefined;
  }
  const below = pathname.slice(SITE_BASE.length).replace(/^\/|\/$/g, "");
  const file = join(outDir, below, "index.html");
  return existsSync(file) ? file : undefined;
}

/**
 * `sitemap({ serialize })`: the item with `lastmod` set to the footer date of its built page.
 * A page without a footer date, or without a built file, keeps no `lastmod`.
 */
export function sitemapLastmod<T extends { url: string; lastmod?: string }>(
  outDir: string,
  item: T,
): T {
  const file = builtPage(outDir, item.url);
  const date = file ? footerDate(readFileSync(file, "utf8")) : undefined;
  if (date === undefined) {
    const { lastmod: _unset, ...rest } = item;
    return rest as T;
  }
  return { ...item, lastmod: date };
}
