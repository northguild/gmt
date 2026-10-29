/**
 * callOutput: the lines of text a set of library calls returned, in one scrollable `<output>`.
 *
 * `live` lines are results; a `lost` line is the library's sentinel and reads "NO SIGNAL" in
 * the amber family, in words. `empty` is the state before any call has run. It is a
 * non-announcing output: the widget's status line says what changed.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./call-output.module.css";

export interface CallOutputLine {
  text: string;
  /** The library returned its sentinel for this call. */
  lost: boolean;
}

export interface CallOutputOptions {
  /** The output's accessible name. Required. */
  label: string;
  state: "live" | "sentinel" | "empty";
  lines: readonly CallOutputLine[];
}

export const CALL_OUTPUT_LOST = "NO SIGNAL";

export function callOutput(o: CallOutputOptions): SafeHtml {
  return html`<output class="${styles.output}" aria-label="${o.label}" aria-live="off" data-state="${o.state}" tabindex="0"
    >${o.lines.map(
      (l, i) =>
        html`${i === 0 ? "" : "\n"}${
          l.lost
            ? html`<span class="${styles.lost}">${CALL_OUTPUT_LOST}</span>`
            : l.text
        }`,
    )}</output
  >`;
}
