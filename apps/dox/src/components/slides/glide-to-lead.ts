import { prefersReducedMotion } from "~/lib/reduced-motion";

/** How long the rail's body must hold its size before the glide starts. */
const SETTLE_MS = 200;

/**
 * Scrolls the rail's body so its widget's `[data-rail-lead]` sits at the top, smoothly unless the
 * reader asked for reduced motion. The widget draws after the rail opens and its sections open
 * with an animation, so this waits until the lead is there and the body has held its size for
 * `SETTLE_MS`: a scroll before that stops short, and a smooth one is cut off by the growth under
 * it. It scrolls once. Returns the cleanup that stops waiting.
 */
export function glideToLead(host: HTMLElement): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const glide = (): void => {
    const scroller = host.querySelector<HTMLElement>(".gmt-hive-artifact-body");
    const lead = scroller?.querySelector<HTMLElement>("[data-rail-lead]");
    if (!scroller || !lead) return;
    const top =
      scroller.scrollTop +
      lead.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top;
    if (scroller.scrollHeight - scroller.clientHeight < top) return;
    stop();
    scroller.scrollTo({
      top,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
  };
  const check = (): void => {
    // The body's height comes from its children, which grow as the widget draws.
    const scroller = host.querySelector<HTMLElement>(".gmt-hive-artifact-body");
    if (scroller) for (const child of scroller.children) sizes.observe(child);
    clearTimeout(timer);
    timer = setTimeout(glide, SETTLE_MS);
  };
  const watch = new MutationObserver(check);
  const sizes = new ResizeObserver(check);
  const stop = (): void => {
    watch.disconnect();
    sizes.disconnect();
    clearTimeout(timer);
  };
  watch.observe(host, { childList: true, subtree: true });
  check();
  return stop;
}
