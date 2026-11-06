import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

// Upgrade check (CORE-92, CORE-108): the same suite on the newest `temporal-polyfill` release (the
// candidate), behind the unchanged seam (`src/internal/temporal.ts`). The job installs the candidate
// under the npm alias `temporal-polyfill-candidate` in its own checkout, because installing it as
// `temporal-polyfill` would replace the pinned version the control pass runs on. The alias is never
// committed to a `package.json`, so running this config in an ordinary checkout fails to resolve
// the entry. That is the intended failure.

/** The swap pass's implementation: the candidate release, never the pinned one or the runtime's built-in Temporal. */
export const CANDIDATE_ENTRY =
  "temporal-polyfill-candidate/full/implementation";

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      // A bare specifier, resolved from this package, where the job installs the alias.
      alias: [
        {
          find: /^temporal-polyfill\/full\/implementation$/,
          replacement: CANDIDATE_ENTRY,
        },
      ],
    },
    // The bounded child process does not go through Vite; its resolve hook reads this.
    test: { env: { GMT_SWAP_ENTRY: CANDIDATE_ENTRY } },
  }),
);
