/**
 * Turns a tool call that a model wrote as text into a real one.
 *
 * GLM 4.7 Flash sometimes writes its own tool-call syntax into the answer
 * instead of making the call:
 *
 *   <tool_call>showGlobe<arg_key>zone</arg_key><arg_value>Asia/Tokyo</arg_value></tool_call>
 *
 * This middleware takes everything from `<tool_call>` to `</tool_call>` out of
 * the text, including a tag split across deltas (a partial open tag is held back
 * until it is known to be one) and a call the model never closed. A text block that held nothing but markup is dropped whole. Other
 * text, including a lone `<`, passes through unchanged.
 *
 * When the step made no real tool call, each complete written call that names
 * a tool on offer is sent as a real `tool-call` at the end of the step. The
 * SDK then runs the tool, the widget opens, and `WIDGET_THEN_PROSE` in
 * `brains.ts` asks for the prose. When the step made a real call as well, the
 * written ones are only dropped, so a widget never opens twice. A written call
 * that cannot be read, or names a tool not on offer, is only dropped.
 *
 * Gemma 4 writes a different syntax, with the same effect on the reader:
 *
 *   <|tool_call>call:showGlobe{zone:<|"|>Asia/Tokyo<|"|>}<tool_call|>
 *
 * Both are handled the same way. Values read from a Gemma call are matched to
 * the tool's schema (`tool-input-coercion.ts`), since its parser types a
 * quoted `"0"` and a bare `0` alike.
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
import { coerceObject } from "./tool-input-coercion";

type Part = LanguageModelV4StreamPart;
type TextDelta = Extract<Part, { type: "text-delta" }>;

/** GLM's format: the tool name, then any number of key and value pairs. */
const CALL_BODY =
  /^\s*([A-Za-z_][\w-]*)\s*((?:<arg_key>[\s\S]*?<\/arg_key>\s*<arg_value>[\s\S]*?<\/arg_value>\s*)*)$/;
const ARGUMENT =
  /<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g;

/** One way a model writes a call as text: its tags, and how to read what is between them. */
interface Format {
  open: string;
  close: string;
  read: (
    body: string,
    tools: LanguageModelV4CallOptions["tools"],
  ) => WrittenCall | undefined;
}

interface BlockState {
  /** The block's `text-start`, sent only once the block has visible text. */
  start: Part;
  started: boolean;
  /** The end of the text so far, when it could be the start of a tag. */
  pending: string;
  /** The format whose call is being read, between its tags. */
  inside: Format | undefined;
  /** The text of the call being read, between its tags. */
  body: string;
}

interface WrittenCall {
  toolName: string;
  input: string;
}

/** A call that closed, with the format that wrote it. */
interface WrittenBody {
  format: Format;
  body: string;
}

/** How many characters at the end of `text` could begin `tag`. */
function partialTagLength(text: string, tag: string): number {
  for (
    let length = Math.min(tag.length - 1, text.length);
    length > 0;
    length--
  ) {
    if (tag.startsWith(text.slice(-length))) return length;
  }
  return 0;
}

/**
 * Returns the visible text in `block.pending + delta`, updating `block`, and
 * adds each call that closes to `bodies`.
 */
