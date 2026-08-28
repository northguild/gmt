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
// MDX → Markdown stripping (for hand-written guide pages)
// ---------------------------------------------------------------------------

/**
 * Minimal MDX-to-markdown conversion for the 3 hand-written guide `.mdx`
 * files (`install.mdx`, `core-rules.mdx`).
 *
 * Drops:
 * - `import …` / `export …` lines
 * - Starlight component tags (`<Card>`, `<CardGrid>`, `<Tabs>`, `<TabItem>`,
 *   `<Aside>`, `<Steps>`) — keeps inner text
 *
 * Replaces `{gmtVersion}` with the provided value.
 *
 * Note: fidelity is best-effort and improves when DOX-A4a ports real guide
 * content into plain `.md` files.
 */
export function stripMdx(body: string, vars: { gmtVersion?: string }): string {
  let md = body;

  // Drop import/export lines
  md = md.replace(/^\s*import\s.+$/gm, "");
  md = md.replace(/^\s*export\s.+$/gm, "");

  // Remove Starlight component tags (keep inner text)
  md = md.replace(/<\/?(Card|CardGrid|Tabs|TabItem|Aside|Steps)\b[^>]*>/g, "");

  // Substitute template variables
  if (vars.gmtVersion != null) {
    md = md.replace(/\{gmtVersion\}/g, vars.gmtVersion);
  }

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
