/**
 * GMT itself, loaded from `packages/gmt/dist`, for the repo's own scripts.
 *
 * These scripts handle dates — a "last checked" stamp, a filing's `createdAt`, a filename's day —
 * and the library they support exists because `new Date` is the wrong tool for exactly that. So
 * they use GMT, and the one place that knows how to find a built copy is here.
 *
 * `@northguild/gmt` is not a dependency of the repo root, so this resolves `dist` by path the same
 * way `temporal-compat.mjs` loads the compiled repros. A caller that cannot build first should use
 * `tryLoadGmt` and degrade; one that can should use `loadGmt` and fail loudly, because silently
 * falling back to `Date` is the behaviour this file exists to prevent.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIST = join(ROOT, "packages/gmt/dist");
const ENTRY = join(DIST, "index.js");

/** The built GMT, or `null` when `packages/gmt` has not been built yet. */
export async function tryLoadGmt() {
  if (!existsSync(ENTRY)) return null;
  return await import(pathToFileURL(ENTRY).href);
}

/** The built GMT, or exit with the build instruction. */
export async function loadGmt() {
  const gmt = await tryLoadGmt();
  if (gmt === null) {
    console.error(
      "This script uses GMT to read and compare dates, so it needs a build: run `pnpm --filter @northguild/gmt build`.",
    );
    process.exit(2);
  }
  return gmt;
}
