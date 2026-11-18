/**
 * `streamText`'s `repairToolCall`: a deterministic second look at a tool call
 * whose input failed the tool's schema, before the reader is told it failed.
 *
 * It spends nothing (no model call) and changes only the type of a value the
 * model already gave (`tool-input-coercion.ts`). A call that is still invalid
 * after that stays invalid, because the SDK validates the repaired input again.
 */
import {
  InvalidToolInputError,
  type ToolCallRepairFunction,
  type ToolSet,
} from "ai";
import { coerceObject } from "./tool-input-coercion";

export const repairToolCall: ToolCallRepairFunction<ToolSet> = async ({
  toolCall,
  inputSchema,
  error,
}) => {
  if (!InvalidToolInputError.isInstance(error)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(toolCall.input);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return null;
  const schema = await inputSchema({ toolName: toolCall.toolName });
  const repaired = JSON.stringify(
    coerceObject(schema, parsed as Record<string, unknown>),
  );
  return repaired === JSON.stringify(parsed)
    ? null
    : { ...toolCall, input: repaired };
};
