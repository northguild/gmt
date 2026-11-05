import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

// CORE-92 swap check: the same suite on `temporal-polyfill`, behind the unchanged seam
// (`src/internal/temporal.ts`). The package is installed only in the swap job's checkout and is
// never committed to a `package.json`, so running this config in an ordinary checkout fails to
// resolve the entry. That is the intended failure.

/** The swap pass's implementation: always the polyfill, never the runtime's built-in Temporal. */
export const SWAP_ENTRY = "temporal-polyfill/full/implementation";

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      // A bare specifier, resolved from this package, where the job installs it.
      alias: [{ find: /^@js-temporal\/polyfill$/, replacement: SWAP_ENTRY }],
    },
    // The bounded child process does not go through Vite; its resolve hook reads this.
    test: { env: { GMT_SWAP_ENTRY: SWAP_ENTRY } },
  }),
);
