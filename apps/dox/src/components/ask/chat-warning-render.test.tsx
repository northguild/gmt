/**
 * @vitest-environment jsdom
 *
 * The rendered half of `chat-warning.tsx`. `chat-warning.test.ts` covers
 * `classifyChatError`'s branches as a pure function; this covers what the
 * reader is actually offered, and in particular that `retryable` — computed on
 * all seven of those branches and, until now, read by nothing — reaches the DOM.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatWarning } from "./chat-warning";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";

installJsdomShims();

describe("ChatWarning", () => {
  it("always shows the message", async () => {
    const { container } = render(
      <ChatWarning
        state={{ message: "Dox is unavailable.", retryable: false }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Dox is unavailable.");
    await expectNoAxeViolations(container);
  });

  it("offers no retry for a failure that would fail identically again", async () => {
    // Rate limits, malformed requests, a missing local endpoint: retrying is
    // certain to fail, and offering it would be a lie.
    const { container } = render(
      <ChatWarning
        state={{ message: "Too many requests.", retryable: false }}
        onRetry={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("offers a retry for a failure that might not recur", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { container } = render(
      <ChatWarning
        state={{ message: "Dox stopped responding.", retryable: true }}
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  it("shows no button when the caller has nothing to retry", async () => {
    const { container } = render(
      <ChatWarning
        state={{ message: "Dox stopped responding.", retryable: true }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
