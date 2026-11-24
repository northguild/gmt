/**
 * codeString: a quoted string argument in a call line, written so it breaks where a person would.
 *
 * A date, time or offset in a string stays whole (a hyphen or a colon is a break point in a
 * browser, and a split date is a split word). A string with no space is held in its pieces by
 * `zonedValue`: it breaks only after the `T`, before the offset and before the `[`. A string with
 * spaces wraps at them, each date inside kept whole (`valueText`). A string with no date, time or
 * offset in it (`xxxx…`) has no seam: it is left to the page's `overflow-wrap: anywhere` on
 * `.gmt-code-str`, the last resort for junk. An ID made of three or more hex groups joined by
 * hyphens (a UUID such as `017F22E2-79B0-…`) breaks after each hyphen: WebKit and Firefox do not
 * break after a hyphen before a digit, so it would be one word wider than its cell. Only hex
 * groups count, so a year-month (`2024-03`), month-day (`--03-15`), week (`2024-W11-3`) or ordinal
 * (`2024-075`) date stays whole. The colour is the global `gmt-code-str` class, the same as
 * `codeToken("str", …)`.
 */
import { html, type SafeHtml } from "./html";
import { valueText } from "./value-text";

/** Three or more hex groups joined by hyphens, quoted, as a UUID is. */
const ID_LIKE = /^"[0-9A-F]+(?:-[0-9A-F]+){2,}"$/i;
/** A full calendar date is also three groups of hex digits: `valueText` keeps it whole. */
const FULL_DATE = /\d{4}-\d{2}-\d{2}/;

export function codeString(text: string): SafeHtml {
  const quoted = JSON.stringify(text);
  const body =
    ID_LIKE.test(quoted) && !FULL_DATE.test(quoted)
      ? html`${quoted.split(/(?<=-)/).map((part, i) => html`${i === 0 ? "" : html`<wbr />`}${part}`)}`
      : valueText(quoted);
  return html`<span class="gmt-code-str">${body}</span>`;
}
