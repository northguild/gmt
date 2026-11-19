import { InvalidToolInputError, NoSuchToolError, type ToolSet } from "ai";
import type { JSONSchema7 } from "@ai-sdk/provider";
import { repairToolCall } from "./repair-tool-call";

const SCHEMA: JSONSchema7 = {
  type: "object",
  properties: {
    mode: { type: "string" },
    week: { type: "integer" },
    rolloverEra: { type: "string" },
    flag: { type: "boolean" },
    legs: {
      type: "array",
      items: { type: "object", properties: { hours: { type: "number" } } },
    },
  },
};

async function repair(input: string, error: unknown = invalid(input)) {
  return repairToolCall({
    instructions: undefined,
    system: undefined,
    messages: [],
    toolCall: {
      type: "tool-call",
      toolCallId: "c1",
      toolName: "showGnssWeekDecoder",
      input,
    },
    tools: {} as ToolSet,
    inputSchema: async () => SCHEMA,
    error: error as InvalidToolInputError,
  });
}

const invalid = (toolInput: string) =>
  new InvalidToolInputError({
    toolName: "showGnssWeekDecoder",
    toolInput,
    cause: new Error("schema"),
  });

describe("repairToolCall", () => {
  it("writes a number the schema wants as text, as the lenient provider parser sent it", async () => {
    // `starter-showGnssWeekDecoder`: era "0" arrived as the number 0.
    const fixed = await repair(
      '{"mode":"broadcast","week":1024,"rolloverEra":0}',
    );
    expect(JSON.parse(fixed?.input ?? "null")).toEqual({
      mode: "broadcast",
      week: 1024,
      rolloverEra: "0",
    });
  });

  it("reads numeric and boolean text where the schema wants them, nested too", async () => {
    const fixed = await repair(
      '{"week":"1024","flag":"true","legs":[{"hours":"6.5"}]}',
    );
    expect(JSON.parse(fixed?.input ?? "null")).toEqual({
      week: 1024,
      flag: true,
      legs: [{ hours: 6.5 }],
    });
  });

  it("removes Gemma's quote token from a value", async () => {
    const fixed = await repair('{"mode":"<|\\"|>broadcast<|\\"|>"}');
    expect(JSON.parse(fixed?.input ?? "null")).toEqual({ mode: "broadcast" });
  });

  it("never changes what a value says", async () => {
    expect(await repair('{"week":"soon"}')).toBeNull();
    expect(await repair('{"mode":"broadcast"}')).toBeNull();
  });

  it("leaves unreadable input and other errors alone", async () => {
    expect(await repair("{not json")).toBeNull();
    expect(
      await repair(
        '{"rolloverEra":0}',
        new NoSuchToolError({ toolName: "x", availableTools: [] }),
      ),
    ).toBeNull();
  });
});
