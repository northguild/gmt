/**
 * The mobile menu button's element. It is Starlight 0.41's `<starlight-menu-button>` with one
 * fix: `aria-expanded` lives on the inner `<button>`, the element that holds the role, so the
 * button announces "expanded" while the menu is open. Starlight 0.41 sets it on the custom
 * element, where no assistive technology reads it. Starlight 0.42 replaces the component with a
 * native `popovertarget` button, so `MobileMenuToggle.astro` and this module are deleted then
 * (`MobileMenuToggle.test.ts` fails once the installed version reaches 0.42).
 *
 * The menu takes part in the site's Escape order (`esc-layers.ts`); the button gets focus back.
 * A change of state plays the opening or closing Steel breath; the button carries
 * `data-cue` so the press ping stays out. A resize that closes the menu closes it, so it fades.
 */
import { registerEscLayer } from "./esc-layers";
import { cue } from "./sound/cue";

export class MenuButton extends HTMLElement {
  readonly btn = this.querySelector("button")!;

  constructor() {
    super();
    // The open and close Steel breath play for the menu (setExpanded), not the press ping.
    this.btn.setAttribute("data-cue", "");
    this.btn.addEventListener("click", () => this.toggleExpanded());

    // Escape closes the menu, in its turn among the page's layers.
    registerEscLayer({
      el: this,
      isOpen: () => this.btn.getAttribute("aria-expanded") === "true",
      close: () => this.setExpanded(false),
      opener: () => this.btn,
    });

    // Reset the menu when the viewport toggles between mobile and desktop sizes.
    matchMedia("(min-width: 50em)").addEventListener("change", () =>
      this.setExpanded(false),
    );
  }

  setExpanded(expanded: boolean) {
    const changed =
      (this.btn.getAttribute("aria-expanded") === "true") !== expanded;
    this.btn.setAttribute("aria-expanded", String(expanded));
    document.body.toggleAttribute("data-mobile-menu-expanded", expanded);
    // Trap keyboard focus inside the header and menu while it is open.
    document
      .querySelectorAll<HTMLElement>(".main-frame, .sl-skip-link")
      .forEach((el) => el.toggleAttribute("inert", expanded));
    if (changed) cue(expanded ? "open" : "close");
  }

  toggleExpanded() {
    this.setExpanded(this.btn.getAttribute("aria-expanded") !== "true");
  }
}

/** Registers `<starlight-menu-button>` once. */
export function defineMenuButton(): void {
  if (!customElements.get("starlight-menu-button")) {
    customElements.define("starlight-menu-button", MenuButton);
  }
}
