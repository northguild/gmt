/**
 * @vitest-environment jsdom
 *
 * The chat's sound: Sonar launch when a question leaves, the Sonar idle pings while Dox waits for its
 * first word, a Morse beep per streamed chunk, the Ice bell when the answer completes and the
 * Low double buzz on an error. The real `DoxChat` runs against a real AI SDK stream that the test
 * writes to by hand; `cue` and `loop` are spies, since the audio is the engine's.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { installJsdomShims } from "~/test/jsdom-shims";
import { DoxChat } from "./DoxChat";

const sound = vi.hoisted(() => ({
  cue: vi.fn(),
  stopThinking: vi.fn(),
  loop: vi.fn(),
}));
vi.mock("~/lib/sound/cue", () => ({
  cue: (name: string) => sound.cue(name),
  loop: (name: string) => {
    sound.loop(name);
    return sound.stopThinking;
  },
}));

installJsdomShims();

type Writer = Parameters<
  Parameters<typeof createUIMessageStream>[0]["execute"]
>[0]["writer"];

/** An answer the test writes to chunk by chunk. */
function answer() {
  const handle: { writer?: Writer; end: () => void } = { end: () => {} };
  const response = createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) =>
        new Promise<void>((resolve) => {
          handle.writer = writer;
          handle.end = resolve;
        }),
    }),
  });
  return {
    response,
    ready: () => waitFor(() => expect(handle.writer).toBeDefined()),
    start: () => handle.writer!.write({ type: "text-start", id: "t" }),
    say: (delta: string) =>
      handle.writer!.write({ type: "text-delta", id: "t", delta }),
    finish: () => {
      handle.writer!.write({ type: "text-end", id: "t" });
      handle.end();
    },
  };
}

const cues = (name: string) =>
  sound.cue.mock.calls.filter(([n]) => n === name).length;

async function ask(reply: Response | (() => Response)) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/chat")
        ? typeof reply === "function"
          ? reply()
          : reply
        : new Response("{}", { status: 404 }),
    ),
  );
  render(
    <main>
      <DoxChat />
    </main>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), "What time is it?{Enter}");
  return user;
}

beforeEach(() => {
  sound.cue.mockClear();
  sound.loop.mockClear();
  sound.stopThinking.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the chat's sound", () => {
  it("launches a sonar and starts the thinking pings once, as the question leaves", async () => {
    const reply = answer();
    await ask(reply.response);
    await waitFor(() => expect(sound.loop.mock.calls).toEqual([["thinking"]]));
    expect(cues("send")).toBe(1);
    expect(sound.stopThinking).not.toHaveBeenCalled();
  });

  it("stops the pings at the first token, beeps per growing chunk and rings the bell once at the end", async () => {
    const reply = answer();
    await ask(reply.response);
    await reply.ready();
    expect(sound.stopThinking).not.toHaveBeenCalled();
    await act(async () => reply.start());

    for (const [n, word] of ["One ", "two ", "three."].entries()) {
      await act(async () => reply.say(word));
      await waitFor(() => expect(cues("stream")).toBe(n + 1));
    }
    expect(sound.stopThinking).toHaveBeenCalledTimes(1);
    expect(cues("done")).toBe(0);

    await act(async () => reply.finish());
    await waitFor(() => expect(cues("done")).toBe(1));
    expect(cues("error")).toBe(0);
    expect(sound.loop).toHaveBeenCalledTimes(1);
  });

  it("buzzes on an error and never rings the bell", async () => {
    await ask(
      () =>
        new Response(JSON.stringify({ error: "Down" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    await waitFor(() => expect(cues("error")).toBe(1));
    expect(cues("done")).toBe(0);
    expect(sound.stopThinking).toHaveBeenCalledTimes(1);
  });

  it("stops the pings when the chat unmounts while Dox is still thinking", async () => {
    const reply = answer();
    await ask(reply.response);
    await waitFor(() => expect(sound.loop).toHaveBeenCalledTimes(1));
    cleanup();
    expect(sound.stopThinking).toHaveBeenCalledTimes(1);
  });

  it("stops the pings and plays no bell when the reader presses Stop mid-answer", async () => {
    const reply = answer();
    const user = await ask(reply.response);
    await reply.ready();
    await act(async () => reply.start());
    await act(async () => reply.say("Part of an answer"));
    await waitFor(() => expect(cues("stream")).toBe(1));

    await user.click(screen.getByRole("button", { name: /stop/i }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /stop/i }),
      ).not.toBeInTheDocument(),
    );
    expect(sound.stopThinking).toHaveBeenCalledTimes(1);
    expect(cues("done")).toBe(0);
    await act(async () => reply.finish());
  });
});
