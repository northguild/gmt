/**
 * Scroll-triggered reveal primitive (DOX-D2).
 *
 * A general-purpose entrance for panel chrome and mounted widgets — a card
 * scrolling into view, a widget appearing in a rail. An IntersectionObserver
 * toggles `.revealed` on `.gmt-reveal` elements; the CSS in gmt-motion.css owns
 * the transition. When the revealed element is a glass panel it also gets a
 * single `.scanline-active` sweep as it arrives.
 *
 * It reveals ELEMENTS, not characters. There is deliberately no text/chunk API
 * and no `push()` — Tier 6 renders replies with Streamdown, which handles
 * progressive markdown itself, and a typewriter layer would fight it. See
 * context/dox/reference/visual-design.md §Motion.
 *
 * One-shot: once an element is revealed it is unobserved and never reset.
 * Every navigation is a full page load (no ClientRouter), so a module-level
 * init guard is all the lifecycle management this needs.
 */

const REVEAL_SELECTOR = ".gmt-reveal";
const PANEL_SELECTOR = ".gmt-glass, .gmt-widget-card";
const MAX_REVEAL_DELAY_MS = 1000;

let started = false;

/**
 * Observe every `.gmt-reveal` element and reveal it when it scrolls into view.
 * Safe to call more than once; only the first call does anything.
 */
export function initRevealPrimitive(): void {
  if (typeof window === "undefined" || started) {
    return;
  }
  started = true;

  const targets = document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR);
  if (targets.length === 0) {
    return;
  }

  // Reduced motion: reveal everything now, no transition, no observer.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((el) => el.classList.add("revealed"));
    return;
  }

  const scanlineMs =
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--gmt-motion-scanline-duration",
      ),
      10,
    ) || 600;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        reveal(el, scanlineMs);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );

  targets.forEach((el) => observer.observe(el));
}

function reveal(el: HTMLElement, scanlineMs: number): void {
  const delay = clampDelay(el.getAttribute("data-reveal-delay"));
  window.setTimeout(() => {
    el.classList.add("revealed");
    if (el.matches(PANEL_SELECTOR)) {
      el.classList.add("scanline-active");
      window.setTimeout(
        () => el.classList.remove("scanline-active"),
        scanlineMs,
      );
    }
  }, delay);
}

function clampDelay(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.min(n, MAX_REVEAL_DELAY_MS);
}
