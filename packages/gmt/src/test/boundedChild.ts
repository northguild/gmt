/**
 * Runs GMT calls from the TypeScript source in a separate Node process with a small heap and a
 * wall-clock timeout, so a test can assert that a call finishes in bounded time and memory.
 *
 * A V8 heap OOM is a fatal abort that `try/catch` cannot catch, and it would take the Vitest
 * worker down with it. In the child it only ends the child, and the parent test fails with the
 * reason (`crashed` or `timedOut`) instead of the run dying.
 *
 * The child uses Node's built-in type stripping. A synchronous resolve hook maps GMT's
 * extensionless relative imports (`./x`, `./dir`) to `./x.ts` / `./dir/index.ts`.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");

/**
 * The source file URL of each public function an expression calls as `gmt.<name>`. Importing
 * only those files keeps the child's start-up to a fraction of loading the whole index.
 */
function sourceModules(expressions: readonly string[]): Record<string, string> {
  const names = new Set(
    expressions.flatMap((expression) =>
      [...expression.matchAll(/\bgmt\.(\w+)/g)].map((match) => match[1] ?? ""),
    ),
  );
  const modules: Record<string, string> = {};
  for (const file of readdirSync(SOURCE_ROOT, { recursive: true })) {
    const name = path.basename(String(file), ".ts");
    if (names.has(name) && String(file).endsWith(`${name}.ts`)) {
      modules[name] = pathToFileURL(path.join(SOURCE_ROOT, String(file))).href;
    }
  }
  return modules;
}

const RESOLVE_HOOK = `
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
registerHooks({
  resolve(specifier, context, next) {
    if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.endsWith(".ts")) {
      for (const suffix of [".ts", "/index.ts"]) {
        const url = new URL(specifier + suffix, context.parentURL);
        if (existsSync(fileURLToPath(url))) return next(url.href, context);
      }
    }
    return next(specifier, context);
  },
});
`;

export interface BoundedCall {
  /** The call's result, as JSON. */
  value: unknown;
  /** Wall-clock milliseconds the call took inside the child. */
  ms: number;
}

export interface BoundedRun {
  /** One entry per call that finished, in order. */
  calls: BoundedCall[];
  /** True when the child exceeded `timeoutMs` and was killed. */
  timedOut: boolean;
  /** True when the child exited abnormally (for example a fatal heap OOM). */
  crashed: boolean;
  /** The tail of the child's stderr, for the failure message. */
  stderr: string;
}

/**
 * Evaluates each expression (a JavaScript expression calling public functions as `gmt.<name>`,
 * loaded from their source files) in one child process, in order.
 *
 * @param expressions e.g. `gmt.addDate("1402-10-25[u-ca=persian]", { months: 3000000 })`
 * @param options `timeoutMs` for the whole child (default 20 s), `heapMb` old-space limit (default 256)
 */
export function runInBoundedChild(
  expressions: readonly string[],
  { timeoutMs = 20_000, heapMb = 256 } = {},
): BoundedRun {
  const modules = sourceModules(expressions);
  const script = `
const gmt = {};
for (const [name, url] of Object.entries(${JSON.stringify(modules)})) {
  gmt[name] = (await import(url))[name];
}
for (const run of [${expressions.map((expression) => `() => (${expression})`).join(",")}]) {
  const started = performance.now();
  const value = run();
  process.stdout.write(JSON.stringify({ value, ms: performance.now() - started }) + "\\n");
}
`;
  const result = spawnSync(
    process.execPath,
    [
      `--max-old-space-size=${heapMb}`,
      "--no-warnings",
      "--import",
      `data:text/javascript,${encodeURIComponent(RESOLVE_HOOK)}`,
      "--input-type=module",
      "--eval",
      script,
    ],
    { encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL" },
  );
  const timedOut =
    (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  return {
    calls: result.stdout
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as BoundedCall),
    timedOut,
    crashed: !timedOut && result.status !== 0,
    stderr: result.stderr.slice(-400),
  };
}
