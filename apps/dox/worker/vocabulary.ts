// DOX-C2 (#138) — "vocabulary" for the system prompt: the consumer-facing
// packages/gmt/skills/*/SKILL.md content, concatenated so the model learns
// the library's terminology before reading reference signatures (see the
// section order in worker/system-prompt.ts).
//
// Deliberately excludes packages/gmt/skills/contributor/*/SKILL.md (issue
// creation, PR contribution, new-method implementation, unit-test
// generation, API-expansion workflow) — those are maintainer/contributor
// workflow docs, not usage vocabulary, and Dox only ever answers
// consumer questions about using the library. Loading them would risk the
// model picking up contributor-workflow tone/suggestions ("file an issue")
// in an end-user answer.
//
// Resolved via wrangler.jsonc's Text module rule (`{ type: "Text", globs:
// ["**/*.md"] }`), verified to work for a cross-package import during this
// story's spike (see PR notes). Explicit static imports rather than a glob:
// Wrangler's bundler is esbuild, not Vite, so `import.meta.glob` isn't
// available, and four fixed files don't need generated-module machinery —
// add a new import line here if a consumer-facing skill is added later.
//
// Astro's own ambient types declare `*.md` imports as `AstroComponentFactory`
// (its content-collection machinery), since worker/ shares the app's
// tsconfig with `astro check`; the `as unknown as string` casts below route
// around that mismatch rather than reflecting a real type error — see
// core-rules.ts for the same pattern.
import gmtArithmetic from "../../../packages/gmt/skills/gmt-arithmetic/SKILL.md";
import gmtBasics from "../../../packages/gmt/skills/gmt-basics/SKILL.md";
import gmtIntegration from "../../../packages/gmt/skills/gmt-integration/SKILL.md";
import gmtTimezone from "../../../packages/gmt/skills/gmt-timezone/SKILL.md";

export const VOCABULARY_CONTENT: string = [
  gmtBasics,
  gmtArithmetic,
  gmtTimezone,
  gmtIntegration,
]
  .map((s) => s as unknown as string)
  .join("\n\n---\n\n");
