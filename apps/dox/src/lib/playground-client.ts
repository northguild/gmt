/**
 * Client-side helpers for the live playground.
 *
 * These run in the browser so they must have zero Node/TS dependencies.
 */

export function evaluateArg(raw: string): unknown {
  const t = raw.trim();
  if (!t) return "";
  try {
    return new Function('"use strict"; return (' + t + ');')();
  } catch {
    return undefined;
  }
}

export function sentinelFor(
  returnType: string,
  allowEmptyArray: boolean,
): unknown {
  if (returnType === "number") return null;
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
