#!/usr/bin/env node
/**
 * A small static file server for the browser checks in `scripts/`.
 *
 * `python3 -m http.server` listens with a backlog of 5 and drops a module request when a
 * page loads many files at once under load. This one listens with a backlog of 1024.
 *
 * Usage:
 *   node scripts/lib/static-server.mjs <root-dir> <port>
 *   (serves <root-dir> on 127.0.0.1:<port>; build with `--outDir <root-dir>/gmt` to serve under /gmt)
 *
 * Imported, `serveStatic(root, port)` resolves to the listening server.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

export function serveStatic(root, port) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url ?? "/", "http://x").pathname,
      );
      let file = normalize(join(base, path));
      if (file !== base && !file.startsWith(base + sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(file).catch(() => null))?.isDirectory())
        file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen({ port, host: "127.0.0.1", backlog: 1024 }, () =>
      done(server),
    );
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [root, port] = process.argv.slice(2);
  if (!root || !port) {
    console.error(
      "usage: node scripts/lib/static-server.mjs <root-dir> <port>",
    );
    process.exit(2);
  }
  await serveStatic(root, Number(port));
  console.log(`serving ${resolve(root)} on http://127.0.0.1:${port}/`);
}
