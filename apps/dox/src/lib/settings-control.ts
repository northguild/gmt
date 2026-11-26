/**
 * Wires the header's settings control (`components/settings-control.ts`).
 *
 * - The gear button opens the popover (`popovertarget`, the browser's). Its `aria-expanded`
 *   follows the popover's `toggle` event, and opening moves focus to the first control, the
 *   "Dark theme" switch; Escape and focus return are the browser's and `esc-native.ts`'s.
 * - The theme switch is `theme.ts`'s; its Ice snap is the kit switch's own (`switch-cue.ts`).
 * - Mute, the fader and Aura are `sound/control.ts`'s.
 *
 * Every listener is on one `AbortController`; the returned function is `destroy()`.
 */
import { mountSoundControl } from "./sound/control";
import { mountThemeSwitch } from "./theme";

export function mountSettingsControl(root: ParentNode = document): () => void {
  const pop = root.querySelector<HTMLElement>("#gmt-settings-pop");
  const theme = root.querySelector<HTMLInputElement>("#gmt-theme-dark");
  if (!pop || !theme) return () => {};
  const trigger = root.querySelector<HTMLButtonElement>(
    "[popovertarget='gmt-settings-pop']",
  );

  const controller = new AbortController();
  const { signal } = controller;
  mountThemeSwitch(theme, signal);
  signal.addEventListener("abort", mountSoundControl(pop), { once: true });

  pop.addEventListener(
    "toggle",
    (event) => {
      const open = (event as ToggleEvent).newState === "open";
      trigger?.setAttribute("aria-expanded", String(open));
      // A popover does not take focus by itself: the first control is where a keyboard reader
      // goes next. Escape returns focus to the button (the browser, and `esc-native.ts`).
      if (open) theme.focus();
    },
    { signal },
  );

  return () => controller.abort();
}
