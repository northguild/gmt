/**
 * The built pages whose HTML holds something.
 *
 * `listBuiltPages(distRoot, holds)` reads `<distRoot>/gmt/**\/index.html` and returns the site path
 * (`/compare/behaviour/`, no `/gmt` prefix) of every page whose HTML `holds` accepts, sorted. The
 * list is read from the build, never typed in, so a page that gains what the check looks for is
 * covered without anyone adding it. `distRoot` is `apps/dox/dist`. `listTablePages` and
 * `listWidgetPages` are two uses of it.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export function listBuiltPages(distRoot, holds) {
  const site = path.join(distRoot, "gmt");
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${rel}${entry.name}/`);
      } else if (
        entry.name === "index.html" &&
        holds(readFileSync(path.join(dir, entry.name), "utf8"))
      ) {
        out.push(rel);
      }
    }
  };
  walk(site, "/");
  return out.sort();
}
