/**
 * @vitest-environment jsdom
 *
 * The deck's Dox on a slide: the real chat answers a ready question from its recording with no
 * request, a typed question goes to the network, and leaving the slide aborts the answer and
 * clears the chat.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sendDeckState } from "~/test/deck-events";
import { recordingOf, stalling } from "~/test/chat-stream";
import type { DeckToolScript, FaqQuestion } from "~/lib/slides/live-data";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import type { BrainsInfo } from "~/components/ask/use-brains";
import { getDeckBrain, setDeckBrain } from "~/lib/slides/deck-brain";
import DeckDox, { type DeckDoxMode } from "./DeckDox";

installJsdomShims();

/* A deck's live data, made up here: the component is shared, so its test reads no deck's folder. */
const FAQ: FaqQuestion[] = [
  { id: "faq-one", question: "What is a leap second?" },
  { id: "faq-two", question: "Which day did a country skip?" },
  { id: "faq-three", question: "How do I add a month to 31 January?" },
];
const first = FAQ[0]!;
const TOOL: DeckToolScript = {
  question: "When is Easter in 2027? Ask this page.",
  year: 2027,
};
/* The first question's recording, with its offsets squeezed to zero so it plays at once. */
const recorded = recordingOf(
  first.id,
  "A leap second is one second added to UTC.",
);
const recording = {
  ...recorded,
  question: first.question,
  chunks: recorded.chunks.map((c) => ({ ...c, at: 0 })),
};

/** Every `/api/chat` call, so a test can say no request was made. */
let chatCalls: string[];
/** The body of every `/api/chat` call. */
let chatBodies: { model?: string }[];

const RESETS = "2027-03-28T07:00:00Z";
const INFO: BrainsInfo = {
  brains: [
    {
      id: "gemini-a",
      label: "3.8 Flash",
      provider: "google",
      remaining: 20,
      limit: 20,
      state: "ok",
    },
    {
      id: "cf-a",
      label: "GLM 4.7 Flash",
      provider: "workers-ai",
      remaining: 100,
      limit: 100,
      state: "ok",
    },
  ],
  providers: [
    { id: "google", label: "Gemini", resetsAt: RESETS },
    { id: "workers-ai", label: "Workers AI", resetsAt: RESETS },
  ],
  activeBrainId: "gemini-a",
  visitor: {
    used: 1,
    limit: 5,
    remaining: 4,
    unlimited: false,
    resetsAt: RESETS,
  },
};

/** `/api/chat` answers with `chat`; `/api/brains` with `brains`, or a 404 without it. */
function route(chat: typeof fetch, brains?: BrainsInfo) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/api/brains") && brains)
      return Response.json(brains);
    if (!String(input).includes("/api/chat"))
      return new Response("{}", { status: 404 });
    chatCalls.push(String(input));
    chatBodies.push(JSON.parse(String(init?.body ?? "{}")));
    return chat(input, init);
  });
}

function mount(mode: DeckDoxMode = "audience") {
  const view = render(
    <main data-deck-root>
      <section data-slide id="thanks">
        <DeckDox
          mode={mode}
          demoId="thanks"
          questions={FAQ}
          recordings={[recording]}
          pageContext="/slides/test-deck/"
          zone="Europe/Helsinki"
          tool={TOOL}
        />
      </section>
    </main>,
  );
  return view;
}

beforeEach(() => {
  chatCalls = [];
  chatBodies = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setDeckBrain(null));
});

describe("DeckDox on a slide", () => {
  it("answers a ready question from its recording with no request", async () => {
    vi.stubGlobal("fetch", route(stalling()));
    const { container } = mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: first.question }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(chatCalls).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent(
      /Recorded .*Gemma 4 26B/,
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

  it("says so in the brain bar when the brains cannot be read", async () => {
    vi.stubGlobal("fetch", route(stalling()));
    mount();
    const bar = screen.getByRole("group", { name: "Dox brain" });
    await waitFor(() =>
      expect(bar).toHaveTextContent(
        "Dox's brains did not answer: questions left unknown, recorded answers still play.",
      ),
    );
  });

  it.each<DeckDoxMode>(["answer", "audience", "tools"])(
    "shows the brain and the questions left on the %s slide",
    async (mode) => {
      vi.stubGlobal("fetch", route(stalling(), INFO));
      mount(mode);
      const bar = screen.getByRole("group", { name: "Dox brain" });
      await waitFor(() => expect(bar).toHaveTextContent("3.8 Flash"));
      expect(bar).toHaveTextContent("You 4 left");
      expect(bar).toHaveTextContent("Dox 120 today");
      // One picker per frame: the composer's own copy stays out.
      expect(
        screen.getAllByRole("button", { name: /3\.8 Flash/ }),
      ).toHaveLength(1);
    },
  );

  it("sends to the deck's brain and keeps the pick when the slide's chat starts afresh", async () => {
    vi.stubGlobal("fetch", route(stalling(), INFO));
    mount();
    const bar = screen.getByRole("group", { name: "Dox brain" });
    const user = userEvent.setup();
    await user.click(
      await within(bar).findByRole("button", { name: /3\.8 Flash/ }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", { name: /GLM 4\.7 Flash/ }),
    );
    expect(getDeckBrain()).toBe("cf-a");
    const deck = screen.getByRole("main");
    act(() => sendDeckState(deck, "thanks", 0));
    act(() => sendDeckState(deck, "next", 0));
    act(() => sendDeckState(deck, "thanks", 0));
    await waitFor(() => expect(bar).toHaveTextContent("GLM 4.7 Flash"));
    await user.type(screen.getByRole("textbox"), "Is 2100 a leap year?{Enter}");
    await waitFor(() => expect(chatBodies).toHaveLength(1));
    expect(chatBodies[0]?.model).toBe("cf-a");
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
