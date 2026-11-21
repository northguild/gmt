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

/** A camelCase name: a lower-case start, then at least one capitalised part (`parseDuration`). */
export const CAMEL_NAME = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;

/** Each seam of a camelCase name: before a capital that follows a lower-case letter or a digit. */
export const CAMEL_SEAM = /(?<=[a-z0-9])(?=[A-Z])/;

/**
 * A string that marks inline code with backticks, as HTML: each `` `span` `` becomes
 * `<code>`, and everything else is escaped. An unpaired backtick stays as text. The
 * text surfaces keep the backticks, which are Markdown there. A span that is a camelCase name
 * gets a `<wbr>` at each seam, so a name in a narrow table cell breaks there instead of widening
 * the column; no character is added.
 */
export function inlineCodeHtml(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part) => {
      if (!(part.length > 1 && part.startsWith("`") && part.endsWith("`")))
        return escapeHtml(part);
      const code = part.slice(1, -1);
      const body = CAMEL_NAME.test(code)
        ? code.split(CAMEL_SEAM).join("<wbr>")
        : escapeHtml(code);
      return `<code>${body}</code>`;
    })
    .join("");
}
