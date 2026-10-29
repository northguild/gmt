/**
 * <gmt-copy>: copy a string to the clipboard.
 *
 * Pattern: WAI-ARIA APG Button, https://www.w3.org/WAI/ARIA/apg/patterns/button/
 * A native `<button type="button">` named by `label`. The outcome ("Copied", or
 * the failure) goes to a polite live region this element owns, so it is spoken and
 * is never the only signal: the icon and colour change too. A missing Clipboard
 * API and a rejected write both end in "Copy failed", not silence. The message
 * clears after 1.5 s. Replaces `wireCopyButtons`.
 */
import { CHECK_ICON, COPY_ICON } from "~/lib/code-frame";
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, raw, type SafeHtml } from "../../builders/html";
import { KitElement } from "../base";
import styles from "./copy.module.css";

export const COPIED_TEXT = "Copied";
export const FAILED_TEXT = "Copy failed";

export interface CopyOptions extends GateOption {
  /** The button's accessible name, such as "Copy call". Required. */
  label: string;
  /** What is copied. */
  text: string;
}

const svg = (paths: string): SafeHtml =>
  html`<svg
    class="${styles.icon}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    >${raw(paths)}</svg
  >`;

export function copy(o: CopyOptions): SafeHtml {
  return html`<gmt-copy class="${styles.root}" text="${o.text}" ${gateAttr(o.gate)}
    ><button class="${styles.button}" type="button" aria-label="${o.label}">${svg(COPY_ICON)}</button
    ><span class="${styles.status}" role="status"></span></gmt-copy
  >`;
}

export class GmtCopy extends KitElement {
  #timer: ReturnType<typeof setTimeout> | undefined;

  get text(): string {
    return this.getAttribute("text") ?? "";
  }
  set text(next: string) {
    this.setAttribute("text", next);
  }

  get #button(): HTMLButtonElement | null {
    return this.querySelector("button");
  }
  get #status(): HTMLElement | null {
    return this.querySelector('[role="status"]');
  }

  #show(state: "idle" | "copied" | "failed"): void {
    const button = this.#button;
    const status = this.#status;
    if (!button || !status) return;
    button.dataset["state"] = state;
    const icon = button.querySelector("svg");
    if (icon) icon.innerHTML = state === "copied" ? CHECK_ICON : COPY_ICON;
    status.textContent =
      state === "copied" ? COPIED_TEXT : state === "failed" ? FAILED_TEXT : "";
    clearTimeout(this.#timer);
    if (state !== "idle")
      this.#timer = setTimeout(() => this.#show("idle"), 1500);
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#timer);
    super.disconnectedCallback();
  }

  protected wire(signal: AbortSignal): void {
    this.#button?.addEventListener(
      "click",
      async () => {
        try {
          await navigator.clipboard.writeText(this.text);
          if (!signal.aborted) this.#show("copied");
        } catch {
          if (!signal.aborted) this.#show("failed");
        }
      },
      { signal },
    );
  }
}
