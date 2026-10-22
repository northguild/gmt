import { SITE_BASE } from "./site";

/**
 * `astro dev` -> `wrangler dev` proxy (DOX-C3a, #139).
 *
 * The Worker owns `/gmt/api/…`; `astro dev` runs no Worker, so Vite forwards that route to a local
 * `wrangler dev` (see `scripts/dev-all.mjs`).
 *
 * The key is `/api`, NOT `${SITE_BASE}/api`. Astro's dev server unshifts its base middleware to the
 * front of Vite's stack (`vite-plugin-astro-server/plugin.js`), ahead of Vite's proxy, and that
 * middleware strips the base from `req.url`. By the time the proxy looks, `/gmt/api/brains` is
 * already `/api/brains`, so a `/gmt/api` key never matched and Astro answered its own 404. The
 * Worker expects the full path and strips the base itself, so `rewrite` puts it back.
 * `src/lib/dev-worker-proxy.test.ts` starts the real dev server, so an Astro change to that order
 * fails there.
 */
export function devWorkerProxy(workerPort: string | undefined) {
  return {
    // A regex key (`^`): `/api` and `/api/…`, not `/apiary`.
    "^/api(?:[/?]|$)": {
      target: `http://localhost:${workerPort || "8787"}`,
      changeOrigin: true,
      rewrite: (path: string) => `${SITE_BASE}${path}`,
    },
  };
}
