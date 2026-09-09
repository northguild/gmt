/** One `@example` block from a function's JSDoc — mirrors `build-reference.ts`'s
 * internal `Example` shape, the part of it worth persisting into the corpus. */
export interface CorpusExample {
  call: string;
  result: string;
  note?: string;
}

export interface CorpusEntry {
  url: string;
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
}

// DOX-C1 (#137): tightened from a mutable `Set<string>` to match what
// build-reference.ts's own header comment already claimed. Nothing reads this
// as a Set expecting mutation — the generator writes it once and every
// consumer (route resolution, retrieval chunk URLs) only ever reads it.
export type RouteManifest = ReadonlySet<string>;
