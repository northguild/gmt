/**
 * The command line every browser gate shares: its options, the browsers it drives, the page shard
 * and the built site it reads. A usage error prints `<gate>: <message>` and exits with 2.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { applyPageContract, shardOf } from "../gates/contract.mjs";
import { serveStatic } from "./static-server.mjs";

/** The engines a gate can drive, as `--browsers` names them. */
export const ENGINES = ["chromium", "firefox", "webkit"];

/** Stops the gate on a usage error. */
export function usageError(gate, message) {
  console.error(`${gate}: ${message}`);
  process.exit(2);
}

/**
 * Checks `args` against the gate's `flags` and returns a reader for `--name value`: the value, or
 * `fallback` when the option is absent or has no value.
 */
export function gateOptions(gate, args, flags) {
  const known = new Set(flags);
  const unknown = args.find((a) => a.startsWith("--") && !known.has(a));
  if (unknown)
    usageError(gate, `unknown option ${unknown} (${[...known].join(", ")})`);
  return (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
      ? args[i + 1]
      : fallback;
  };
}

/** The `--browsers` list, Chromium alone by default. */
export function gateBrowsers(gate, opt) {
  const browsers = opt("browsers", "chromium").split(",").filter(Boolean);
  for (const name of browsers)
    if (!ENGINES.includes(name))
      usageError(gate, `unknown browser "${name}" (${ENGINES.join(", ")})`);
  return browsers;
}

/** `--shard <i>/<n>`, or `null` when the option is absent. */
function gateShard(gate, args, opt) {
  if (!args.includes("--shard")) return null;
  const m = /^(\d+)\/(\d+)$/.exec(opt("shard", ""));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > Number(m[2]))
    usageError(gate, "--shard needs <i>/<n> with 1 <= i <= n, e.g. 1/3");
  return { i: Number(m[1]), n: Number(m[2]) };
}

/** Stops the gate unless the site under `dist` is built. */
function requireDist(gate, dist) {
  if (!existsSync(path.join(dist, "gmt", "index.html")))
    usageError(
      gate,
      "apps/dox/dist/gmt/index.html is missing; build the site first.",
    );
}

/**
 * The site's address without a trailing slash: `--base`, or a static server over the built
 * `dist`. Close `server` when the gate ends; it is `null` under `--base`.
 */
export async function gateBase(gate, opt, dist) {
  const given = opt("base", "");
  if (given !== "") return { base: given.replace(/\/$/, ""), server: null };
  requireDist(gate, dist);
  const server = await serveStatic(dist, 0);
  return { base: `http://127.0.0.1:${server.address().port}/gmt`, server };
}

/**
 * The pages a gate over the built site checks: it stops unless `dist` is built, lists the pages
 * with `list(dist)`, keeps those `--pages` or `--list-pages` choose (the page contract), then this
 * run's `--shard`.
 */
export async function gatePages(gate, args, opt, dist, list) {
  requireDist(gate, dist);
  const all = list(dist);
  const selected =
    (await applyPageContract({ gate, pages: all, argv: args })) ?? all;
  const shard = gateShard(gate, args, opt);
  return shard ? shardOf(selected, shard) : selected;
}
