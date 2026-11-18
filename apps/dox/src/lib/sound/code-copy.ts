/**
 * The Glass clink for Starlight's code-block copy button.
 *
 * Expressive Code's markup is not ours, so the cue is one delegated `click` listener on
 * `.expressive-code .copy button`. A press there is a copy, so slice 1's press hook leaves it
 * to this listener (the selector is in its `data-cue` exception).
 */
import { cue } from "./cue";

export const CODE_COPY_SELECTOR = ".expressive-code .copy button";

/** Start listening. Returns the way to stop; the engine calls it on destroy. */
export function watchCodeCopy(): () => void {
  const controller = new AbortController();
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(CODE_COPY_SELECTOR)
      )
        cue("copy");
    },
    { capture: true, signal: controller.signal },
  );
  return () => controller.abort();
}
