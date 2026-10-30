/**
 * A shared, reusable analog clock: a thin 12-sided (dodecagon) outline around a dial, with hour
 * and minute hands, a small centre cap, and a clear ice-glass pane over the whole face.
 *
 * The face itself, its geometry and its style live in the clock family
 * (`~/widgets/families/clock/crystal-clock`), which draws it from the kit's `html` builder and a
 * CSS module. This module is the entry point the other widgets already import: it re-exports the
 * geometry and the types, gives the face back as a string (the multi-zone scrubber writes its
 * rows from strings), and owns the two runtime pieces that act on a face already on the page.
 *
 * - `bindClockGlow` wires the night-light toggle once, on a stable host.
 * - `updateCrystalClock` draws a face the first time, then moves only its hands and its name, so
 *   a tick neither replaces the face (which would drop focus and reset the night light) nor moves
 *   a box. The second hand turns forward only: its angle accumulates, so 59 to 0 does not spin
 *   back across the dial.
 */
import { html, setHtml } from "~/widgets/builders";
import {
  bindClockToggle,
  crystalClock,
  crystalClockName,
  crystalClockToggleName,
  handAngles,
  handTip,
  type CrystalClockOptions,
} from "~/widgets/families/clock/crystal-clock";

export {
  CLOCK_OUTER,
  CLOCK_VIEWBOX,
  handAngles,
  type CrystalClockHighlight,
  type CrystalClockOptions,
  type CrystalClockState,
  type HandAngles,
} from "~/widgets/families/clock/crystal-clock";

/** Wires the night-light toggle for every face inside `root`, present or future. */
export function bindClockGlow(root: HTMLElement, signal: AbortSignal): void {
  bindClockToggle(root, signal);
}

/** Draws `opts` into `host`: the whole face the first time, then only the hands and the name. */
export function updateCrystalClock(
  host: HTMLElement,
  opts: CrystalClockOptions,
): void {
  const svg = host.querySelector<SVGElement>("svg[data-clock-id]");
  if (svg === null) {
    setHtml(host, html`${crystalClock(opts)}`);
    return;
  }
  const { hourDeg, minuteDeg } = handAngles(opts.hour, opts.minute);
  const aim = (kind: "hour" | "minute", deg: number) => {
    const hand = svg.querySelector(`[data-hand="${kind}"]`);
    if (hand === null) return;
    const { x2, y2 } = handTip(kind, deg);
    hand.setAttribute("x2", x2);
    hand.setAttribute("y2", y2);
  };
  aim("hour", hourDeg);
  aim("minute", minuteDeg);
  const second = svg.querySelector<SVGElement>('[data-hand="second"]');
  if (second !== null && opts.second !== undefined) {
    const previous = Number(second.dataset["turn"] ?? 0);
    const target = opts.second * 6;
    const forward = (((target - previous) % 360) + 360) % 360;
    const next = previous + forward;
    if (forward !== 0) {
      second.dataset["turn"] = String(next);
      second.style.transform = `rotate(${next}deg)`;
    }
  }
  const name = crystalClockName(opts);
  const toggle = host.querySelector("[data-clock-toggle]");
  const named = toggle ?? (svg.hasAttribute("aria-label") ? svg : null);
  const full = toggle === null ? name : crystalClockToggleName(name);
  if (named !== null && named.getAttribute("aria-label") !== full) {
    named.setAttribute("aria-label", full);
  }
}
