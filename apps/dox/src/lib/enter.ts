/**
 * The site's arrival gesture, shared: a 0.5s fade from 92% scale on the
 * spring curve, first performed by the globe. `.gmt-enter` and its tokens live
 * in `gmt-primitives.css` and `gmt-tokens.css`; this module only decides when
 * an element enters.
 *
 * Content is never hidden before script runs. The hidden state comes from the
 * `data-enter="pending"` attribute or the `.gmt-enter` class, and only this
 * module sets either, so a page whose script stalls renders as it was served.
 * A held element is released by a timer even if nobody calls `enter()`.
 *
 * No gmt import, no `dox-tools`, no `zod`, no `ai`.
 */

/** Long enough for the 0.5s entrance plus a stagger to finish on a busy main thread. */
const SETTLE_MS = 1500;

export interface EnterOptions {
  /** Start the entrance this many ms late, to stagger it after a sibling's. */
  delayMs?: number;
  /** Runs once the element has fully entered, or at once under reduced motion. */
  onEntered?: () => void;
}

function reducedMotion(): boolean {
  return (
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/**
 * Play the entrance once on `el`. A second call while it plays, or after it
 * has entered, does nothing. At rest the element carries `data-entered` and
 * neither the class nor the pending attribute, so it is back to its own styles.
 */
export function enter(el: HTMLElement, options: EnterOptions = {}): void {
  if (el.hasAttribute("data-entered") || el.classList.contains("gmt-enter")) {
    return;
  }
  const { delayMs = 0, onEntered } = options;

  let done = false;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    el.removeEventListener("animationend", onEnd);
    el.classList.remove("gmt-enter");
    el.style.removeProperty("--gmt-enter-delay");
    el.setAttribute("data-entered", "");
    onEntered?.();
  };
  const onEnd = (event: AnimationEvent) => {
    if (event.target === el && event.animationName === "gmt-enter") finish();
  };

  el.removeAttribute("data-enter");
  if (reducedMotion()) {
    // `.gmt-enter` is `animation: none` here, so no animationend would come.
    finish();
    return;
  }

  el.style.setProperty("--gmt-enter-delay", `${delayMs}ms`);
  el.addEventListener("animationend", onEnd);
  el.classList.add("gmt-enter");
  /* A timer as well: animationend does not fire for an element that is not
     rendered, or while the document timeline is paused, and onEntered may arm
     controls the reader needs. */
  fallback = setTimeout(finish, delayMs + SETTLE_MS);
}

/**
 * Hide `el` until a later `enter()`, for content that is ready before the
 * moment it should arrive (the globe's zone list waits for the globe). Returns
 * a release that calls `enter()`; the timer releases it anyway after `maxMs`,
 * so a failed or abandoned mount never leaves it hidden.
 */
export function holdEntrance(
  el: HTMLElement,
  maxMs = SETTLE_MS,
): (options?: EnterOptions) => void {
  if (el.hasAttribute("data-entered") || reducedMotion()) {
    return () => {};
  }
  el.setAttribute("data-enter", "pending");
  const timer = setTimeout(() => enter(el), maxMs);
  return (options) => {
    clearTimeout(timer);
    enter(el, options);
  };
}
