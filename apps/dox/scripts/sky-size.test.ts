import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The night sky is decoration, so its code is held small, minified and gzipped as bundled alone:
 * the meteor (`space-fx.ts`) to 4,096 bytes, and the sky (`sky.ts` with `sky-math.ts`, the Sun and
 * the Moon, the band and the stars, kept off the solid Earth) to 5,248 bytes (the layer hook and the stars' shared law). The Moon's
 * and the Sun's painters, the planets' layer (`sky-planets.ts` with its series, laws and
 * ephemeris) and a close pass's states (`sky-pass.ts`, loaded only inside the pass's window) are lazy
 * chunks of their own, each held to a limit; the planets' is what its entry loads statically.
 */

type Chunk = {
  type: string;
  code?: string;
  fileName: string;
  isEntry?: boolean;
  imports?: string[];
};
type BuildResult = { output: Chunk[] };

/**
 * The chunks the entry loads statically: the entry chunk and what it imports, and what those
 * import. A chunk reached only through a dynamic `import()` is a lazy chunk with a row of its own.
 */
function staticChunks(chunks: Chunk[]): Chunk[] {
  const byName = new Map(chunks.map((one) => [one.fileName, one]));
  const seen = new Set<string>();
  const walk = (name: string): void => {
    if (seen.has(name) || !byName.has(name)) return;
    seen.add(name);
    byName.get(name)!.imports?.forEach(walk);
  };
  chunks.filter((one) => one.isEntry).forEach((one) => walk(one.fileName));
  return chunks.filter((one) => seen.has(one.fileName));
}

async function size(entry: string, eager = false): Promise<number> {
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
  const chunks = outputs.filter((file) => file.type === "chunk");
  const code = (eager ? staticChunks(chunks) : chunks)
    .map((file) => file.code ?? "")
    .join("");
  const bytes = gzipSync(code).length;
  if (process.env["SKY_SIZE_LOG"]) console.log(entry, bytes);
  return bytes;
}

describe("night sky code size", () => {
  it.each<[string, string, number, boolean?]>([
    ["the meteor", "src/lib/space-fx.ts", 4096],
    ["the sky", "src/lib/sky.ts", 5248],
    ["the body painter", "src/lib/body-paint.ts", 3200],
    ["the Sun painter", "src/lib/sun-paint.ts", 2048],
    /* 8,411 B measured: what the entry loads statically, with the pass hooks (the window check and loader, the Earth cover test, the near canvas) and `sky-orbits.json`, which carries Pluto and the pass's element sets; the pass chunk below is reached only by a dynamic import. */
    ["the planets", "src/lib/sky-planets.ts", 8448, true],
    /* 6,530 B measured, bundled alone with the geometry it shares: the pass table's Hermite read, the placement, the nutation, the Moon's theory and `sky-passes.json` (the table is 20 minute rows over three days); the next 128-byte step. */
    ["the close-approach pass", "src/lib/sky-pass.ts", 6656],
  ])(
    "keeps %s within its limit, minified and gzipped",
    async (_name, entry, limit, eager) => {
      expect(await size(entry, eager)).toBeLessThanOrEqual(limit);
    },
    30_000,
  );
});
