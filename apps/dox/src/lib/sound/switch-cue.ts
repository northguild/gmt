/**
 * The Ice snap for every kit switch (`switchField`, src/widgets/builders/switch-field.ts).
 *
 * The switch's input carries `data-cue`. One capture-phase `change` listener on the document
 * cues `toggle` for it. A `change` event follows only a reader's action (a click, Space), never
 * a `checked` set from code, so a programmatic change is silent without any flag.
 */
import { cue } from "./cue";

let stop: (() => void) | undefined;

/** Start listening, once. Returns the way to stop, which tests use; the page never calls it. */
export function watchSwitchCue(): () => void {
  if (!stop) {
    const controller = new AbortController();
    document.addEventListener(
      "change",
      (event) => {
        const el = event.target;
        if (
          el instanceof HTMLInputElement &&
          el.getAttribute("role") === "switch" &&
          el.hasAttribute("data-cue")
        )
          cue("toggle");
      },
      { capture: true, signal: controller.signal },
    );
    stop = () => {
      controller.abort();
      stop = undefined;
    };
  }
  return stop;
}
