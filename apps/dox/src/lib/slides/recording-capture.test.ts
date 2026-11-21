import { createCapture, findSecret } from "./recording-capture";

const line = (value: object): string => `data: ${JSON.stringify(value)}\n\n`;

describe("createCapture", () => {
  it("keeps chunks with offsets from the first byte, and drops the usage part", () => {
    const capture = createCapture();
    capture.push(line({ type: "start" }), 1000);
    capture.push(line({ type: "data-usage", data: { visitor: 1 } }), 1050);
    capture.push(line({ type: "text-delta", id: "t", delta: "Hi" }), 1200);
    capture.push("data: [DONE]\n\n", 1300);
    capture.finish();
    expect(capture.chunks().map((c) => [c.at, c.chunk.type])).toEqual([
      [0, "start"],
      [200, "text-delta"],
    ]);
    expect(capture.answer()).toBe("Hi");
  });

  it("joins a line split across two reads", () => {
    const capture = createCapture();
    const whole = line({ type: "text-delta", id: "t", delta: "ab" });
    capture.push(whole.slice(0, 10), 0);
    capture.push(whole.slice(10), 5);
    expect(capture.answer()).toBe("ab");
  });

  it("names the brain and the tools, and reports a failure", () => {
    const capture = createCapture();
    capture.push(
      line({
        type: "data-retrieval",
        data: { brainId: "g", brainLabel: "Gemma" },
      }) +
        line({
          type: "tool-input-start",
          toolCallId: "1",
          toolName: "convert_x",
        }) +
        line({
          type: "tool-input-start",
          toolCallId: "2",
          toolName: "convert_x",
        }),
      0,
    );
    expect(capture.brain()).toEqual({ id: "g", label: "Gemma" });
    expect(capture.tools()).toEqual(["convert_x"]);
    expect(capture.failure()).toBeNull();
    capture.push(line({ type: "data-refusal", data: {} }), 1);
    expect(capture.failure()).toBe("refused");
  });
});

describe("findSecret", () => {
  it("finds the key and the dev-key markers, and passes clean text", () => {
    expect(findSecret("a longsecret b", ["longsecret"])).not.toBeNull();
    expect(findSecret("cookie dox_dev=1", [])).not.toBeNull();
    expect(findSecret("/api/brains?key=1", [])).not.toBeNull();
    expect(findSecret("a leap second", ["longsecret"])).toBeNull();
  });
});
