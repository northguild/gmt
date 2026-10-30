/**
 * Drops widget stylesheets from the pages that do not use them, after a build.
 *
 * Every widget's mount module imports a CSS Module. Astro's build attaches the CSS that a
 * script imports to the one Starlight `[...slug]` route, so every docs page ended up linking
 * about 37 of the 39 `_astro/*.css` files, 230 KB of which no page used. This hook runs on
 * `astro:build:done` and removes the `<link rel="stylesheet">` of a widget stylesheet from
 * each page that shows no sign of the widget.
 *
 * What counts as a widget stylesheet: a file whose every class selector is a CSS-Module name
 * (`gmt-<module>__<local>`, see `generateScopedName` in `astro.config.mjs`). Global sheets,
 * the Tailwind bundle and Astro's scoped component CSS hold other selectors and are never
 * touched.
 *
 * What counts as use: one of the sheet's class names appears in a `class` attribute of the
 * page, or as a literal in a script the page loads (static imports followed). A widget's
 * markup is server-rendered, so its classes are in the HTML.
 *
 * Two cases keep working without a link:
 * - A widget mounted by a dynamic `import()` (the globe): Vite adds the chunk's CSS to the
 *   import's preload list, so the stylesheet arrives with the chunk.
 * - The `/dox` chat rail, which mounts any widget on demand: a page with an Astro island is
 *   left alone, and `DoxPage`'s own preload list names every mount stylesheet.
 */
import type { AstroIntegration } from "astro";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLASS_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g;
const MODULE_CLASS = /^gmt-[\w-]+__[\w-]+$/;
const STYLESHEET_LINK = /<link\b[^>]*\brel="stylesheet"[^>]*>/g;
const HREF = /\bhref="([^"]+)"/;
const ASTRO_FILE = /_astro\/([^"'\s?#)]+)$/;

/**
 * The class names of a stylesheet that holds nothing but CSS-Module classes, or null for any
 * other sheet. Declarations are stripped first so `0.5rem` or a url() is not read as a class.
 */
export function moduleClasses(css: string): Set<string> | null {
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{[^{}]*\}/g, "{}")
    .replace(/\{[^{}]*\}/g, "{}");
  const names = new Set<string>();
  for (const match of selectors.matchAll(CLASS_SELECTOR)) {
    const name = match[1]!;
    if (!MODULE_CLASS.test(name)) return null;
    names.add(name);
  }
  return names.size > 0 ? names : null;
}

/** Every class token in the page's `class` attributes. */
export function classTokens(html: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const token of match[1]!.split(/\s+/)) if (token) tokens.add(token);
  }
  return tokens;
}

/** True when the page shows the widget: a class of the sheet in its markup, or in its scripts. */
export function usesStylesheet(
  classes: ReadonlySet<string>,
  tokens: ReadonlySet<string>,
  scriptText: string,
): boolean {
  for (const name of classes) {
    if (tokens.has(name) || scriptText.includes(name)) return true;
  }
  return false;
}

/** The `_astro/` file name a URL points at, or null. */
export function astroFile(url: string): string | null {
  return ASTRO_FILE.exec(url)?.[1] ?? null;
}

/**
 * Removes the stylesheet links whose file is in `widgetSheets` and unused by the page.
 * Returns the new HTML and the file names it dropped.
 */
export function pruneStylesheetLinks(
  html: string,
  widgetSheets: ReadonlyMap<string, ReadonlySet<string>>,
  scriptText: string,
): { html: string; removed: string[] } {
  // The chat rail mounts widgets on demand; its page keeps every sheet.
  if (html.includes("<astro-island")) return { html, removed: [] };
  const tokens = classTokens(html);
  const removed: string[] = [];
  const pruned = html.replace(STYLESHEET_LINK, (link) => {
    const href = HREF.exec(link)?.[1];
    const file = href ? astroFile(href) : null;
    const classes = file ? widgetSheets.get(file) : undefined;
    if (!file || !classes || usesStylesheet(classes, tokens, scriptText))
      return link;
    removed.push(file);
    return "";
  });
  return { html: pruned, removed };
}

/** The `_astro/` scripts a page loads: `src`, and static `import`/`from` in inline modules. */
export function scriptFiles(html: string): string[] {
  const files = new Set<string>();
  for (const match of html.matchAll(/\bsrc="([^"]+\.js)"/g)) {
    const file = astroFile(match[1]!);
    if (file) files.add(file);
  }
  for (const match of html.matchAll(
    /(?:\bimport\s*|\bfrom\s*)["']([^"']+\.js)["']/g,
  )) {
    const file = astroFile(match[1]!);
    if (file) files.add(file);
  }
  return [...files];
}

function walkHtml(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(path, found);
    else if (entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

export function pruneWidgetCss(): AstroIntegration {
  return {
    name: "gmt-prune-widget-css",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const astroDir = join(root, "_astro");
        const widgetSheets = new Map<string, Set<string>>();
        for (const name of readdirSync(astroDir)) {
          if (!name.endsWith(".css")) continue;
          const classes = moduleClasses(
            readFileSync(join(astroDir, name), "utf8"),
          );
          if (classes) widgetSheets.set(name, classes);
        }

        // A script's text, with the text of the scripts it imports statically.
        const scriptCache = new Map<string, string>();
        const importsOf = new Map<string, string[]>();
        const load = (name: string): string => {
          let text = scriptCache.get(name);
          if (text === undefined) {
            try {
              text = readFileSync(join(astroDir, basename(name)), "utf8");
            } catch {
              text = "";
            }
            scriptCache.set(name, text);
            const deps: string[] = [];
            for (const match of text.matchAll(
              /(?:\bimport\s*|\bfrom\s*)["']([^"']+\.js)["']/g,
            )) {
              deps.push(basename(match[1]!));
            }
            importsOf.set(name, deps);
          }
          return text;
        };
        const reachableText = (files: string[]): string => {
          const seen = new Set<string>();
          const parts: string[] = [];
          const stack = [...files];
          while (stack.length > 0) {
            const name = stack.pop()!;
            if (seen.has(name)) continue;
            seen.add(name);
            parts.push(load(name));
            stack.push(...(importsOf.get(name) ?? []));
          }
          return parts.join("\n");
        };

        let removedLinks = 0;
        let pages = 0;
        for (const path of walkHtml(root)) {
          const html = readFileSync(path, "utf8");
          const { html: next, removed } = pruneStylesheetLinks(
            html,
            widgetSheets,
            reachableText(scriptFiles(html)),
          );
          if (removed.length === 0) continue;
          writeFileSync(path, next);
          removedLinks += removed.length;
          pages += 1;
        }
        logger.info(
          `removed ${removedLinks} unused widget stylesheet links from ${pages} pages`,
        );
      },
    },
  };
}
