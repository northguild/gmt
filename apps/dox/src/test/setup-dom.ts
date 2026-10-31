/**
 * The one global setup file. In every environment it restores what `vi` changed (spies, fake
 * timers, `vi.stubGlobal`, `vi.stubEnv`) after each test and fails a file that leaves other
 * global state behind (`leak-guard.ts`). In the `node` environment (about 480 tests) it loads no
 * DOM library; in a `@vitest-environment jsdom` file it also adds the jest-dom matchers, tears
 * down the widgets `renderWidget` mounted and resets the DOM (`reset-dom.ts`).
 *
 * The matchers are registered with this file's own `expect.extend`, not through
 * `@testing-library/jest-dom/vitest`. That entry extends an `expect` loaded from inside
 * node_modules, and with it loaded `rail-keyboard.test.tsx` fails (`rejects.toThrow(text)`
 * received an empty message). Test files must not import either one.
 *
 * It does not register Testing Library's React `cleanup`: `@testing-library/react`
 * registers `afterEach(cleanup)` itself on import when `globals` is true, and
 * `@testing-library/dom` has no cleanup to register.
 */
import type * as JestDomMatchers from "@testing-library/jest-dom/matchers";
import { afterEach, vi } from "vitest";
import { watchLeaks } from "./leak-guard";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
watchLeaks();

if (typeof document !== "undefined") {
  const { expect } = await import("vitest");
  // The package types the module with `export =`, so a dynamic import's type gains a
  // `default` member the runtime module does not have. The type-only import names the
  // matcher set itself.
  const matchers: typeof JestDomMatchers =
    await import("@testing-library/jest-dom/matchers");
  expect.extend(matchers);
  // `waitFor` and `findBy*` return the moment their check passes, so a longer ceiling costs
  // nothing when a test passes. The default 1 s was shorter than a cold `import()` of the
  // library and its polyfill on a loaded machine, which failed `playground-form-mount` once.
  const { configure } = await import("@testing-library/dom");
  configure({ asyncUtilTimeout: 5_000 });
  const { destroyLiveWidgets } = await import("./live-widgets");
  const { resetDom } = await import("./reset-dom");
  afterEach(() => {
    destroyLiveWidgets();
    resetDom();
  });
}
