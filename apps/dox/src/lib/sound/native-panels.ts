/**
 * The open and close Felt slide for every native `[popover]` panel (the Settings panel, the data
 * credits, the chat's fine print).
 *
 * One capture-phase `toggle` listener on the document: `toggle` does not bubble, but it is
 * captured. The event fires after the panel has changed state, so a cancelled open is silent, and
 * it follows the reader's press, Escape or an outside press. A `popover="manual"` is not a panel
 * (the globe's tooltip is one), so it is silent, as it is for Escape (esc-native.ts). The buttons
 * with `popovertarget` carry `data-cue`, so the press ping does not double it; the header's
 * Settings gear is the one that pings as well, like the header links beside it.
 */
import { cue } from "./cue";

/** Start listening. Returns the way to stop; the engine calls it on destroy. */
export function watchNativePanels(): () => void {
  const controller = new AbortController();
  document.addEventListener(
    "toggle",
    (event) => {
      const el = event.target;
      if (
        !(el instanceof HTMLElement) ||
        !el.hasAttribute("popover") ||
        el.getAttribute("popover") === "manual"
      )
        return;
      cue((event as ToggleEvent).newState === "open" ? "open" : "close");
    },
    { capture: true, signal: controller.signal },
  );
  return () => controller.abort();
}
