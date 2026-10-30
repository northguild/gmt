/**
 * The playground's result block: a visible "output" label and the `<output>` it names.
 * The mount writes the text and sets `data-state` (`live`, `sentinel` or `empty`).
 * It lives under `src/widgets/` because the kit has no free-length result element: a
 * `readout` never wraps, and a playground result can be a long JSON string.
 */
import { html, type SafeHtml } from "~/widgets/builders";
import styles from "./playground-form.module.css";

export function playgroundResult(labelId: string, toneClass: string): SafeHtml {
  return html`<div class="${styles.result}"
    ><span class="${styles.outputLabel}" id="${labelId}">output</span
    ><output
      class="${styles.output} ${toneClass}"
      aria-labelledby="${labelId}"
      data-state="empty"
      data-result
      >&nbsp;</output
    ></div
  >`;
}
