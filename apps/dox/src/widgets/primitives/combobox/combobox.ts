/**
 * <gmt-combobox>: an editable text box with a popup list of choices that narrow as
 * you type, and an optional button that browses every choice.
 *
 * Pattern: Combobox with list autocomplete
 * https://www.w3.org/WAI/ARIA/apg/patterns/combobox/. Focus stays in the input, which
 * is `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`.
 * ArrowDown opens the list or moves down, ArrowUp moves up, Alt+ArrowDown opens it,
 * Enter chooses the active option (or an exact match that was typed), Escape closes,
 * Tab closes and moves on. The list shows every match and scrolls; it is never cut short.
 *
 * It is the control of a `field()`, which writes the `<label for>`. The list inside is a
 * `<gmt-listbox>` that the element drives; focus never enters it.
 *
 * `items` is the full list. `value` is the text in the box. Events, bubbling:
 * `change` with `detail.value` when a choice is made, and `openchange` with
 * `detail.open` when the list opens or shuts, by any route.
 */
import { html, setHtml, type SafeHtml } from "../../builders/html";
import { gateAttr, type GateOption } from "../../builders/gate";
import { KitElement, type KitDetail } from "../base";
import {
  listboxOption,
  listboxOptionId,
  type GmtListbox,
} from "../listbox/listbox";
import styles from "./combobox.module.css";

interface ComboboxOptions extends GateOption {
  /** The input's id; the field's `<label for>` points at it. */
  id: string;
  /** The field's label text; the popup list is named from it. Required. */
  label: string;
  items: readonly string[];
  value?: string;
  placeholder?: string;
  /** The hint's id from `field()`. */
  describedBy?: string | undefined;
  /** Adds a button with this name that opens and shuts the full list. */
  browseLabel?: string;
  /**
   * Which side of the input the list opens on. `above` is for a box that sits in the lower
   * half of a fixed-height column, where there is no room below it. Default `below`.
   */
  placement?: "above" | "below";
}

const listId = (id: string): string => `${id}-list`;

export function combobox(o: ComboboxOptions): SafeHtml {
  const list = listId(o.id);
  return html`<gmt-combobox class="${styles.root}" data-placement="${o.placement ?? "below"}" ${gateAttr(o.gate)}
    ><div class="${styles.bar}"
      ><input
        class="${styles.input}"
        id="${o.id}"
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded="false"
        aria-controls="${list}"
        ${o.value === undefined ? "" : html`value="${o.value}"`}
        ${o.placeholder === undefined ? "" : html`placeholder="${o.placeholder}"`}
        ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
      />${
        o.browseLabel === undefined
          ? ""
          : html`<button
            class="${styles.browse}"
            type="button"
            tabindex="-1"
            aria-label="${o.browseLabel}"
            aria-expanded="false"
            aria-controls="${list}"
          >
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
          </button>`
      }</div
    ><div class="${styles.popup}" hidden
      ><gmt-listbox
        id="${list}"
        class="${styles.list}"
        role="listbox"
        tabindex="-1"
        aria-label="${o.label} suggestions"
        >${o.items.map((item, index) =>
          listboxOption({
            id: listboxOptionId(listId(o.id), index),
            index,
            value: item,
            children: item,
          }),
        )}</gmt-listbox
      ></div
    ></gmt-combobox
  >`;
}

/** How long a blur waits before it closes the list, so a click on an option still lands. */
const BLUR_CLOSE_MS = 120;

export class GmtCombobox extends KitElement {
  #items: readonly string[] = [];
  #shown: string[] = [];
  #open = false;
  #active = -1;
  /** Focusing the input opens the list; `toggle` closing it must not undo itself. */
  #focusOpens = true;
  #blurTimer: ReturnType<typeof setTimeout> | undefined;

