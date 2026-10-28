import { BRAINS, type Brain } from "../src/lib/chat-constants";
import { workersAISettings } from "./workers-ai-settings";

const brain = (overrides: Partial<Brain>): Brain => ({
  id: "cf-test",
  label: "Test",
  provider: "workers-ai",
  dailyLimit: 1,
  ...overrides,
});

describe("workersAISettings", () => {
  it("sends thinking off as chat_template_kwargs", () => {
    expect(workersAISettings(brain({ enableThinking: false }))).toEqual({
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it("sends thinking on when a brain asks for it", () => {
    expect(workersAISettings(brain({ enableThinking: true }))).toEqual({
      chat_template_kwargs: { enable_thinking: true },
    });
  });

  it("sends nothing when a brain leaves the model's default", () => {
    expect(workersAISettings(brain({}))).toEqual({});
  });

  // Both lineup models think by default, and thinking was the slow part:
  // 4–21 s against 1.6–2.5 s with it off.
  it("turns thinking off for every Workers AI brain in the lineup", () => {
    const workersAI = BRAINS.filter((b) => b.provider === "workers-ai");
    expect(workersAI.length).toBeGreaterThan(0);
    for (const b of workersAI) {
      expect(workersAISettings(b)).toEqual({
        chat_template_kwargs: { enable_thinking: false },
      });
    }
  });
});
