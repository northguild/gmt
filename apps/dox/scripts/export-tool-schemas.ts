/**
 * CORE-87 — `tool-schemas.json`: the chat's tool schemas, for another repo.
 *
 * One entry per offered chat tool, in prompt order. `inputSchema` is what the `ai` SDK hands the
 * model (JSON Schema draft-07), so the other repo and the chat cannot differ. A cross-field
 * `.refine()` is not expressible in JSON Schema; its message ships as `rules` text instead.
 *
 * Imports `dox-tools.ts` and `ai` only. It must not import `worker/tools.ts`, which needs a gmt
 * build the export step promises not to need.
 */
import { asSchema, type FlexibleSchema, type JSONSchema7 } from "ai";
import type { z } from "zod";
import {
  DOX_TOOL_INPUTS,
  ENABLED_TOOL_DOCS,
  type EnabledToolName,
  DOX_TOOLS,
} from "../src/lib/dox-tools";

export interface ExportedTool {
  name: EnabledToolName;
  /** The tool's description as the model receives it: `DOX_TOOL_DOCS[i].purpose`. */
  description: string;
  /** When the chat's system prompt says to call it: `DOX_TOOL_DOCS[i].when`. */
  when: string;
  /** The prompt's argument guidance: `DOX_TOOL_DOCS[i].args`. */
  args: string;
  /** The message of each cross-field rule the JSON Schema cannot carry. Usually empty. */
  rules: string[];
  /** JSON Schema draft-07, exactly as the `ai` SDK hands it to the model. */
  inputSchema: JSONSchema7;
}

export interface ToolSchemaFile {
  tools: ExportedTool[];
}

/** The slice of zod's `_zod.def` surface this walk reads. */
interface ZodDefLike {
  type?: string;
  checks?: { _zod: { def: { check?: string; error?: unknown } } }[];
  shape?: Record<string, ZodLike>;
  element?: ZodLike;
  innerType?: ZodLike;
}
interface ZodLike {
  _zod: { def: ZodDefLike };
}

/**
 * The message of every refinement (a check whose `def.check` is `"custom"`), in definition
 * order, found by walking object shapes, array elements and optionals.
 *
 * Throws when a refinement has no string message: a rule with no words cannot be passed on,
 * and a silent empty string would hide it.
 */
export function refinementMessages(schema: z.ZodType): string[] {
  const found: string[] = [];
  const walk = (node: ZodLike, path: string): void => {
    const def = node._zod.def;
    for (const check of def.checks ?? []) {
      const cdef = check._zod.def;
      if (cdef.check !== "custom") continue;
      const message =
        typeof cdef.error === "function"
          ? (cdef.error as (issue: object) => unknown)({})
          : undefined;
      if (typeof message !== "string" || message === "") {
        throw new Error(
          `refinement at ${path || "(root)"} has no string message; give .refine() a message`,
        );
      }
      found.push(message);
    }
    if (def.shape) {
      for (const [key, child] of Object.entries(def.shape)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
    if (def.type === "array" && def.element) walk(def.element, `${path}[]`);
    if (def.type === "optional" && def.innerType) walk(def.innerType, path);
  };
  walk(schema as unknown as ZodLike, "");
  return found;
}

export async function toolSchemaFile(): Promise<ToolSchemaFile> {
  const tools: ExportedTool[] = [];
  for (const doc of ENABLED_TOOL_DOCS) {
    const name = doc.name as EnabledToolName;
    tools.push({
      name,
      description: doc.purpose,
      when: doc.when,
      args: doc.args,
      rules: refinementMessages(DOX_TOOL_INPUTS[name]),
      inputSchema: await asSchema(
        DOX_TOOLS[name].inputSchema as FlexibleSchema<unknown>,
      ).jsonSchema,
    });
  }
  return { tools };
}
