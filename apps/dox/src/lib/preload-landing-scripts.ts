/**
 * Has the landing preload every script its entry scripts import statically, once its copy has
 * painted, after a build.
 *
 * A module script's imports are found only once the script itself has arrived and run, so a chain
 * of imports is one round trip per level: the landing's entries sit five levels above the code
 * that mounts the hero's sky and Earth, and on a phone's network each level costs about a second.
 * Listing the whole static graph makes the browser fetch all of it at once. Links in the head
 * would share the network with the page's own styles and fonts, and on a slow connection the
 * copy's first paint came 430 ms later, so a small inline script adds the links when the first
 * contentful paint is reported (at once where the browser has no paint timing). Only the
 * landing gets the list: it is the one page that draws the hero (`data-hero-sky`), and a page
 * that needs none of it would pay bytes for nothing. Dynamic imports are not listed here; the
 * landing starts those itself once its copy has painted (`globe-warmup.ts`), so none of them
 * competes with the first paint.
 *
 * `preloadLandingScripts` is that integration. It runs on `astro:build:done`, over `dist/gmt`.
 */
import type { AstroIntegration } from "astro";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptFiles, staticImports } from "./prune-widget-css";

/** The page marker: the hero's sky is on the landing and on no other page. */
const LANDING_MARK = "data-hero-sky";

/**
 * `html` with a modulepreload link for each script the page's entry scripts import statically,
 * the entries themselves excluded (the parser finds those), and every other byte unchanged.
 * `readScript` returns a file's text (an `_astro/` file name in) or "" when there is none. A page
 * that is not the landing comes back as it was.
 */
export function preloadStaticImports(
  html: string,
  readScript: (file: string) => string,
): string {
  if (!html.includes(LANDING_MARK) || !html.includes("</head>")) return html;
  const entries = scriptFiles(html);
  const prefix = /\bsrc="([^"]*\/_astro\/)/.exec(html)?.[1];
  if (!prefix || entries.length === 0) return html;
  const seen = new Set(entries);
  const stack = [...entries];
  const preloads: string[] = [];
  while (stack.length > 0) {
    const file = stack.pop()!;
    for (const next of staticImports(readScript(file))) {
      if (seen.has(next)) continue;
      seen.add(next);
      preloads.push(next);
      stack.push(next);
    }
  }
  if (preloads.length === 0) return html;
  preloads.sort();
  const hrefs = JSON.stringify(preloads.map((file) => `${prefix}${file}`));
  const add = `var h=${hrefs};var f=function(){h.forEach(function(u){var l=document.createElement("link");l.rel="modulepreload";l.href=u;document.head.append(l)})};`;
  const wait = `var P=window.PerformanceObserver;if(P&&(P.supportedEntryTypes||[]).indexOf("paint")>-1)new P(function(l,o){o.disconnect();f()}).observe({type:"paint",buffered:true});else f();`;
  return html.replace("</head>", `<script>${add}${wait}</script></head>`);
}

export function preloadLandingScripts(): AstroIntegration {
  return {
    name: "gmt-preload-landing-scripts",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const page = join(root, "index.html");
        if (!existsSync(page)) return;
        const html = readFileSync(page, "utf8");
        const out = preloadStaticImports(html, (file) => {
          try {
            return readFileSync(join(root, "_astro", basename(file)), "utf8");
          } catch {
            return "";
          }
        });
        if (out === html) return;
        writeFileSync(page, out);
        logger.info(
          `added the landing's static import list (${/var h=(\[[^\]]*\]);/.exec(out)?.[1]?.split(",").length ?? 0} scripts)`,
        );
      },
    },
  };
}
