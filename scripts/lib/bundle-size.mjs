/**
 * The pure parts of `scripts/bundle-size.mjs`: the JSON the Dox bundle-size page reads, and the
 * check that every `absent` path in the budgets file still names a file.
 */
import path from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const bytesOf = (m) =>
  m === null ? null : { minified: m.minified, gzipped: m.gzipped };

/**
 * One measured polyfill set, as it appears in the report's `polyfills` array.
 * An entry measured as `null` stays `null`: the release does not export that name.
 */
export function polyfillSet({
  package: name,
  version,
  importPath,
  shipped,
  gmt,
  from,
  measured,
}) {
  const entries = {};
  for (const [entry, m] of Object.entries(measured))
    entries[entry] = bytesOf(m);
  return {
    package: name,
    version,
    import: importPath,
    shipped,
    gmt,
    from,
    entries,
  };
}

/**
 * The whole `--json` report. Top-level `entries` are the shipped set with their budgets, as
 * before; `polyfills` lists the shipped set first and then the previous set, when measured.
 */
export function reportShape({ meta, floor, budgets, shipped, previous }) {
  const entries = {};
  for (const [name, m] of Object.entries(shipped.measured)) {
    entries[name] = {
      minified: m.minified,
      gzipped: m.gzipped,
      budget: budgets.entries?.[name]?.minified ?? null,
    };
  }
  const polyfills = [polyfillSet({ ...shipped, shipped: true })];
  if (previous) polyfills.push(polyfillSet({ ...previous, shipped: false }));
  return { ...meta, floor, entries, polyfills };
}

/**
 * One failure per `absent` path that is not a file under `gmtDir`, so the list never goes stale.
 * `kindOf` answers "file", "directory" (or any other existing thing) or "missing".
 */
export function absentPathFailures(budgets, gmtDir, kindOf) {
  const failures = [];
  for (const [entry, paths] of Object.entries(budgets.absent ?? {})) {
    for (const listed of paths) {
      const kind = kindOf(path.join(gmtDir, listed));
      if (kind === "missing")
        failures.push(`${entry}: absent path ${listed} does not exist`);
      else if (kind !== "file")
        failures.push(`${entry}: absent path ${listed} is not a file`);
    }
  }
  return failures;
}

/**
 * Bundle one entry (`contents` is the stdin module) in memory and measure it.
 * The loader is `js`, not `ts`: with `ts` esbuild treats `export { name } from "…"` as a possible
 * type-only re-export and drops a missing name silently, as 0 bytes with no warning.
 * With `missingIsNull`, a name the module does not export gives `null` (the previous release);
 * otherwise esbuild's "No matching export" error is thrown (the shipped set).
 */
export async function measureEntry(contents, resolveDir, { missingIsNull }) {
  let result;
  try {
    result = await build({
      stdin: { contents, resolveDir, loader: "js" },
      bundle: true,
      minify: true,
      format: "esm",
      platform: "neutral",
      mainFields: ["module", "main"],
      target: "es2022",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
  } catch (error) {
    if (missingIsNull && /No matching export/.test(error.message)) return null;
    throw error;
  }
  const bytes = result.outputFiles[0].contents;
  const output = Object.values(result.metafile.outputs)[0];
  return {
    minified: bytes.length,
    gzipped: gzipSync(bytes, { level: 9 }).length,
    inputs: output.inputs,
  };
}
