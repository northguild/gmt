/**
 * valueText: a value a widget prints, written so it breaks where a person would break it.
 *
 * A date, time or offset in it stays whole (a hyphen or a colon is a break point in a browser, and
 * a split date is a split word). One word with a date or time in it (an instant, a zoned time) is
 * held in its pieces by `zonedValue`: it breaks only after the `T`, before the offset and before
 * the `[`. Text with spaces wraps at them, each date inside kept whole (`keepTokens`). Text with no
 * date, time or offset is returned as it is. No character is added.
 */
import { html, type SafeHtml } from "./html";
import { keepTokens } from "./tokens";
import { zonedValue } from "./zoned-value";

const HAS_TOKEN = /\d[-:+]\d/;

export function valueText(text: string): SafeHtml {
  if (!HAS_TOKEN.test(text)) return html`${text}`;
  return /\s/.test(text) ? keepTokens(text) : zonedValue(text);
}
