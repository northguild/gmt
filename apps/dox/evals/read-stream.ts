/**
 * Reads one `/api/chat` response, as the UI message stream the Worker writes, into a
 * `TurnRecord` the graders check. Pure: it takes lines, so a recorded fixture and a live
 * response go through the same code. Loads under `tsx`.
 */
import {
  REFUSAL_PART_TYPE,
  RETRIEVAL_PART_TYPE,
  type RetrievalTraceData,
} from "../src/lib/chat-types";

export interface TurnRecord {
  /** HTTP status, set by the caller. */
  status: number;
  /** From the last data-retrieval part. */
  brainId?: string;
  /** The link allowlist, from the same part. */
  chunkUrls: string[];
  /** Server-measured, from the trace. */
  timings?: { firstToken?: number; total?: number };
  /** text-delta parts, concatenated. */
  answer: string;
  toolCalls: { toolName: string; input: unknown }[];
  /** A tool-input-start with no matching tool-input-available, and each tool-input-error. */
  toolErrors: string[];
  errors: string[];
  /** A data-refusal part arrived: the pool was spent mid-answer. */
  refusalPart: boolean;
}

const DATA_PREFIX = "data: ";

/** A record for a response that never streamed (a non-200 status). */
export function emptyRecord(status: number): TurnRecord {
  return {
    status,
    chunkUrls: [],
    answer: "",
    toolCalls: [],
    toolErrors: [],
    errors: [],
    refusalPart: false,
  };
}

export async function readStream(
  lines: AsyncIterable<string> | Iterable<string>,
  status = 200,
): Promise<TurnRecord> {
  const record = emptyRecord(status);
  const started = new Map<string, string>();
  const finished = new Set<string>();

  for await (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (!line.startsWith(DATA_PREFIX) || line === `${DATA_PREFIX}[DONE]`)
      continue;
    let part: Record<string, unknown>;
    try {
      part = JSON.parse(line.slice(DATA_PREFIX.length));
    } catch {
      record.errors.push("unreadable stream line");
      continue;
    }

    switch (part.type) {
      case RETRIEVAL_PART_TYPE: {
        // Written twice with one id: the second write wins.
        const data = part.data as RetrievalTraceData;
        record.brainId = data.brainId;
        record.chunkUrls = data.chunkUrls ?? [];
        record.timings = data.timings
          ? { firstToken: data.timings.firstToken, total: data.timings.total }
          : undefined;
        break;
      }
      case REFUSAL_PART_TYPE:
        record.refusalPart = true;
        break;
      case "text-delta":
        record.answer += String(part.delta ?? "");
        break;
      case "tool-input-start":
        started.set(String(part.toolCallId), String(part.toolName));
        break;
      case "tool-input-available":
        finished.add(String(part.toolCallId));
        record.toolCalls.push({
          toolName: String(part.toolName),
          input: part.input,
        });
        break;
      case "tool-input-error":
        finished.add(String(part.toolCallId));
        record.toolErrors.push(
          `${String(part.toolName)}: ${String(part.errorText ?? "input rejected")}`,
        );
        break;
      case "error":
        record.errors.push(String(part.errorText ?? "stream error"));
        break;
    }
  }

  for (const [id, toolName] of started) {
    if (!finished.has(id))
      record.toolErrors.push(`${toolName}: call never completed`);
  }
  return record;
}

/** The lines of a streamed body, for `readStream`. */
export async function* linesOf(
  body: AsyncIterable<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });
    const parts = buffered.split("\n");
    buffered = parts.pop() ?? "";
    yield* parts;
  }
  buffered += decoder.decode();
  if (buffered) yield buffered;
}
