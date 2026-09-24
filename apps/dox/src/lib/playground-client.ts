/**
 * Client-side helpers for the live playground.
 *
 * These run in the browser so they must have zero Node/TS dependencies.
 */

import { renderWidgetOutput, type WidgetOutputState } from "./widget-ui";

export function evaluateArg(raw: string): unknown {
  const t = raw.trim();
  if (!t) return "";
  try {
    return new Function('"use strict"; return (' + t + ");")();
  } catch {
    return undefined;
  }
}

export function sentinelFor(
  returnType: string,
  allowEmptyArray: boolean,
): unknown {
  if (returnType === "number") return null;
  // gmt's bigint functions signal invalid input with `0n` — but `0n` is also a
  // legitimate result (`toNanoseconds("1970-01-01T00:00:00Z")`), so it is not
  // usable as a sentinel. Match `number`, whose zero is guarded for the same
  // reason: return a value no bigint can equal, and show the result verbatim.
  if (returnType === "bigint") return null;
  if (returnType === "boolean") return false;
  if (returnType === "object") return null;
  if (returnType === "array" && !allowEmptyArray) return [];
  return "";
}

export interface ResultShape {
  returnType: string;
  allowEmptyArray?: boolean;
  nullIsEmpty?: boolean;
}

/**
 * Decide how a playground result renders: a live value, the sentinel (invalid
 * input), or a correct empty answer.
 *
 * `null` is the sentinel for every return kind unless the template says it can
 * be an answer (`nullIsEmpty`): gmt never returns `null` as a successful value
 * otherwise, and a `string | null` function (`minZoned([])`) would slip past a
 * `""` comparison and show `null` as though it were a result.
 */
export function classifyPlaygroundResult(
  result: unknown,
  shape: ResultShape,
): WidgetOutputState {
  const allowEmptyArray = shape.allowEmptyArray ?? false;
  if (result === null) return shape.nullIsEmpty ? "empty" : "sentinel";
  if (Array.isArray(result) && result.length === 0) {
    return allowEmptyArray ? "empty" : "sentinel";
  }
  const sentinel = sentinelFor(shape.returnType, allowEmptyArray);
  // 0 and false are real answers for number and boolean functions.
  if (result === sentinel && result !== 0 && result !== false) {
    return "sentinel";
  }
  return "live";
}

/** Render a result in one of the three output states. */
export function renderResult(
  outputEl: HTMLElement,
  value: unknown,
  state: WidgetOutputState,
): void {
  const text =
    state === "sentinel"
      ? "NO SIGNAL"
      : state === "empty"
        ? `${Array.isArray(value) ? "[]" : "null"} — empty, or invalid input`
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  renderWidgetOutput(outputEl, text, state);
}
