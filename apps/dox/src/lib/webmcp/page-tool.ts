/**
 * One WebMCP tool per tool page: the definition, its description and the adapter to the browser's
 * model context.
 *
 * A tool module (`tools/<slug>.ts`) exports `def`, made by `definePageTool`, and a default
 * `toModelContextTool(def)`. `execute` parses the agent's input with the same zod schema the chat
 * tool uses, then runs the page's own pure functions. It resolves with a JSON-safe result; a
 * refusal resolves too, because the browser hides a rejection's message from the model.
 */
import { z } from "zod";
import { DOX_TOOL_DOCS, type DoxToolName } from "../dox-tool-schemas";
import { WidgetLoadError } from "../widget-mount";
import type { ModelContextToolInit, PageToolRun } from "./model-context";

export type { PageToolResult, PageToolRun } from "./model-context";

export interface PageToolDef<S extends z.ZodType = z.ZodType, R = unknown> {
  /** The slug, equal to the `.mdx` basename. */
  page: string;
  /** `<verb>_<object>` in snake_case. */
  name: string;
  /** The page title. */
  title: string;
  /** The chat tool whose exported `<doxTool>Input` is this tool's input. */
  doxTool: DoxToolName;
  /** One sentence: what `result` holds. */
  returns: string;
  /** The library functions it calls, named in the description. */
  calls: string[];
  /** One sentence per `.refine` or `.superRefine` (`toJSONSchema` drops them). */
  rules?: string[];
  /**
   * Edits to the chat tool's `args` line for the description, as `[from, to]` pairs applied in
   * order, for a page whose chat wording names the page (`shown`) or the reader. Each `from` must
   * occur in the chat text, so a change to `DOX_TOOL_DOCS` that leaves one behind throws instead
   * of drifting apart. A tool needs swaps only while its chat `args` holds a banned word, or while the
   * description built without them would exceed 1,000 characters (`coverage.test.ts`). The chat prompt itself is untouched.
   */
  argsSwaps?: [from: string, to: string][];
  /**
   * The same for the chat `when` line, for a sample the plain description cannot carry (`30 2 * * *`
   * holds `*`). Applied before the backticks around a sample are dropped, and each `from` must occur
   * in the chat text. The chat prompt itself is untouched.
   */
  whenSwaps?: [from: string, to: string][];
  input: S;
  /** The page's first preset, as args. */
  example: z.input<S>;
  run(args: z.output<S>, signal: AbortSignal): Promise<PageToolRun<R>>;
}

/** Identity. It exists so `S` and `R` are inferred from the literal. */
export function definePageTool<S extends z.ZodType, R>(
  def: PageToolDef<S, R>,
): PageToolDef<S, R> {
  return def;
}

const sentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * What the agent reads. Plain, positive prose: the agent never sees the page, so it never hears
 * of a control, a drawing or a drag.
 */
export function describeTool(def: PageToolDef): string {
  const docs = DOX_TOOL_DOCS.find((doc) => doc.name === def.doxTool);
  if (!docs) throw new Error(`No DOX_TOOL_DOCS entry for ${def.doxTool}`);
  let args = docs.args;
  for (const [from, to] of def.argsSwaps ?? []) {
    if (!args.includes(from)) {
      throw new Error(
        `${def.name}: argsSwaps "${from}" is not in the ${def.doxTool} args`,
      );
    }
    args = args.replace(from, () => to);
  }
  // Some chat `when` lines open with their own "Call when"; the description says "Use it when".
  // A chat line may set a sample in backticks; the description is plain text.
  let when = docs.when;
  for (const [from, to] of def.whenSwaps ?? []) {
    if (!when.includes(from)) {
      throw new Error(
        `${def.name}: whenSwaps "${from}" is not in the ${def.doxTool} when line`,
      );
    }
    when = when.replace(from, () => to);
  }
  when = when.replace(/^Call when /, "").replaceAll("`", "");
  return [
    sentence(def.returns),
    sentence(`Use it when ${when}`),
    sentence(args),
    ...(def.rules ?? []).map(sentence),
    sentence(`Calls ${def.calls.join(", ")}`),
  ].join(" ");
}

export function toModelContextTool(def: PageToolDef): ModelContextToolInit {
  const name = def.name;
  return {
    name,
    title: def.title,
    description: describeTool(def),
    inputSchema: z.toJSONSchema(def.input, { io: "input" }),
    annotations: { readOnlyHint: true },
    async execute(input, options) {
      const parsed = def.input.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          tool: name,
          error: "invalid-input",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        };
      }
      const signal = options?.signal ?? new AbortController().signal;
      let run: PageToolRun<unknown>;
      try {
        run = await def.run(parsed.data, signal);
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        if (error instanceof WidgetLoadError) {
          return {
            ok: false,
            tool: name,
            error: "unavailable",
            message: error.message,
          };
        }
        throw error;
      }
      if (signal.aborted) throw signal.reason;
      if (import.meta.env.DEV) assertJsonSafe(name, run);
      // A run's link is a site path. The agent may quote it in a chat or hand it to another
      // tool, so it leaves as a full URL on the page's own origin: localhost, a preview or the
      // live site.
      const answer =
        run.link === undefined
          ? run
          : { ...run, link: new URL(run.link, location.href).href };
      return { ok: true, tool: name, ...answer };
    },
  };
}

/** Whether `a` survives a JSON round trip as the very same value. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  return keys.every((key) => key in right && sameJson(left[key], right[key]));
}

/**
 * In dev and test, fail loudly on a result the browser would turn into `OperationError`: a
 * `Temporal` object, a `Map`, a `NaN` or an `undefined` field.
 */
function assertJsonSafe(tool: string, run: PageToolRun<unknown>): void {
  const text = JSON.stringify(run);
  if (text === undefined || !sameJson(JSON.parse(text), run)) {
    throw new Error(`${tool}: the result does not survive a JSON round trip`);
  }
}
