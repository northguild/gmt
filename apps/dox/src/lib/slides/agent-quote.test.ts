import { describe, expect, it } from "vitest";
import record from "~/slides/give-me-temporal/quotes/agent-moment.json";
import { agentQuote } from "./agent-quote";

const full = {
  question: "q",
  model: "m",
  date: "d",
  answer: "a",
};

describe("the slide 2 agent quote", () => {
  it("is ready when every field is filled", () => {
    expect(agentQuote(full)).toEqual({ ready: true, ...full });
  });

  it.each(["question", "model", "date", "answer"] as const)(
    "is a seam while %s is empty",
    (field) => {
      expect(agentQuote({ ...full, [field]: "  " })).toEqual({ ready: false });
    },
  );

  it("reads the committed record", () => {
    expect(Object.keys(record).sort()).toEqual([
      "answer",
      "date",
      "model",
      "question",
    ]);
  });
});
