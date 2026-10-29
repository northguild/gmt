/**
 * The one global setup file. A no-op in the `node` environment (about 480 tests), so it
 * never loads a DOM library there; in a `@vitest-environment jsdom` file it adds the
 * jest-dom matchers and tears down the widgets `renderWidget` mounted.
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

if (typeof document !== "undefined") {
  const { expect } = await import("vitest");
  // The package types the module with `export =`, so a dynamic import's type gains a
  // `default` member the runtime module does not have. The type-only import names the
  // matcher set itself.
  const matchers: typeof JestDomMatchers =
    await import("@testing-library/jest-dom/matchers");
  expect.extend(matchers);
  const { destroyLiveWidgets } = await import("./live-widgets");
  afterEach(() => {
    destroyLiveWidgets();
  });
}
