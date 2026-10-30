/**
 * Scroll-into-view stagger reveal. Pairs with gmt-reveal.css: this module
 * only ever adds `gmt-reveal-in` to a `[data-reveal-group]` element once it
 * scrolls into view — the CSS owns the hidden state and the transition. The
 * script numbers each item once, in `--gmt-reveal-i`, and the CSS turns the number into a
 * transition delay.
 *
 * One observer for the whole page; called once from ScrollReveal.astro
 * regardless of how many components render a [data-reveal-group] marker.
 */
/** Writes each item's place in source order on it, before the group first shows. */
function numberItems(group: HTMLElement): void {
  const items = [...group.children].flatMap((child) =>
    child.classList.contains("card-grid") ? [...child.children] : [child],
  );
  items.forEach((item, index) => {
    (item as HTMLElement).style.setProperty("--gmt-reveal-i", String(index));
  });
}

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

  for (const group of groups) numberItems(group);

  /* The hidden state exists only from here: no script, no hiding. */
  document.documentElement.classList.add("gmt-reveal-ready");

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
