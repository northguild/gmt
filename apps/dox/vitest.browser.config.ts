import { defineConfig } from "vitest/config";
import { BROWSER_TEST_GLOB } from "./src/test/isolation.ts";

/**
 * The tests that launch a real browser (`*.browser.test.ts`). The default run leaves them out: the
 * Tests job installs no browser. The `dox-tables` check runs them in Chromium, before
 * `table-fit.mjs`, which uses what they test.
 */
export default defineConfig({
  test: {
    globals: true,
    root: ".",
    environment: "node",
    include: [BROWSER_TEST_GLOB],
    // Launching Chromium can take several seconds on a cold runner.
    hookTimeout: 60_000,
  },
});
