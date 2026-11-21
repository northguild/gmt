/**
 * Turns the bytes of a `/gmt/api/chat` event stream into a recording's chunks
 * (`scripts/record-deck-answers.ts` feeds it; `replay.ts` plays the result).
 *
 * Each `data: {json}` line is one UI-message chunk. The capture keeps every chunk except
 * `data-usage`, which holds the visitor's and the brains' counters and has no place in a file that
 * ships with the site. It notes the brain from the retrieval trace and the tools the model called,
 * so the script can say whether an answer used gmt's tools. No imports beyond types, so Node's
 * type stripping can run it.
 */
import type { RecordedChunk } from "./replay";

const RETRIEVAL = "data-retrieval";
const USAGE = "data-usage";

export interface Capture {
  /** Adds the next decoded text and the ms since the first byte it arrived at. */
  push(text: string, atMs: number): void;
  /** Reads a last line that had no newline after it. */
  finish(): void;
  chunks(): RecordedChunk[];
  brain(): { id: string; label: string } | null;
  tools(): string[];
  /** Text of the answer, for a sanity read by the person recording. */
  answer(): string;
  /** A stream-level failure the Worker reported, or null. */
  failure(): string | null;
}

export function createCapture(): Capture {
  const chunks: RecordedChunk[] = [];
  const tools: string[] = [];
  let brain: { id: string; label: string } | null = null;
  let answer = "";
  let failure: string | null = null;
  let buffered = "";
  let lastAt = 0;
  let origin: number | null = null;

  const take = (line: string, atMs: number): void => {
    if (!line.startsWith("data: ") || line === "data: [DONE]") return;
    let chunk: unknown;
    try {
      chunk = JSON.parse(line.slice("data: ".length));
    } catch {
      return;
    }
    if (typeof chunk !== "object" || chunk === null) return;
    const part = chunk as Record<string, unknown>;
    if (typeof part["type"] !== "string") return;
    const type = part["type"];
    if (type === USAGE) return;
    if (type === RETRIEVAL) {
      const data = part["data"] as Record<string, unknown> | undefined;
      if (data && typeof data["brainId"] === "string") {
        brain = {
          id: data["brainId"],
          label:
            typeof data["brainLabel"] === "string" && data["brainLabel"] !== ""
              ? data["brainLabel"]
              : data["brainId"],
        };
      }
    }
    if (type === "text-delta" && typeof part["delta"] === "string")
      answer += part["delta"];
    if (type === "tool-input-start" && typeof part["toolName"] === "string")
      tools.push(part["toolName"]);
    if (type === "error") failure = String(part["errorText"] ?? "error");
    if (type === "data-refusal") failure = "refused";
    origin ??= atMs;
    // Offsets never go back, which `parseRecording` requires.
    lastAt = Math.max(lastAt, Math.round(atMs - origin));
    chunks.push({ at: lastAt, chunk: chunk as RecordedChunk["chunk"] });
  };

  return {
    push(text, atMs) {
      buffered += text;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) take(line.trimEnd(), atMs);
    },
    finish() {
      if (buffered !== "") take(buffered.trimEnd(), lastAt + (origin ?? 0));
      buffered = "";
    },
    chunks: () => chunks,
    brain: () => brain,
    tools: () => [...new Set(tools)],
    answer: () => answer,
    failure: () => failure,
  };
}

/** The strings that must never reach a recording or the built site. */
export function findSecret(
  text: string,
  secrets: readonly string[],
): string | null {
  for (const secret of secrets) {
    if (secret.length >= 4 && text.includes(secret)) return "a secret value";
  }
  return /dox_dev|[?&]key=/.test(text) ? "a dev key marker" : null;
}
