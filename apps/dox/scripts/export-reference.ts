/**
 * CORE-87 — export the reference corpus and the chat's tool schemas for another repo.
 *
 * Run from a gmt checkout:
 *
 *   pnpm dox:export --out /absolute/dir
 *
 * Writes `manifest.json`, `gmt-corpus.json` and `tool-schemas.json` flat into the directory,
 * creating it if missing and overwriting those three files. Nothing else in it is touched.
 * `--out` must be absolute: pnpm runs this script with `apps/dox` as the working directory, so
 * a relative path would land somewhere the caller did not mean.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { generateReference } from "./build-reference";
import { toolSchemaFile } from "./export-tool-schemas";

/** Bump when a field is removed or renamed, or a meaning changes. Never for an added field. */
export const EXPORT_FORMAT = 1;

export const EXPORT_FILES = {
  manifest: "manifest.json",
  corpus: "gmt-corpus.json",
  toolSchemas: "tool-schemas.json",
} as const;

const repoRoot = resolve(import.meta.dirname, "../../..");
const generatedCorpus = join(
  import.meta.dirname,
  "../src/generated/reference/gmt-corpus.json",
);

/** `--out <absolute dir>` from argv, or the reason it cannot be used. */
export function parseOutDir(
  argv: readonly string[],
): { outDir: string } | { error: string } {
  // pnpm may pass a literal `--` ahead of the arguments.
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let out: string | undefined;
  try {
    out = parseArgs({
      args: [...args],
      options: { out: { type: "string" } },
      strict: true,
    }).values.out;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (out === undefined || out === "") {
    return { error: "--out is required." };
  }
  if (!isAbsolute(out)) {
    return { error: `--out must be an absolute path, got "${out}".` };
  }
  return { outDir: out };
}

/** Regenerate the corpus, then write the three files into `outDir`. */
export async function exportReference(outDir: string): Promise<void> {
  generateReference();
  mkdirSync(outDir, { recursive: true });

  copyFileSync(generatedCorpus, join(outDir, EXPORT_FILES.corpus));

  writeFileSync(
    join(outDir, EXPORT_FILES.toolSchemas),
    JSON.stringify(await toolSchemaFile(), null, 2) + "\n",
  );

  const pkg = JSON.parse(
    readFileSync(join(repoRoot, "packages/gmt/package.json"), "utf8"),
  ) as { version?: string };
  if (!pkg.version) {
    throw new Error("packages/gmt/package.json has no version field");
  }
  // Last, so a reader that sees a manifest sees the other two.
  writeFileSync(
    join(outDir, EXPORT_FILES.manifest),
    JSON.stringify(
      {
        format: EXPORT_FORMAT,
        gmtVersion: pkg.version,
        files: {
          corpus: EXPORT_FILES.corpus,
          toolSchemas: EXPORT_FILES.toolSchemas,
        },
      },
      null,
      2,
    ) + "\n",
  );
}

async function cli(): Promise<void> {
  const parsed = parseOutDir(process.argv.slice(2));
  if ("error" in parsed) {
    console.error("usage: pnpm dox:export --out <absolute directory>");
    console.error(parsed.error);
    process.exit(1);
  }
  await exportReference(parsed.outDir);
  for (const file of Object.values(EXPORT_FILES)) {
    console.log(`[export] wrote ${join(parsed.outDir, file)}`);
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await cli();
}
