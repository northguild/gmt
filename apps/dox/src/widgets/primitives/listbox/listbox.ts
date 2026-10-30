/**
 * <gmt-listbox>: a single-select listbox with one tab stop.
 *
 * Pattern: Listbox https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ (focus stays on
 * the listbox and `aria-activedescendant` names the active option). ArrowDown and
 * ArrowUp move, Home and End go to the ends, PageDown and PageUp move ten, Enter and
 * Space choose the active option, and a click chooses the option it lands on.
 *
 * Options are `role="option"` elements that carry `data-index` and `data-value`
 * (`listboxOption` writes them). Two modes:
 * - Plain: the element reads its options from the DOM.
 * - Virtual: the caller sets `count` and `valueAt`, and draws only the rows near the
 *   viewport. The element still owns the keys and the active index; it fires `active`
 *   so the caller can scroll that row in and draw it, then calls `sync()`.
 *
 * Events, all bubbling, with `detail`: `active` `{ index }` when the keys move the
 * active option, and `change` `{ value }` when an option is chosen.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement, type KitDetail } from "../base";
import styles from "./listbox.module.css";

interface ListboxItem {
  value: string;
  label: string;
}

interface ListboxOptions extends GateOption {
  /** The element's id; `aria-activedescendant` and a combobox's `aria-controls` point at it. */
  id: string;
  /** The listbox's accessible name. Required. */
  label: string;
  items: readonly ListboxItem[];
  /** The chosen value, if any. */
  value?: string;
  /** Extra class for the root (the family module's own). */
  className?: string;
}

interface ListboxOptionOptions {
  /** The option's id; build it with `listboxOptionId`. */
  id: string;
  index: number;
  value: string;
  selected?: boolean;
  /** The option's content; plain text or a builder's output. */
  children: SafeHtml | string;
  className?: string;
}

/** The id of the option at `index` inside the listbox with id `listId`. */
export function listboxOptionId(listId: string, index: number): string {
  return `${listId}-opt-${index}`;
}

export function listboxOption(o: ListboxOptionOptions): SafeHtml {
  return html`<div
    role="option"
    id="${o.id}"
    class="${styles.option} ${o.className ?? ""}"
    data-index="${o.index}"
    data-value="${o.value}"
    aria-selected="${String(o.selected === true)}"
  >
    ${o.children}
  </div>`;
}

export function listbox(o: ListboxOptions): SafeHtml {
  return html`<gmt-listbox
    id="${o.id}"
    class="${styles.root} ${o.className ?? ""}"
    role="listbox"
    tabindex="0"
    aria-label="${o.label}"
    ${gateAttr(o.gate)}
    >${o.items.map((item, index) =>
      listboxOption({
        id: listboxOptionId(o.id, index),
        index,
        value: item.value,
        selected: item.value === o.value,
        children: item.label,
      }),
    )}</gmt-listbox
  >`;
}

/** How far PageDown and PageUp move. */
const LISTBOX_PAGE = 10;

/** The index a navigation key moves to, or `current` for any other key. Pure. */
export function nextIndex(key: string, current: number, count: number): number {
  if (count <= 0) return current;
  const clamp = (i: number) => Math.min(Math.max(i, 0), count - 1);
  switch (key) {
    case "ArrowDown":
      return clamp(current + 1);
    case "ArrowUp":
      return clamp(current - 1);
    case "PageDown":
      return clamp(current + LISTBOX_PAGE);
    case "PageUp":
      return clamp(current - LISTBOX_PAGE);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return current;
  }
}

export class GmtListbox extends KitElement {
  #active = 0;
  #value = "";
  #count: number | undefined;

  /** Virtual mode: the total number of options, drawn or not. */
  get count(): number {
    return this.#count ?? this.#options().length;
  }
  set count(next: number | undefined) {
    this.#count = next;
    if (this.#active >= this.count) this.#active = Math.max(0, this.count - 1);
    this.sync();
  }

  /** Virtual mode: the value of the option at an index, drawn or not. */
  valueAt: (index: number) => string | undefined = (index) =>
    this.#optionAt(index)?.dataset.value;

  get activeIndex(): number {
    return this.#active;
  }
  set activeIndex(next: number) {
    this.#active = Math.min(Math.max(next, 0), Math.max(this.count - 1, 0));
    this.sync();
  }

  /** The chosen value; `""` for none. Setting it does not fire `change`. */
  get value(): string {
    return this.#value;
  }
  set value(next: string) {
    this.#value = next;
    this.sync();
  }

  /**
   * Bring the ARIA state in line with the active index and the value. Call it after the
   * options are redrawn. `aria-activedescendant` is only set while the active option is
   * in the DOM, so it never names an element that is not there.
   */
  sync(): void {
    const options = this.#options();
    const active = this.#optionAt(this.#active);
    for (const option of options) {
      option.setAttribute(
        "aria-selected",
        String(option.dataset.value === this.#value && this.#value !== ""),
      );
      if (option === active) option.dataset.active = "true";
      else delete option.dataset.active;
    }
    if (active) this.setAttribute("aria-activedescendant", active.id);
    else this.removeAttribute("aria-activedescendant");
  }

  #options(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  #optionAt(index: number): HTMLElement | undefined {
    return (
      this.querySelector<HTMLElement>(
        `[role="option"][data-index="${index}"]`,
      ) ?? undefined
    );
  }

  #move(next: number): void {
    if (next === this.#active) return;
    this.#active = next;
    this.sync();
    this.dispatchEvent(
      new CustomEvent<{ index: number }>("active", {
        bubbles: true,
        detail: { index: next },
      }),
    );
    this.#optionAt(next)?.scrollIntoView?.({ block: "nearest" });
  }

  #choose(index: number): void {
    const value = this.valueAt(index);
    if (value === undefined) return;
    this.#active = index;
    this.#value = value;
    this.sync();
    this.dispatchEvent(
      new CustomEvent<KitDetail<string>>("change", {
        bubbles: true,
        detail: { value },
      }),
    );
  }

  protected wire(signal: AbortSignal): void {
    // The builder marks the chosen option; take it as the starting value.
    const marked = this.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]',
    );
    if (this.#value === "" && marked?.dataset.value !== undefined)
      this.#value = marked.dataset.value;
    this.sync();
    this.addEventListener(
      "keydown",
      (event) => {
        if (event.target !== this) return;
        if (event.key === "Enter" || event.key === " ") {
          if (this.count === 0) return;
          event.preventDefault();
          this.#choose(this.#active);
          return;
        }
        const next = nextIndex(event.key, this.#active, this.count);
        if (next === this.#active && !isNavigationKey(event.key)) return;
        event.preventDefault();
        this.#move(next);
      },
      { signal },
    );
    this.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const option = target.closest<HTMLElement>('[role="option"]');
        if (!option || !this.contains(option)) return;
        const index = Number(option.dataset.index);
        if (Number.isFinite(index)) this.#choose(index);
      },
      { signal },
    );
  }
}

function isNavigationKey(key: string): boolean {
  return (
    key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "PageDown" ||
    key === "PageUp" ||
    key === "Home" ||
    key === "End"
  );
}
