/**
 * Keeps startup work from holding the main thread. A task over 50 ms is a long task: input that
 * arrives during it waits (web.dev/articles/long-tasks-devtools, web.dev/articles/inp), so work
 * that has to run on the main thread is cut into slices and the thread is handed back between them.
 */

type SchedulerWithYield = { yield?: () => Promise<void> };

/** Hands the thread back, and returns when the browser has run what was waiting. */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerWithYield })
    .scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * A slice of work with a time budget. `turn()` yields only once the budget is spent, so a loop can
 * call it after every item and still pay for a yield only about once per slice.
 */
export function createSlicer(budgetMs = 8): { turn(): Promise<void> } {
  let sliceStart = performance.now();
  return {
    async turn() {
      if (performance.now() - sliceStart < budgetMs) return;
      await yieldToMain();
      sliceStart = performance.now();
    },
  };
}

/** Longest the page may stay busy before the callback runs anyway, in milliseconds. */
const IDLE_DEADLINE_MS = 2000;
/** The wait where `requestIdleCallback` does not exist (WebKit), in milliseconds. */
const IDLE_FALLBACK_MS = 150;

/**
 * Resolves once the page has loaded and the browser is idle: `requestIdleCallback`, or a short
 * timer where it does not exist.
 */
export async function whenIdle(): Promise<void> {
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) =>
      window.addEventListener("load", () => resolve(), { once: true }),
    );
  }
  await new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: IDLE_DEADLINE_MS });
    } else {
      setTimeout(resolve, IDLE_FALLBACK_MS);
    }
  });
}
