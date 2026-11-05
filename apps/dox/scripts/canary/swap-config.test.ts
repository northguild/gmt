import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

// The provider only matters when the browsers start; loading Playwright would slow every row.
vi.mock("@vitest/browser-playwright", () => ({ playwright: () => ({}) }));
// Only the browser config's own choices are under test: its imports are stood in for, so each row
// does not load Vite and the whole base config again.
vi.mock("vitest/config", () => ({
  configDefaults: { exclude: ["**/node_modules/**"] },
  defineConfig: (config: unknown) => config,
  mergeConfig: (_base: unknown, config: unknown) => config,
}));
vi.mock("../../../../packages/gmt/vitest.config.ts", () => ({
  baseConfig: {},
  testInclude: [],
  default: {},
}));
vi.mock("../../../../packages/gmt/src/test/sourceTree.ts", () => ({
  REPO_FILES: [],
  repoFile: () => "",
  sourceTree: () => [],
}));

const BROWSER_CONFIG = pathToFileURL(
  path.resolve(
    import.meta.dirname,
    "../../../../packages/gmt/vitest.browser.config.ts",
  ),
).href;

const SWAP_CONFIG = pathToFileURL(
  path.resolve(
    import.meta.dirname,
    "../../../../packages/gmt/vitest.swap.config.ts",
  ),
).href;

type Config = {
  resolve?: { alias?: { find: RegExp; replacement: string }[] };
  test?: { env?: Record<string, string>; exclude?: string[] };
  optimizeDeps?: { exclude?: string[] };
};

async function loadBrowserConfig(temporal: string | undefined) {
  vi.resetModules();
  if (temporal === undefined) vi.stubEnv("GMT_TEMPORAL", undefined as never);
  else vi.stubEnv("GMT_TEMPORAL", temporal);
  return (await import(BROWSER_CONFIG)).default as Config;
}

describe(
  "vitest.browser.config GMT_TEMPORAL modes",
  { timeout: 30_000 },
  () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it.each`
      label      | mode
      ${"unset"} | ${undefined}
      ${"empty"} | ${""}
    `(
      "aliases to the native shim when GMT_TEMPORAL is $label",
      async ({ mode }) => {
        const config = await loadBrowserConfig(mode);
        expect(config.resolve?.alias).toHaveLength(1);
        expect(config.resolve?.alias?.[0]?.replacement).toMatch(
          /nativeTemporal\.ts$/,
        );
        expect(config.test?.env).toEqual({ GMT_NATIVE_TEMPORAL: "1" });
      },
    );

    it("adds no alias for GMT_TEMPORAL=polyfill", async () => {
      const config = await loadBrowserConfig("polyfill");
      expect(config.resolve?.alias).toEqual([]);
      expect(config.test?.env).toEqual({});
    });

    it("aliases to the swap entry for GMT_TEMPORAL=temporal-polyfill", async () => {
      const config = await loadBrowserConfig("temporal-polyfill");
      expect(config.resolve?.alias).toHaveLength(1);
      expect(config.resolve?.alias?.[0]?.replacement).toBe(
        "temporal-polyfill/full/implementation",
      );
      // `src/test/swapEntry.test.ts` runs only when this is set.
      expect(config.test?.env).toEqual({
        GMT_SWAP_ENTRY: "temporal-polyfill/full/implementation",
      });
    });

    // A browser has no child process, `process` or file system, so these Node-only harness
    // tests cannot load there (#441). Each is excluded by its package path and by its path from
    // the repository root, where scripts/native-suite.mjs starts Vitest (#462).
    it.each`
      label                  | mode
      ${"native"}            | ${undefined}
      ${"polyfill"}          | ${"polyfill"}
      ${"temporal-polyfill"} | ${"temporal-polyfill"}
    `(
      "leaves the Node-only harness tests out of the $label browser pass",
      async ({ mode }) => {
        const config = await loadBrowserConfig(mode);
        expect(config.test?.exclude).toEqual(
          expect.arrayContaining([
            "src/test/boundedChild.test.ts",
            "src/test/isolationGroups.test.ts",
            "src/test/sharedState.test.ts",
            "packages/gmt/src/test/boundedChild.test.ts",
            "packages/gmt/src/test/isolationGroups.test.ts",
            "packages/gmt/src/test/sharedState.test.ts",
          ]),
        );
        expect(config.test?.exclude).toContain("**/node_modules/**");
      },
    );

    // Only the swap job installs `temporal-polyfill`. Elsewhere Vite's dependency scan cannot
    // resolve it, gives up pre-bundling and reloads the page mid-run.
    it.each`
      label                  | mode                   | excluded
      ${"native"}            | ${undefined}           | ${["temporal-polyfill/full/implementation"]}
      ${"polyfill"}          | ${"polyfill"}          | ${["temporal-polyfill/full/implementation"]}
      ${"temporal-polyfill"} | ${"temporal-polyfill"} | ${undefined}
    `(
      "keeps the swap entry out of the dependency scan in the $label pass: $excluded",
      async ({ mode, excluded }) => {
        const config = await loadBrowserConfig(mode);
        expect(config.optimizeDeps?.exclude).toEqual(excluded);
      },
    );

    it("throws, naming the value and the accepted values, for GMT_TEMPORAL=bogus", async () => {
      await expect(loadBrowserConfig("bogus")).rejects.toThrow(
        /"bogus".*"polyfill".*"temporal-polyfill"/,
      );
    });
  },
);

describe("vitest.swap.config", () => {
  it("aliases the polyfill's specifier, and only that, to the swap entry", async () => {
    const config = (await import(SWAP_CONFIG)).default as Config;
    expect(config.resolve?.alias).toHaveLength(1);
    const [alias] = config.resolve?.alias ?? [];
    expect(alias?.replacement).toBe("temporal-polyfill/full/implementation");
    expect(alias?.find.test("@js-temporal/polyfill")).toBe(true);
    expect(alias?.find.test("@js-temporal/polyfill/extra")).toBe(false);
    expect(alias?.find.test("x@js-temporal/polyfill")).toBe(false);
  });

  it("hands the swap entry to the bounded child process through GMT_SWAP_ENTRY", async () => {
    const config = (await import(SWAP_CONFIG)).default as Config;
    expect(config.test?.env).toEqual({
      GMT_SWAP_ENTRY: "temporal-polyfill/full/implementation",
    });
  });
});
