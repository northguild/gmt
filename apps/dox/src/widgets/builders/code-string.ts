/**
 * codeString: a quoted string argument in a call line, written so it breaks where a person would.
 *
 * A date, time or offset in a string stays whole (a hyphen or a colon is a break point in a
 * browser, and a split date is a split word). A string with no space is held in its pieces by
 * `zonedValue`: it breaks only after the `T`, before the offset and before the `[`. A string with
 * spaces wraps at them, each date inside kept whole (`valueText`). A string with no date, time or
 * offset in it (`xxxx…`) has no seam: it is left to the page's `overflow-wrap: anywhere` on
 * `.gmt-code-str`, the last resort for junk. The colour is the global `gmt-code-str` class, the
 * same as `codeToken("str", …)`.
 */
import { html, type SafeHtml } from "./html";
import { valueText } from "./value-text";

export function codeString(text: string): SafeHtml {
  return html`<span class="gmt-code-str">${valueText(JSON.stringify(text))}</span>`;
}
