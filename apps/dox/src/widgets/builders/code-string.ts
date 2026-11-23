/**
 * codeString: a quoted string argument in a call line, written so it breaks where a person would.
 *
 * A date, time or offset in a string stays whole (a hyphen or a colon is a break point in a
 * browser, and a split date is a split word). A string with no space is held in its pieces by
 * `zonedValue`: it breaks only after the `T`, before the offset and before the `[`. A string with
 * spaces wraps at them, each date inside kept whole (`valueText`). A string with no date, time or
 * offset in it (`xxxx…`) has no seam: it is left to the page's `overflow-wrap: anywhere` on
 * `.gmt-code-str`, the last resort for junk. A string with no space and no date or time in it but
 * hyphens or colons (an ID such as `017F22E2-79B0-…`) breaks after each one: WebKit and Firefox
 * do not break after a hyphen before a digit, so it would be one word wider than its cell. The colour is the global `gmt-code-str` class, the
 * same as `codeToken("str", …)`.
 */
import { html, type SafeHtml } from "./html";
import { valueText } from "./value-text";

/** No space, a hyphen or colon to break at, and no date or time that `valueText` keeps whole. */
const ID_LIKE = /^[^\s-:]*(?:[-:][^\s-:]*)+$/;
const DATE_OR_TIME = /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/;

export function codeString(text: string): SafeHtml {
  const quoted = JSON.stringify(text);
  const body =
    ID_LIKE.test(quoted) && !DATE_OR_TIME.test(quoted)
      ? html`${quoted.split(/(?<=[-:])/).map((part, i) => html`${i === 0 ? "" : html`<wbr />`}${part}`)}`
      : valueText(quoted);
  return html`<span class="gmt-code-str">${body}</span>`;
}
