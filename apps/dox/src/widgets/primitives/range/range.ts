/**
 * <gmt-range>: a native `<input type="range">` with a value chip on the thumb.
 *
 * Pattern: WAI-ARIA APG Slider, https://www.w3.org/WAI/ARIA/apg/patterns/slider/
 * The native input owns the role, the name, the keys (arrows, PageUp/PageDown,
 * Home/End) and the value; this element adds the fill, the chip and
 * `aria-valuetext` from `formatValue`.
 *
 * The builder writes the initial state, so the server render and the first client
 * render match. The mount reads and writes `value`, never inner nodes. The
 * element re-emits the input's `input`/`change` from itself, bubbling, with
 * `detail.value` (a number), and stops the native ones at the host.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement, num, relay } from "../base";
import styles from "./range.module.css";

interface RangeOptions extends GateOption {
  /** The input's id, so a `<label for>` or a test can reach it. */
  id: string;
  /** The accessible name. Required. */
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Initial `aria-valuetext` and chip text. */
  valueText: string;
  /** Visible end labels, hidden when the box is narrow. */
  ends?: readonly [string, string];
  disabled?: boolean;
}

/** The fill position, 0 to 100, clamped. */
export function rangePct(value: number, min: number, max: number): number {
  if (!(max > min) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function range(o: RangeOptions): SafeHtml {
  const pct = rangePct(o.value, o.min, o.max);
  return html`<gmt-range class="${styles.root}" ${gateAttr(o.gate)} style="--gmt-range-pct: ${pct}"
    ><input
      class="${styles.input}"
      type="range"
      id="${o.id}"
      aria-label="${o.label}"
      min="${o.min}"
      max="${o.max}"
      step="${o.step}"
      value="${o.value}"
      aria-valuetext="${o.valueText}"
      ${o.disabled ? html`disabled` : ""}
    /><span class="${styles.chip}" data-gate="rider" aria-hidden="true"
      ><span data-live>${o.valueText}</span
      ><span data-sample="${o.min}"></span
      ><span data-sample="${o.max}"></span></span
    >${
      o.ends
        ? html`<span class="${styles.ends}" aria-hidden="true"
          ><span>${o.ends[0]}</span><span>${o.ends[1]}</span></span
        >`
        : ""
    }</gmt-range
  >`;
}

export class GmtRange extends KitElement {
  #format: (n: number) => string = (n) => String(n);

  get input(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('input[type="range"]');
  }

  /** The current value. Setting it moves the fill, the chip and `aria-valuetext`. */
  get value(): number {
    return num(this.input?.value ?? null, 0);
  }
  set value(next: number) {
    const input = this.input;
    if (!input) return;
    input.value = String(next);
    this.#sync();
  }

  /**
   * The bounds and step. Setting one moves the fill, the chip and `aria-valuetext` and
   * clamps the value the input holds, so a mount never re-renders the slider to change them.
   */
  get min(): number {
    return num(this.input?.min ?? null, 0);
  }
  set min(next: number) {
    this.#bound("min", next);
  }
  get max(): number {
    return num(this.input?.max ?? null, 100);
  }
  set max(next: number) {
    this.#bound("max", next);
  }
  get step(): number {
    return num(this.input?.step ?? null, 1);
  }
  set step(next: number) {
    this.#bound("step", next);
  }

  /** The visible end labels (the pair `ends` made). A no-op when the range has none. */
  set ends(next: readonly [string, string]) {
    const ends = this.input?.nextElementSibling?.nextElementSibling;
    const labels = ends?.children;
    if (!labels || labels.length < 2) return;
    labels[0]!.textContent = next[0];
    labels[1]!.textContent = next[1];
  }

  #bound(name: "min" | "max" | "step", next: number): void {
    const input = this.input;
    if (!input) return;
    input[name] = String(next);
    // Browsers re-run the range's value sanitization when a bound changes; writing the
    // value back makes every engine (jsdom does not) clamp and snap it the same way.
    input.value = String(input.value);
    this.#sync();
  }

  get disabled(): boolean {
    return this.input?.disabled ?? false;
  }
  set disabled(next: boolean) {
    if (this.input) this.input.disabled = next;
  }

  /** How a value reads aloud and in the chip. Defaults to the number. */
  set formatValue(fn: (n: number) => string) {
    this.#format = fn;
    this.#sync();
  }

  #sync(): void {
    const input = this.input;
    if (!input) return;
    const value = Number(input.value);
    this.style.setProperty(
      "--gmt-range-pct",
      String(rangePct(value, num(input.min, 0), num(input.max, 100))),
    );
    const text = this.#format(value);
    input.setAttribute("aria-valuetext", text);
    // The chip is the input's next sibling, written by `range()`. It holds the live text and a
    // hidden sample of each end's text, so its width is the widest reading and holds still.
    const chip = input.nextElementSibling;
    const live = chip?.querySelector("[data-live]");
    if (live) live.textContent = text;
    const samples = chip?.querySelectorAll("[data-sample]");
    if (samples?.length === 2) {
      samples[0]!.setAttribute("data-sample", this.#format(num(input.min, 0)));
      samples[1]!.setAttribute(
        "data-sample",
        this.#format(num(input.max, 100)),
      );
    }
  }

  protected wire(signal: AbortSignal): void {
    const input = this.input;
    if (!input) return;
    this.style.setProperty(
      "--gmt-range-pct",
      String(
        rangePct(Number(input.value), num(input.min, 0), num(input.max, 100)),
      ),
    );
    for (const type of ["input", "change"]) {
      this.addEventListener(
        type,
        (event) => {
          if (type === "input") this.#sync();
          relay(this, event, input, () => Number(input.value));
        },
        { signal },
      );
    }
  }
}
