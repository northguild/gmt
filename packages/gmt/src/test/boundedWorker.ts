/**
 * The worker half of `boundedChild.browser.ts`: evaluates each expression against the public
 * functions, in order, and posts one JSON line per finished call, as the Node child writes them.
 * An expression that throws ends the worker with an `error` event, as an uncaught error ends the
 * Node child. It runs on the browser's own engine, and posts `ready` once GMT has loaded.
 */
import * as gmt from "../index";

interface WorkerScope {
  onmessage: ((event: { data: { expressions: string[] } }) => void) | null;
  postMessage(message: string): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  for (const expression of event.data.expressions) {
    const run = new Function("gmt", `return (${expression})`) as (
      namespace: typeof gmt,
    ) => unknown;
    const started = performance.now();
    const value = run(gmt);
    scope.postMessage(
      JSON.stringify({ value, ms: performance.now() - started }),
    );
  }
  scope.postMessage("done");
};

scope.postMessage("ready");
