/**
 * The package's own source files as text, for the harnesses that scan them. This is the Node
 * implementation; the browser config serves `sourceTree.browser.ts` in its place, filled by calling
 * these functions once when the dev server starts, so one implementation decides what the tree
 * holds and a browser gets a copy.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cachedTree, REPO_FILES } from "./sourceTreeShared";

const PACKAGE_DIR = path.resolve(import.meta.dirname, "../..");
const REPO_ROOT = path.resolve(PACKAGE_DIR, "../..");

export { REPO_FILES };

/**
 * Every `.ts`, `.mts`, `.cts` and `.tsx` file under `dir` of the package, test files included,
 * keyed by package-relative path (`src/plain/get/getYear.ts`).
 */
export function sourceTree(dir: "src" | "bench"): ReadonlyMap<string, string> {
  return cachedTree(dir, () => {
    const tree = new Map<string, string>();
    for (const entry of readdirSync(path.join(PACKAGE_DIR, dir), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !/\.(?:c|m)?tsx?$/.test(entry.name)) continue;
      const file = path.relative(
        PACKAGE_DIR,
        path.join(entry.parentPath, entry.name),
      );
      tree.set(
        file.split(path.sep).join("/"),
        readFileSync(path.join(PACKAGE_DIR, file), "utf8"),
      );
    }
    return tree;
  });
}

/** The text of one repository file named in `REPO_FILES`. */
export function repoFile(file: (typeof REPO_FILES)[number]): string {
  return readFileSync(path.join(REPO_ROOT, file), "utf8");
}
