/**
 * The browser APIs jsdom 30 does not implement but the chat island and the
 * Tier 2 widgets call unconditionally.
 *
 * Imported explicitly by the test files that need it, never wired as a global
 * `setupFiles`: the great majority of this package's ~480 tests run in the
 * `node` environment (see `vitest.config.ts`), and a global setup would load
 * DOM shims into every one of them. The one global setup file is `setup-dom.ts`,
 * which does nothing in node and adds only the jest-dom matchers in jsdom.
 *
 * Note there is no `environmentMatchGlobs` option to reach for here — it was
 * removed in Vitest 3, and this repo is on 5.x. Per-file
 * `@vitest-environment jsdom` docblocks are the supported route, and are
 * already the convention (`PlaygroundForm.test.ts`, `chat-warning.test.ts`).
 */

/** Call from a test file's top level, after the jsdom docblock. */
export function installJsdomShims(): void {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  /* Radix and the DST inspector's ticker both use pointer capture. jsdom
     implements the events but not the capture methods, so a drag throws
     before the handler under test ever runs. */
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {};
    Element.prototype.releasePointerCapture = function () {};
    Element.prototype.hasPointerCapture = function () {
      return false;
    };
  }

  /* cmdk (the reset clock's zone search) scrolls its active item into view on
     every selection change. jsdom has no layout, so the method is missing. */
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {};
  }

  /* Browsers stamp an event on the `performance.now()` clock. jsdom stamps it with the epoch, so
     code that subtracts `performance.now()` from `event.timeStamp` sets a timer of about 1.8e12 ms,
     which Node clamps to 1 ms with a `TimeoutOverflowWarning`. Move the stamp onto the browser clock. */
  const stamp = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp");
  if (
    stamp?.get &&
    !(stamp.get as { onBrowserClock?: boolean }).onBrowserClock
  ) {
    const read = stamp.get;
    const onBrowserClock = function (this: Event): number {
      const value = read.call(this) as number;
      return value > performance.timeOrigin
        ? value - performance.timeOrigin
        : value;
    };
    (onBrowserClock as { onBrowserClock?: boolean }).onBrowserClock = true;
    Object.defineProperty(Event.prototype, "timeStamp", {
      ...stamp,
      get: onBrowserClock,
    });
  }

  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        0,
      ) as unknown as number) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
  }
}
