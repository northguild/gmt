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
 *   functions  `buildFunctionChunks` is `corpus.map(...)`, strictly 1:1 with
 *              the generated `gmt-corpus.json`, so its length is the count.
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

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const GUIDES = join(APP, "src/content/docs/guides");
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

const functionCount = (
  JSON.parse(readFileSync(CORPUS_JSON, "utf8")) as unknown[]
).length;

const guideCount = buildGuideChunks(
  guideFiles(GUIDES)
    .sort()
    .map((path) => toGuideSource(path, readFileSync(path, "utf8"))),
).length;

const next = `// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-corpus-counts.ts (\`pnpm dox:generate\`).
//
// Three integers rather than the corpus itself: see the script's header for why
// the chat island cannot derive these where it shows them.

export const CORPUS_FUNCTION_COUNT = ${functionCount};
export const CORPUS_GUIDE_COUNT = ${guideCount};
export const CORPUS_CHUNK_COUNT = ${functionCount + guideCount};
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
    `[corpus-counts] ${functionCount} functions + ${guideCount} guides = ${functionCount + guideCount}`,
  );
}
