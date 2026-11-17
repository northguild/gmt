/**
 * The WebMCP origin-trial tokens for this site's origin.
 *
 * The build reads them from the `WEBMCP_ORIGIN_TRIAL_TOKEN` environment variable, which only the
 * deploy workflow (`deploy-dox.yml`) sets, from the repository secret of the same name. A local,
 * pull-request or weekly-gate build has no token, so its tool pages carry no origin-trial meta.
 * Chrome's testing flag (`chrome://flags/#enable-webmcp-testing`) still turns WebMCP on for
 * whoever sets it.
 *
 * The variable may hold several tokens separated by whitespace, so an old and a new token can
 * overlap while one is renewed. Renewing is a secret update and a redeploy, with no pull request.
 *
 * It is read through `process.env`, not `astro:env/server`. This module runs only in the static
 * build (`route-data.ts`), where Astro's `getSecret` reads `process.env` anyway, and Vitest, which
 * reaches `route-data.ts` through `lean-sidebar.test.ts`, cannot resolve `astro:env`.
 */

/** The tokens in `value`, split on whitespace, blanks dropped and repeats removed, in order. */
export function parseOriginTrialTokens(
  value: string | undefined,
): readonly string[] {
  return [
    ...new Set((value ?? "").split(/\s+/).filter((token) => token !== "")),
  ];
}

export const ORIGIN_TRIAL_TOKENS: readonly string[] = parseOriginTrialTokens(
  process.env.WEBMCP_ORIGIN_TRIAL_TOKEN,
);
