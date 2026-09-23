/**
 * Resolve a `weekStartsOn` option value.
 *
 * - `undefined` (the option omitted) resolves to `"monday"`, the ISO 8601 week start.
 * - `"monday"` and `"sunday"` resolve to themselves.
 * - Any other value is invalid and resolves to `null`, which callers map to their sentinel — as
 *   Temporal's GetOption rejects a string outside the allowed list.
 *
 * @param weekStartsOn raw option value from caller input
 * @returns `"monday"`, `"sunday"`, or `null` when the value is invalid
 */
export function resolveWeekStartsOn(
  weekStartsOn: unknown,
): "monday" | "sunday" | null {
  if (weekStartsOn === undefined) return "monday";

  return weekStartsOn === "monday" || weekStartsOn === "sunday"
    ? weekStartsOn
    : null;
}
