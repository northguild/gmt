import type { UIMessage, UIMessageChunk } from "ai";
import {
  answering,
  failingWith,
  recordingOf,
  refusing,
  stalling,
  textChunks,
  unreachable,
} from "~/test/chat-stream";
import {
  createDeckSession,
  FIRST_OUTPUT_MS,
  type DeckSession,
  type SourceState,
} from "./deck-transport";
import { formatRecordedLabel, type Recording } from "./replay";

const question: UIMessage = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "What is a leap second?" }],
};

let session: DeckSession;
let sources: (SourceState | null)[];
let controller: AbortController;

function open(
  doFetch: typeof fetch,
  extra: {
    local?: (signal: AbortSignal) => ReadableStream<UIMessageChunk>;
  } = {},
) {
  session = createDeckSession({
    fetch: doFetch,
    onSource: (state) => sources.push(state),
    ...extra,
  });
  return session.transport(() => "gemma");
}

function send(transport: ReturnType<typeof open>) {
  return transport.sendMessages({
    chatId: "c",
    messageId: undefined,
    trigger: "submit-message",
    messages: [question],
    abortSignal: controller.signal,
  });
}

/** Reads a stream to its end, noting an error as a final `error:` entry. */
async function drain(
  stream: ReadableStream<UIMessageChunk>,
): Promise<string[]> {
  const seen: string[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return seen;
      seen.push(next.value.type);
    }
  } catch (failure) {
    seen.push(`error:${(failure as Error).message}`);
    return seen;
  }
}

const recording: Recording = recordingOf("demo", "A recorded answer.");
const withUsage: Recording = {
  ...recording,
  chunks: [
    ...recording.chunks,
    {
      at: 100,
      chunk: { type: "data-usage", data: {} } as unknown as UIMessageChunk,
    },
  ],
};

/* The label loads the library once; do it before time is faked so the replay starts at once. */
beforeAll(async () => {
  await formatRecordedLabel(recording);
});

beforeEach(() => {
  vi.useFakeTimers();
  sources = [];
  controller = new AbortController();
});

afterEach(() => {
  controller.abort();
  session.abort();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

/** Plays the stream to its end under fake time. */
async function played(stream: ReadableStream<UIMessageChunk>, ms: number) {
  const done = drain(stream);
  await vi.advanceTimersByTimeAsync(ms);
  return done;
}

describe("a ready question", () => {
  it("plays its recording with no request, labelled with its date and brain", async () => {
    const doFetch = vi.fn<typeof fetch>();
    const transport = open(doFetch);
    session.plan({ recording: withUsage, recordedOnly: true });
    const seen = await played(await send(transport), 1000);
    expect(doFetch).not.toHaveBeenCalled();
    expect(seen).toContain("text-delta");
    expect(seen).not.toContain("data-usage");
    const last = sources.at(-1);
    expect(last?.source).toBe("recorded");
    expect(last?.label).toMatch(/Recorded .*Gemma/);
  });

  it("says so when its recording is missing", async () => {
    const transport = open(vi.fn<typeof fetch>());
    session.plan({ recording: null, recordedOnly: true });
    const seen = await played(await send(transport), 100);
    expect(seen).toEqual(["error:This answer has not been recorded yet."]);
  });
});

describe("a typed question", () => {
  it("goes live and says Live at the first output", async () => {
    const transport = open(answering(textChunks("Live answer.")));
    const seen = await played(await send(transport), 100);
    expect(seen).toContain("text-delta");
    expect(sources.at(-1)).toEqual({ source: "live" });
  });

  it("sends the page it is asked from and the brain it picked", async () => {
    const doFetch = vi.fn(answering(textChunks("ok")));
    const transport = open(doFetch);
    await played(await send(transport), 100);
    const body = JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body));
    expect(body.pageContext).toBe("/slides/give-me-temporal/");
    expect(body.model).toBe("gemma");
  });
});

