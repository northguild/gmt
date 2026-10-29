/**
 * storedNote: a short line of muted explanation under a control or a drawing.
 *
 * The kit's `hint` takes plain text only; the audit's notes carry a `<code>` example, so the
 * note takes a built piece. The ink is the body ink, never a dimmed one, so it holds 7:1 on
 * the widget surface wherever it sits.
 */
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./stored-note.module.css";

export function storedNote(children: HtmlValue, id?: string): SafeHtml {
  return html`<p class="${styles.note}" ${id === undefined ? "" : html`id="${id}"`}>${children}</p>`;
}
