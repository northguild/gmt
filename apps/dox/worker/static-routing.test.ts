/**
 * Which requests reach the Worker and which go straight to static assets, under
 * `assets.run_worker_first` in `wrangler.jsonc` (redirect matrix, layer R).
 *
 * Cloudflare's rule: a pattern tests the pathname only, `*` is `.*`, anchored. A path that
 * matches any `!` pattern goes to assets (file or no file); otherwise a match on any
 * positive pattern runs the Worker. The config is read with Wrangler's own reader.
 */
import { experimental_readRawConfig } from "wrangler";

const { rawConfig } = experimental_readRawConfig({
  config: new URL("../wrangler.jsonc", import.meta.url).pathname,
});
const patterns = (rawConfig.assets as { run_worker_first?: unknown })
  .run_worker_first;

function toRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}

function servedBy(pathname: string): "worker" | "assets" {
  const rules = patterns as string[];
  const negative = rules
    .filter((r) => r.startsWith("!"))
    .map((r) => r.slice(1));
  const positive = rules.filter((r) => !r.startsWith("!"));
  if (negative.some((r) => toRegExp(r).test(pathname))) return "assets";
  return positive.some((r) => toRegExp(r).test(pathname)) ? "worker" : "assets";
}

describe("assets.run_worker_first", () => {
  it("is an array of patterns, within Cloudflare's limit of 100", () => {
    expect(Array.isArray(patterns)).toBe(true);
    expect((patterns as string[]).length).toBeLessThanOrEqual(100);
  });

  it.each([
    "/",
    "/reference/",
    "/llms.txt",
    "/robots.txt",
    "/_astro/a.css",
    "/gmt",
    "/gmtx",
    "/gmt/api/brains",
    "/gmt/api/chat",
    "/gmt/reference",
  ])("runs the Worker for %s", (pathname) => {
    expect(servedBy(pathname)).toBe("worker");
  });

  it.each([
    "/gmt/",
    "/gmt/reference/",
    "/gmt/nope/",
    "/gmt/llms.txt",
    "/gmt/install.md",
    "/gmt/_astro/a.css",
    "/gmt/404.html",
  ])("serves %s from assets", (pathname) => {
    expect(servedBy(pathname)).toBe("assets");
  });

  it("states workers_dev and the single route", () => {
    expect(rawConfig.workers_dev).toBe(true);
    expect(rawConfig.routes).toEqual([
      { pattern: "northguild.dev/gmt*", zone_name: "northguild.dev" },
    ]);
  });
});
