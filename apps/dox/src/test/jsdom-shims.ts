/**
 * The browser APIs jsdom 30 does not implement but the chat island and the
 * Tier 2 widgets call unconditionally.
 *
 * Imported explicitly by the test files that need it, never wired as a global
 * `setupFiles`: the great majority of this package's ~480 tests run in the
 * `node` environment (see `vitest.config.ts`), and a global setup would load
 * DOM shims into every one of them.
 *
 * Note there is no `environmentMatchGlobs` option to reach for here — it was
 * removed in Vitest 3, and this repo is on 4.x. Per-file
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
