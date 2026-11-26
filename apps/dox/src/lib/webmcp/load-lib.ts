/**
 * Loads a page's library for a tool call. A load that fails is a `WidgetLoadError`, which
 * `definePageTool` turns into `unavailable`; an aborted call stops here and not in the facts.
 */
import { WidgetLoadError } from "../widget-mount";

export async function loadLibFor<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let lib: T;
  try {
    lib = await load();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) throw signal.reason;
  return lib;
}
