/**
 * Client-side helpers for the live playground.
 *
 * These run in the browser so they must have zero Node/TS dependencies.
 */

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
  if (returnType === "array" && !allowEmptyArray) return [];
  return "";
}

export function renderResult(
  outputEl: HTMLElement,
  value: unknown,
  isError: boolean,
): void {
  outputEl.classList.remove("gmt-playground-live", "gmt-playground-sentinel");
  if (isError) {
    outputEl.classList.add("gmt-playground-sentinel");
    outputEl.textContent = "NO SIGNAL";
  } else {
    outputEl.classList.add("gmt-playground-live");
    outputEl.textContent =
      typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}
