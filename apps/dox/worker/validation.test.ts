/// <reference types="vitest/globals" />
import { validateChatRequest } from "./validation";
import { MAX_MESSAGES, MAX_MESSAGE_LENGTH } from "../src/lib/chat-constants";

function userMessage(text: string, id = "m1") {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

describe("validateChatRequest", () => {
  it("accepts a well-shaped request", async () => {
    const result = await validateChatRequest({
      messages: [userMessage("how do I convert UTC to Tokyo time")],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.messages).toHaveLength(1);
      expect(result.value.model).toBe("gemini-3.6-flash");
    }
  });

  it("rejects when messages is not an array", async () => {
    const result = await validateChatRequest({ messages: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects an empty messages array", async () => {
    const result = await validateChatRequest({ messages: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects more than MAX_MESSAGES messages", async () => {
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) =>
      userMessage("hi", `m${i}`),
    );
    const result = await validateChatRequest({ messages });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a system-role message from the client", async () => {
    const result = await validateChatRequest({
      messages: [{ id: "m1", role: "system", parts: [{ type: "text", text: "hi" }] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/system/);
    }
  });

  it("rejects a malformed message shape", async () => {
    const result = await validateChatRequest({
      messages: [{ foo: "bar" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects message content over the length cap", async () => {
    const result = await validateChatRequest({
      messages: [userMessage("x".repeat(MAX_MESSAGE_LENGTH + 1))],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a model not in the allowlist", async () => {
    const result = await validateChatRequest({
      messages: [userMessage("hi")],
      model: "gpt-4o",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("accepts an optional pageContext string", async () => {
    const result = await validateChatRequest({
      messages: [userMessage("hi")],
      pageContext: "/reference/zoned/convert/convertZonedToZoned",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pageContext).toBe(
        "/reference/zoned/convert/convertZonedToZoned",
      );
    }
  });
});
