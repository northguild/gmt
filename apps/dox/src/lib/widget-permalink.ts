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
 *     <the widget's own /tools page>?w=<kind>&wa=<compact JSON>
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
 * Every entry is a `/tools/` page whose whole subject is that widget. Three of
 * these used to point at reference pages that merely embed the widget partway
 * down — which resolved, but landed a reader who clicked "the view I was
 * looking at" on a function's API documentation instead of on the thing they
 * wanted, and needed an anchor to get near it at all. A dedicated page is the
 * better destination and needs no anchor, because the widget *is* the page.
 *
 * A permalink that 404s would violate the same DOX-C rule as a hallucinated
 * citation, so `widget-permalink.test.ts` asserts each of these is a real
 * content file rather than trusting the string.
 */
export const WIDGET_PAGE_PATHS: Record<WidgetKind, string> = {
  globe: "/tools/zoned-earth/",
  dst: "/tools/dst-inspector/",
  interval: "/tools/interval-visualizer/",
  converter: "/tools/converter-bench/",
};

export function encodeWidgetPermalink(
  kind: WidgetKind,
  args: Record<string, unknown>,
): string {
  const params = new URLSearchParams({ w: kind, wa: JSON.stringify(args) });
  return `${WIDGET_PAGE_PATHS[kind]}?${params.toString()}`;
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

/**
 * Read this page's own permalink, if it carries one for `kind`.
 *
 * Called from each widget's page bootstrap, so a link copied out of the chat —
 * or written by hand into a guide, as `/tools/dst-inspector/` does — arrives
 * showing the state it names rather than the widget's defaults.
 *
 * ## Why the checks here are structural rather than a zod parse
 *
 * The tool path already validates with the real schemas, twice: at the edge in
 * the Worker and again in `widget-registry.ts` before mounting. This is the
 * *other* entrance, and it has a different constraint — it runs on the widget's
 * own page, which must not drag `zod` (and through `dox-tools.ts`, the whole
 * `ai` package) into a documentation page's bundle for the sake of reading four
 * query parameters.
 *
 * So: shapes and ranges are checked here, and everything interpolated into
 * markup is escaped at the template boundary by `escapeAttr` regardless of
 * which entrance it came through. The escaping is what actually makes this
 * safe; these checks stop a nonsense value producing a confusing widget.
 */
export function seedFromLocation(
  kind: WidgetKind,
  search: string = typeof window === "undefined" ? "" : window.location.search,
): Record<string, unknown> {
  const decoded = decodeWidgetPermalink(search);
  if (!decoded || decoded.kind !== kind) return {};
  const args = decoded.args;
  if (typeof args !== "object" || args === null || Array.isArray(args))
    return {};

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    // Strings are capped rather than pattern-matched: the widgets already fall
    // back to a default for anything they cannot use, and a length bound is
    // what stops a hostile link bloating the page.
    if (typeof value === "string" && value.length > 0 && value.length <= 64) {
      out[key] = value;
    } else if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1900 &&
      value <= 2100
    ) {
      out[key] = value;
    }
  }
  return out;
}
