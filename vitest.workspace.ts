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
        path.resolve(__dirname, "packages/gmt/src/test/setupTests.ts"),
      ],
    },
  }),
];
