export interface CorpusEntry {
  url: string
  name: string
  namespace: string
  module: string
  kind: string
  signature: string
  description: string
  sourcePath: string
}

export interface WidgetExample {
  call: string
  result: string
  note?: string
}

export interface WidgetSeed {
  route: string
  fnName: string
  examples: WidgetExample[]
}

export type RouteManifest = Set<string>
