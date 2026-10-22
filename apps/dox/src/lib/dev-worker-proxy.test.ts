import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { devWorkerProxy } from "./dev-worker-proxy";

/**
 * `/gmt/api/…` must reach the Worker through `astro dev`. It did not: the proxy key was
 * `/gmt/api`, but Astro's dev base middleware strips `/gmt` before Vite's proxy runs, so every
 * request fell through to Astro's own 404.
 *
 * The first block is the shape. The second starts the real `astro dev` CLI (a child process: the
 * programmatic `dev()` orders its middleware differently and passed with the broken key) with the
 * real `astro.config.mjs` against a stub Worker, so an Astro upgrade that reorders its middleware fails
 * here instead of in someone's browser.
 */
describe("devWorkerProxy", () => {
  it("matches the path as it looks after Astro strips the base", () => {
    const [key, rule] = Object.entries(devWorkerProxy("8790"))[0];
    const re = new RegExp(key);
    expect(re.test("/api/brains")).toBe(true);
    expect(re.test("/api/canada-clock-change?x=1")).toBe(true);
    expect(re.test("/api")).toBe(true);
    expect(re.test("/apiary")).toBe(false);
    expect(re.test("/gmt/api/brains")).toBe(false);
    expect(rule.rewrite("/api/brains?k=1")).toBe("/gmt/api/brains?k=1");
    expect(rule.target).toBe("http://localhost:8790");
  });

  it("defaults to the standard Worker port", () => {
    expect(Object.values(devWorkerProxy(undefined))[0].target).toBe(
      "http://localhost:8787",
    );
  });
});

/** The parent's env without Vitest's own markers: under `NODE_ENV=test` Astro's dev server orders its middleware differently, which hid the bug. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITEST") || key === "TEST") delete env[key];
  }
  env.NODE_ENV = "development";
  return env;
}

describe("astro dev proxies /gmt/api to the Worker", () => {
  let stub: Server;
  let child: ChildProcess | undefined;
  let cacheDir: string;
  let site = "";
  const seen: { method?: string; url?: string; body: string }[] = [];

  beforeAll(async () => {
    stub = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ method: req.method, url: req.url, body });
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ stub: true, url: req.url }));
      });
    });
    await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
    const workerPort = (stub.address() as AddressInfo).port;

    // A free port for the site: ask the OS, then give it back.
    const probe = createServer();
    await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
    const sitePort = (probe.address() as AddressInfo).port;
    await new Promise((r) => probe.close(r));

    cacheDir = mkdtempSync(path.join(tmpdir(), "dox-proxy-vite-"));
    const root = path.resolve(import.meta.dirname, "../..");
    child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/astro/bin/astro.mjs"),
        "dev",
        // Not tied to the project lock, so it runs beside the author's own `pnpm dox:dev`.
        "--ignore-lock",
        "--port",
        String(sitePort),
      ],
      {
        cwd: root,
        stdio: "ignore",
        env: {
          ...cleanEnv(),
          ASTRO_DEV_BACKGROUND: "1",
          DOX_WORKER_PORT: String(workerPort),
          DOX_VITE_CACHE_DIR: cacheDir,
        },
      },
    );
    site = `http://localhost:${sitePort}`;
    // Ready once the site answers at all (a missing page is still an answer).
    const until = performance.now() + 90_000;
    for (;;) {
      try {
        await fetch(`${site}/gmt/`);
        break;
      } catch {
        if (performance.now() > until || child.exitCode !== null) {
          throw new Error("astro dev did not start");
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }, 120_000);

  afterAll(async () => {
    // astro dev writes its Vite cache while it shuts down, so the cache is removed only after
    // the process has exited.
    if (child && child.exitCode === null && child.signalCode === null) {
      const proc = child;
      const exited = new Promise((r) => proc.once("exit", r));
      proc.kill("SIGTERM");
      const timer = setTimeout(() => proc.kill("SIGKILL"), 10_000);
      await exited;
      clearTimeout(timer);
    }
    await new Promise((r) => stub?.close(r));
    if (cacheDir)
      rmSync(cacheDir, { recursive: true, force: true, maxRetries: 5 });
  }, 30_000);

  it("forwards a GET with the full /gmt path", async () => {
    const res = await fetch(`${site}/gmt/api/brains`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ stub: true, url: "/gmt/api/brains" });
  });

  it("forwards a form POST with its body", async () => {
    const res = await fetch(`${site}/gmt/api/canada-clock-change`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "zone=America%2FToronto",
    });
    expect(res.status).toBe(200);
    expect(seen.at(-1)).toMatchObject({
      method: "POST",
      url: "/gmt/api/canada-clock-change",
      body: "zone=America%2FToronto",
    });
  });
}, 120_000);
