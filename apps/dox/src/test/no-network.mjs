/**
 * Every Dox test runs with the network off.
 *
 * Tests must never spend AI budget — a Gemini request or a Workers AI Neuron —
 * and must not depend on the network at all. Model calls are already faked
 * (`MockLanguageModelV4`, stub `AI` bindings, injected `fetchImpl`), so nothing
 * should ever try; this turns a mistake into a loud failure instead of a quiet
 * charge against a shared free-tier quota.
 *
 * Preloaded with `--import` into every test worker (see `vitest.config.ts`), so
 * the guard is in place before any test file, setup file or dependency loads.
 * Plain ESM, because a preload runs outside Vite's TypeScript transform.
 *
 * Loopback stays open for anything a test starts locally. Blocked for every
 * other host: `fetch`, and every socket connection — `http`, `https` and undici
 * all end up in `net.Socket#connect`. `no-network.test.ts` proves each path.
 */
import net from "node:net";

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\])$/;

/** @param {string} target */
function blocked(target) {
  return new Error(
    `Tests may not use the network (tried ${target}). Fake the model or inject a fetch — see src/test/no-network.mjs.`,
  );
}

/**
 * The connection target, from any of the shapes `net.Socket#connect` receives:
 * `(options)`, `(port, host)`, or — from Node's own `net.createConnection`,
 * which `http` uses — one array of already-normalised arguments,
 * `[options, callback]`.
 *
 * @param {unknown[]} args
 * @returns {{ host: string | undefined; port: unknown }}
 */
function targetOf(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "object" && first !== null) {
    const { host, port } = /** @type {{ host?: unknown; port?: unknown }} */ (
      first
    );
    return {
      host: typeof host === "string" && host !== "" ? host : undefined,
      port,
    };
  }
  return {
    host: typeof args[1] === "string" && args[1] !== "" ? args[1] : undefined,
    port: first,
  };
}

const connect = net.Socket.prototype.connect;

/** @this {import("node:net").Socket} @param {...unknown} args */
net.Socket.prototype.connect = function (...args) {
  const { host, port } = targetOf(args);
  // No host means a local IPC `path` or Node's own `localhost` default. The host
  // decides, not `path`: `https` passes `path: null` alongside a real host.
  if (host !== undefined && !LOOPBACK.test(host)) {
    const error = blocked(`${host}:${String(port)}`);
    process.nextTick(() => this.destroy(error));
    return this;
  }
  return Reflect.apply(connect, this, args);
};

const realFetch = globalThis.fetch;

/** @param {RequestInfo | URL} input @param {RequestInit} [init] */
globalThis.fetch = async (input, init) => {
  const href =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  let host;
  try {
    host = new URL(href).hostname;
  } catch {
    // A relative URL has no host to reach; the real fetch reports it.
  }
  if (host !== undefined && !LOOPBACK.test(host)) throw blocked(href);
  return realFetch(input, init);
};
