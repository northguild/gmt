/**
 * Fullscreen for the deck root alone, so the site header is not in it. While it is fullscreen the
 * deck holds a screen wake lock so a TV does not dim mid-talk: requested on entering and again when
 * the page becomes visible (the browser drops it when the page hides), released on leaving and when
 * the signal aborts. No API, or a refused request, does nothing and shows nothing.
 */
export interface DeckFullscreen {
  active(): boolean;
  enter(): void;
  toggle(): void;
}

export function mountDeckFullscreen(o: {
  root: HTMLElement;
  doc: Document;
  signal: AbortSignal;
  button: HTMLButtonElement | null;
  /** The polite region, told when the browser refuses. */
  live: HTMLElement;
}): DeckFullscreen {
  const { root, doc, button } = o;
  const active = (): boolean => doc.fullscreenElement === root;
  const can = typeof root.requestFullscreen === "function";
  if (!can && button) button.disabled = true;
  button?.setAttribute("aria-pressed", "false");
  const wakeLock: WakeLock | undefined = doc.defaultView?.navigator.wakeLock;
  let lock: WakeLockSentinel | null = null;
  const letGo = (): void => {
    const held = lock;
    lock = null;
    held?.release().catch(() => {});
  };
  const hold = async (): Promise<void> => {
    letGo();
    if (!wakeLock || !active()) return;
    try {
      const got = await wakeLock.request("screen");
      if (active() && !o.signal.aborted) {
        // A second request may have landed while this one was in flight; keep only the newest.
        letGo();
        lock = got;
      } else await got.release();
    } catch {
      // Refused (low battery, hidden page): the screen sleeps as it would have.
    }
  };
  const enter = (): void => {
    if (!can || active()) return;
    root.requestFullscreen().catch(() => {
      o.live.textContent = "Fullscreen is not available here";
    });
  };
  doc.addEventListener(
    "fullscreenchange",
    () => {
      root.toggleAttribute("data-fullscreen", active());
      button?.setAttribute("aria-pressed", String(active()));
      if (active()) void hold();
      else letGo();
    },
    { signal: o.signal },
  );
  doc.addEventListener(
    "visibilitychange",
    () => {
      if (doc.visibilityState === "visible" && active()) void hold();
    },
    { signal: o.signal },
  );
  o.signal.addEventListener(
    "abort",
    () => {
      root.removeAttribute("data-fullscreen");
      letGo();
    },
    { once: true },
  );
  return {
    active,
    enter,
    toggle: () => {
      if (active()) void doc.exitFullscreen();
      else enter();
    },
  };
}
