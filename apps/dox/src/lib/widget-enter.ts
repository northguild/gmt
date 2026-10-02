/**
 * The arrival gesture for a tool's numbered cards.
 *
 * Each numbered step of a teaching widget is its own card in the widget's
 * responsive grid (styles/gmt-widget.css), so each one arrives rather than the
 * widget appearing as a single slab. The gesture itself is the site's shared
 * one — `enter()` from lib/enter.ts, a fade from 92% scale on the spring curve,
 * the same arrival the globe and the Crossing Clock faces perform. Nothing new
 * is invented here; this module only decides which elements get it and in what
 * order.
 *
 * The cards are staggered in DOM order, which is reading order, so a three-card
 * row resolves left to right instead of flashing at once. The stagger restarts
 * per widget: two widgets on one page each begin at their own first card rather
 * than the second compounding the first's delay.
 *
 * Only `transform` and `opacity` move. Neither affects layout, so a card's
 * entrance cannot change the page's height — which keeps it clear of
 * `smoothHeight`'s height easing on the same elements (cards 2 and later are
 * `.gmt-grow` hosts) and of the frame-to-frame height budget that
 * scripts/grow-measure.mjs asserts.
 *
 * Measured, at 2560px on Billing Deadlines and Delivery Scheduler: this gesture
 * costs nothing detectable. A load with it and a load without it both sit at a
 * 16.7 ms median with 14 to 16 frames over 32 ms. Those frames are the height
 * easing the sections do as the mount fills them, not this — the same load with
 * every animation off is 2 frames over 32 ms. Worth knowing before this is
 * blamed for a choppy load.
 *
 * `enter()` is idempotent per element (it guards on `data-entered`) and resolves
 * immediately under `prefers-reduced-motion: reduce`, so calling this twice over
 * the same scope, or for a reader who has asked for less motion, is a no-op.
 *
 * No gmt import, no `dox-tools`, no `zod`, no `ai`.
 */
import { enter } from "./enter";

/**
 * The class `Head.astro`'s inline script puts on `<html>` before the first
 * paint, and the one rule in `gmt-primitives.css` that reads it: while it is
 * set, a numbered card that has not yet entered is transparent. That is what
 * stops a server-rendered card painting visible and then dropping out for its
 * entrance. It is never set without script, or under reduced motion.
 */
export const ENTER_HOLD_CLASS = "gmt-enter-hold";

/** Gap between one card's entrance and the next. */
export const CARD_STAGGER_MS = 70;

/**
 * Play the arrival gesture on every numbered card within `scope`, staggered in
 * reading order and restarting per widget.
 */
export function enterWidgetSections(scope: ParentNode): void {
  for (const card of scope.querySelectorAll<HTMLElement>(".gmt-widget-card")) {
    const sections = card.querySelectorAll<HTMLElement>(
      ":scope > .gmt-widget-section",
    );
    sections.forEach((section, index) => {
      enter(section, { delayMs: index * CARD_STAGGER_MS });
    });
  }
}

/**
 * Lift the first-paint hold. Call it in the same task as `enterWidgetSections`:
 * every held card has by then taken `.gmt-enter` (transparent through its
 * stagger delay) or `data-entered`, so no frame can paint one visible in
 * between. A timer in the inline script lifts it too if this never runs.
 */
export function releaseEntranceHold(
  root: HTMLElement = document.documentElement,
): void {
  root.classList.remove(ENTER_HOLD_CLASS);
}
