/**
 * Turns a tool call that a model wrote as text into a real one.
 *
 * GLM 4.7 Flash sometimes writes its own tool-call syntax into the answer
 * instead of making the call:
 *
 *   <tool_call>showGlobe<arg_key>zone</arg_key><arg_value>Asia/Tokyo</arg_value></tool_call>
 *
 * This middleware takes everything from `<tool_call>` to `</tool_call>` out of
 * the text, including a tag split across deltas and a call the model never
 * closed. A text block that held nothing but markup is dropped whole. Other
 * text, including a lone `<`, passes through unchanged.
 *
 * When the step made no real tool call, each complete written call that names
 * a tool on offer is sent as a real `tool-call` at the end of the step. The
 * SDK then runs the tool, the widget opens, and `WIDGET_THEN_PROSE` in
 * `brains.ts` asks for the prose. When the step made a real call as well, the
 * written ones are only dropped, so a widget never opens twice. A written call
 * that cannot be read, or names a tool not on offer, is only dropped.
 *
 * It sits on the model, below `streamText`, so the SDK records and runs the
 * converted call exactly as if the model had made it.
 */
import type {
  JSONSchema7,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { generateId, type LanguageModelMiddleware } from "ai";

const OPEN = "<tool_call>";
const CLOSE = "</tool_call>";

type Part = LanguageModelV4StreamPart;
type TextDelta = Extract<Part, { type: "text-delta" }>;

/** GLM's format: the tool name, then any number of key and value pairs. */
const CALL_BODY =
  /^\s*([A-Za-z_][\w-]*)\s*((?:<arg_key>[\s\S]*?<\/arg_key>\s*<arg_value>[\s\S]*?<\/arg_value>\s*)*)$/;
const ARGUMENT =
  /<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g;

interface BlockState {
  /** The block's `text-start`, sent only once the block has visible text. */
  start: Part;
  started: boolean;
  /** The end of the text so far, when it could be the start of a tag. */
  pending: string;
  /** Between a `<tool_call>` and its `</tool_call>`. */
  inside: boolean;
  /** The text of the call being read, between its tags. */
  body: string;
}

interface WrittenCall {
  toolName: string;
  input: string;
}

/** How many characters at the end of `text` could begin `tag`. */
function partialTagLength(text: string, tag: string): number {
  for (let length = Math.min(tag.length - 1, text.length); length > 0; length--) {
    if (tag.startsWith(text.slice(-length))) return length;
  }
  return 0;
}

/**
 * Returns the visible text in `block.pending + delta`, updating `block`, and
 * adds the body of each call that closes to `bodies`.
 */
function visibleText(block: BlockState, delta: string, bodies: string[]): string {
  let rest = block.pending + delta;
  let visible = "";
  block.pending = "";
  for (;;) {
    const tag = block.inside ? CLOSE : OPEN;
    const at = rest.indexOf(tag);
    if (at !== -1) {
      if (block.inside) bodies.push(block.body + rest.slice(0, at));
      else visible += rest.slice(0, at);
      block.body = "";
      rest = rest.slice(at + tag.length);
      block.inside = !block.inside;
      continue;
    }
    const held = partialTagLength(rest, tag);
    const settled = rest.slice(0, rest.length - held);
    if (block.inside) block.body += settled;
    else visible += settled;
    block.pending = rest.slice(rest.length - held);
    return visible;
  }
}

/** A string property keeps its text; any other value is read as JSON. */
function argumentValue(schema: unknown, raw: string): unknown {
  const text = raw.trim();
  if (typeof schema === "object" && schema !== null) {
    const { type } = schema as JSONSchema7;
    if (type === "string" || (Array.isArray(type) && type.includes("string")))
      return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Reads one written call, or `undefined` when it is not a call to a tool on offer. */
function readWrittenCall(
  body: string,
  tools: LanguageModelV4CallOptions["tools"],
): WrittenCall | undefined {
  const match = CALL_BODY.exec(body);
  if (!match) return undefined;
  const [, name, argumentText] = match;
  const tool = tools?.find(
    (candidate) => candidate.type === "function" && candidate.name === name,
  );
  if (tool?.type !== "function") return undefined;
  const properties = tool.inputSchema.properties ?? {};
  const input: Record<string, unknown> = {};
  for (const [, key, raw] of argumentText.matchAll(ARGUMENT)) {
    const field = key.trim();
    input[field] = argumentValue(properties[field], raw);
  }
  return { toolName: tool.name, input: JSON.stringify(input) };
}

function markupTransform(
  tools: LanguageModelV4CallOptions["tools"],
): TransformStream<Part, Part> {
  const blocks = new Map<string, BlockState>();
  const bodies: string[] = [];
  let madeRealCall = false;

  const send = (
    controller: TransformStreamDefaultController<Part>,
    block: BlockState,
    part: TextDelta,
    text: string,
  ) => {
    if (text === "") return;
    if (!block.started) {
      controller.enqueue(block.start);
      block.started = true;
    }
    controller.enqueue({ ...part, delta: text });
  };

  return new TransformStream<Part, Part>({
    transform(part, controller) {
      switch (part.type) {
        case "text-start":
          blocks.set(part.id, {
            start: part,
            started: false,
            pending: "",
            inside: false,
            body: "",
          });
          return;
        case "text-delta": {
          const block = blocks.get(part.id);
          if (block) send(controller, block, part, visibleText(block, part.delta, bodies));
          else controller.enqueue(part);
          return;
        }
        case "text-end": {
          const block = blocks.get(part.id);
          if (!block) {
            controller.enqueue(part);
            return;
          }
          // A held `<` that never became a tag is ordinary text. A call the
          // model never closed is dropped.
          if (!block.inside && block.pending !== "") {
            send(controller, block, { type: "text-delta", id: part.id, delta: "" }, block.pending);
          }
          blocks.delete(part.id);
          if (block.started) controller.enqueue(part);
          return;
        }
        case "tool-call":
          madeRealCall = true;
          controller.enqueue(part);
          return;
        case "finish": {
          const calls = madeRealCall
            ? []
            : bodies.flatMap((body) => readWrittenCall(body, tools) ?? []);
          for (const call of calls) {
            controller.enqueue({ type: "tool-call", toolCallId: generateId(), ...call });
          }
          controller.enqueue(
            calls.length > 0
              ? { ...part, finishReason: { ...part.finishReason, unified: "tool-calls" } }
              : part,
          );
          return;
        }
        default:
          controller.enqueue(part);
      }
    },
  });
}

export const toolCallMarkupMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  wrapStream: async ({ doStream, params }) => {
    const result = await doStream();
    return { ...result, stream: result.stream.pipeThrough(markupTransform(params.tools)) };
  },
};
