/**
 * The browser twin of `sourceTree.ts`: the same exports, filled from the virtual module the browser
 * config builds with the Node implementation when the dev server starts.
 */
import data from "virtual:gmt-source-tree";
import { cachedTree, REPO_FILES } from "./sourceTreeShared";

export { REPO_FILES };

/** See `sourceTree.ts`. */
export function sourceTree(dir: "src" | "bench"): ReadonlyMap<string, string> {
  return cachedTree(dir, () => new Map(Object.entries(data.trees[dir] ?? {})));
}

/** See `sourceTree.ts`. */
export function repoFile(file: (typeof REPO_FILES)[number]): string {
  return data.repo[file] ?? "";
}
