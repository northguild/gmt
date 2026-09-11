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

  describe("the tools block's disposition", () => {
    /* This block was rewritten after live measurement. The original closed with
       "Prefer prose. Call a tool only when seeing the thing beats reading about
       it.", and that sentence measurably suppressed calls: a question matching
       `showConverterBench`'s `Call when` line word for word produced a tool call
       in 0 of 3 attempts across three brains. The instruction now keys off the
       `Call when` lines instead of the model's own judgement about whether a
       widget is warranted. */
    const withTools = () =>
      assembleSystemPrompt({
        routeAllowlist: CHUNKS.map((c) => c.url),
        chunks: CHUNKS,
        vocabulary: "VOCAB_MARKER",
        coreRules: "CORE_RULES_MARKER",
        tools: [
          {
            name: "showConverterBench",
            purpose: "A converter.",
            when: "the reader asks to convert a specific time between two zones",
            args: "value, from, to",
          },
        ],
      });

    it("tells the model to call on a match rather than to prefer prose", () => {
      const prompt = withTools();
      expect(prompt).toContain("call that tool");
      expect(prompt).not.toContain("Prefer prose");
    });

    it("still forbids a bare tool call with no answer", () => {
      // The prose-first rule is what stops a widget mounting beside silence;
      // loosening the call bias must not loosen this.
      const prompt = withTools();
      expect(prompt).toContain("Never reply with only a tool call");
      expect(prompt).toContain("Write your prose answer first");
    });

    it("still caps a turn at one widget", () => {
      expect(withTools()).toContain("At most one tool per answer");
    });

    it("still refuses to invent a zone", () => {
      expect(withTools()).toContain("Never invent one");
    });

    it("still says nothing is the default when no line matches", () => {
      expect(withTools()).toContain("There is no default widget");
    });
  });
});
