/**
 * Prints a value as source, one line. Kept in its own module so a tool that only prints its
 * calls does not pull in the holiday builder, and with it `@js-temporal/polyfill`.
 */

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A value as source, one line: keys unquoted, as the guide writes it. */
export function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return "{}";
  return `{ ${entries
    .map(
      ([k, v]) =>
        `${IDENTIFIER.test(k) || /^\d+$/.test(k) ? k : JSON.stringify(k)}: ${literal(v)}`,
    )
    .join(", ")} }`;
}
