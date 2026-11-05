/**
 * zonedValue: a stored zoned time written so it breaks where a person would break it.
 *
 * The value breaks only after the `T`, before the offset and before the `[`. Each stretch is its
 * own no-wrap piece with a `<wbr>` between, outside the no-wrap element: WebKit and Firefox do not
 * break at a `<wbr>` inside `white-space: nowrap`, and Chromium does. No character is added, so the
 * text is the value as given.
 */
import { html, type SafeHtml } from "./html";
import styles from "./zoned-value.module.css";

export function zonedValue(value: string): SafeHtml {
  const cuts: number[] = [];
  const t = value.indexOf("T");
  if (t >= 0) cuts.push(t + 1);
  const off = /(?<=\d)(?=[+-]\d{2}:\d{2})/.exec(value);
  if (off) cuts.push(off.index);
  const br = value.indexOf("[");
  if (br >= 0) cuts.push(br);
  cuts.sort((x, y) => x - y);
  const parts: string[] = [];
  let from = 0;
  for (const at of [...cuts, value.length]) {
    if (at > from) parts.push(value.slice(from, at));
    from = at;
  }
  return html`${parts.map((part, i) => html`${i === 0 ? "" : html`<wbr />`}<span class="${styles.piece}">${part}</span>`)}`;
}
