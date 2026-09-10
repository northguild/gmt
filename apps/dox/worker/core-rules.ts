// Astro's own ambient types declare `*.md` imports as `AstroComponentFactory`
// (its content-collection machinery); Wrangler's Text module rule (see
// wrangler.jsonc "rules") makes this resolve to a plain string at Worker
// runtime instead, verified during this story's spike. `astro check` still
// types this import Astro's way since worker/ shares the app's tsconfig, so
// the cast below routes around that — not a real type error.
import gmtReadme from "../../../packages/gmt/README.md";

/**
 * DOX-C2 (#138) — extracts just the "## Core Rules" section (ISO strings in
 * and out, never Date, sentinel returns, invalid input never throws) out of
 * the full README rather than bundling and prompting with the whole ~86 KB
 * file. Bounded by the next `## ` heading so it stays correct if the
 * section's content changes, and breaks loudly (empty string) rather than
 * silently if the heading itself is ever renamed.
 */
function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `^## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`,
    "m",
  );
  const match = pattern.exec(markdown);
  return match ? match[1].trim() : "";
}

export const CORE_RULES_CONTENT: string = extractSection(
  gmtReadme as unknown as string,
  "Core Rules",
);
