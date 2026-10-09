/**
 * Client-side helpers for the live playground.
 *
 * These run in the browser so they must have zero Node/TS dependencies.
 */

import type { CallField } from "./playground-parsers";
import type { ChoiceSeed, ChoiceSeeds } from "./playground-spec";
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

/** One form control as the seed loader sees it: read its value, overwrite it. */
export interface SeedControl {
  name: string;
  read: () => CallField;
  write: (seed: ChoiceSeed) => void;
}

/**
 * Loads a choice's example values when the reader changes an enum select, but
 * only over values the reader has not touched.
 *
 * `markLoaded` records what every control holds now; a control is pristine while
 * it still reads the same. `onEnumChange` runs after the select changed: when
 * the choice has seeds and every other control is pristine it writes them and
 * records the new state; otherwise it changes nothing. The caller re-runs the
 * call either way.
 */
export function createSeedLoader(
  controls: SeedControl[],
  choiceSeeds: ChoiceSeeds | undefined,
) {
  let loaded = new Map<string, string>();
  const snapshot = (c: SeedControl) => JSON.stringify(c.read());
  const markLoaded = () => {
    loaded = new Map(controls.map((c) => [c.name, snapshot(c)]));
  };

  /** True when seeds were written. */
  const onEnumChange = (name: string): boolean => {
    const changed = controls.find((c) => c.name === name);
    if (!changed) return false;
    const choice = changed.read().value ?? "";
    const seeds = choiceSeeds?.[name]?.[choice];
    if (!seeds) return false;
    const others = controls.filter((c) => c !== changed);
    if (others.some((c) => loaded.get(c.name) !== snapshot(c))) return false;
    for (const c of others) {
      const seed = seeds[c.name];
      if (seed) c.write(seed);
    }
    markLoaded();
    return true;
  };

  return { markLoaded, onEnumChange };
}
