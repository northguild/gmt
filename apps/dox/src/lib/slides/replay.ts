/**
 * A recorded Dox answer, and the stream that plays it back.
 *
 * `scripts/record-deck-answers.ts` stores the raw UI-message chunks of a real `/gmt/api/chat`
 * answer, each with its offset in milliseconds from the first byte. `replayStream` turns that
 * back into a `ReadableStream` of the same chunks at the same offsets, so the live answer and the
 * recording go through one reader (`deck-transport.ts`) and one renderer.
 *
 * Imports no library but types: the offsets use `setTimeout`, a duration and not a reading of
 * time. The date in the label comes from gmt (`formatRecordedLabel`).
 */
import type { UIMessageChunk } from "ai";

/** One chunk and when it arrived, in ms after the first byte. */
export interface RecordedChunk {
  at: number;
  chunk: UIMessageChunk;
}

export interface Recording {
  /** The demo it answers: `ask-dox` or an audience question's id. */
  id: string;
  /** The question, word for word as it was sent. */
  question: string;
  /** The brain that answered, from the retrieval trace. */
  brain: { id: string; label: string };
  /** When the answer was recorded: a UTC instant, from gmt's clock. */
  instant: string;
  chunks: RecordedChunk[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The recording `value` is, or `null` when any part is missing or the wrong shape. A chunk must
 * be an object with a string `type`, and the offsets must not go back in time.
 */
export function parseRecording(value: unknown): Recording | null {
  if (!isRecord(value)) return null;
  const { id, question, brain, instant, chunks } = value;
  if (typeof id !== "string" || id === "") return null;
  if (typeof question !== "string" || question === "") return null;
  if (typeof instant !== "string" || instant === "") return null;
  if (!isRecord(brain)) return null;
  if (typeof brain["id"] !== "string" || brain["id"] === "") return null;
  if (typeof brain["label"] !== "string" || brain["label"] === "") return null;
  if (!Array.isArray(chunks) || chunks.length === 0) return null;
  let last = 0;
  const parsed: RecordedChunk[] = [];
  for (const entry of chunks) {
    if (!isRecord(entry)) return null;
    const at = entry["at"];
    const chunk = entry["chunk"];
    if (typeof at !== "number" || !Number.isFinite(at) || at < last)
      return null;
    if (!isRecord(chunk) || typeof chunk["type"] !== "string") return null;
    last = at;
    parsed.push({ at, chunk: chunk as unknown as UIMessageChunk });
  }
  return {
    id,
    question,
    brain: { id: brain["id"], label: brain["label"] },
    instant,
    chunks: parsed,
  };
}

/**
 * The chunks at their offsets. Aborting `signal` errors the stream with the signal's reason and
 * clears the pending timer, so nothing is left running.
 */
export function replayStream(
  recording: Recording,
  signal?: AbortSignal,
): ReadableStream<UIMessageChunk> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let onAbort: (() => void) | undefined;
  const stop = (): void => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  };
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      const { chunks } = recording;
      let index = 0;
      let clock = 0;
      const next = (): void => {
        if (stopped) return;
        const entry = chunks[index];
        if (!entry) {
          stop();
          controller.close();
          return;
        }
        const wait = Math.max(0, entry.at - clock);
        timer = setTimeout(() => {
          timer = undefined;
          if (stopped) return;
          clock = entry.at;
          index += 1;
          controller.enqueue(entry.chunk);
          next();
        }, wait);
      };
      if (signal) {
        onAbort = () => {
          if (stopped) return;
          stop();
          controller.error(signal.reason);
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      next();
    },
    cancel() {
      stop();
    },
  });
}

/**
 * `Recorded 16 December 2026, Gemma 4 26B`: the date in the talk's zone (the deck's venue zone,
 * `DeckEntry.zone`), read with gmt. An instant gmt refuses gives the label without a date, never a blank.
 */
export async function formatRecordedLabel(
  recording: Pick<Recording, "instant" | "brain">,
  zone: string,
): Promise<string> {
  const { formatUtc } = await import("@northguild/gmt/utc/format");
  const date = formatUtc(recording.instant, "en-GB", {
    timeZone: zone,
    dateStyle: "long",
  });
  return date === ""
    ? `Recorded, ${recording.brain.label}`
    : `Recorded ${date}, ${recording.brain.label}`;
}

/**
 * The recordings among `files` (a deck's `recorded/*.json`, read at build time) that parse and
 * have one of `ids`, in file order. A missing recording is left out and the slide says "Recording
 * to come" when its question is asked; one that does not parse is left out too.
 */
export function selectRecordings(
  files: readonly unknown[],
  ids: readonly string[],
): Recording[] {
  const out: Recording[] = [];
  for (const value of files) {
    const recording = parseRecording(value);
    if (recording && ids.includes(recording.id)) out.push(recording);
  }
  return out;
}
