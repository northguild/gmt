/**
 * @vitest-environment jsdom
 *
 * The deck's Dox on a slide: the real chat answers a ready question from its recording with no
 * request, a typed question goes to the network, and leaving the slide aborts the answer and
 * clears the chat.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FAQ } from "~/lib/slides/live-demos";
import { sendDeckState } from "~/test/deck-events";
import { stalling } from "~/test/chat-stream";
import { parseRecording } from "~/lib/slides/replay";
import real from "~/slides/give-me-temporal/recorded/faq-helsinki-autumn.json";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import DeckDox from "./DeckDox";

installJsdomShims();

const [first] = FAQ;
if (!first) throw new Error("the FAQ is empty");
/* The real recording of the first question, with its offsets squeezed to zero so it plays at once. */
const parsed = parseRecording(real);
if (!parsed || parsed.id !== first.id)
  throw new Error("no recording for the first question");
const recording = {
  ...parsed,
  chunks: parsed.chunks.map((c) => ({ ...c, at: 0 })),
};

/** Every `/api/chat` call, so a test can say no request was made. */
let chatCalls: string[];

function route(chat: typeof fetch) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).includes("/api/chat"))
      return new Response("{}", { status: 404 });
    chatCalls.push(String(input));
    return chat(input, init);
  });
}

function mount() {
  const view = render(
    <main data-deck-root>
      <section data-slide id="thanks">
        <DeckDox
          mode="audience"
          demoId="thanks"
          questions={FAQ}
          recordings={[recording]}
        />
      </section>
    </main>,
  );
  return view;
}

beforeEach(() => {
  chatCalls = [];
});

afterEach(() => vi.unstubAllGlobals());

describe("DeckDox on a slide", () => {
  it("answers a ready question from its recording with no request", async () => {
    vi.stubGlobal("fetch", route(stalling()));
    const { container } = mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: first.question }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(chatCalls).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent(
      /Recorded .*3\.5 Flash-Lite/,
    );
    await expectNoAxeViolations(container);
  });

  it("offers the three ready questions beside the composer", () => {
    vi.stubGlobal("fetch", route(stalling()));
    mount();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("button")).toHaveLength(FAQ.length);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("sends a typed question over the network", async () => {
    vi.stubGlobal("fetch", route(stalling()));
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Is 2100 a leap year?{Enter}");
    await waitFor(() => expect(chatCalls).toHaveLength(1));
  });

  it("aborts a live answer and clears the chat on leaving the slide", async () => {
    let aborted = false;
    vi.stubGlobal(
      "fetch",
      route(async (_input, init) => {
        init?.signal?.addEventListener("abort", () => (aborted = true));
        return stalling()(_input, init);
      }),
    );
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Is 2100 a leap year?{Enter}");
    await waitFor(() => expect(chatCalls).toHaveLength(1));
    const deck = screen.getByRole("main");
    act(() => sendDeckState(deck, "thanks", 0));
    act(() => sendDeckState(deck, "next", 0));
    await waitFor(() => expect(aborted).toBe(true));
    await waitFor(() =>
      expect(
        screen.queryByText("Is 2100 a leap year?"),
      ).not.toBeInTheDocument(),
    );
  });
});
