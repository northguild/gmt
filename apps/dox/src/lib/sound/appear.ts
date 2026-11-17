/**
 * The arrival cues (DOX-G11): a page globe that comes into view plays the Steel horizon
 * (`appearGlobe`), and a feature map whose drawing comes into view the Sonar dawn (`appearMap`).
 *
 * Each element sounds once per page view, when a quarter of it first comes into view, and only
 * after the reader's first gesture on this page. One already on screen before that gesture stays
 * silent for good: it is part of the page the reader arrived at, not something arriving, and a
 * swell that starts on their first click would sound like the click's. The cue is not retried
 * either: one that is not heard (muted, or audio not started) is dropped like every other cue.
 *
 * Under reduced motion it plays nothing: the sound doubles the arrival animation (`enter.ts`),
 * which reduced motion removes, as the landing's entrance sounds and the sidebar's arrival cue do.
 */
import { cue, type CueName } from "./cue";

/** How much of the element is in view when it has arrived. */
const IN_VIEW = 0.25;

type ActivationNavigator = Navigator & {
  userActivation?: { hasBeenActive: boolean };
};

/**
 * Whether the reader has made a gesture on this page. A browser without `userActivation` cannot
 * say; the cue is then up to the engine, which is silent until a gesture or an in-site arrival
 * starts the audio.
 */
function gestured(): boolean {
  return (
    (navigator as ActivationNavigator).userActivation?.hasBeenActive ?? true
  );
}

/** Play `name` once, the first time `el` comes into view. `signal` ends the watch unheard. */
export function cueOnAppear(
  el: Element,
  name: Extract<CueName, "appearGlobe" | "appearMap">,
  signal: AbortSignal,
): void {
  if (signal.aborted || typeof IntersectionObserver !== "function") return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (!gestured()) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
        return;
      cue(name);
    },
    { threshold: IN_VIEW },
  );
  observer.observe(el);
  signal.addEventListener("abort", () => observer.disconnect(), {
    once: true,
  });
}
