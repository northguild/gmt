/** One `@example` block from a function's JSDoc — mirrors `build-reference.ts`'s
 * internal `Example` shape, the part of it worth persisting into the corpus. */
export interface CorpusExample {
  call: string;
  result: string;
  note?: string;
}

/** One member of a public object type: its name and its own JSDoc text. */
export interface CorpusMember {
  name: string;
  description: string;
}

export interface CorpusEntry {
  /**
   * The canonical link. A type documented on its function's page has no page of its own, so
   * its link carries a fragment: `/reference/transport/calculate/dwellTime#dwell`.
   */
  url: string;
  /**
   * The route that serves the entry, never with a fragment. Equal to `url` except for a type
   * documented on its function's page, where it is that function's route. Several entries
   * can share one `page`.
   */
  page: string;
  name: string;
  namespace: string;
  module: string;
  kind: string;
  signature: string;
  description: string;
  sourcePath: string;
  /**
   * DOX-C1 (#137): retrieval chunks need real examples, not just a
   * signature + one-line description. Empty for non-function entries (types,
   * regexes) and for functions with no `@example` tags.
   */
  examples: CorpusExample[];
  /** On a type documented on its function's page only: that function's name. */
  inlineOn?: string;
  /** On a type with members: each member the type itself declares. */
  members?: CorpusMember[];
}

// DOX-C1 (#137): tightened from a mutable `Set<string>` to match what
// build-reference.ts's own header comment already claimed. Nothing reads this
// as a Set expecting mutation — the generator writes it once and every
// consumer (route resolution, retrieval chunk URLs) only ever reads it.
export type RouteManifest = ReadonlySet<string>;
