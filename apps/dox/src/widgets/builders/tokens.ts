/**
 * keepTokens: text with each date, time or offset held on one line. A hyphen, a colon and a plus
 * are line-break points, so `2027-03-28` can split as `2027-` / `03-28` in a narrow cell, and a
 * split date is a split word. The words around a token still wrap at their spaces. An instant
 * (`2026-10-25T01:00:00Z`) is the one token that may break, after its `T` (`zonedValue`).
 */
import { html, type SafeHtml } from "./html";
import styles from "./tokens.module.css";
import { zonedValue } from "./zoned-value";

/** A run of non-space characters with a digit on each side of a `-`, `:` or `+`. */
const TOKEN = /(\S*\d[-:+]\d\S*)/;

export function keepTokens(text: string): SafeHtml {
  return html`${text
    .split(TOKEN)
    .map((part, i) =>
      i % 2 === 1
        ? /\dT\d/.test(part)
          ? zonedValue(part)
          : html`<span class="${styles.token}">${part}</span>`
        : html`${part}`,
    )}`;
}
