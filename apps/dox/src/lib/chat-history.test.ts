/// <reference types="vitest/globals" />
import type { UIMessage } from "ai";
import { messageText, sendableHistory } from "./chat-history";

const user = (id: string, text: string) =>
  ({ id, role: "user", parts: [{ type: "text", text }] }) as UIMessage;

const assistant = (id: string, text: string) =>
  ({ id, role: "assistant", parts: [{ type: "text", text }] }) as UIMessage;

/** What a turn killed before its first token actually looks like: the
 *  retrieval trace arrived, the answer never did. */
const traceOnly = (id: string) =>
  ({
    id,
    role: "assistant",
    parts: [
      { type: "data-retrieval", data: { searched: 755, matched: 4 } },
    ],
  }) as unknown as UIMessage;

describe("sendableHistory", () => {
  it("keeps a normal exchange intact", () => {
    const history = [user("m1", "hello"), assistant("m2", "hi"), user("m3", "more")];
    expect(sendableHistory(history)).toEqual(history);
  });

  it("drops an assistant turn that never received a token", () => {
    const history = [user("m1", "hello"), assistant("m2", ""), user("m3", "again")];
    expect(sendableHistory(history).map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  it("drops an assistant turn carrying only a retrieval trace", () => {
    // A rate limit or provider error lands here: the trace streamed, the
    // answer did not.
    const history = [user("m1", "hello"), traceOnly("m2")];
    expect(sendableHistory(history).map((m) => m.id)).toEqual(["m1"]);
  });

  it("drops an assistant turn that is only whitespace", () => {
    const history = [user("m1", "hello"), assistant("m2", "   \n  ")];
    expect(sendableHistory(history).map((m) => m.id)).toEqual(["m1"]);
  });

  it("never drops a user turn, even an empty one", () => {
    // The edge validates and rejects those; silently rewriting what the reader
    // can see on screen is not this function's job.
    const history = [user("m1", ""), user("m2", "real question")];
    expect(sendableHistory(history)).toHaveLength(2);
  });

  it("leaves a still-streaming assistant turn alone once it has text", () => {
    // Mid-stream the turn is partial but real — it is context for the next
    // question, and the reader can see it.
    const history = [user("m1", "hello"), assistant("m2", "partial ans")];
    expect(sendableHistory(history)).toHaveLength(2);
  });
});

describe("messageText", () => {
  it("joins text parts and ignores everything else", () => {
    const message = {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "data-retrieval", data: {} },
        { type: "text", text: "one " },
        { type: "text", text: "two" },
      ],
    } as unknown as UIMessage;
    expect(messageText(message)).toBe("one two");
  });
});
