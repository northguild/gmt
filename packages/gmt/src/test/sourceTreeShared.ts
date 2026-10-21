/**
 * What `sourceTree.ts` and its browser twin share. It imports no Node module, so a browser page can
 * load it.
 */

/** The repository files a test may read as text, by repository-relative path. */
export const REPO_FILES = [
  "apps/dox/src/generated/reference/gmt-corpus.json",
] as const;

const trees = new Map<string, ReadonlyMap<string, string>>();

/** The tree already built for `dir`, or the one `build` returns, kept for the next call. */
export function cachedTree(
  dir: "src" | "bench",
  build: () => ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  const cached = trees.get(dir);
  if (cached) return cached;
  const tree = build();
  trees.set(dir, tree);
  return tree;
}
