/**
 * Offer a tool page's WebMCP tool, without costing a browser that has none a byte.
 *
 * Every tool page's widget script ends with one call. It returns before any `import()` when the
 * page's head does not name the slug (a widget embedded on a reference page stays silent) and when
 * the browser has no model context (WebKit, Firefox and Chrome without the trial fetch no chunk).
 * Imports `model-context.ts` and nothing else: no zod, no schema, no widget code.
 */
import { findModelContext, type ModelContextToolInit } from "./model-context";

export const WEBMCP_MARKER = "gmt-webmcp";

export type OfferOutcome = "registered" | "absent" | "skipped" | "failed";

/** The slugs each document has already been offered, so a repeat call is a no-op. */
const seen = new WeakMap<object, Set<string>>();

export async function offerPageTool(
  slug: string,
  load: () => Promise<{ default: ModelContextToolInit }>,
  options: { doc?: Document; nav?: Navigator; signal?: AbortSignal } = {},
): Promise<OfferOutcome> {
  const doc = options.doc ?? document;
  const marker = doc.head?.querySelector(`meta[name="${WEBMCP_MARKER}"]`);
  if (marker?.getAttribute("content") !== slug) return "skipped";
  const offered = seen.get(doc) ?? new Set<string>();
  seen.set(doc, offered);
  if (offered.has(slug)) return "skipped";
  const context = findModelContext(doc, options.nav);
  if (!context) return "absent";
  offered.add(slug);
  let name = slug;
  try {
    const tool = (await load()).default;
    name = tool.name;
    await Promise.resolve(
      context.registerTool(tool, { signal: options.signal }),
    );
    return "registered";
  } catch (error) {
    console.warn(
      `WebMCP: ${name} was not registered (${error instanceof Error ? error.name : "Error"})`,
    );
    return "failed";
  }
}
