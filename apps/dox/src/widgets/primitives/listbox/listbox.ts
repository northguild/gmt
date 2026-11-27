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
 *
 * Sound (DOX-G11): a step through the list plays the list step (`sound/list-step.ts`, Servo by
 * place), `listNext` going down and `listPrev` going up, pitched by the option it lands on. A key
 * that moves the active option plays one; at an end, where the key moves nothing, none. A reader's own scroll
 * (wheel, touch, scrollbar) plays one each time the top of the view passes into another row, the
 * row pitch measured from the drawn options; a scroll made for them is silent (`scrollTicks`,
 * `sound/scroll-ticks.ts`, which every scrolling list shares).
 *
 * A chosen option pings with the sonar ring of a focused control, since focus stays on the list
 * and never reaches it.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { stepTo } from "~/lib/sound/list-step";
import { scrollTicks, type ScrollTicks } from "~/lib/sound/scroll-ticks";
import { KitElement, type KitDetail } from "../base";
import styles from "./listbox.module.css";

/**
 * The root's class: background, border, radius and `overflow-y: auto`. A host
 * that renders its own `<gmt-listbox>` (the combobox's popup) composes it,
 * since the element has no styling of its own.
 */
export const listboxRootClass: string = styles.root;

interface ListboxItem {
  value: string;
  label: string;
  /** A note the list shows but does not let the reader choose. */
  disabled?: boolean;
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
  /** A note the list shows but cannot choose: it reads as disabled, and a key or click on it does nothing. */
  disabled?: boolean;
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
    ${o.disabled ? html`aria-disabled="true"` : ""}
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
        disabled: item.disabled === true,
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
  /** The ticks of the reader's own scroll; set while connected. */
  #ticks: ScrollTicks | undefined;

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
    this.#ticks?.quiet();
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

  /** The distance from one row to the next, from the drawn options; 0 when none is laid out. */
  #rowPitch(): number {
    const first = this.querySelector<HTMLElement>('[role="option"]');
    if (!first) return 0;
    const box = first.getBoundingClientRect();
    const index = Number(first.dataset.index);
    const next = this.#optionAt(index + 1)?.getBoundingClientRect();
    return next ? Math.abs(next.top - box.top) : box.height;
  }

  #move(next: number): void {
    if (next === this.#active) return;
    this.#ticks?.quiet();
    stepTo(next > this.#active, next, this.count);
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
    if (
      value === undefined ||
      this.#optionAt(index)?.getAttribute("aria-disabled") === "true"
    )
      return;
    this.#active = index;
    this.#value = value;
    this.sync();
    const chosen = this.#optionAt(index);
    if (chosen) ping(chosen);
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
    this.#ticks = scrollTicks(this, {
      rowPitch: () => this.#rowPitch(),
      signal,
    });
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

/**
 * Ping a chosen option: the sonar ring a focused control shows, which an option never gets, since
 * focus stays on the list. Starting again from the top on a second choice of the same option.
 */
function ping(option: HTMLElement): void {
  option.removeAttribute("data-ping");
  void option.offsetWidth;
  option.setAttribute("data-ping", "");
  option.addEventListener(
    "animationend",
    () => option.removeAttribute("data-ping"),
    { once: true },
  );
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
