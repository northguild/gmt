/**
 * @vitest-environment jsdom
 *
 * The client half of the open-before-failover contract (worker/chat-handler.ts).
 * The Worker opens its stream before it has a brain and writes only transient
 * parts until one answers: `data-status` progress, or a `data-refusal` carrying
 * the `{ status, payload }` a non-OK HTTP response used to. This drives the
 * real `DoxChat` against a real AI SDK stream to pin what the reader sees: the
 * progress line in the waiting card, the refusal as the usual warning, and no
 * empty answer turn left behind.
 */
/// <reference types="vitest/globals" />
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { CHAT_STARTERS } from "~/lib/chat-constants";
import { installJsdomShims } from "~/test/jsdom-shims";
import { DoxChat } from "./DoxChat";

installJsdomShims();

/** A `/api/chat` reply that writes progress, waits for `release`, then refuses. */
function progressThenRefusal() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const response = createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "data-status",
          data: { text: "3.8 Flash is busy — trying the next model…" },
          transient: true,
        });
        await gate;
        writer.write({
          type: "data-refusal",
          data: {
            status: 429,
            payload: {
              error: "Dox has used its free allowance for today.",
              retryable: false,
              resetsAt: "2026-09-25T07:00:00Z",
            },
          },
          transient: true,
        });
      },
    }),
  });
  return { response, release };
}

describe("DoxChat while the Worker chooses a brain", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the Worker's progress, then its refusal as a warning, leaving no empty turn", async () => {
    const reply = progressThenRefusal();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/chat")
          ? reply.response
          : new Response("{}", { status: 404 }),
      ),
    );

    const onWidget = vi.fn();
    render(<DoxChat onWidget={onWidget} />);
    fireEvent.click(screen.getByRole("button", { name: CHAT_STARTERS[0].text }));

    // The seeded widget opens on the click, before any reply.
    expect(onWidget).toHaveBeenCalledWith(
      "starter-showGlobe",
      "showGlobe",
      CHAT_STARTERS[0].args,
    );

    await waitFor(() =>
      expect(document.querySelector(".gmt-hive-pending")?.textContent).toContain(
        "3.8 Flash is busy",
      ),
    );

    await act(async () => {
      reply.release();
    });

    await waitFor(() =>
      expect(document.querySelector(".gmt-hive-warning")?.textContent).toContain(
        "free allowance",
      ),
    );
    // Transient parts never became a message: only the reader's question.
    expect(document.querySelectorAll('.gmt-hive-turn[data-role="assistant"]')).toHaveLength(0);
    expect(document.querySelector(".gmt-hive-pending")).toBeNull();
  });
});
