import { defineProject } from "vitest/config";

export default [
  defineProject({
    test: {
      name: "gmt",
      globals: true,
      environment: "node",
      root: "packages/gmt",
      include: ["src/**/*.test.ts"],
    },
  }),
];
