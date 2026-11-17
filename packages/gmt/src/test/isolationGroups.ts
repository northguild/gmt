import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** `vi.mock` and `vi.doMock` hoist a module replacement that would leak into the next file in a shared worker. */
const MODULE_REPLACEMENT = /vi\.(?:mock|doMock)\(/;

/** `vi.stubGlobal` and `vi.stubEnv` change process-wide state that the setup file does not restore. */
const GLOBAL_STUB = /vi\.stub(?:Global|Env)\(/;

/** Whether a test file's source replaces a module or a global, so it needs a worker of its own. */
export function needsIsolation(source: string): boolean {
  return MODULE_REPLACEMENT.test(source) || GLOBAL_STUB.test(source);
}

/** Every `*.test.ts` under `packageDir/src`, relative to `packageDir`, in path order. */
export function listTestFiles(packageDir: string): string[] {
  return readdirSync(path.join(packageDir, "src"), { recursive: true })
    .map((file) => path.join("src", file.toString()))
    .filter((file) => file.endsWith(".test.ts"))
    .sort();
}

/** The test files under `packageDir/src`, relative to `packageDir`, split by whether they need isolation. */
export function splitTestFiles(packageDir: string): {
  isolated: string[];
  shared: string[];
} {
  const isolated: string[] = [];
  const shared: string[] = [];
  for (const file of listTestFiles(packageDir)) {
    const source = readFileSync(path.join(packageDir, file), "utf8");
    (needsIsolation(source) ? isolated : shared).push(file);
  }
  return { isolated, shared };
}

/** A value import of a `node:` built-in, static or dynamic. A type-only import is erased. */
const NODE_BUILTIN_IMPORT =
  /(?:^|[;\s])import\s+(?!type\s)[^"';]*?\bfrom\s+["']node:|(?:^|[;\s(=])import\(\s*["']node:/m;

/**
 * Whether a test file imports a Node built-in, which no browser can load: the browser config leaves
 * such a file out.
 */
export function importsNodeBuiltin(source: string): boolean {
  return NODE_BUILTIN_IMPORT.test(source);
}

/** The relative specifier of each `vi.mock` or `vi.doMock` call. */
const MOCK_TARGET = /vi\.(?:mock|doMock)\(\s*["'](\.[^"']+)["']/g;

/**
 * A relative import that loads a module as soon as the importer loads: `import … from`,
 * `export … from` or a bare `import "…"`. A type-only import or export is erased, so it is skipped,
 * and a dynamic `import()` waits until its code runs.
 */
const STATIC_IMPORT =
  /(?:^|[;\s])(?:import|export)\s+(type\s+)?[^"';]*?\bfrom\s+["'](\.[^"']+)["']|(?:^|[;\s])import\s+["'](\.[^"']+)["']/gm;

/** The file a relative specifier names from `importer`: the path with `.ts` added, or its `index.ts`. */
function resolveRelative(importer: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(importer), specifier);
  return (
    [base, `${base}.ts`, path.join(base, "index.ts")].find(
      (file) => file.endsWith(".ts") && existsSync(file),
    ) ?? null
  );
}

/** The source files a test file replaces with `vi.mock` or `vi.doMock`, as absolute paths. */
export function mockTargets(testFile: string, source: string): string[] {
  return [...source.matchAll(MOCK_TARGET)]
    .map((match) => resolveRelative(testFile, match[1]))
    .filter((file) => file !== null);
}

/**
 * Every source file `entry` loads through static relative imports, `entry` included, as absolute
 * paths. A browser page runs the setup file before the test file, so a module in the setup file's
 * graph is already loaded when the test file's `vi.mock` would replace it.
 */
export function staticImportGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [path.resolve(entry)];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      if (match[1]) continue;
      const target = resolveRelative(file, match[2] ?? match[3]);
      if (target) queue.push(target);
    }
  }
  return seen;
}
