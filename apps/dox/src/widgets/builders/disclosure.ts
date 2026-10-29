/**
 * disclosure: a button that shows and hides a panel.
 *
 * Pattern: Disclosure https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/. The button
 * carries `aria-expanded` and `aria-controls`; Enter and Space are native. The panel is
 * `hidden` until opened. `label` is the button's name; with `iconOnly` it is kept for
 * assistive technology and the graphic stands for it.
 *
 * `wireDisclosure` is what makes it work: it toggles state on click, closes on Escape and
 * sends focus back to the button, and (with `light`) closes when a pointer lands outside or
 * focus moves to a real element outside. A `focusout` with no destination (a click on
 * non-focusable space) is ignored, so a pointer press inside the panel never closes it.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import { srOnly } from "./sr-only";
import styles from "./disclosure.module.css";

export interface DisclosureOptions extends GateOption {
  /** Unique id; the panel's id is `${id}-panel`. */
  id: string;
  /** The button's name. Required. */
  label: string;
  /** A graphic that stands for the label; the label is then for assistive technology only. */
  icon?: SafeHtml;
  /** The panel's content. */
  children: SafeHtml;
  /** Start open. */
  open?: boolean;
  /** Extra class on the root, from the caller's own module. */
  className?: string;
  /** Extra class on the button, from the caller's own module. */
  buttonClassName?: string;
}

export function disclosure(o: DisclosureOptions): SafeHtml {
  const open = o.open === true;
  return html`<div class="${styles.root} ${o.className ?? ""}" data-disclosure ${gateAttr(o.gate)}
    ><button
      class="${styles.button} ${o.buttonClassName ?? ""}"
      type="button"
      id="${o.id}"
      aria-expanded="${String(open)}"
      aria-controls="${o.id}-panel"
      >${
        o.icon === undefined
          ? o.label
          : html`<span aria-hidden="true" class="${styles.icon}">${o.icon}</span>${srOnly(o.label)}`
      }</button
    ><div class="${styles.panel}" id="${o.id}-panel" ${open ? "" : html`hidden`}>${o.children}</div></div
  >`;
}

export interface DisclosureWire {
  signal: AbortSignal;
  /** Close when a pointer lands outside, or focus moves to an element outside. */
  light?: boolean;
  onToggle?: (open: boolean) => void;
}

export interface DisclosureHandle {
  readonly open: boolean;
  set(open: boolean, restoreFocus?: boolean): void;
}

export function wireDisclosure(
  root: HTMLElement,
  o: DisclosureWire,
): DisclosureHandle {
  const button = root.querySelector<HTMLButtonElement>("button");
  const panel = root.querySelector<HTMLElement>(
    `[id="${button?.getAttribute("aria-controls")}"]`,
  );
  if (!button || !panel)
    throw new Error("disclosure markup is missing its button or panel");
  const { signal } = o;

  const set = (open: boolean, restoreFocus = false): void => {
    if (open === (button.getAttribute("aria-expanded") === "true")) return;
    button.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (!open && restoreFocus) button.focus();
    o.onToggle?.(open);
  };

  button.addEventListener(
    "click",
    () => set(button.getAttribute("aria-expanded") !== "true"),
    { signal },
  );
  root.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        event.stopPropagation();
        set(false, true);
      }
    },
    { signal },
  );
  if (o.light === true) {
    root.ownerDocument.addEventListener(
      "pointerdown",
      (event) => {
        if (event.target instanceof Node && !root.contains(event.target))
          set(false);
      },
      { signal },
    );
    root.addEventListener(
      "focusout",
      (event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !root.contains(next)) set(false);
      },
      { signal },
    );
  }
  return {
    get open() {
      return button.getAttribute("aria-expanded") === "true";
    },
    set,
  };
}