  get #input(): HTMLInputElement {
    const input = this.querySelector("input");
    if (!input) throw new Error("gmt-combobox has no input");
    return input;
  }
  get #list(): GmtListbox {
    const list = this.querySelector<GmtListbox>("gmt-listbox");
    if (!list) throw new Error("gmt-combobox has no list");
    return list;
  }
  get #popup(): HTMLElement {
    const popup = this.#list.parentElement;
    if (!popup) throw new Error("gmt-combobox has no popup");
    return popup;
  }
  get #browse(): HTMLButtonElement | null {
    return this.querySelector("button");
  }

  get items(): readonly string[] {
    return this.#items;
  }
  set items(next: readonly string[]) {
    this.#items = next;
    if (this.#open) this.#draw();
  }

  get value(): string {
    return this.#input.value;
  }
  set value(next: string) {
    this.#input.value = next;
  }

  get open(): boolean {
    return this.#open;
  }

  /** Open the list if it is shut and shut it if it is open; focus ends in the input. */
  toggle(): void {
    this.#clearBlur();
    if (this.#open) {
      this.#close();
      this.#focusOpens = false;
      this.#input.focus();
      this.#focusOpens = true;
    } else {
      this.#openList();
      this.#input.focus();
    }
  }

  #clearBlur(): void {
    if (this.#blurTimer !== undefined) clearTimeout(this.#blurTimer);
    this.#blurTimer = undefined;
  }

  #setOpen(next: boolean): void {
    this.#popup.hidden = !next;
    this.#input.setAttribute("aria-expanded", String(next));
    this.#browse?.setAttribute("aria-expanded", String(next));
    if (next === this.#open) return;
    this.#open = next;
    this.dispatchEvent(
      new CustomEvent<{ open: boolean }>("openchange", {
        bubbles: true,
        detail: { open: next },
      }),
    );
  }

  #draw(): void {
    const query = this.#input.value.trim().toLowerCase();
    this.#shown = query
      ? this.#items.filter((item) => item.toLowerCase().includes(query))
      : [...this.#items];
    const list = this.#list;
    setHtml(
      list,
      html`${this.#shown.map((item, index) =>
        listboxOption({
          id: listboxOptionId(list.id, index),
          index,
          value: item,
          children: item,
        }),
      )}`,
    );
    list.count = this.#shown.length;
    list.valueAt = (index) => this.#shown[index];
    this.#setActive(-1);
  }

  #openList(): void {
    this.#draw();
    this.#setOpen(this.#shown.length > 0);
  }

  #close(): void {
    this.#setOpen(false);
    this.#setActive(-1);
  }

  #setActive(index: number): void {
    this.#active = index;
    const list = this.#list;
    if (index >= 0) list.activeIndex = index;
    const option =
      index >= 0
        ? list.querySelector<HTMLElement>(
            `[role="option"][data-index="${index}"]`,
          )
        : null;
    // The list marks the active option itself; with none active, clear its mark.
    if (index < 0)
      for (const el of list.querySelectorAll<HTMLElement>("[data-active]"))
        delete el.dataset.active;
    if (option) {
      this.#input.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView?.({ block: "nearest" });
    } else {
      this.#input.removeAttribute("aria-activedescendant");
    }
    list.removeAttribute("aria-activedescendant");
  }

  #move(step: 1 | -1): void {
    if (this.#shown.length === 0) return;
    const count = this.#shown.length;
    const from = this.#active < 0 ? (step === 1 ? -1 : 0) : this.#active;
    this.#setActive((from + step + count) % count);
  }

  #choose(value: string): void {
    this.#input.value = value;
    this.#close();
    this.dispatchEvent(
      new CustomEvent<KitDetail<string>>("change", {
        bubbles: true,
        detail: { value },
      }),
    );
  }

  protected wire(signal: AbortSignal): void {
    const input = this.#input;
    const list = this.#list;
    list.valueAt = (index) => this.#shown[index];
    // The builder drew every choice into the list; they are the starting items.
    if (this.#items.length === 0)
      this.#items = [
        ...list.querySelectorAll<HTMLElement>('[role="option"]'),
      ].map((option) => option.dataset.value ?? "");

    input.addEventListener("input", () => this.#openList(), { signal });
    input.addEventListener(
      "focus",
      () => {
        this.#clearBlur();
        if (this.#focusOpens) this.#openList();
      },
      { signal },
    );
    input.addEventListener(
      "blur",
      () => {
        this.#clearBlur();
        this.#blurTimer = setTimeout(() => this.#close(), BLUR_CLOSE_MS);
      },
      { signal },
    );
    input.addEventListener(
      "keydown",
      (event) => {
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            if (!this.#open) this.#openList();
            else if (!event.altKey) this.#move(1);
            break;
          case "ArrowUp":
            event.preventDefault();
            if (!this.#open) this.#openList();
            this.#move(-1);
            break;
          case "Enter": {
            const typed = input.value.trim();
            const active =
              this.#active >= 0 ? this.#shown[this.#active] : undefined;
            if (this.#open && active !== undefined) {
              event.preventDefault();
              this.#choose(active);
            } else if (this.#items.includes(typed)) {
              this.#choose(typed);
            }
            break;
          }
          case "Escape":
            if (this.#open) {
              event.preventDefault();
              this.#close();
            }
            break;
          case "Tab":
            this.#close();
            break;
          default:
        }
      },
      { signal },
    );
    // Keep focus in the input while a pointer picks an option.
    list.addEventListener("mousedown", (event) => event.preventDefault(), {
      signal,
    });
    list.addEventListener(
      "change",
      (event) => {
        event.stopPropagation();
        const value = (event as CustomEvent<KitDetail<string>>).detail.value;
        this.#choose(value);
      },
      { signal },
    );
    this.#browse?.addEventListener("click", () => this.toggle(), { signal });
    signal.addEventListener("abort", () => this.#clearBlur());
  }
}
