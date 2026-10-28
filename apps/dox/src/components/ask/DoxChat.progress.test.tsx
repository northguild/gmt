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
import { act, render, screen, waitFor } from "@testing-library/react";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import type { BrainsInfo } from "~/lib/chat-types";
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
          data: { text: "Gemma 4 26B is busy — trying the next model…" },
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

    render(<DoxChat />);
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox"),
      "Show me what time it is in Tokyo right now.{Enter}",
    );

    await waitFor(() =>
      expect(
        document.querySelector(".gmt-hive-pending")?.textContent,
      ).toContain("Gemma 4 26B is busy"),
    );

    await act(async () => {
      reply.release();
    });

    await waitFor(() =>
      expect(
        document.querySelector(".gmt-hive-warning")?.textContent,
      ).toContain("free allowance"),
    );
    // Transient parts never became a message: only the reader's question.
    expect(
      document.querySelectorAll('.gmt-hive-turn[data-role="assistant"]'),
    ).toHaveLength(0);
    expect(document.querySelector(".gmt-hive-pending")).toBeNull();
  });

  it("hands the stream's usage part to the badge, and does not re-read it after the answer", async () => {
    const info = {
      brains: [],
      providers: [],
      activeBrainId: null,
      visitor: {
        used: 1,
        limit: 5,
        remaining: 4,
        unlimited: false,
        resetsAt: "2026-09-25T00:00:00Z",
      },
    } satisfies BrainsInfo;
    const response = createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "data-usage", data: info, transient: true });
          writer.write({ type: "text-start", id: "t1" });
          writer.write({ type: "text-delta", id: "t1", delta: "An answer." });
          writer.write({ type: "text-end", id: "t1" });
        },
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/chat")
          ? response
          : new Response("{}", { status: 404 }),
      ),
    );
    const onUsage = vi.fn();
    const onUsed = vi.fn();

    render(<DoxChat onUsage={onUsage} onUsed={onUsed} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "What is a DST gap?{Enter}");

    await waitFor(() => expect(onUsage).toHaveBeenCalledWith(info));
    await waitFor(() =>
      expect(
        document.querySelectorAll('.gmt-hive-turn[data-role="assistant"]'),
      ).toHaveLength(1),
    );
    expect(onUsed).not.toHaveBeenCalled();
  });
});
