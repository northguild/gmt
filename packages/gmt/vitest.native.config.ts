import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

// The same suite on the host's native Temporal: the polyfill's specifier resolves to the shim.
export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: [
        {
          find: /^@js-temporal\/polyfill$/,
          replacement: path.resolve(
            import.meta.dirname,
            "src/test/nativeTemporal.ts",
          ),
        },
      ],
    },
    test: { env: { GMT_NATIVE_TEMPORAL: "1" } },
  }),
);
