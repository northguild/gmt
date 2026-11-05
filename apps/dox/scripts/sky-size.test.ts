import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The night sky is decoration, so its code is held small: the meteor (`space-fx.ts`) and the sky
 * (`sky.ts` with `sky-math.ts`) are held to 4 KB (the meteor) and 5 KB (the sky, with the Sun and the Moon) minified and gzipped, as bundled alone.
 */

type BuildResult = {
  output: { type: string; code?: string }[];
};

async function size(entry: string): Promise<number> {
  /* Vite is a dependency of Astro, not of the app, so it is found from Astro's own install. */
  const viteFile = createRequire(
    createRequire(import.meta.url).resolve("astro/package.json"),
  ).resolve("vite");
  const { build } = (await import(pathToFileURL(viteFile).href)) as {
    build: (config: object) => Promise<unknown>;
  };
  const result = (await build({
    configFile: false,
    logLevel: "silent",
    root: process.cwd(),
    build: {
      write: false,
      minify: true,
      target: "es2022",
      lib: {
        entry: resolve(process.cwd(), entry),
        formats: ["es"],
        fileName: "out",
      },
    },
  })) as BuildResult | BuildResult[];
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (one) => one.output,
  );
  const code = outputs
    .filter((file) => file.type === "chunk")
    .map((file) => file.code ?? "")
    .join("");
  return gzipSync(code).length;
}

describe("night sky code size", () => {
  it.each([
    ["the meteor", "src/lib/space-fx.ts", 4096],
    ["the sky", "src/lib/sky.ts", 5120],
  ])(
    "keeps %s within its limit, minified and gzipped",
    async (_name, entry, limit) => {
      expect(await size(entry)).toBeLessThanOrEqual(limit);
    },
    30_000,
  );
});
