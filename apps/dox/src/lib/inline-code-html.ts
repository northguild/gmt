/**
 * Backtick-marked strings as HTML, for the /compare tables and the widgets.
 *
 * A leaf with no imports, so a widget can use it without pulling the comparison
 * figures that `library-compare-tables.ts` reads into its chunk.
 */

/** Text safe in element content and in a quoted attribute. */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * A string that marks inline code with backticks, as HTML: each `` `span` `` becomes
 * `<code>`, and everything else is escaped. An unpaired backtick stays as text. The
 * text surfaces keep the backticks, which are Markdown there.
 */
export function inlineCodeHtml(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.length > 1 && part.startsWith("`") && part.endsWith("`")
        ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
        : escapeHtml(part),
    )
    .join("");
}