function visibleText(
  block: BlockState,
  delta: string,
  bodies: WrittenBody[],
): string {
  let rest = block.pending + delta;
  let visible = "";
  block.pending = "";
  for (;;) {
    if (block.inside) {
      const { close } = block.inside;
      const at = rest.indexOf(close);
      if (at !== -1) {
        bodies.push({
          format: block.inside,
          body: block.body + rest.slice(0, at),
        });
        block.body = "";
        rest = rest.slice(at + close.length);
        block.inside = undefined;
        continue;
      }
      const held = partialTagLength(rest, close);
      block.body += rest.slice(0, rest.length - held);
      block.pending = rest.slice(rest.length - held);
      return visible;
    }
    // The first opening tag of any format.
    let first: { format: Format; at: number } | undefined;
    for (const format of FORMATS) {
      const at = rest.indexOf(format.open);
      if (at !== -1 && (!first || at < first.at)) first = { format, at };
    }
    if (first) {
      visible += rest.slice(0, first.at);
      rest = rest.slice(first.at + first.format.open.length);
      block.inside = first.format;
      block.body = "";
      continue;
    }
    const held = Math.max(
      ...FORMATS.map((format) => partialTagLength(rest, format.open)),
    );
    visible += rest.slice(0, rest.length - held);
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

/** Reads one GLM call, or `undefined` when it is not a call to a tool on offer. */
function readGlmCall(
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

/** Gemma's string delimiter. */
const GEMMA_QUOTE = '<|"|>';

/**
 * Reads Gemma's value syntax from `text` at `at`: a string between two
 * `<|"|>` tokens, an object `{k:v,...}`, an array `[v,...]`, or a bare
 * number, boolean, null or word. Returns `undefined` for text it cannot read.
 */
function readGemmaValue(
  text: string,
  at: number,
): { value: unknown; end: number } | undefined {
  if (text.startsWith(GEMMA_QUOTE, at)) {
    const from = at + GEMMA_QUOTE.length;
    const close = text.indexOf(GEMMA_QUOTE, from);
    if (close === -1) return undefined;
    return { value: text.slice(from, close), end: close + GEMMA_QUOTE.length };
  }
  if (text[at] === "{") return readGemmaObject(text, at);
  if (text[at] === "[") {
    const items: unknown[] = [];
    let cursor = at + 1;
    while (text[cursor] !== "]") {
      const item = readGemmaValue(text, cursor);
      if (!item) return undefined;
      items.push(item.value);
      cursor = item.end;
      if (text[cursor] === ",") cursor++;
      else if (text[cursor] !== "]") return undefined;
    }
    return { value: items, end: cursor + 1 };
  }
  const bare = /^[^,}\]]+/.exec(text.slice(at));
  if (!bare) return undefined;
  const word = bare[0].trim();
  let value: unknown = word;
  if (word === "true" || word === "false") value = word === "true";
  else if (word === "null") value = null;
  else if (word !== "" && Number.isFinite(Number(word))) value = Number(word);
  return { value, end: at + bare[0].length };
}

function readGemmaObject(
  text: string,
  at: number,
): { value: Record<string, unknown>; end: number } | undefined {
  if (text[at] !== "{") return undefined;
  const value: Record<string, unknown> = {};
  let cursor = at + 1;
  while (text[cursor] !== "}") {
    const key = /^\s*([A-Za-z_][\w-]*)\s*:/.exec(text.slice(cursor));
    if (!key) return undefined;
    const item = readGemmaValue(text, cursor + key[0].length);
    if (!item) return undefined;
    value[key[1]] = item.value;
    cursor = item.end;
    if (text[cursor] === ",") cursor++;
    else if (text[cursor] !== "}") return undefined;
  }
  return { value, end: cursor + 1 };
}

/** Reads one Gemma call, or `undefined` when it is not a call to a tool on offer. */
function readGemmaCall(
  body: string,
  tools: LanguageModelV4CallOptions["tools"],
): WrittenCall | undefined {
  const match = /^\s*call:([A-Za-z_][\w-]*)\s*/.exec(body);
  if (!match) return undefined;
  const tool = tools?.find(
    (candidate) => candidate.type === "function" && candidate.name === match[1],
  );
  if (tool?.type !== "function") return undefined;
  const text = body.slice(match[0].length);
  const read =
    text.trim() === "" ? { value: {}, end: 0 } : readGemmaObject(text, 0);
  if (!read || text.slice(read.end).trim() !== "") return undefined;
  return {
    toolName: tool.name,
    input: JSON.stringify(coerceObject(tool.inputSchema, read.value)),
  };
}

const FORMATS: readonly Format[] = [
  { open: "<tool_call>", close: "</tool_call>", read: readGlmCall },
  { open: "<|tool_call>", close: "<tool_call|>", read: readGemmaCall },
];

function markupTransform(
  tools: LanguageModelV4CallOptions["tools"],
): TransformStream<Part, Part> {
  const blocks = new Map<string, BlockState>();
  const bodies: WrittenBody[] = [];
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
            inside: undefined,
            body: "",
          });
          return;
        case "text-delta": {
          const block = blocks.get(part.id);
          if (block)
            send(
              controller,
              block,
              part,
              visibleText(block, part.delta, bodies),
            );
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
            send(
              controller,
              block,
              { type: "text-delta", id: part.id, delta: "" },
              block.pending,
            );
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
            : bodies.flatMap(
                ({ format, body }) => format.read(body, tools) ?? [],
              );
          for (const call of calls) {
            controller.enqueue({
              type: "tool-call",
              toolCallId: generateId(),
              ...call,
            });
          }
          controller.enqueue(
            calls.length > 0
              ? {
                  ...part,
                  finishReason: { ...part.finishReason, unified: "tool-calls" },
                }
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
    return {
      ...result,
      stream: result.stream.pipeThrough(markupTransform(params.tools)),
    };
  },
};
