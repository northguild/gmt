/**
 * DOX-C3b (#139) — the contract every mountable widget implements.
 *
 * Types only, no runtime. Two functions per widget, deliberately separate:
 *
 *   `renderTemplate()` produces markup as a string, with no DOM access.
 *   `mount(root, args, signal)` wires markup that is already there.
 *
 * That split is what lets one source of truth serve both surfaces: the `.astro`
 * page server-renders `renderTemplate()` via `<Fragment set:html>`, and the chat
 * rail assigns the same string to `root.innerHTML` before mounting. The
 * alternative — having `mount()` build its own DOM — would convert
 * server-rendered HTML into client-generated HTML and lose the pre-JS readable
 * page that every Tier 2 widget currently has.
 */

/** What a mounted widget hands back to its host. */
export interface WidgetHandle {
  /**
   * Release everything this mount owns.
   *
   * Must be **idempotent** and must never throw — React StrictMode invokes
   * effect cleanup twice, and a rail can unmount a widget that is still
   * starting.
   *
   * Listeners bound to elements *inside* `root` do not need removing: the host
   * drops the subtree. Timers, intervals, observers, and anything bound to
   * `window` or `document` do.
   */
  destroy(): void;

  /** Current state as a permalink payload, or null when there is nothing
   *  addressable yet. See `widget-permalink.ts`. */
  getPermalinkState?(): Record<string, unknown> | null;
}

/**
 * A widget's mount function.
 *
 * `root` already contains `renderTemplate()`'s markup — `mount` never creates
 * chrome, only wires it.
 *
 * `signal` is the real answer to StrictMode, not `destroy()`. Every mount is
 * async (each awaits a dynamic import), and StrictMode runs the effect, cleans
 * up, and re-runs it *before the first mount's await settles* — so `destroy()`
 * would be called on a handle that does not exist yet. Implementations check
 * `signal.aborted` after each await and bail with an inert handle.
 */
export type MountFn<Args = void> = (
  root: HTMLElement,
  args: Args,
  signal: AbortSignal,
) => Promise<WidgetHandle>;

/**
 * The library could not be loaded, so the widget cannot work.
 *
 * Thrown by every mount when its dynamic `import()` of `@northguild/gmt`
 * fails — a dropped connection, a `dist/` mid-rebuild, a stale deploy. It used
 * to be swallowed: the mount returned an inert handle and the reader was left
 * with controls that looked live and did nothing. The distinction from any
 * other mount failure matters to the host: a load failure is worth a retry,
 * an argument the model invented is not.
 */
export class WidgetLoadError extends Error {
  override readonly name = "WidgetLoadError";
  constructor(cause: unknown) {
    super("The library for this widget could not be loaded.", { cause });
  }
}

/** A handle that owns nothing — what an aborted mount returns. */
export const INERT_HANDLE: WidgetHandle = {
  destroy() {},
  getPermalinkState: () => null,
};

/**
 * Wrap a `destroy` so calling it twice is safe.
 *
 * Every widget needs this and none of them should re-derive it.
 */
export function onceDestroy(
  destroy: () => void,
  getPermalinkState?: () => Record<string, unknown> | null,
): WidgetHandle {
  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        destroy();
      } catch (error) {
        // A failed teardown must not take the panel down with it — the host is
        // about to drop this subtree regardless.
        console.error("widget destroy failed", error);
      }
    },
    getPermalinkState: getPermalinkState ?? (() => null),
  };
}
