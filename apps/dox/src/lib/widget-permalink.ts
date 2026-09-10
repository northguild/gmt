/**
 * DOX-C3b (#139) — linking to a widget's state from the chat transcript.
 *
 * ## Why a new convention rather than reusing the scrubber's
 *
 * The only URL-state mechanism in the app is `multi-zone-scrubber.ts`'s
 * `encodeState`/`decodeState`, and it cannot serve this:
 *
 *   - Its params (`tz`, `t`) are unnamespaced, and **every** reference page
 *     imports all three widget components, so a bare `?zone=` is ambiguous
 *     about which widget it addresses.
 *   - It always writes the *current* page's pathname. From `/dox` that would
 *     produce `/dox?tz=…`, which no route knows how to rehydrate.
 *   - Its decoder filters zone ids through the globe's coordinate table, so it
 *     is a scrubber decoder, not a general one.
 *
 * The scrubber's existing links stay exactly as they are. Migrating them would
 * break every permalink already shared, and it is not this story's business.
 *
 * ## The shape
 *
 *     <the widget's own Tier 2 page>?w=<kind>&wa=<compact JSON>
 *
 * `w` disambiguates which widget on the page is being addressed. `wa` is the
 * arguments, URL-encoded JSON, validated on the way back in by **the same zod
 * schema as the tool input** — one schema, three consumers (the model's tool
 * call, the rail mount, and this). URL-encoding rather than base64 because a
 * hand-editable link is worth more than a shorter one at this size.
 *
 * `JSON.parse` here is not the dynamic code execution the DoD forbids: it
 * produces data, which is then schema-checked, and the registry's dispatch is a
 * fixed object literal. See `widget-registry.ts`.
 */

export type WidgetKind = "globe" | "dst" | "interval" | "converter";

/**
 * Where each widget actually lives, so the encoder never guesses a route.
 *
 * These are real pages — `route-manifest.ts` covers the reference ones — and a
 * permalink that 404s would violate the same DOX-C rule as a hallucinated
 * citation.
 */
export const WIDGET_PAGE_PATHS: Record<WidgetKind, string> = {
  globe: "/tools/zoned-earth/",
  dst: "/reference/zoned/get/getDstTransitions/",
  interval: "/reference/zoned/interval/intervalIntersectionZoned/",
  converter: "/reference/zoned/convert/convertZonedToZoned/",
};

/** Anchor within the page, matching the heading `build-reference.ts` emits. */
const WIDGET_ANCHORS: Record<WidgetKind, string> = {
  globe: "",
  dst: "#dst-transition-inspector",
  interval: "#interval-algebra-visualizer",
  converter: "#converter--format-bench",
};

export function encodeWidgetPermalink(
  kind: WidgetKind,
  args: Record<string, unknown>,
): string {
  const params = new URLSearchParams({ w: kind, wa: JSON.stringify(args) });
  return `${WIDGET_PAGE_PATHS[kind]}?${params.toString()}${WIDGET_ANCHORS[kind]}`;
}

/**
 * Read a permalink back.
 *
 * Returns the raw parsed args — the caller validates them with the widget's own
 * schema, because that schema is the single source of truth about what a valid
 * call looks like and this module should not hold a second opinion.
 */
export function decodeWidgetPermalink(
  search: string,
): { kind: WidgetKind; args: unknown } | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const kind = params.get("w");
  const raw = params.get("wa");
  if (!kind || !raw) return null;
  if (!(kind in WIDGET_PAGE_PATHS)) return null;

  try {
    return { kind: kind as WidgetKind, args: JSON.parse(raw) };
  } catch {
    // A hand-mangled or truncated link is a missing permalink, not an error.
    return null;
  }
}
