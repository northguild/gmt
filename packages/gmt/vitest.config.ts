import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { splitTestFiles } from "./src/test/isolationGroups.ts";

const here = import.meta.dirname;

/** Support running from repository root or package cwd. */
export const testInclude = [
  "packages/gmt/src/**/*.test.ts",
  "src/**/*.test.ts",
];

/**
 * Settings every run shares, including the browser run, which has no project split. It carries no
 * `include`: a project that extends the root would merge its own list into it.
 */
export const baseConfig = defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [path.resolve(here, "src/test/setupTests.ts")],
  },
});

// A file that replaces a module or a global runs in a fresh worker module graph. Every other file
// shares modules with its neighbours, so it skips the cost of importing the library again.
const { isolated } = splitTestFiles(here);

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    projects: [
      {
        extends: true,
        test: {
          name: "isolated",
          root: here,
          include: isolated,
          isolate: true,
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          root: here,
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...isolated],
          isolate: false,
          env: { GMT_SHARED_MODULES: "1" },
        },
      },
    ],
  },
});
