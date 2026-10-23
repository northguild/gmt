import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveStatic } from "./static-server.mjs";

describe("serveStatic", () => {
  let server: Awaited<ReturnType<typeof serveStatic>>;
  let origin = "";

  beforeAll(async () => {
    const root = mkdtempSync(join(tmpdir(), "static-server-"));
    mkdirSync(join(root, "gmt", "page"), { recursive: true });
    writeFileSync(join(root, "gmt", "page", "index.html"), "<p>hi</p>");
    writeFileSync(join(root, "gmt", "a.js"), "export {};");
    server = await serveStatic(root, 0);
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((done) => server.close(done)));

  it("serves a directory's index.html and a module with its type", async () => {
    const page = await fetch(`${origin}/gmt/page/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toBe("<p>hi</p>");
    const mod = await fetch(`${origin}/gmt/a.js`);
    expect(mod.headers.get("content-type")).toContain("text/javascript");
  });

  it("answers 404 for a missing file and refuses to leave the root", async () => {
    expect((await fetch(`${origin}/gmt/missing.css`)).status).toBe(404);
    const out = await fetch(`${origin}/..%2f..%2fetc/passwd`);
    expect([403, 404]).toContain(out.status);
  });
});
