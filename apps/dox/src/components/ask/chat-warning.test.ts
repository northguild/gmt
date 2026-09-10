/// <reference types="vitest/globals" />
/**
 * @vitest-environment jsdom
 *
 * Needs a DOM: the dev-only 404 message is gated on `window.location.hostname`
 * being localhost, so that a real reader hitting a misconfigured production
 * deployment is never told to run `wrangler dev`. jsdom's default location is
 * localhost, which is exactly the case under test.
 */
import { classifyChatError } from "./chat-warning";

function errorWith(cause: unknown): Error {
  return new Error("Chat request failed", { cause });
}

describe("classifyChatError", () => {
  it("surfaces the Worker's own message and retryable flag when it sent one", () => {
    const result = classifyChatError(
      errorWith({
        status: 429,
        payload: {
          error: "Too many requests. Please slow down.",
          retryable: true,
        },
      }),
    );
    expect(result).toEqual({
      message: "Too many requests. Please slow down.",
      retryable: true,
    });
  });

  it("keeps a non-retryable Worker rejection non-retryable", () => {
    const result = classifyChatError(
      errorWith({
        status: 400,
        payload: { error: "Malformed JSON body.", retryable: false },
      }),
    );
    expect(result.retryable).toBe(false);
  });

  it("names the real cause for a 404 in local development", () => {
    // `astro dev` serves the static site only; /api/chat lives in the Worker.
    // "Check your connection" would send a developer chasing the wrong thing.
    const result = classifyChatError(errorWith({ status: 404 }));
    expect(result.message).toMatch(/wrangler dev/);
    expect(result.message).not.toMatch(/connection/i);
    expect(result.retryable).toBe(false);
  });

  it("reports an unexpected status without inventing a cause", () => {
    const result = classifyChatError(errorWith({ status: 502 }));
    expect(result.message).toMatch(/502/);
    expect(result.retryable).toBe(true);
  });

  it("blames the network only when the request itself failed", () => {
    // A rejected fetch surfaces as a TypeError. This is the one case where
    // "check your connection" is honest.
    const result = classifyChatError(new TypeError("Failed to fetch"));
    expect(result.message).toMatch(/connection/i);
    expect(result.retryable).toBe(true);
  });

  it("treats an aborted request as a transport failure, not a Worker message", () => {
    const aborted = new Error("The operation was aborted.");
    aborted.name = "AbortError";
    expect(classifyChatError(aborted).message).toMatch(/connection/i);
  });

  it("shows the Worker's message when it was streamed into a 200 response", () => {
    // The regression this exists for: a Gemini daily-quota exhaustion returns
    // HTTP 200 and writes the error INTO the open stream, so nothing is
    // attached to `cause`. That was being reported as a network failure and
    // told the reader to check a connection that was never broken.
    const streamed = new Error(
      "The assistant has reached its daily usage limit. Please come back tomorrow.",
    );
    const result = classifyChatError(streamed);
    expect(result.message).toMatch(/daily usage limit/);
    expect(result.message).not.toMatch(/connection/i);
  });

  it("falls back to the network message when a streamed error carries no text", () => {
    expect(classifyChatError(new Error("  "))).toEqual({
      message: "Couldn't reach Dox. Check your connection and try again.",
      retryable: true,
    });
  });

  it("never leaks the raw upstream error text to the reader", () => {
    const result = classifyChatError(
      errorWith({
        status: 500,
        payload: {
          error: "The assistant is temporarily unavailable.",
          retryable: false,
        },
      }),
    );
    expect(JSON.stringify(result)).not.toContain("Chat request failed");
  });
});
