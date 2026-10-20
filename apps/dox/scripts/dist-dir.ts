import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The built site (`apps/dox/dist`), or a reason to stop.
 *
 * Dox is served under `/gmt`, so the pages sit in `dist/gmt/` and `dist/` itself holds only that
 * folder and `_redirects`. Callers that read pages append `gmt`.
 *
 * These gates read `dist`, so without a build they have nothing to check — and a test that checks
 * nothing still reports as passing. That is not hypothetical: the CI Tests job builds only
 * `@northguild/gmt`, so all three of them had never run there, and a raw `<UpstreamDefects />`
 * reached every text surface with the suite green (CORE-8 review, #253). Locally a skip is the
 * right call, because requiring a 45-second build before `vitest` would be hostile. The same is
 * true of the CI Tests job, which runs this suite across three Node versions and has no reason to
 * build the site three times.
 *
 * So the failure is keyed to `DOX_DIST_REQUIRED`, which `Story consistency` sets on the one step
 * that builds the site first — not to `CI`, which is set everywhere and would turn a legitimate
 * skip into a failure in every other job.
 */
export function distDirOrSkip(): string | null {
  const distDir = resolve(import.meta.dirname, "..", "dist");
  if (existsSync(distDir)) return distDir;
  if (process.env.DOX_DIST_REQUIRED) {
    throw new Error(
      "apps/dox/dist is missing, so the built-site gates would silently pass. " +
        "The step that sets DOX_DIST_REQUIRED must run `pnpm --filter dox run build` first.",
    );
  }
  return null;
}
