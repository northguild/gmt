/**
 * Scroll-into-view stagger reveal. Pairs with gmt-reveal.css: this module
 * only ever adds `gmt-reveal-in` to a `[data-reveal-group]` element once it
 * scrolls into view — the CSS owns the hidden state, the transition, and the
 * per-child stagger delay (nth-child based, so no per-element JS timing).
 *
 * One observer for the whole page; called once from ScrollReveal.astro
 * regardless of how many components render a [data-reveal-group] marker.
 */
export function initScrollReveal(root: ParentNode = document): void {
  const groups = root.querySelectorAll<HTMLElement>("[data-reveal-group]");
  if (groups.length === 0) return;

  const reduceMotion = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    for (const group of groups) group.classList.add("gmt-reveal-in");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("gmt-reveal-in");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
  );

  for (const group of groups) observer.observe(group);
}
