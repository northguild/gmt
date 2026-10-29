/**
 * <gmt-handle>: a draggable `role="slider"` thumb.
 *
 * Pattern: WAI-ARIA APG Slider, https://www.w3.org/WAI/ARIA/apg/patterns/slider/
 * and, for two handles on one track, Multi-Thumb Slider,
 * https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
 *
 * Keys: arrows +/- `step`, PageUp/PageDown +/- `large-step`, Home/End to the
 * bounds. Pointer: drag with capture. The element owns `role`, `tabindex`,
 * `aria-orientation` and `aria-valuemin/-max/-now/-valuetext`; the builder writes
 * the same attributes so the server render matches. The name (`aria-label`) is
 * required by `handle()`.
 *
 * Two handles in one track set `pair="start"` and `pair="end"`: each is bounded by
 * the other, and its `aria-valuemin`/`-max` say so, as the multi-thumb pattern asks.
 * A typed-input equivalent is the widget's own field (invariant 10); `value` is the
 * property that field writes.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement, num } from "../base";
import styles from "./handle.module.css";

/**
 * The value under a pointer: the track's fraction at `clientX`, scaled to
 * `[min, max]`, snapped to `step` from `min`, clamped. A zero-width or non-finite
 * track gives `min`. `step <= 0` means continuous.
 */
export function valueAt(
  clientX: number,
  trackRect: Pick<DOMRect, "left" | "width">,
  min: number,
  max: number,
  step: number,
  rtl = false,
): number {
  if (!(max > min)) return min;
  if (!(trackRect.width > 0) || !Number.isFinite(clientX)) return min;
  let ratio = (clientX - trackRect.left) / trackRect.width;
  if (rtl) ratio = 1 - ratio;
  ratio = Math.min(1, Math.max(0, ratio));
  let value = min + ratio * (max - min);
  if (step > 0) {
    value = min + Math.round((value - min) / step) * step;
    // Drop the float noise a fractional step leaves (0.1 * 3).
    value = Number(value.toFixed(10));
  }
  return Math.min(max, Math.max(min, value));
}

export interface HandleOptions extends GateOption {
  /** The accessible name. Required. */
  label: string;
  id?: string;
  min: number;
  max: number;
  step: number;
  /** PageUp/PageDown step; defaults to ten steps. */
  largeStep?: number;
  value: number;
  /** Initial `aria-valuetext`. */
  valueText: string;
  /** Set on both handles of a pair. */
  pair?: "start" | "end";
}

/** The positioning box the handles sit in. */
export function handleTrack(handles: SafeHtml, o: GateOption = {}): SafeHtml {
  return html`<div class="${styles.track}" ${gateAttr(o.gate)}>${handles}</div>`;
}

export function handle(o: HandleOptions): SafeHtml {
  const span = o.max - o.min;
  const pct =
    span > 0 ? Math.min(100, Math.max(0, ((o.value - o.min) / span) * 100)) : 0;
  return html`<gmt-handle
    class="${styles.root}"
    ${o.id ? html`id="${o.id}"` : ""}
    role="slider"
    tabindex="0"
    aria-orientation="horizontal"
    aria-label="${o.label}"
    aria-valuemin="${o.min}"
    aria-valuemax="${o.max}"
    aria-valuenow="${o.value}"
    aria-valuetext="${o.valueText}"
    min="${o.min}"
    max="${o.max}"
    step="${o.step}"
    large-step="${o.largeStep ?? o.step * 10}"
    ${o.pair ? html`pair="${o.pair}"` : ""}
    ${gateAttr(o.gate)}
    style="--gmt-handle-pct: ${pct}"
  ></gmt-handle>`;
}

export class GmtHandle extends KitElement {
  #format: ((n: number) => string) | null = null;
  /** The value last rendered; undefined until the first render. */
  #rendered: number | undefined;

  /** The element whose box is the track; defaults to the parent. */
  track: HTMLElement | null = null;

  get min(): number {
    return num(this.getAttribute("min"), 0);
  }
  get max(): number {
    return num(this.getAttribute("max"), 100);
  }
  get step(): number {
    return num(this.getAttribute("step"), 1);
  }
  get largeStep(): number {
    return num(this.getAttribute("large-step"), this.step * 10);
  }

  get value(): number {
    return this.#clamp(num(this.getAttribute("aria-valuenow"), this.min));
  }
  /** Set from code (a typed field, a preset). Re-renders; emits nothing. */
  set value(next: number) {
    this.setAttribute("aria-valuenow", String(this.#clamp(next)));
    this.#render();
  }

  /** How the value reads aloud. Defaults to the number. */
  set formatValue(fn: (n: number) => string) {
    this.#format = fn;
    this.#render();
  }

  #track(): HTMLElement | null {
    return this.track ?? this.parentElement;
  }

  #peer(): GmtHandle | null {
    const pair = this.getAttribute("pair");
    if (!pair) return null;
    const other = pair === "start" ? "end" : "start";
    return (
      this.#track()?.querySelector<GmtHandle>(`gmt-handle[pair="${other}"]`) ??
      null
    );
  }

