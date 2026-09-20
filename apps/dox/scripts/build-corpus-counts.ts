/**
 * Derives the corpus figures the empty chat screen advertises.
 *
 * `CORPUS_SUMMARY` is rendered inside the chat island, so the numbers cannot be
 * computed where they are shown: `buildRetrievalCorpus()` pulls in the 536 KB
 * generated corpus and the whole content collection, none of which belongs in
 * that bundle for the sake of three integers.
 *
 * They used to be hand-typed constants guarded by a test, and that guard fired
 * on every merge that touched the library — three times in two days once the
 * span, precision and foreign-epoch namespaces landed. A number no human input
 * determines should not be maintained by a human, so this generates them.
 *
 * **Derived from the same builders the Worker's corpus uses**, not from a
 * second count:
 *
 *   reference  `buildFunctionChunks` is `corpus.map(...)`, strictly 1:1 with
 *              the generated `gmt-corpus.json`, so its length is the count. It
 *              covers functions, types and regex patterns alike.
 *   functions  only the corpus entries whose `kind` is `"function"` — the figure
 *              the chat screen labels "functions". Counting every entry there
 *              advertised 90 types and patterns as functions.
 *   guides     the real `buildGuideChunks`, over the real `toGuideSource`.
 *              Only the file *reading* differs (fs here, `import.meta.glob` in
 *              `guide-sources.ts`), and `corpus-summary.test.ts` re-checks the
 *              result against the Vite path so the two cannot drift.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGuideChunks } from "../src/lib/retrieval/guide-chunks";
import { toGuideSource } from "../src/lib/retrieval/guide-source-parse";
import { gmtVersion } from "../src/generated/versions";
import { pageExpressionValues } from "../src/lib/page-expression-values";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const DOCS = join(APP, "src/content/docs");
const GUIDES = join(DOCS, "guides");
const CORPUS_JSON = join(APP, "src/generated/reference/gmt-corpus.json");
const OUT = join(APP, "src/generated/corpus-counts.ts");

/** Every `.md`/`.mdx` under the guides tree — the fs twin of the Vite glob. */
function guideFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...guideFiles(full));
    else if (/\.mdx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** Every top-level `.md`/`.mdx` directly under content/docs/ — the fs twin of
 * the second glob in `guide-sources.ts`. */
function topLevelFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => join(dir, entry.name));
}

const corpusEntries = JSON.parse(readFileSync(CORPUS_JSON, "utf8")) as {
  kind: string;
}[];
/** Reference chunks: one per corpus entry (functions, types and regex patterns). */
const referenceCount = corpusEntries.length;
/** What the chat screen calls "functions": only the corpus entries that are functions. */
const functionCount = corpusEntries.filter((e) => e.kind === "function").length;

const guideCount = buildGuideChunks(
  [...guideFiles(GUIDES), ...topLevelFiles(DOCS)]
    .sort()
    .map((path) =>
      toGuideSource(path, readFileSync(path, "utf8"), {
        gmtVersion,
        values: pageExpressionValues(),
      }),
    ),
).length;

const next = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-corpus-counts.ts (\`pnpm dox:generate\`).
//
// Three integers rather than the corpus itself: see the script's header for why
// the chat island cannot derive these where it shows them.

export const CORPUS_FUNCTION_COUNT = ${functionCount};
export const CORPUS_REFERENCE_COUNT = ${referenceCount};
export const CORPUS_GUIDE_COUNT = ${guideCount};
export const CORPUS_CHUNK_COUNT = ${referenceCount + guideCount};
`;

// Only write on change, so a no-op `generate` leaves the tree clean.
let current = "";
try {
  current = readFileSync(OUT, "utf8");
} catch {
  /* first run */
}

if (current === next) {
  console.log("[corpus-counts] up-to-date, skipping");
} else {
  writeFileSync(OUT, next);
  console.log(
    `[corpus-counts] ${referenceCount} reference entries (${functionCount} functions) + ${guideCount} guides = ${referenceCount + guideCount}`,
  );
}
