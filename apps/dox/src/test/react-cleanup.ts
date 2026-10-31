/**
 * Unmounts what Testing Library's React `render` mounted, in every file that loaded it.
 *
 * `@testing-library/react` registers `afterEach(cleanup)` when the module is first evaluated. In
 * the shared project that happens once per worker, so every later file in the worker would keep
 * its components mounted, with their effects and window listeners (`react-cleanup.test.tsx`).
 *
 * The setup cannot simply import the package: loading it replaces `@testing-library/dom`'s
 * `asyncWrapper` with one that waits on a `setTimeout(0)`, which never fires under Vitest's fake
 * timers, so a file that renders no React but drives `user-event` under fake timers would hang
 * (`multi-zone-scrubber-mount.test.ts`). A changed `asyncWrapper` is how this module tells the
 * package is loaded. It is read once per worker, before any test file runs, so `plain` is the
 * `@testing-library/dom` default.
 */
import { getConfig } from "@testing-library/dom";

const plain = getConfig().asyncWrapper;

export async function cleanupReact(): Promise<void> {
  if (getConfig().asyncWrapper === plain) return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
}
