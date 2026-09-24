/**
 * Where the time goes in one `/api/chat` request.
 *
 * `Stopwatch` times the stages that run before the stream opens — the ledger
 * read, the corpus fetch, the search, the prompt, the walk across brains — and
 * `observeOutput` watches the model's own stream for the two moments the
 * reader feels: the first chunk of output, and the end. Both feed the
 * retrieval trace in the transcript and the `dox-timing` log line, so a slow
 * answer can be told apart from a slow walk past spent brains, or from a
 * retrieval that has quietly grown.
 */
import type { RetrievalTimings } from "../src/lib/chat-types";

export class Stopwatch {
  private readonly started: number;
  private readonly stages: Partial<RetrievalTimings> = {};

  constructor(private readonly clock: () => number = () => performance.now()) {
    this.started = clock();
  }

  /** Times one stage. Whole milliseconds: a sub-millisecond stage reads as 0. */
  async time<T>(
    stage: keyof RetrievalTimings,
    work: () => T | Promise<T>,
  ): Promise<T> {
    const at = this.clock();
    try {
      return await work();
    } finally {
      this.stages[stage] = Math.round(this.clock() - at);
    }
  }

  /** Milliseconds since the request arrived. */
  elapsed(): number {
    return Math.round(this.clock() - this.started);
  }

  /** The stages timed so far, every pre-stream stage present (0 if skipped). */
  snapshot(): RetrievalTimings {
    return {
      usage: this.stages.usage ?? 0,
      corpus: this.stages.corpus ?? 0,
      search: this.stages.search ?? 0,
      prompt: this.stages.prompt ?? 0,
      brains: this.stages.brains ?? 0,
      ...(this.stages.firstToken !== undefined && {
        firstToken: this.stages.firstToken,
      }),
      ...(this.stages.total !== undefined && { total: this.stages.total }),
    };
  }

  /** Records the moment the reader first sees output. Once only. */
  markFirstToken(): void {
    if (this.stages.firstToken === undefined) {
      this.stages.firstToken = this.elapsed();
    }
  }

  /** Records the end of the answer. */
  markTotal(): void {
    this.stages.total = this.elapsed();
  }
}

/** The model-stream chunks that count as output the reader can see. Tool
 * input deltas count too: the widget rail opens on them before any prose. */
const OUTPUT_TYPES = new Set([
  "text-delta",
  "tool-input-start",
  "tool-input-delta",
  "tool-call",
]);

export interface OutputHooks {
  /** The first chunk of visible output. Called at most once. */
  onFirstOutput: () => void;
  /** A tool call, with its name. Called once per call. */
  onToolCall: (toolName: string) => void;
  /** The stream has ended, however it ended. Called once. */
  onEnd: () => void;
}

/**
 * Passes the model stream through untouched, reporting the first output, any
 * tool call, and the end. `onEnd` runs on close *and* on error, so a stream
 * that dies mid-answer still gets its total recorded.
 */
export function observeOutput<T extends { type: string }>(
  stream: ReadableStream<T>,
  hooks: OutputHooks,
): ReadableStream<T> {
  let sawOutput = false;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    hooks.onEnd();
  };
  return stream.pipeThrough(
    new TransformStream<T, T>({
      transform(chunk, controller) {
        if (!sawOutput && OUTPUT_TYPES.has(chunk.type)) {
          sawOutput = true;
          hooks.onFirstOutput();
        }
        if (chunk.type === "tool-call" && "toolName" in chunk) {
          hooks.onToolCall(String((chunk as { toolName: unknown }).toolName));
        }
        if (chunk.type === "error") end();
        controller.enqueue(chunk);
      },
      flush() {
        end();
      },
    }),
  );
}
