/**
 * The built pages that hold a table.
 *
 * `listTablePages(distRoot)` reads `<distRoot>/gmt/**\/index.html` and returns the site path
 * (`/compare/behaviour/`, no `/gmt` prefix) of every page whose HTML has a `<table`, sorted. The
 * list is read from the build, never typed in, so a page that gains a table is checked without
 * anyone adding it. `distRoot` is `apps/dox/dist`.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export function listTablePages(distRoot) {
  const site = path.join(distRoot, "gmt");
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${rel}${entry.name}/`);
      } else if (
        entry.name === "index.html" &&
        readFileSync(path.join(dir, entry.name), "utf8").includes("<table")
      ) {
        out.push(rel);
      }
    }
  };
  walk(site, "/");
  return out.sort();
}
