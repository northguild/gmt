/**
 * @vitest-environment jsdom
 *
 * The page's one copy of Dox's counts: every chat on a page reads and updates the same counts, and
 * overlapping reads share one request.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { BrainsInfo } from "~/lib/chat-types";
import { useBrains } from "./use-brains";

const RESETS = "2026-12-17T00:00:00Z";

const counts = (remaining: number): BrainsInfo => ({
  brains: [],
  providers: [],
  activeBrainId: null,
  visitor: {
    used: 5 - remaining,
    limit: 5,
    remaining,
    unlimited: false,
    resetsAt: RESETS,
  },
});

/** `/api/brains` answers with each of `answers` in turn; `null` is a 503. */
function serve(...answers: (BrainsInfo | null)[]) {
  const fetch = vi.fn(async () => {
    const next = answers.length > 1 ? answers.shift()! : answers[0]!;
    return next === null
      ? new Response("{}", { status: 503 })
      : Response.json(next);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useBrains", () => {
  it("reads once for chats that mount together, and gives each the same counts", async () => {
    const fetch = serve(counts(4));
    const one = renderHook(() => useBrains());
    const two = renderHook(() => useBrains());
    await waitFor(() => expect(one.result.current.status).toBe("ready"));
    expect(two.result.current.info).toBe(one.result.current.info);
    expect(fetch).toHaveBeenCalledTimes(1);
    one.unmount();
    two.unmount();
  });

  it("shows the counts one chat's question brought on every other chat", async () => {
    serve(counts(4));
    const askDox = renderHook(() => useBrains());
    const qa = renderHook(() => useBrains());
    await waitFor(() => expect(qa.result.current.status).toBe("ready"));
    act(() => askDox.result.current.apply(counts(3)));
    expect(qa.result.current.info?.visitor.remaining).toBe(3);
    askDox.unmount();
    qa.unmount();
  });

  it("re-reads when another chat mounts, and every chat takes the new counts", async () => {
    const fetch = serve(counts(4), counts(2));
    const first = renderHook(() => useBrains());
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    const second = renderHook(() => useBrains());
    await waitFor(() =>
      expect(first.result.current.info?.visitor.remaining).toBe(2),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    first.unmount();
    second.unmount();
  });

  it("keeps the counts in hand when a re-read fails", async () => {
    serve(counts(4), null);
    const chat = renderHook(() => useBrains());
    await waitFor(() => expect(chat.result.current.status).toBe("ready"));
    await act(() => chat.result.current.refresh());
    expect(chat.result.current.status).toBe("ready");
    expect(chat.result.current.info?.visitor.remaining).toBe(4);
    chat.unmount();
  });

  it("says the counts are unreachable when the first read fails", async () => {
    serve(null);
    const chat = renderHook(() => useBrains());
    await waitFor(() => expect(chat.result.current.status).toBe("unreachable"));
    expect(chat.result.current.info).toBeNull();
    chat.unmount();
  });

  it("drops the counts with the page's last chat, and a read still under way never lands", async () => {
    let answer!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    const gone = renderHook(() => useBrains());
    gone.unmount();
    serve(counts(1));
    const next = renderHook(() => useBrains());
    await waitFor(() => expect(next.result.current.status).toBe("ready"));
    await act(async () => answer(Response.json(counts(4))));
    expect(next.result.current.info?.visitor.remaining).toBe(1);
    next.unmount();
  });
});
