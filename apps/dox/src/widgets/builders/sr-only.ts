/**
 * srOnly: text for assistive technology only.
 *
 * `gmt-sr-only` is the one global class the kit writes (everything else is a CSS
 * Module class). It lives in the `gmt.base` layer of `gmt-primitives.css`, so a
 * builder, an Astro shell and a mount all share one definition.
 */
import { html, type SafeHtml } from "./html";

export function srOnly(text: string): SafeHtml {
  return html`<span class="gmt-sr-only">${text}</span>`;
}
