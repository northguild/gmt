/**
 * What every kit element shares. Not an element itself.
 *
 * `Base` falls back to an empty class when there is no `HTMLElement`, so a
 * module imports in node and during SSR. Nothing here touches `customElements`;
 * `defineElements()` (../define.ts) is the one place that does.
 *
 * Lifecycle. Each connection owns one `AbortController`. `connectedCallback`
 * aborts any previous one first, which keeps StrictMode's double connect
 * idempotent, then calls `wire(signal)` to attach listeners with `{ signal }`.
 * `disconnectedCallback` aborts, so a moved element re-wires cleanly.
 */
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export abstract class KitElement extends Base {
  #controller: AbortController | undefined;

  connectedCallback(): void {
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    this.wire(controller.signal);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  /** Attach listeners (all with `{ signal }`) and sync state from attributes. Idempotent. */
  protected abstract wire(signal: AbortSignal): void;
}

/** The payload of every kit `input` and `change` event. */
export interface KitDetail<T> {
  value: T;
}

/**
 * Re-emit a native control's event from the host, bubbling, with `detail.value`.
 * The native one is stopped at the host so a listener above sees one event, not two.
 * Returns false for an event the host itself dispatched (let it through).
 */
export function relay<T>(
  host: HTMLElement,
  event: Event,
  source: EventTarget | null,
  value: () => T,
): boolean {
  if (event.target !== source) return false;
  event.stopPropagation();
  host.dispatchEvent(
    new CustomEvent<KitDetail<T>>(event.type, {
      bubbles: true,
      detail: { value: value() },
    }),
  );
  return true;
}

/** Whether `value` is a finite number; used to keep attribute parsing honest. */
export function num(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
