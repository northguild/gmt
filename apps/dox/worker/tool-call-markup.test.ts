import type {
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { toolCallMarkupMiddleware } from "./tool-call-markup";

type Part = LanguageModelV4StreamPart;

const TOOLS: LanguageModelV4CallOptions["tools"] = [
  {
    type: "function",
    name: "showGlobe",
    inputSchema: {
      type: "object",
      properties: { zone: { type: "string" } },
    },
  },
  {
    type: "function",
    name: "showConverterBench",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        hours: { type: "number" },
      },
    },
  },
];

const FINISH: Part = {
  type: "finish",
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: {
      total: 1,
      noCache: 1,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
};

/** Runs `parts` through the middleware, as a model call offering `tools`. */
async function run(
  parts: Part[],
  tools: LanguageModelV4CallOptions["tools"] = TOOLS,
): Promise<Part[]> {
  const wrapStream = toolCallMarkupMiddleware.wrapStream;
  if (!wrapStream) throw new Error("wrapStream missing");
  const result = await wrapStream({
    doGenerate: () => {
      throw new Error("not used");
    },
    doStream: async () => ({
      stream: new ReadableStream<Part>({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      }),
    }),
    params: { prompt: [], tools } as LanguageModelV4CallOptions,
    model: {} as never,
  });
  const out: Part[] = [];
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

/** One text block, sent as the given deltas, then the finish. */
function textStep(...deltas: string[]): Part[] {
  return [
    { type: "text-start", id: "t" },
    ...deltas.map((delta): Part => ({ type: "text-delta", id: "t", delta })),
    { type: "text-end", id: "t" },
    FINISH,
  ];
}

function textOf(parts: Part[]): string {
  return parts
    .map((part) => (part.type === "text-delta" ? part.delta : ""))
    .join("");
}

function callsOf(parts: Part[]) {
  return parts.flatMap((part) =>
    part.type === "tool-call"
      ? [{ toolName: part.toolName, input: JSON.parse(part.input) as unknown }]
      : [],
  );
}

function finishOf(parts: Part[]) {
  const finish = parts.at(-1);
  return finish?.type === "finish" ? finish.finishReason.unified : undefined;
}

const GLM_CALL =
  "<tool_call>showGlobe<arg_key>zone</arg_key><arg_value>Asia/Tokyo</arg_value></tool_call>";

describe("toolCallMarkupMiddleware", () => {
  it("passes ordinary text through unchanged", async () => {
    const out = await run(textStep("Tokyo is ", "UTC+9 all year."));
    expect(textOf(out)).toBe("Tokyo is UTC+9 all year.");
    expect(out.map((part) => part.type)).toEqual([
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "finish",
    ]);
    expect(finishOf(out)).toBe("stop");
  });

  it("turns a call written as text into a real one at the end of the step", async () => {
    const out = await run(textStep(GLM_CALL));
    expect(out.map((part) => part.type)).toEqual(["tool-call", "finish"]);
    expect(callsOf(out)).toEqual([
      { toolName: "showGlobe", input: { zone: "Asia/Tokyo" } },
    ]);
    expect(finishOf(out)).toBe("tool-calls");
  });

  it("keeps the prose around a written call", async () => {
    const out = await run(textStep(`Here it is. ${GLM_CALL} Enjoy.`));
    expect(textOf(out)).toBe("Here it is.  Enjoy.");
    expect(callsOf(out)).toHaveLength(1);
  });

  it("reads a call whose tags are split across deltas", async () => {
    const out = await run(
      textStep(
        "Before <too",
        "l_call>showGlobe<arg_k",
        "ey>zone</arg_key><arg_value>Asia/To",
        "kyo</arg_value></tool",
        "_call> after",
      ),
    );
    expect(textOf(out)).toBe("Before  after");
    expect(callsOf(out)).toEqual([
      { toolName: "showGlobe", input: { zone: "Asia/Tokyo" } },
    ]);
  });

  it("reads a value that is not a string as JSON, and keeps a string as text", async () => {
    const out = await run(
      textStep(
        "<tool_call>showConverterBench<arg_key>from</arg_key><arg_value>2024-03-15</arg_value>" +
          "<arg_key>hours</arg_key><arg_value>9</arg_value></tool_call>",
      ),
    );
    expect(callsOf(out)).toEqual([
      {
        toolName: "showConverterBench",
        input: { from: "2024-03-15", hours: 9 },
      },
    ]);
  });

  it("only drops written calls when the step also made a real call", async () => {
    const real: Part = {
      type: "tool-call",
      toolCallId: "c1",
      toolName: "showGlobe",
      input: JSON.stringify({ zone: "Asia/Tokyo" }),
    };
    const steps = textStep(GLM_CALL);
    const out = await run([...steps.slice(0, -1), real, FINISH]);
    expect(out).toEqual([real, FINISH]);
  });

  it("drops a written call to a tool that is not on offer", async () => {
    const out = await run(textStep(GLM_CALL), []);
    expect(out).toEqual([FINISH]);
  });

  it("drops a written call it cannot read", async () => {
    const out = await run(textStep("<tool_call>show Globe please</tool_call>"));
    expect(out).toEqual([FINISH]);
  });

  it("drops an unclosed call at the end of the block", async () => {
    const out = await run(
      textStep(
        "Done. <tool_call>showGlobe<arg_key>zone</arg_key><arg_value>Asia/To",
      ),
    );
    expect(textOf(out)).toBe("Done. ");
    expect(callsOf(out)).toEqual([]);
    expect(finishOf(out)).toBe("stop");
  });

  it("keeps a lone `<` that does not start a call", async () => {
    const out = await run(textStep("a <", " b and x <t", "able>"));
    expect(textOf(out)).toBe("a < b and x <table>");
  });

  it("releases a held `<` when the block ends", async () => {
    const out = await run(textStep("3 <"));
    expect(textOf(out)).toBe("3 <");
  });
});
