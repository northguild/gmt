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
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const WORKER_PORT = process.env.DOX_WORKER_PORT ?? "8787";
const SITE_PORT = process.env.DOX_SITE_PORT ?? "4321";

// The Worker reads the retrieval corpus from the running `astro dev` server
// (`DOX_ASSETS_ORIGIN`, see `worker/index.ts`), not from a build — so no
// `astro build` before starting, and the chat sees content edits as they land.
// `wrangler.jsonc` still names `dist/` as the assets directory and Wrangler
// refuses to start when it is missing, so an empty one is enough.
mkdirSync(path.join(root, "dist"), { recursive: true });
start();

function start() {
  const children = [];
  let shuttingDown = false;

  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Both servers are this script's own foreground children (see `run` below),
    // so signalling them stops exactly what this script started. It never runs
    // `astro dev stop`: that stops whichever server holds this project's lock,
    // which may be one another terminal or agent started.
    for (const c of children) c.kill("SIGTERM");
    // The process normally ends on its own once the children exit — before the
    // unref'd timer fires — so the code has to be set here to survive that.
    process.exitCode = code;
    setTimeout(() => process.exit(code), 2000).unref();
  };

  const run = (name, bin, args) => {
    // The local binaries, not `npx`: no package lookup on every start, and none
    // of the npm config warnings `npx` prints under pnpm.
    const child = spawn(path.join(root, "node_modules", ".bin", bin), args, {
      cwd: root,
      // Astro 7 moves `astro dev` into a detached background server when it
      // detects an AI agent environment. `ASTRO_DEV_BACKGROUND` switches that
      // detection off, so the server stays a foreground child in every
      // environment and Ctrl+C (or the other server failing) stops it.
      env: { ...process.env, ASTRO_DEV_BACKGROUND: "1" },
    });
    const pipe = (stream) => (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) stream.write(`[${name}] ${line}\n`);
      }
    };
    child.stdout.on("data", pipe(process.stdout));
    child.stderr.on("data", pipe(process.stderr));
    child.on("exit", (code) => {
      if (shuttingDown) return;
      console.error(
        `[dev-all] ${name} exited (${code}) — stopping the other process too.`,
      );
      shutdown(code ?? 1);
    });
    children.push(child);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  run("worker", "wrangler", [
    "dev",
    "--port",
    WORKER_PORT,
    "--var",
    `DOX_ASSETS_ORIGIN:http://localhost:${SITE_PORT}`,
  ]);
  run("astro", "astro", ["dev", "--port", SITE_PORT]);

  console.log(
    `\n[dev-all] Worker on :${WORKER_PORT}. Astro prints its own URL below —\n` +
      `[dev-all] open THAT one; it proxies /api/chat through to the Worker.\n` +
      `[dev-all] Ctrl+C stops both.\n`,
  );
}
