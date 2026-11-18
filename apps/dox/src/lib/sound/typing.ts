/**
 * The Data blip for typing: one capture-phase `keydown` listener on the document that plays `key`
 * whenever the reader types into a text field, anywhere on the site. No field opts in: the Dox
 * composer, the kit `textInput`, combobox inputs, the playground's rows, the search box and any
 * `<textarea>` or contenteditable all sound alike, because the field's kind decides.
 *
 * - A text field is a `<textarea>`, a contenteditable element, or an `<input>` of a text-entry
 *   type (`TYPED`). A read-only field takes no typing, so it is silent.
 * - A password field is silent: a sound per key tells anyone in earshot how long the password is.
 * - Printable keys and Backspace count. Enter counts only where it types a line, in a
 *   `<textarea>` or contenteditable (the composer's Enter also sends, and its blip sits under the
 *   Sonar launch); in a one-line `<input>` Enter submits or picks a combobox option, and those
 *   have their own cues.
 * - A held key (`repeat`), an input method mid-composition (`isComposing`, so CJK stays quiet) and
 *   a Ctrl or Meta chord are silent.
 *
 * The engine calls this on load and the returned function on destroy.
 */
import { cue } from "./cue";

/** The `<input>` types a reader types text into. `password` is left out on purpose (above). */
const TYPED = new Set(["text", "search", "email", "url", "tel", "number"]);

/** How a field takes a key: as a one-line field, a multi-line one, or not at all. */
function fieldKind(target: EventTarget | undefined): "line" | "lines" | null {
  if (target instanceof HTMLInputElement)
    return TYPED.has(target.type) && !target.readOnly ? "line" : null;
  if (target instanceof HTMLTextAreaElement)
    return target.readOnly ? null : "lines";
  if (target instanceof HTMLElement && target.isContentEditable) return "lines";
  return null;
}

export function watchTyping(): () => void {
  const controller = new AbortController();
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey)
        return;
      // The field itself, even inside a shadow root (the document sees its host).
      const kind = fieldKind(event.composedPath()[0]);
      if (!kind) return;
      if (
        event.key.length === 1 ||
        event.key === "Backspace" ||
        (event.key === "Enter" && kind === "lines")
      )
        cue("key");
    },
    { capture: true, signal: controller.signal },
  );
  return () => controller.abort();
}
