/**
 * Dev-only: keeps the API reference in step with `packages/gmt/src` while `astro dev` runs.
 *
 * The reference pages are generated from gmt's JSDoc, and the live playgrounds import gmt's
 * built `dist/`, so a gmt edit used to need a dev-server restart to show up. This watches the
 * gmt source and, once a burst of saves settles, runs the incremental gmt build and the
 * reference steps. Both write only what changed, so Astro's own watcher reloads just the
 * touched pages. A new export (a new route, a new sidebar entry) still needs a restart.
 */
import type { AstroIntegration } from "astro";
import { spawn } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../..", import.meta.url));
const gmtSrc = fileURLToPath(
  new URL("../../../../packages/gmt/src", import.meta.url),
);

/** How long saves must pause before regenerating — one save often touches several files. */
const SETTLE_MS = 400;

const STEPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["pnpm", ["--filter", "@northguild/gmt", "run", "build:dev"]],
  ["node_modules/.bin/tsx", ["scripts/build-reference.ts"]],
  ["node_modules/.bin/tsx", ["scripts/build-corpus-counts.ts"]],
];

/**
 * True for a gmt source file the build or the reference generator reads — `file` is the path
 * relative to `packages/gmt/src` that `fs.watch` reports. Tests and the `src/test/` helpers
 * are neither built nor documented.
 */
export function isReferenceInput(file: string | null): boolean {
  if (!file || !file.endsWith(".ts")) return false;
  if (/\.(test|spec)\.ts$/.test(file)) return false;
  return !file.split(/[\\/]/).includes("test");
}

/**
 * Debounces `run` by `delayMs` and never overlaps it: triggers that land while a run is in
 * flight collapse into a single rerun once it finishes.
 */
export function createCoalescingRunner(
  run: () => Promise<void>,
  delayMs: number,
  onError: (error: unknown) => void = () => {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;

  const start = async () => {
    running = true;
    pending = false;
    try {
      await run();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (pending) void start();
    }
  };

  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (running) pending = true;
      else void start();
    }, delayMs);
  };
}

function runStep([cmd, args]: readonly [string, readonly string[]]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: appRoot, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

export function gmtReferenceWatch(): AstroIntegration {
  let watcher: FSWatcher | undefined;
  return {
    name: "gmt-reference-watch",
    hooks: {
      "astro:server:setup": ({ logger }) => {
        const regenerate = createCoalescingRunner(
          async () => {
            logger.info("gmt source changed — rebuilding the reference");
            for (const step of STEPS) await runStep(step);
          },
          SETTLE_MS,
          (error) =>
            logger.warn(
              `reference rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );
        watcher = watch(gmtSrc, { recursive: true }, (_event, file) => {
          if (isReferenceInput(file)) regenerate();
        });
      },
      "astro:server:done": () => {
        watcher?.close();
      },
    },
  };
}
