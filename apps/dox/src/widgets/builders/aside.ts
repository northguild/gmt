/**
 * aside: a note or a caution. A complementary landmark named by `label`
 * (https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/complementary.html).
 *
 * The two icon paths are Starlight's own (`@astrojs/starlight` Icons), as in
 * `renderAside`, so a widget's aside matches a real `:::note`.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, raw, type SafeHtml } from "./html";
import styles from "./aside.module.css";

const ICON_INFO =
  '<path d="M12 11a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1Zm.38-3.92a1 1 0 0 0-.76 0 1 1 0 0 0-.33.21 1.15 1.15 0 0 0-.21.33 1 1 0 0 0 .21 1.09c.097.088.209.16.33.21A1 1 0 0 0 13 8a1.05 1.05 0 0 0-.29-.71 1 1 0 0 0-.33-.21ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16.001A8 8 0 0 1 12 20Z"/>';
const ICON_WARNING =
  '<path d="M12 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10.67 1.47-8.05-14a3 3 0 0 0-5.24 0l-8 14A3 3 0 0 0 3.94 22h16.12a3 3 0 0 0 2.61-4.53Zm-1.73 2a1 1 0 0 1-.88.51H3.94a1 1 0 0 1-.88-.51 1 1 0 0 1 0-1l8-14a1 1 0 0 1 1.78 0l8.05 14a1 1 0 0 1 .05 1.02v-.02ZM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1Z"/>';

export interface AsideOptions extends GateOption {
  /** The landmark's name. Required. */
  label: string;
  tone: "note" | "caution";
  /** The visible heading line. */
  title: string;
}

export function aside(o: AsideOptions, children: SafeHtml): SafeHtml {
  return html`<aside class="${styles.root}" data-tone="${o.tone}" ${gateAttr(o.gate)} aria-label="${o.label}"
    ><svg class="${styles.icon}" viewBox="0 0 24 24" aria-hidden="true"
      >${raw(o.tone === "caution" ? ICON_WARNING : ICON_INFO)}</svg
    ><p class="${styles.title}">${o.title}</p
    ><div class="${styles.body}">${children}</div></aside
  >`;
}
