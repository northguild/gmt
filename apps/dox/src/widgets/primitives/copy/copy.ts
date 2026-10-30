/**
 * <gmt-copy>: copy a string to the clipboard.
 *
 * Pattern: WAI-ARIA APG Button, https://www.w3.org/WAI/ARIA/apg/patterns/button/
 * A native `<button type="button">` named by `label`. The outcome ("Copied", or
 * the failure) goes to a polite live region this element owns, so it is spoken and
 * is never the only signal: the icon and colour change too. A missing Clipboard
 * API and a rejected write both end in "Copy failed", not silence. The message
 * clears after 1.5 s. With `reveal`, for text shown nowhere else on the page (a share
 * link), a failure also shows the text, and it stays until the next click, so it can be
 * selected and copied by hand.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, raw, type SafeHtml } from "../../builders/html";
import { KitElement } from "../base";
import styles from "./copy.module.css";

/** Clipboard icon paths, the inside of the `<svg>`, so both states share one wrapper. */
const COPY_ICON =
  '<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
const CHECK_ICON = '<polyline points="20 6 9 17 4 12"></polyline>';

export const COPIED_TEXT = "Copied";
export const FAILED_TEXT = "Copy failed";

interface CopyOptions extends GateOption {
  /** The button's accessible name, such as "Copy call". Required. */
  label: string;
  /** What is copied. */
  text: string;
  /** The text is shown nowhere else on the page: a failed copy shows it, to copy by hand. */
  reveal?: boolean;
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
  return html`<gmt-copy class="${styles.root}" text="${o.text}" ${o.reveal ? "data-reveal" : ""} ${gateAttr(o.gate)}
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
    const reveal = state === "failed" && this.hasAttribute("data-reveal");
    status.textContent =
      state === "copied"
        ? COPIED_TEXT
        : state === "failed"
          ? reveal
            ? `${FAILED_TEXT}. Copy it from here: ${this.text}`
            : FAILED_TEXT
          : "";
    clearTimeout(this.#timer);
    if (state !== "idle" && !reveal)
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
