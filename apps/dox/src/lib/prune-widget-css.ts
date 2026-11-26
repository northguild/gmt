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
 *
 * Astro also writes some widget sheets straight into every page's head as a `<style>` block,
 * with no `_astro/` file behind them: about 105 KB of the landing's 166 KB of HTML was such
 * blocks for widgets it never shows. The same hook drops a block made only of CSS-Module
 * classes when the page does not use it. Such a block is the only copy of its CSS, so here
 * "use" also counts a script the page can load later: a dynamic `import()` or a chunk in
 * Vite's preload list, as well as a static import.
 */
import type { AstroIntegration } from "astro";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLASS_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g;
const MODULE_CLASS = /^gmt-[\w-]+__[\w-]+$/;
const STYLESHEET_LINK = /<link\b[^>]*\brel="stylesheet"[^>]*>/g;
const INLINE_STYLE = /<style>([\s\S]*?)<\/style>/g;
/* A quoted `_astro/` script: `"./x.js"` inside a chunk, `"_astro/x.js"` in Vite's preload
   list, `"/gmt/_astro/x.js"` in a page. */
const SCRIPT_REFERENCE =
  /["'`](?:\.\/|[^"'`\s]*\/_astro\/|_astro\/)([\w.-]+\.js)["'`]/g;
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

/** Whether a script set's text holds a name; see `searchText`. */
export type ScriptSearch = (name: string) => boolean;

/**
 * A substring test over `text` that scans it once per distinct name. Pages share script sets,
 * so one test serves every page that reaches the same set.
 */
export function searchText(text: string): ScriptSearch {
  const answers = new Map<string, boolean>();
  return (name) => {
    let found = answers.get(name);
    if (found === undefined) {
      found = text.includes(name);
      answers.set(name, found);
    }
    return found;
  };
}

/** True when the page shows the widget: a class of the sheet in its markup, or in its scripts. */
export function usesStylesheet(
  classes: ReadonlySet<string>,
  tokens: ReadonlySet<string>,
  scriptHas: ScriptSearch,
): boolean {
  for (const name of classes) {
    if (tokens.has(name) || scriptHas(name)) return true;
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
  scriptHas: ScriptSearch,
): { html: string; removed: string[] } {
  // The chat rail mounts widgets on demand; its page keeps every sheet.
  if (html.includes("<astro-island")) return { html, removed: [] };
  const tokens = classTokens(html);
  const removed: string[] = [];
  const pruned = html.replace(STYLESHEET_LINK, (link) => {
    const href = HREF.exec(link)?.[1];
    const file = href ? astroFile(href) : null;
    const classes = file ? widgetSheets.get(file) : undefined;
    if (!file || !classes || usesStylesheet(classes, tokens, scriptHas))
      return link;
    removed.push(file);
    return "";
  });
  return { html: pruned, removed };
}

/**
 * Removes the inline `<style>` blocks that hold only CSS-Module classes and that neither the
 * page's markup nor `scriptHas` names. Returns the new HTML and how many blocks it dropped.
 */
export function pruneInlineStyles(
  html: string,
  scriptHas: ScriptSearch,
): { html: string; removed: number } {
  // The chat rail mounts widgets on demand; its page keeps every block.
  if (html.includes("<astro-island")) return { html, removed: 0 };
  const tokens = classTokens(html);
  let removed = 0;
  const pruned = html.replace(INLINE_STYLE, (block, css: string) => {
    const classes = moduleClasses(css);
    if (!classes || usesStylesheet(classes, tokens, scriptHas)) return block;
    removed += 1;
    return "";
  });
  return { html: pruned, removed };
}

/**
 * Every `_astro/` script a text names in a string: a static import, a dynamic `import()`, or
 * an entry of Vite's preload list. In a page this takes in `src` attributes too.
 */
export function referencedScripts(text: string): string[] {
  const files = new Set<string>();
  for (const match of text.matchAll(SCRIPT_REFERENCE)) files.add(match[1]!);
  return [...files];
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

        /* A script's text, and the scripts it names: `imports` are its static imports, `all`
           adds its dynamic imports and Vite's preload list. */
        const scriptCache = new Map<
          string,
          { text: string; imports: string[]; all: string[] }
        >();
        const load = (name: string) => {
          let script = scriptCache.get(name);
          if (script === undefined) {
            let text = "";
            try {
              text = readFileSync(join(astroDir, basename(name)), "utf8");
            } catch {
              // A name that is not an `_astro/` file adds no text.
            }
            const imports: string[] = [];
            for (const match of text.matchAll(
              /(?:\bimport\s*|\bfrom\s*)["']([^"']+\.js)["']/g,
            )) {
              imports.push(basename(match[1]!));
            }
            script = { text, imports, all: referencedScripts(text) };
            scriptCache.set(name, script);
          }
          return script;
        };
        /* Pages share script sets (about 54 sets across 1,290 pages), so the search over a
           set's joined text is built once per set and reused. The cache lives in this
           closure, so no build sees an earlier one's scripts. */
        const searches = new Map<string, ScriptSearch>();
        const reachableSearch = (
          files: string[],
          follow: "imports" | "all",
        ): ScriptSearch => {
          const key = `${follow}|${files.slice().sort().join(",")}`;
          let search = searches.get(key);
          if (search === undefined) {
            search = searchText(reachableText(files, follow));
            searches.set(key, search);
          }
          return search;
        };
        const reachableText = (
          files: string[],
          follow: "imports" | "all",
        ): string => {
          const seen = new Set<string>();
          const parts: string[] = [];
          const stack = [...files];
          while (stack.length > 0) {
            const name = stack.pop()!;
            if (seen.has(name)) continue;
            seen.add(name);
            const script = load(name);
            parts.push(script.text);
            stack.push(...script[follow]);
          }
          return parts.join("\n");
        };

        let removedLinks = 0;
        let removedBlocks = 0;
        let pages = 0;
        for (const path of walkHtml(root)) {
          const html = readFileSync(path, "utf8");
          const links = pruneStylesheetLinks(
            html,
            widgetSheets,
            reachableSearch(scriptFiles(html), "imports"),
          );
          const blocks = pruneInlineStyles(
            links.html,
            reachableSearch(referencedScripts(html), "all"),
          );
          if (links.removed.length === 0 && blocks.removed === 0) continue;
          writeFileSync(path, blocks.html);
          removedLinks += links.removed.length;
          removedBlocks += blocks.removed;
          pages += 1;
        }
        logger.info(
          `removed ${removedLinks} unused widget stylesheet links and ${removedBlocks} unused widget style blocks from ${pages} pages`,
        );
      },
    },
  };
}
