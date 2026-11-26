/**
 * Test plumbing for `settings-control.test.ts` and `sound/control.test.ts` (not a `.test` file,
 * so the `dox-test/*` lint does not read it). It renders the control as SettingsControl.astro
 * does, from the same markup, and holds the one thing a test cannot reach as a person would:
 * jsdom has no popover, so the panel is shown as an open one and its `toggle` event, which the
 * browser sends, is sent by hand.
 */
import { settingsControl } from "~/components/settings-control";
import { renderHtml } from "~/widgets/test-fixture";
import { mountSettingsControl } from "./settings-control";

export interface SettingsFixture {
  destroy(): void;
  /** What the browser does when the popover opens or closes. */
  toggle(state: "open" | "closed"): void;
}

export function renderSettingsControl(): SettingsFixture {
  const fx = renderHtml(settingsControl());
  const popover = fx.host.querySelector<HTMLElement>("[popover]")!;
  // jsdom hides a `[popover]` that is not open, and a hidden control cannot take focus.
  popover.style.display = "grid";
  const destroy = mountSettingsControl(fx.host);
  return {
    destroy,
    toggle(state) {
      popover.dispatchEvent(
        Object.assign(new Event("toggle"), { newState: state }),
      );
    },
  };
}
