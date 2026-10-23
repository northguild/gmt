import { defineConfig } from "tsdown";

/**
 * One output file per source file, at the same path under `dist/`, so the `exports` map and
 * deep imports keep working and consumers can tree-shake per module. Nothing is bundled
 * together or minified, though Rolldown may inline a constant used once. Relative imports are
 * written with their full output path.
 * Declarations come from the TypeScript compiler (the sources do not use `isolatedDeclarations`).
 */
export default defineConfig({
  entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/test/**"],
  tsconfig: "tsconfig.build.json",
  unbundle: true,
  format: "esm",
  platform: "neutral",
  target: "esnext",
  outDir: "dist",
  clean: true,
  minify: false,
  dts: true,
  sourcemap: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  deps: { neverBundle: true },
});
