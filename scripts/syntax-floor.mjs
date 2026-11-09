#!/usr/bin/env node
/**
 * Syntax floor of `@northguild/gmt`: the lowest ECMA-262 edition whose grammar parses every file a
 * consumer's bundler or browser loads.
 *
 *   node scripts/syntax-floor.mjs [--ts <file>]   print the floor; with --ts also write
 *                                                 `export const syntaxFloor = { edition, entries }`
 *
 * The published build's `tsdown` target is `esnext`, so the target is not a floor. The floor is
 * measured: esbuild bundles each `packages/gmt/package.json` `exports` entry in memory
 * (`write: false`, the polyfill and `jsbi` bundled in), so `dist` is never touched and no build is
 * needed. Each output is parsed with acorn as a module, trying `ecmaVersion` from 2015 up. An entry's
 * floor is the lowest edition that parses it; the page's floor is the highest entry floor. ECMA-262
 * says what each edition adds; acorn is the tool, not the authority. A bundle no edition parses
 * exits 2 with the entry name and acorn's message. There is no fallback.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GMT_DIR = path.join(ROOT, "packages", "gmt");

/** The editions acorn can parse, lowest first: 2015 up to the first one it refuses. */
function supportedEditions() {
  const editions = [];
  for (let year = 2015; year < 2100; year += 1) {
    try {
      parse("", { ecmaVersion: year, sourceType: "module" });
    } catch {
      break;
    }
    editions.push(year);
  }
  return editions;
}

/**
 * The lowest edition that parses every source.
 * @param {string[]} sources JavaScript module text
 * @returns {number} an ECMA-262 edition year
 * @throws {Error} naming the source index when no edition parses a source
 */
export function syntaxFloor(sources) {
  const editions = supportedEditions();
  let floor = editions[0];
  sources.forEach((source, index) => {
    let lastError = null;
    for (const edition of editions) {
      try {
        parse(source, { ecmaVersion: edition, sourceType: "module" });
        floor = Math.max(floor, edition);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `source ${index}: no edition parses it (${lastError?.message})`,
    );
  });
  return floor;
}

/** Every `exports` entry of `packages/gmt/package.json`: its key and the `src` file it is built from. */
export function exportEntries() {
  const manifest = JSON.parse(
    readFileSync(path.join(GMT_DIR, "package.json"), "utf8"),
  );
  return Object.entries(manifest.exports).map(([key, target]) => {
    const file = typeof target === "string" ? target : target.default;
    return {
      key,
      src: file.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts"),
    };
  });
}

/** Bundle every entry in memory and measure the floor. */
export async function measureSyntaxFloor() {
  const entries = exportEntries();
  const sources = [];
  for (const entry of entries) {
    const result = await build({
      stdin: {
        contents: `export * from ${JSON.stringify(entry.src)};`,
        resolveDir: GMT_DIR,
        loader: "ts",
      },
      bundle: true,
      format: "esm",
      platform: "neutral",
      mainFields: ["module", "main"],
      target: "esnext",
      write: false,
      logLevel: "silent",
    });
    const text = result.outputFiles[0].text;
    try {
      syntaxFloor([text]);
    } catch (error) {
      throw new Error(`${entry.key}: ${error.message}`);
    }
    sources.push(text);
  }
  return { edition: syntaxFloor(sources), entries: entries.length };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const tsIndex = args.indexOf("--ts");
  const out = tsIndex === -1 ? null : args[tsIndex + 1];
  if (tsIndex !== -1 && !out) {
    console.error("syntax-floor: --ts needs a file");
    process.exit(2);
  }
  try {
    const result = await measureSyntaxFloor();
    console.log(
      `[syntax-floor] ECMAScript ${result.edition} over ${result.entries} entries`,
    );
    if (out) {
      const source = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/syntax-floor.mjs (\`pnpm dox:generate\`).
export const syntaxFloor = { edition: ${result.edition}, entries: ${result.entries} } as const;
`;
      mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      let previous = "";
      try {
        previous = readFileSync(out, "utf8");
      } catch {
        previous = "";
      }
      if (previous !== source) writeFileSync(out, source);
    }
  } catch (error) {
    console.error(`syntax-floor: ${error.message}`);
    process.exit(2);
  }
}
