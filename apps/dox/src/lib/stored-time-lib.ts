/**
 * Loads the two real gmt functions the Stored Time Audit needs, at module
 * granularity, and hands them back as a `StoredTimeLib`.
 *
 * `classifyStoredZoned` lives in `zoned/classify` and `getDstTransitions` in
 * `zoned/get`. Each name is picked from its module and nothing else is read.
 * `classifyLocal` is not loaded: the `kind` that `classifyStoredZoned` returns
 * already says whether a time is unique, in an overlap or in a gap.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * the widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type { StoredZonedClassification } from "@northguild/gmt";
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** One clock change, as `getDstTransitions` returns it. */
export interface StoredTimeTransition {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

/** The functions the tool calls, as the library declares them. */
export interface StoredTimeLib {
  classifyStoredZoned(value: string): StoredZonedClassification | null;
  getDstTransitions(timeZone: string, year: number): StoredTimeTransition[];
}

export async function loadStoredTimeLib(): Promise<StoredTimeLib> {
  try {
    const [classify, get] = await Promise.all([
      GMT_MODULES["zoned/classify"](),
      GMT_MODULES["zoned/get"](),
    ]);
    return {
      ...pickFunctions(classify, ["classifyStoredZoned"]),
      ...pickFunctions(get, ["getDstTransitions"]),
    } as unknown as StoredTimeLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
