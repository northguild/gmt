/**
 * Makes a model's tool input match the tool's JSON schema where the mismatch
 * is only the type of a value, never its meaning.
 *
 * Providers hand tool arguments over as loosely typed JSON, and a model that
 * writes `rolloverEra:<|"|>0<|"|>` (a string) can come back from a lenient
 * parser as the number `0`. Several Dox schemas keep a value a string on
 * purpose (a rollover era that may be `"rolling"`, a date-time), so one such
 * slip fails validation and the reader gets no widget. The repair is the same
 * whichever tool and whichever brain: a number or boolean where the schema
 * wants a string becomes its text, and numeric text where it wants a number
 * becomes the number. A value is never invented, defaulted or corrected.
 *
 * Used by `repairToolCall` (a call the SDK could not validate) and by
 * `tool-call-markup.ts` (a call the model wrote as text).
 */
import type { JSONSchema7 } from "@ai-sdk/provider";

/** Gemma writes its string delimiter as this token; it can leak into a value. */
const GEMMA_QUOTE = '<|"|>';

function typesOf(schema: JSONSchema7): readonly string[] {
  const { type } = schema;
  if (type === undefined) return [];
  return Array.isArray(type) ? type : [type];
}

function coerceValue(
  schema: JSONSchema7 | boolean | undefined,
  value: unknown,
): unknown {
  if (typeof schema !== "object") return value;
  const types = typesOf(schema);

  if (typeof value === "string" && value.includes(GEMMA_QUOTE))
    return coerceValue(schema, value.split(GEMMA_QUOTE).join("").trim());

  if (types.length > 0 && !types.some((t) => matches(t, value))) {
    if (types.includes("string") && typeof value !== "object")
      return String(value);
    if (typeof value === "string" && value.trim() !== "") {
      const text = value.trim();
      if (types.includes("number") || types.includes("integer")) {
        const number = Number(text);
        if (Number.isFinite(number)) return number;
      }
      if (types.includes("boolean") && (text === "true" || text === "false"))
        return text === "true";
    }
    return value;
  }

  if (Array.isArray(value) && typeof schema.items === "object") {
    const items = schema.items;
    if (!Array.isArray(items))
      return value.map((item) => coerceValue(items, item));
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value))
    return coerceObject(schema, value as Record<string, unknown>);
  return value;
}

function matches(type: string, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
    case "integer":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null;
    case "null":
      return value === null;
    default:
      return true;
  }
}

/** `input` with each property of `schema` coerced; unknown properties pass through. */
export function coerceObject(
  schema: JSONSchema7,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const properties = schema.properties ?? {};
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      coerceValue(properties[key], value),
    ]),
  );
}
