/**
 * Playground spec types.
 *
 * Each spec describes one live playground: which gmt module + function it
 * calls, the template call string, and the return type (for sentinel detection).
 *
 * The `LIVE_PLAYGROUND_TEMPLATES` record is generated from the gmt source by
 * `scripts/build-reference.ts` — it is NOT hand-authored. The generator walks
 * every exported function and derives seed values from the function's `@example`
 * tags. See the plan at
 * `.kilo/plans/1788099109759-auto-generate-playground-specs.md`.
 */

export interface LivePlaygroundTemplate {
  module: string;
  fn: string;
  template: string;
  returnType: "string" | "number" | "boolean" | "array";
  allowEmptyArray?: boolean;
}

export { LIVE_PLAYGROUND_TEMPLATES } from "~/generated/reference/live-playground-templates";
