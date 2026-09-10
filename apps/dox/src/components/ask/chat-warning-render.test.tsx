/**
 * @vitest-environment jsdom
 *
 * The rendered half of `chat-warning.tsx`. `chat-warning.test.ts` covers
 * `classifyChatError`'s branches as a pure function; this covers what the
 * reader is actually offered, and in particular that `retryable` — computed on
 * all seven of those branches and, until now, read by nothing — reaches the DOM.
 */
/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatWarning } from "./chat-warning";
import { installJsdomShims } from "~/test/jsdom-shims";

installJsdomShims();

describe("ChatWarning", () => {
  it("always shows the message", () => {
    render(
      <ChatWarning
        state={{ message: "Dox is unavailable.", retryable: false }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Dox is unavailable.",
    );
  });

  it("offers no retry for a failure that would fail identically again", () => {
    // Rate limits, malformed requests, a missing local endpoint: retrying is
    // certain to fail, and offering it would be a lie.
    render(
      <ChatWarning
        state={{ message: "Too many requests.", retryable: false }}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers a retry for a failure that might not recur", () => {
    const onRetry = vi.fn();
    render(
      <ChatWarning
        state={{ message: "Dox stopped responding.", retryable: true }}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows no button when the caller has nothing to retry", () => {
    render(
      <ChatWarning
        state={{ message: "Dox stopped responding.", retryable: true }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
