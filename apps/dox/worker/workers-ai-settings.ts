import type { Brain } from "../src/lib/chat-constants";

/** What `workers-ai-provider` needs, beyond the model id, for one brain.
 *  A type, not an interface, so it fits the provider's indexed settings. */
export type WorkersAISettings = {
  chat_template_kwargs?: { enable_thinking: boolean };
};

/**
 * The model settings for a Workers AI brain.
 *
 * `enableThinking` goes through `chat_template_kwargs`, the only switch that
 * turned thinking off for Gemma 4 and GLM 4.7 — see `Brain.enableThinking`.
 * The provider forwards it to the model's inputs on every call.
 */
export function workersAISettings(brain: Brain): WorkersAISettings {
  return brain.enableThinking === undefined
    ? {}
    : { chat_template_kwargs: { enable_thinking: brain.enableThinking } };
}
