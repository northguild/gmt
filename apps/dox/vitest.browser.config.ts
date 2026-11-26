import path from "node:path";
import { defineConfig } from "vitest/config";
import { BROWSER_TEST_GLOB } from "./src/test/isolation.ts";

/**
 * The tests that launch a real browser (`*.browser.test.ts`). The default run leaves them out: the
 * Tests job installs no browser. The `dox-tables` check runs them in Chromium and WebKit, against
 * the built site, before `table-fit.mjs`, which uses what they test.
 */
export default defineConfig({
  resolve: {
    // Mirrors vitest.config.ts: a test that imports app code reaches it through `~/`.
    alias: { "~": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    globals: true,
    root: ".",
    environment: "node",
    include: [BROWSER_TEST_GLOB],
    // Launching Chromium can take several seconds on a cold runner.
    hookTimeout: 60_000,
    // The Day Ruler file runs its 16 tests concurrently, each on its own page. Four is the
    // runner's vCPU count; the other browser test files share those cores.
    maxConcurrency: 4,
  },
});
