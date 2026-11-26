/**
 * The built tool pages.
 *
 * `listToolPages(distRoot)` reads `<distRoot>/gmt/tools/<slug>/index.html` and returns the site path
 * (`/tools/dwell-ledger/`, no `/gmt` prefix) of every tool, sorted. The list is read from the build,
 * never typed in, so a tool that is added is checked without anyone adding it. `distRoot` is
 * `apps/dox/dist`.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export function listToolPages(distRoot) {
  const tools = path.join(distRoot, "gmt", "tools");
  if (!existsSync(tools)) return [];
  return readdirSync(tools, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(tools, entry.name, "index.html")),
    )
    .map((entry) => `/tools/${entry.name}/`)
    .sort();
}