  /** The bounds this handle may move within right now. */
  #bounds(): [number, number] {
    let lo = this.min;
    let hi = this.max;
    const peer = this.#peer();
    if (peer) {
      const theirs = num(peer.getAttribute("aria-valuenow"), peer.min);
      if (this.getAttribute("pair") === "start") hi = Math.min(hi, theirs);
      else lo = Math.max(lo, theirs);
    }
    return [lo, hi];
  }

  #clamp(v: number): number {
    const [lo, hi] = this.#bounds();
    return Math.min(hi, Math.max(lo, v));
  }

  #render(): void {
    const [lo, hi] = this.#bounds();
    const value = Math.min(
      hi,
      Math.max(lo, num(this.getAttribute("aria-valuenow"), this.min)),
    );
    if (!this.hasAttribute("role")) this.setAttribute("role", "slider");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    this.setAttribute("aria-orientation", "horizontal");
    this.setAttribute("aria-valuemin", String(lo));
    this.setAttribute("aria-valuemax", String(hi));
    this.setAttribute("aria-valuenow", String(value));
    // The server-written text stands until a formatter arrives or the value moves.
    if (
      this.#format ||
      !this.hasAttribute("aria-valuetext") ||
      (this.#rendered !== undefined && value !== this.#rendered)
    ) {
      this.setAttribute(
        "aria-valuetext",
        this.#format ? this.#format(value) : String(value),
      );
    }
    this.#rendered = value;
    const span = this.max - this.min;
    this.style.setProperty(
      "--gmt-handle-pct",
      String(
        span > 0
          ? Math.min(100, Math.max(0, ((value - this.min) / span) * 100))
          : 0,
      ),
    );
  }

  #emit(type: "input" | "change"): void {
    this.dispatchEvent(
      new CustomEvent(type, { bubbles: true, detail: { value: this.value } }),
    );
  }

  /** Move to `next` as the reader's own act: render, then emit `input` (and `change` unless dragging). */
  #commit(next: number, final: boolean): void {
    const before = this.value;
    this.setAttribute("aria-valuenow", String(this.#clamp(next)));
    this.#render();
    if (this.value === before) return;
    this.#emit("input");
    if (final) this.#emit("change");
  }

  protected wire(signal: AbortSignal): void {
    this.#render();

    this.addEventListener(
      "keydown",
      (event) => {
        const step = this.step;
        const [lo, hi] = this.#bounds();
        const now = this.value;
        let next: number | null = null;
        switch (event.key) {
          case "ArrowRight":
          case "ArrowUp":
            next = now + step;
            break;
          case "ArrowLeft":
          case "ArrowDown":
            next = now - step;
            break;
          case "PageUp":
            next = now + this.largeStep;
            break;
          case "PageDown":
            next = now - this.largeStep;
            break;
          case "Home":
            next = lo;
            break;
          case "End":
            next = hi;
            break;
        }
        if (next === null) return;
        event.preventDefault();
        this.#commit(next, true);
      },
      { signal },
    );

    let dragging: number | null = null;
    let moved = false;
    const at = (clientX: number): number => {
      const rect = (this.#track() ?? this).getBoundingClientRect();
      const [lo, hi] = this.#bounds();
      const rtl = getComputedStyle(this).direction === "rtl";
      // Snap on the full scale, then let the bounds clamp.
      return Math.min(
        hi,
        Math.max(
          lo,
          valueAt(clientX, rect, this.min, this.max, this.step, rtl),
        ),
      );
    };

    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        dragging = event.pointerId;
        moved = false;
        this.setPointerCapture?.(event.pointerId);
        this.focus({ preventScroll: true });
        event.preventDefault();
      },
      { signal },
    );
    this.addEventListener(
      "pointermove",
      (event) => {
        if (dragging !== event.pointerId) return;
        const before = this.value;
        this.#commit(at(event.clientX), false);
        if (this.value !== before) moved = true;
      },
      { signal },
    );
    const end = (event: PointerEvent): void => {
      if (dragging !== event.pointerId) return;
      dragging = null;
      if (this.hasPointerCapture?.(event.pointerId))
        this.releasePointerCapture(event.pointerId);
      if (moved) this.#emit("change");
    };
    this.addEventListener("pointerup", end, { signal });
    this.addEventListener("pointercancel", end, { signal });

    // The other handle of a pair moved: our bounds changed.
    this.#track()?.addEventListener(
      "input",
      (event) => {
        if (event.target !== this) this.#render();
      },
      { signal },
    );
  }
}