describe("a failing live answer with a recording", () => {
  const cases: [string, () => typeof fetch][] = [
    ["an HTTP error", () => failingWith(429)],
    ["a refusal", refusing],
    ["an unreachable network", unreachable],
  ];
  it.each(cases)("plays the recording after %s", async (_name, make) => {
    const transport = open(make());
    session.plan({ recording, recordedOnly: false });
    const seen = await played(await send(transport), 1000);
    expect(seen).toContain("text-delta");
    expect(sources.at(-1)?.source).toBe("recorded");
  });

  it("plays the recording when the first output is later than the budget", async () => {
    const transport = open(stalling());
    session.plan({ recording, recordedOnly: false });
    const done = drain(await send(transport));
    await vi.advanceTimersByTimeAsync(FIRST_OUTPUT_MS - 1);
    expect(sources.at(-1)?.source).toBe("pending");
    await vi.advanceTimersByTimeAsync(1000);
    const seen = await done;
    expect(seen).toContain("text-delta");
    expect(sources.at(-1)?.source).toBe("recorded");
  });

  it("drops a late live chunk once the recording has taken over", async () => {
    let release: (() => void) | undefined;
    const late: typeof fetch = async (_input, init) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(out) {
          release = () => {
            try {
              out.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text-start", id: "late" })}\n\n`,
                ),
              );
            } catch {
              // The reader is gone: that is the point.
            }
          };
          init?.signal?.addEventListener(
            "abort",
            () => out.error(init.signal?.reason),
            {
              once: true,
            },
          );
        },
      });
      return new Response(body, { status: 200 });
    };
    const transport = open(late);
    session.plan({ recording, recordedOnly: false });
    const done = drain(await send(transport));
    await vi.advanceTimersByTimeAsync(FIRST_OUTPUT_MS + 1000);
    release?.();
    await vi.advanceTimersByTimeAsync(10);
    expect((await done).filter((type) => type === "text-start")).toHaveLength(
      1,
    );
  });
});

describe("a failing live answer with no recording", () => {
  it("reaches the chat as the error it is", async () => {
    const transport = open(failingWith(429));
    session.plan(null);
    const seen = await played(await send(transport), 100);
    expect(seen[0]).toMatch(/^error:Chat request failed with 429/);
  });
});

describe("leaving", () => {
  it("aborts a stalled live request and leaves nothing running", async () => {
    const doFetch = vi.fn(stalling());
    const transport = open(doFetch);
    const done = drain(await send(transport));
    await vi.advanceTimersByTimeAsync(100);
    expect(doFetch).toHaveBeenCalledOnce();
    session.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(await done).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops a playing recording", async () => {
    const transport = open(vi.fn<typeof fetch>());
    session.plan({ recording, recordedOnly: true });
    const done = drain(await send(transport));
    await vi.advanceTimersByTimeAsync(5);
    session.abort();
    await vi.advanceTimersByTimeAsync(0);
    await done;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops when the chat's own signal aborts", async () => {
    const transport = open(stalling());
    const done = drain(await send(transport));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(await done).toEqual([]);
  });
});

describe("an answer made in the page", () => {
  it("is streamed with no request", async () => {
    const doFetch = vi.fn<typeof fetch>();
    const transport = open(doFetch, {
      local: () =>
        new ReadableStream<UIMessageChunk>({
          start(out) {
            for (const chunk of textChunks("From the page."))
              out.enqueue(chunk);
            out.close();
          },
        }),
    });
    const seen = await played(await send(transport), 100);
    expect(doFetch).not.toHaveBeenCalled();
    expect(seen).toContain("text-delta");
    expect(sources.at(-1)).toEqual({ source: "live" });
  });
});

describe("reconnecting", () => {
  it("has nothing to reconnect to", async () => {
    const transport = open(vi.fn<typeof fetch>());
    await expect(
      transport.reconnectToStream({ chatId: "c" }),
    ).resolves.toBeNull();
  });
});
