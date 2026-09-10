#!/usr/bin/env node
/**
 * DOX-C3a (#139) — one command for a fully working local site, chat included.
 *
 * The two servers do different jobs and neither is sufficient alone:
 *   - `astro dev`    serves the site with hot reload, but runs no Worker, so
 *                    `/api/chat` 404s and Dox can't answer.
 *   - `wrangler dev` runs the real Worker, but serves the built `dist/`, so
 *                    there's no hot reload and every UI change needs a rebuild.
 *
 * Running both, and proxying `/api` from Astro to the Worker (see
 * `astro.config.mjs`'s `vite.server.proxy`), gives one URL with both
 * properties. Open the Astro URL; the Worker port only exists to be proxied.
 *
 * Spawned here rather than via a `concurrently`-style dependency: the only
 * genuinely fiddly part is making Ctrl+C take both processes down together,
 * and that's the dozen lines below.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const WORKER_PORT = process.env.DOX_WORKER_PORT ?? "8787";

// The Worker reads the retrieval index through its own assets binding — i.e.
// out of `dist/`. With no build there is nothing to search, and every answer
// would come back empty-handed.
if (existsSync(path.join(root, "dist"))) {
  start();
} else {
  console.log(
    "[dev-all] no dist/ yet — building once so the Worker has a corpus to search…",
  );
  const build = spawn("pnpm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  build.on("exit", (code) => (code === 0 ? start() : process.exit(code ?? 1)));
}

function start() {
  const children = [];
  let shuttingDown = false;

  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const c of children) c.kill("SIGTERM");
    // Astro's dev server daemonises itself, so killing the process we spawned
    // doesn't stop it — it has its own lifecycle command.
    spawn("npx", ["astro", "dev", "stop"], { cwd: root, stdio: "ignore" });
    setTimeout(() => process.exit(code), 2000).unref();
  };

  /** @param daemonises `astro dev` forks a background server and the process
   * we spawned exits 0 immediately. That's success, not a crash — only a
   * non-zero exit means something actually broke. */
  const run = (name, cmd, args, { daemonises = false } = {}) => {
    const child = spawn(cmd, args, { cwd: root });
    const pipe = (stream) => (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) stream.write(`[${name}] ${line}\n`);
      }
    };
    child.stdout.on("data", pipe(process.stdout));
    child.stderr.on("data", pipe(process.stderr));
    child.on("exit", (code) => {
      if (shuttingDown) return;
      if (daemonises && code === 0) return;
      console.error(
        `[dev-all] ${name} exited (${code}) — stopping the other process too.`,
      );
      shutdown(code ?? 1);
    });
    children.push(child);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  run("worker", "npx", ["wrangler", "dev", "--port", WORKER_PORT]);
  run("astro", "npx", ["astro", "dev"], { daemonises: true });

  console.log(
    `\n[dev-all] Worker on :${WORKER_PORT}. Astro prints its own URL below —\n` +
      `[dev-all] open THAT one; it proxies /api/chat through to the Worker.\n` +
      `[dev-all] Ctrl+C stops both.\n`,
  );
}
