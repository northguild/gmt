import { Temporal } from "../internal/temporal";

// The swap pass (CORE-92) sets GMT_SWAP_ENTRY (`vitest.swap.config.ts` on Node,
// `vitest.browser.config.ts` with GMT_TEMPORAL=temporal-polyfill in a browser). Only that pass
// runs the test titled "the swap pass runs GMT on the swap entry's own Temporal object", so a
// pass without the variable cannot produce it. `scripts/polyfill-swap.mjs` reads that test's
// result in the swap report: a swap verdict says `entryLoaded: true` only when it passed.
// Every other pass runs the second test, which names the Temporal that pass is meant to run.
const viteEnv = (import.meta as { env?: Record<string, string | undefined> })
  .env;
const env = (name: string) =>
  (typeof process !== "undefined" ? process.env[name] : undefined) ||
  viteEnv?.[name];
const swapPass = !!env("GMT_SWAP_ENTRY");
const nativePass = env("GMT_NATIVE_TEMPORAL") === "1";
const host = globalThis as { Temporal?: typeof Temporal };

it(
  swapPass
    ? "the swap pass runs GMT on the swap entry's own Temporal object"
    : "any other pass runs GMT on its own Temporal, not the swap entry's",
  async () => {
    if (swapPass) {
      const { Temporal: entry } = await import("./swapEntry");
      expect(Temporal).toBe(entry);
      expect(Temporal).not.toBe(host.Temporal);
      return;
    }
    if (nativePass) {
      // The native pass: the engine's own classes, so not the swap entry's.
      expect(Temporal.PlainDate).toBe(host.Temporal?.PlainDate);
    } else {
      // The polyfill pass: `@js-temporal/polyfill`, never the engine's or the swap entry's
      // classes. (The swap entry is not imported here: where it is not installed, Vite would
      // log a failed import in every other pass.)
      expect(Temporal.PlainDate).not.toBe(host.Temporal?.PlainDate);
      expect(Temporal.PlainDate.name).toBe("PlainDate");
    }
  },
);
