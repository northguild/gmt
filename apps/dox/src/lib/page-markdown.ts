import { renderMdxComponents } from "./mdx-jsx";

/**
 * Pure helpers for converting MDX/Markdown pages to clean Markdown output.
 *
 * Kept free of `import.meta.glob` / Astro globals so vitest can import them
 * directly.
 */

// ---------------------------------------------------------------------------
// Frontmatter stripping
// ---------------------------------------------------------------------------

/**
 * Strip a leading `---`-delimited frontmatter block from raw page content.
 *
 * Returns the parsed data fields (simple `key: "json"` / `key: value` lines)
 * and the body text that follows the closing `---`.
 */
export function stripFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Strip surrounding JSON quotes for simple string values
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }

  return { data, body: m[2] };
}

// ---------------------------------------------------------------------------
// MDX → Markdown stripping
// ---------------------------------------------------------------------------

/**
 * Apply `transform` to the parts of `body` that are not inside a fenced code block.
 *
 * Every other rule here works on MDX syntax, and a code sample is not MDX: a guide that shows
 * `import { addDate } from "@northguild/gmt";` means that line to be read, and the mistake and
 * scenario cards are made almost entirely of such samples. Running the import and component rules
 * over them silently deleted the sample's first line.
 */
function outsideFences(
  body: string,
  transform: (part: string) => string,
): string {
  return body
    .split(/(^```[\s\S]*?^```)/m)
    .map((part) => (part.startsWith("```") ? part : transform(part)))
    .join("");
}

/**
 * Drop `{ … .map( … ) … }` JSX blocks, brace by brace so a nested object literal or template
 * literal inside one does not end the block early.
 */
function dropMapBlocks(body: string): string {
  let out = "";
  let index = 0;

  while (index < body.length) {
    const open = body.indexOf("{", index);
    if (open === -1) break;

    let depth = 0;
    let cursor = open;
    let inBacktick = false;
    let quote = "";
    for (; cursor < body.length; cursor += 1) {
      const char = body[cursor];
      if (body[cursor - 1] === "\\") continue;
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (inBacktick) {
        if (char === "`") inBacktick = false;
        continue;
      }
      if (char === "`") inBacktick = true;
      else if (char === '"' || char === "'") quote = char;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const block = body.slice(open, cursor + 1);
    out += body.slice(index, open);
    if (!block.includes(".map(")) out += block;
    index = cursor + 1;
  }

  return out + body.slice(index);
}

/**
 * MDX → Markdown for the text surfaces (`.md`, `llms.txt`, `llms-full.txt`, retrieval chunks),
 * which are built from the raw `.mdx` and so see everything Astro would have evaluated.
 *
 * Drops:
 * - `import …` / `export …` statements, however many lines they span
 * - `{/* … *\/}` MDX comments
 * - JSX blocks that map over data (`{rows.map(…)}`) — the generated tables and charts, whose
 *   numbers the surrounding prose already states
 * - Starlight component tags (`<Card>`, `<CardGrid>`, `<Tabs>`, `<TabItem>`, `<Aside>`,
 *   `<Steps>`, `<Playground>`) — keeps inner text
 *
 * Renders the components that carry prose of their own (`<Mistake>`, `<Scenario>`) to Markdown,
 * and substitutes `{gmtVersion}` plus any `values` given, so a figure stated as an expression
 * reaches the text surfaces as the figure.
 */
export function stripMdx(
  body: string,
  vars: { gmtVersion?: string; values?: Record<string, string> },
): string {
  let md = renderMdxComponents(body);

  // Drop whole import statements, not just their first line. A multi-line
  // import (`import {\n  a,\n  b,\n} from "x";`) used to leave every
  // continuation line — including the closing `} from "...";` — behind as
  // literal text, because the old regex only matched a single line. Matching
  // non-greedily up to the first `;` after `import` consumes the whole
  // statement regardless of how many lines it spans; no import specifier in
  // this codebase embeds a `;` of its own.
  md = outsideFences(md, (part) =>
    part
      .replace(/^[ \t]*import\b[\s\S]*?;[ \t]*$/gm, "")
      // `export` statements span lines too (`export const x = {\n …\n};`), and a single-line
      // rule left every continuation behind as prose.
      .replace(/^[ \t]*export\b[\s\S]*?;[ \t]*$/gm, "")
      // Remove Starlight + playground component tags (keep inner text)
      .replace(
        /<\/?(Card|CardGrid|Tabs|TabItem|Aside|Steps|Playground)\b[^>]*>/g,
        "",
      ),
  );

  // MDX comments: `{/* … */}`, which are authoring notes, never page text.
  md = outsideFences(md, (part) =>
    part.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ""),
  );

  // Substitute template variables
  if (vars.gmtVersion != null) {
    md = md.replace(/\{gmtVersion\}/g, vars.gmtVersion);
  }

  // Figures the pages state as expressions over the stats modules.
  const values = vars.values ?? {};
  md = outsideFences(md, (part) =>
    part
      .replace(/\{([^{}\n]+)\}/g, (whole, expression: string) => {
        const resolved = values[expression.trim()];
        return resolved === undefined ? whole : resolved;
      })
      // `{" "}` is JSX line-break padding.
      .replace(/\{"\s*"\}/g, " "),
  );

  // A `.map(…)` block is a generated table or chart, whose figures the prose already states.
  md = outsideFences(md, dropMapBlocks);

  return md;
}

// ---------------------------------------------------------------------------
// Page → Markdown wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a page's title and body into a single Markdown string with an H1
 * heading.
 */
export function pageToMarkdown({
  title,
  body,
}: {
  title: string;
  body: string;
}): string {
  return `# ${title}\n\n${body.trim()}\n`;
}
