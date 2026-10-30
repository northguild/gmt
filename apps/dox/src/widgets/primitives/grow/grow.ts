/**
 * <gmt-grow>: wraps `smooth-height.ts` for a result region whose height changes.
 *
 * No role: it is layout only. The element has exactly one element child (the
 * inner box, from `grow()`). Its duration is `var(--gmt-motion-grow)`, which is 0
 * under reduced motion; at 0 the element does not attach the easing at all, so
 * the region snaps. `smooth-height.ts` also snaps when `prefers-reduced-motion`
 * is set or the tab is hidden, so the two agree.
 *
 * Replaces direct `smoothHeight` calls. `smoothHeight` ignores a second call for the
 * same element, and cleans up on `signal`, so a re-connect re-attaches.
 */
import { smoothHeight } from "~/lib/smooth-height";
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement } from "../base";
import styles from "./grow.module.css";

export function grow(children: SafeHtml, o: GateOption = {}): SafeHtml {
  return html`<gmt-grow class="${styles.root}" ${gateAttr(o.gate)}><div class="${styles.inner}">${children}</div></gmt-grow>`;
}

/** A CSS time (`0s`, `240ms`) in milliseconds; NaN when it is not one. */
export function cssTimeMs(value: string): number {
  const match = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(value);
  if (!match) return Number.NaN;
  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
}

export class GmtGrow extends KitElement {
  protected wire(signal: AbortSignal): void {
    const duration = cssTimeMs(
      getComputedStyle(this).getPropertyValue("--gmt-motion-grow"),
    );
    // 0 is the reduced-motion value: no easing. An unreadable token (no stylesheet,
    // as in a test) leaves the easing on; smooth-height guards itself.
    if (duration === 0) return;
    smoothHeight(this, signal);
  }
}
