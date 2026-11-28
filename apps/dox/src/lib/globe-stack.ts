/**
 * The hero's folded control stack: at rest only its info button shows (globe.module.css).
 *
 * A pointer over the stack, or keyboard focus in it, opens it by CSS alone, and the info button
 * then opens the credits as it always has. A tap has no hover to open the stack with, so a tap
 * on the folded info button opens the stack instead (`data-open`) and does not open the credits;
 * the next tap on it does. The tapped-open stack stays open until a press lands outside it or
 * Escape closes it, in its turn among the page's layers (esc-layers.ts: an open credits panel or
 * Look at bar inside it closes first).
 */
import { registerEscLayer } from "./esc-layers";

const OPEN = "data-open";

export function wireGlobeStack(stack: HTMLElement, signal: AbortSignal): void {
  const info = stack.querySelector<HTMLButtonElement>(
    ":scope > [popovertarget]",
  );
  if (!info) return;
  const doc = stack.ownerDocument;

  /* The pointer that pressed the info button: a mouse has hovered the stack open before its
     click, a finger or a pen has not. */
  let mouse = false;
  info.addEventListener(
    "pointerdown",
    (event) => {
      mouse = event.pointerType === "mouse";
    },
    { signal },
  );
  info.addEventListener(
    "click",
    (event) => {
      /* The stack shows already when it was tapped open, when the click comes from a key
         (`detail` 0: keyboard focus is on the button, and focus shows the stack), or when a
         mouse is over it. */
      const shown =
        stack.hasAttribute(OPEN) ||
        event.detail === 0 ||
        (mouse && stack.matches(":hover"));
      if (shown) return;
      /* Cancelling the click keeps the popover shut (HTML's popovertarget activation). */
      event.preventDefault();
      stack.setAttribute(OPEN, "");
    },
    { signal },
  );

  doc.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Node) || stack.contains(event.target))
        return;
      stack.removeAttribute(OPEN);
    },
    { signal, capture: true },
  );

  registerEscLayer(
    {
      el: stack,
      isOpen: () => stack.hasAttribute(OPEN),
      close: () => stack.removeAttribute(OPEN),
      opener: () => info,
    },
    signal,
    doc,
  );
}
