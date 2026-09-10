/**
 * DOX-C2 (#138) — a bias, not a filter (DOX-C1's DoD requires a
 * cross-namespace question to still work). `/reference/zoned/...` biases
 * toward "zoned"; a guide path like `/guides/core-date-operations/...`
 * biases toward "core-date-operations", matching `guide-chunks.ts`'s own
 * namespace derivation (top-level directory under the guide/reference
 * root). Anything else (the homepage, `/dox` itself, an unrecognized path)
 * has no namespace to bias toward.
 */
export function namespaceFromPageContext(
  pageContext: string | undefined,
): string | undefined {
  if (!pageContext) return undefined;

  const match = /^\/(?:reference|guides)\/([^/]+)/.exec(pageContext);
  return match?.[1];
}
