/**
 * Types the jest-dom matchers `src/test/setup-dom.ts` registers, with their real signatures.
 *
 * Why this file exists. Vitest 5 types `expect(x)` as `Assertion<R, T>`, which extends its own
 * `Matchers<R, T>` and, through `vitest/node` (pulled in by `vitest.config.ts`), the Browser
 * Mode set `@vitest/browser/matchers` adds. That set names the same methods but takes a
 * Locator-era signature: `toHaveTextContent(text?: string | number)` rejects a RegExp. The
 * package's own `@testing-library/jest-dom/vitest` typing is written for Vitest 1 to 3
 * (`Assertion<T>`, one type parameter), so it never lands on the Vitest 5 interface, and
 * `@testing-library/jest-dom` in `tsconfig.json` `types` only augments the `jest` namespace,
 * which Vitest 5 does not read.
 *
 * TypeScript resolves a member that two bases both declare from the base listed first, and
 * `Matchers` is listed before anything an augmentation adds to `Assertion`. Extending
 * `Matchers` is therefore what makes these signatures the ones a call resolves to.
 */
import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  // The parameter list must repeat Vitest's own, so the merge is one interface.
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
