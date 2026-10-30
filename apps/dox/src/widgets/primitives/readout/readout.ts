/**
 * <gmt-readout>: a result value that holds still and announces once.
 *
 * Pattern: the WAI-ARIA `status` role, https://www.w3.org/TR/wai-aria-1.2/#status
 * (APG has no readout pattern; `<output>` carries it natively, and the live
 * region follows the APG guidance to announce a settled value, not each tick).
 *
 * The visible `<output>` updates on every `input` and is not live. A separate
 * visually hidden `role="status"` region is written only on `change` (or
 * `announce()`), so a drag from min to max speaks once. Every declared sample, and
 * the sentinel, are laid out in the same grid cell, hidden, so the box reserves
 * the width of the widest (invariant 14); text never wraps and figures are tabular.
 *
 * Three states, and the difference between the last two is load-bearing
 * (invariant 7): `live` is a value; `sentinel` is invalid input (GMT returned the
 * empty string) and shows the amber signal-lost notice; `empty` is a correct answer
 * that happens to be nothing (two intervals that do not overlap) and shows the
 * caller's message in muted ink. Setting `value = ""` is the sentinel; call
 * `setEmpty(message)` for a legitimate empty result.
 *
 * `for="id id"` names the controls whose `change` announces the value; without it
 * the mount calls `announce()`.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement } from "../base";
import styles from "./readout.module.css";

export const SENTINEL_TEXT = "⟨ NO SIGNAL — invalid input ⟩";

interface ReadoutOptions extends GateOption {
  /** The accessible name of the value. Required. */
  label: string;
  /** The initial value; an empty string starts as the sentinel. */
  value: string;
  /** Examples of the widest values it will show, so the box is that wide from the start. */
  samples: readonly string[];
  /** Ids of the controls whose `change` announces the value. */
  announceOn?: readonly string[];
  /** Replaces the default sentinel text. */
  sentinel?: string;
}

export function readout(o: ReadoutOptions): SafeHtml {
  const sentinel = o.sentinel ?? SENTINEL_TEXT;
  const live = o.value !== "";
  return html`<gmt-readout
    class="${styles.root}"
    data-state="${live ? "live" : "sentinel"}"
    sentinel="${sentinel}"
    ${gateAttr(o.gate)}
    ${o.announceOn?.length ? html`for="${o.announceOn.join(" ")}"` : ""}
    ><output class="${styles.value}" aria-label="${o.label}" aria-live="off"
      >${live ? o.value : sentinel}</output
    >${[...o.samples, sentinel].map(
      (sample) =>
        html`<span class="${styles.ghost}" aria-hidden="true">${sample}</span>`,
    )}<span class="${styles.announce}" role="status" aria-label="${o.label} (announcement)"></span
  ></gmt-readout>`;
}

type State = "live" | "sentinel" | "empty";

export class GmtReadout extends KitElement {
  get #output(): HTMLOutputElement | null {
    return this.querySelector("output");
  }
  get #announcer(): HTMLElement | null {
    return this.querySelector('[role="status"]');
  }

  get sentinelText(): string {
    return this.getAttribute("sentinel") ?? SENTINEL_TEXT;
  }

  get state(): State {
    return (this.dataset["state"] as State | undefined) ?? "live";
  }

  /** The text shown. Empty means invalid input: the sentinel. */
  get value(): string {
    return this.state === "live" ? (this.#output?.textContent ?? "") : "";
  }
  set value(next: string) {
    if (next === "") this.#show(this.sentinelText, "sentinel");
    else this.#show(next, "live");
  }

  /** A correct answer that is nothing. Never the sentinel. */
  setEmpty(message: string): void {
    this.#show(message, "empty");
  }

  #show(text: string, state: State): void {
    this.dataset["state"] = state;
    const output = this.#output;
    if (output) output.textContent = text;
  }

  #timer: ReturnType<typeof setTimeout> | undefined;

  /** Say the current text once. Clears itself so the next announcement is heard even if equal. */
  announce(): void {
    const region = this.#announcer;
    const output = this.#output;
    if (!region || !output) return;
    region.textContent = output.textContent;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      region.textContent = "";
    }, 1000);
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#timer);
    super.disconnectedCallback();
  }

  protected wire(signal: AbortSignal): void {
    const ids = (this.getAttribute("for") ?? "").split(/\s+/).filter(Boolean);
    if (ids.length === 0) return;
    // `change`, never `input`: the settled value, not each tick of a drag.
    this.ownerDocument.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (target instanceof Element && ids.includes(target.id))
          this.announce();
      },
      // Capture: <gmt-range> stops the input's native `change` at the host, so a
      // bubbling listener here would never see the control's own id.
      { signal, capture: true },
    );
  }
}
