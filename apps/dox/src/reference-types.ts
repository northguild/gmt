export interface CorpusEntry {
  url: string;
  name: string;
  namespace: string;
  module: string;
  kind: string;
  signature: string;
  description: string;
  sourcePath: string;
}

export type RouteManifest = Set<string>;
