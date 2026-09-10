/**
 * DOX-C1 (#137) — retrieval chunk shape.
 *
 * One chunk is one retrievable unit: either a single function/type/regex
 * reference entry, or one heading-delimited section of a guide. Both kinds
 * are searched together (see `search.ts`) — a question doesn't know in
 * advance whether the answer lives in a signature or a guide's prose.
 */
export interface RetrievalChunk {
  /** Stable id — `namespace/module/name` for a function, `guide-slug#heading-slug`
   * for a guide section. Used only for dedup/debugging, never shown to the model. */
  id: string;
  /** `"function"` (includes type/regex reference entries) or `"guide"`. */
  kind: "function" | "guide";
  /** The page URL this chunk answers from — always resolvable against
   * `referenceRoutes` (function chunks) or a real guide route (guide chunks).
   * Guide chunks add a `#heading-slug` fragment when the chunk is not the
   * page's first section. */
  url: string;
  /** `namespace` for a function chunk (e.g. "zoned"); the guide's top-level
   * directory for a guide chunk (e.g. "core-date-operations"). This is what
   * DOX-C1's namespace-scoping bias matches the current page context against. */
  namespace: string;
  /** Short label for the retrieval trace UI (DOX-C3a) — a function name, or
   * "Guide title › Heading". Never used for search matching itself. */
  title: string;
  /** The actual searchable text: signature + description + formatted examples
   * for a function chunk; the heading + section body for a guide chunk. */
  text: string;
}
