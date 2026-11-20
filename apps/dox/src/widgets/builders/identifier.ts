/**
 * identifier: a camelCase name (`parseHumanDuration`) written so it can break at its seams.
 *
 * A name is one word to a browser, so a column headed by a function name is as wide as the name
 * and a table of several such columns is wider than its box. A `<wbr>` before each capital that
 * follows a lower-case letter or a digit gives the name its seams (`parse` / `Human` / `Duration`)
 * and nothing else: no character is added, so the text is the name as given. Text that is not a
 * camelCase name is returned as it is.
 *
 * A name joined by hyphens or slashes (`madrid-chamartin`, `Europe/Lisbon`) breaks after each one:
 * a browser does not break after a slash, and a break after a hyphen is a break between words. A
 * date, time or offset, or a phrase with spaces, is not a name and is returned as it is.
 */
import { html, type SafeHtml } from "./html";

/** A lower-case start, then at least one capitalised part: `parseDuration`, not `Written`. */
const CAMEL = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;

export function identifier(text: string): SafeHtml {
  const joined = /[-/]/.test(text) && !/\s|\d[-:+]\d/.test(text);
  if (!CAMEL.test(text) && !joined) return html`${text}`;
  const parts = joined
    ? text.split(/(?<=[-/])/)
    : text.split(/(?<=[a-z0-9])(?=[A-Z])/);
  return html`${parts.map((part, i) => html`${i === 0 ? "" : html`<wbr />`}${part}`)}`;
}
