import { readdirSync, readFileSync } from "node:fs";
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
