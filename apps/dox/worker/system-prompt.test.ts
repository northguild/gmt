/// <reference types="vitest/globals" />
import { assembleSystemPrompt } from "./system-prompt";
import type { RetrievalChunk } from "../src/lib/retrieval/types";

const CHUNKS: RetrievalChunk[] = [
  {
    id: "zoned/convert/convertZonedToZoned",
    kind: "function",
    url: "/reference/zoned/convert/convertZonedToZoned",
    namespace: "zoned",
    title: "convertZonedToZoned",
    text: "convertZonedToZoned(value, from, to): converts between IANA zones",
  },
];

describe("assembleSystemPrompt", () => {
  it("emits all seven sections in order", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: CHUNKS.map((c) => c.url),
      chunks: CHUNKS,
      vocabulary: "VOCAB_MARKER",
      coreRules: "CORE_RULES_MARKER",
    });

    const headings = [
      "## Persona and scope",
      "## Linking rules",
      "## Vocabulary",
      "## Core rules",
      "## Retrieved context",
      "## Available tools",
      "## Refusal instruction",
    ];
    const positions = headings.map((h) => prompt.indexOf(h));
    expect(positions.every((p) => p !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("includes the injected vocabulary and core rules verbatim", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: [],
      chunks: [],
      vocabulary: "VOCAB_MARKER",
      coreRules: "CORE_RULES_MARKER",
    });
    expect(prompt).toContain("VOCAB_MARKER");
    expect(prompt).toContain("CORE_RULES_MARKER");
  });

  it("the route allowlist matches the retrieved set exactly", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: CHUNKS.map((c) => c.url),
      chunks: CHUNKS,
      vocabulary: "",
      coreRules: "",
    });
    for (const chunk of CHUNKS) {
      expect(prompt).toContain(chunk.url);
    }
  });

  it("labels the retrieved context with each chunk's URL", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: CHUNKS.map((c) => c.url),
      chunks: CHUNKS,
      vocabulary: "",
      coreRules: "",
    });
    expect(prompt).toContain(
      `### convertZonedToZoned (${CHUNKS[0].url})`,
    );
  });

  it("is honest about an empty retrieval — no chunks, no allowlist entries", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: [],
      chunks: [],
      vocabulary: "",
      coreRules: "",
    });
    expect(prompt).toContain("no chunks retrieved for this question");
    expect(prompt).toContain("this question retrieved no pages");
  });
});
