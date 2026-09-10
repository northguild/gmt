import path from "node:path";
import { defineProject } from "vitest/config";

export default [
  defineProject({
    test: {
      name: "gmt",
      globals: true,
      environment: "node",
      root: "packages/gmt",
      include: ["src/**/*.test.ts"],
      setupFiles: [
        path.resolve(
          import.meta.dirname,
          "packages/gmt/src/test/setupTests.ts",
        ),
      ],
    },
  }),
  defineProject({
    test: {
      name: "dox",
      globals: true,
      environment: "node",
      root: "apps/dox",
      // DOX-C0 (#171): kept in sync with apps/dox/vitest.config.ts's `include`
      // — this list had drifted (missing src/**) before this story, which
      // meant a root-level `vitest run` silently skipped every src/ test.
      // DOX-C2 (#138) added worker/** the same way, deliberately, to avoid
      // reintroducing that drift for the Worker's own tests.
      include: [
        "scripts/**/*.test.ts",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "worker/**/*.test.ts",
      ],
      resolve: {
        alias: {
          "~": path.resolve(import.meta.dirname, "apps/dox/src"),
        },
      },
    },
  }),
];
