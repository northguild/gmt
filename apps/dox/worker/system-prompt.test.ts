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
  it("emits all eight sections in order", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: CHUNKS.map((c) => c.url),
      chunks: CHUNKS,
      vocabulary: "VOCAB_MARKER",
      coreRules: "CORE_RULES_MARKER",
    });

    const headings = [
      "## Persona and scope",
      /* The prompt-injection boundary. It was missing from this list, which
         meant the whole section could be deleted and this test — the only one
         that looks at prompt structure — would still pass. */
      "## Standing order",
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

  /* This assertion used to pass `routeAllowlist` and `chunks` from one fixture
     and then only check `prompt).toContain(chunk.url)` — which would hold
     just as well if `assembleSystemPrompt` ignored `routeAllowlist` entirely,
     or if the caller passed the whole 500-plus entry manifest. The property the
     prompt's own docstring rests on ("a model shown 20 valid routes
     hallucinates far less than one shown 120") was asserted nowhere. */
  it("lists exactly the retrieved routes in the linking rules, and no others", () => {
    const decoys = [
      "/reference/plain/calculate/addPlainDate",
      "/reference/duration/format/formatDuration",
    ];
    const prompt = assembleSystemPrompt({
      routeAllowlist: CHUNKS.map((c) => c.url),
      chunks: CHUNKS,
      vocabulary: "",
      coreRules: "",
    });

    const allowlistBlock = prompt.slice(
      prompt.indexOf("## Linking rules"),
      prompt.indexOf("## Vocabulary"),
    );
    const listed = allowlistBlock
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2));

    expect(listed).toEqual(CHUNKS.map((c) => c.url));
    // A route that was not retrieved must not appear anywhere in the prompt.
    for (const decoy of decoys) expect(prompt).not.toContain(decoy);
  });


  it("labels the retrieved context with each chunk's URL", () => {
    const prompt = assembleSystemPrompt({
      routeAllowlist: CHUNKS.map((c) => c.url),
      chunks: CHUNKS,
      vocabulary: "",
      coreRules: "",
    });
    expect(prompt).toContain(`### convertZonedToZoned (${CHUNKS[0].url})`);
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
