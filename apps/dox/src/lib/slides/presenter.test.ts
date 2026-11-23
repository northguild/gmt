/**
 * @vitest-environment jsdom
 *
 * The presenter view over a fixture of three slides (0, 2 and 1 builds), built with the same shell
 * and dialogs the page renders. gmt's clock is replaced by a fake that the test moves with
 * `advance`, and timers are fake: nothing here waits on a real second.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations, renderWidget } from "~/test/render-widget";
import { installDialogFullscreenShims } from "~/test/dialog-fullscreen-shims";
import { installJsdomShims } from "~/test/jsdom-shims";
import { html } from "~/widgets/builders/html";
import { deckDialogs } from "~/widgets/builders/deck-controls";
import { presenterShell } from "~/widgets/builders/presenter";
import { KEY_TABLE } from "./keys";
import {
  DECK_GRACE_MS,
  mountPresenter,
  type PresenterHandle,
} from "./presenter";
import { channelName, type DeckEnv, type SyncMessage } from "./sync";

installJsdomShims();

/** The fake clock: 500 ms into a second, so the first tick lands half a second on. */
let clockMs = 1_700_000_000_500;
vi.mock("@northguild/gmt/unix/get", () => ({ getUnixNow: () => clockMs }));
vi.mock("@northguild/gmt/zoned/get", () => ({
  getSystemTimeZone: () => "Europe/Helsinki",
  getZonedNow: () => "2026-12-01T18:42+02:00[Europe/Helsinki]",
}));
vi.mock("@northguild/gmt/zoned/format", () => ({
  formatZonedDateTime: () => "18:42",
}));

const ENV: DeckEnv = {
  renderer: "webgpu",
  reducedMotion: false,
  fullscreen: true,
};

const source = html`<div hidden data-presenter-source>
  <section id="first" data-slide data-minutes="1"><h2>First</h2><p>Opening words</p>
    <aside data-notes><h3>Speaker notes</h3><p>Greet the room.</p></aside></section>
  <section id="second" data-slide data-minutes="2"><h2>Second</h2>
    <div data-build="1"><p>Build one</p></div><div data-build="2"><p>Build two</p></div>
    <aside data-notes><h3>Speaker notes</h3><p>Explain the second slide.</p></aside></section>
  <section id="third" data-slide data-minutes="1"><h2>Third</h2><div data-build="1"><p>Last build</p></div>
    <aside data-notes><h3>Speaker notes</h3><p>Say thanks.</p></aside></section>
</div>`;

let session: Awaited<ReturnType<typeof renderWidget>> | undefined;
let handle: PresenterHandle | null = null;
const channels: BroadcastChannel[] = [];
let shims: ReturnType<typeof installDialogFullscreenShims>;

async function start() {
  session = await renderWidget(
    {
      renderTemplate: () =>
        html`${source}<div data-presenter-root>${presenterShell()}</div>${deckDialogs(KEY_TABLE)}`,
      mount: async (root, _args, signal) => {
        // After the kit's own setup click, which waits on a real timer: from here on time is fake.
        vi.useFakeTimers({
          toFake: [
            "setTimeout",
            "clearTimeout",
            "setInterval",
            "clearInterval",
          ],
        });
        // The mount's own root, which has no role to find it by.
        // oxlint-disable-next-line dox-test/no-class-query, testing-library/no-node-access
        const rootEl = root.querySelector<HTMLElement>("[data-presenter-root]");
        handle = rootEl
          ? mountPresenter(rootEl, {
              signal,
              slug: "test-deck",
              deckUrl: "https://example.test/gmt/slides/test-deck/",
              brainsUrl: "https://example.test/gmt/api/brains",
            })
          : null;
        return { destroy: () => handle?.destroy() };
      },
    },
    {},
  );
  // Lets the dynamic imports of the fake clock settle.
  await vi.advanceTimersByTimeAsync(0);
  // The kit's own `user` waits on real timers, which are fake here.
  const user = userEvent.setup({
    advanceTimers: (ms) => vi.advanceTimersByTime(ms),
  });
  return { ...session, user };
}

/** A deck window's end of the channel. */
function deck() {
  const channel = new BroadcastChannel(channelName("test-deck"));
  channels.push(channel);
  const heard: { type: string; action?: string; n?: number }[] = [];
  channel.addEventListener("message", (e) => heard.push(e.data));
  const post = async (
    slide: number,
    build = 0,
    over: Partial<{ blanked: boolean; demo: unknown }> = {},
  ) => {
    const message: SyncMessage = {
      type: "state",
      slide,
      build,
      blanked: over.blanked ?? false,
      demo: (over.demo ?? null) as never,
      env: ENV,
    };
    channel.postMessage(message);
    await vi.waitFor(() => expect(handle?.connected).toBe(true));
  };
  return { channel, heard, post };
}

/** Moves the fake clock and the fake timers together. */
async function advance(ms: number): Promise<void> {
  clockMs += ms;
  await vi.advanceTimersByTimeAsync(ms);
}

/** The one visible element with this text: the hidden source copy of the deck is also in the page. */
function shown(text: string, selector?: string): HTMLElement {
  const hits = screen
    .queryAllByText(text, selector ? { selector } : {})
    .filter((el) => {
      try {
        expect(el).toBeVisible();
        return true;
      } catch {
        return false;
      }
    });
  expect(hits).toHaveLength(1);
  return hits[0] as HTMLElement;
}

const value = (label: string): string =>
  screen.getByLabelText(label).textContent ?? "";

beforeEach(() => {
  clockMs = 1_700_000_000_500;
  shims = installDialogFullscreenShims();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 404 })),
  );
});

afterEach(() => {
  session?.destroy();
  session = undefined;
  handle = null;
  for (const c of channels.splice(0)) c.close();
  shims.restore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("mountPresenter", () => {
  it("shows the first slide, what Next shows and the notes", async () => {
    await start();
    expect(screen.getByText("Slide 1 of 3: First")).toBeInTheDocument();
    expect(shown("Greet the room.")).toBeInTheDocument();
    expect(screen.getByText("Next: slide 2 of 3, Second")).toBeInTheDocument();
    expect(shown("Second")).toBeInTheDocument();
  });

  it("holds the first values until the clock starts", async () => {
    await start();
    expect(value("Elapsed")).toBe("00:00");
    expect(value("Pace")).toBe("Not started");
    expect(value("Local time")).toBe("18:42");
    expect(value("Demo")).toBe("No demo");
  });

  it("says no deck window is open, and steps on its own", async () => {
    const { user } = await start();
    await advance(DECK_GRACE_MS);
    expect(
      screen.getByText(/Deck window not open: stepping here only/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Slide 2 of 3: Second, build 1 of 2"),
    ).toBeInTheDocument();
    expect(shown("Explain the second slide.")).toBeInTheDocument();
    expect(screen.getByText("Next: build 2 of 2")).toBeInTheDocument();
  });

  it("hides the builds not reached yet from the slide copy", async () => {
    const { user } = await start();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    // The next preview holds the same slide at its next build, so look in the current slide's panel.
    const current = within(
      screen.getByRole("region", { name: "Current slide" }),
    );
    /* oxlint-disable testing-library/no-node-access, dox-test/no-class-query -- a build's state is on its wrapper, which has no role */
    const build = (text: string) =>
      current.getByText(text).closest<HTMLElement>("[data-build]");
    expect(build("Build one")?.inert).toBe(false);
    expect(build("Build two")?.inert).toBe(true);
    /* oxlint-enable testing-library/no-node-access, dox-test/no-class-query */
  });

  it("renders the deck's state, and posts a step instead of moving on its own", async () => {
    const { user } = await start();
    const d = deck();
    await d.post(1, 2);
    expect(
      screen.getByText("Slide 2 of 3: Second, build 2 of 2"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Deck window connected/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await vi.waitFor(() =>
      expect(d.heard).toContainEqual({ type: "step", action: "next" }),
    );
    expect(
      screen.getByText("Slide 2 of 3: Second, build 2 of 2"),
    ).toBeInTheDocument();
  });

  it("asks the deck for its state when it opens", async () => {
    const d = deck();
    await start();
    await vi.waitFor(() => expect(d.heard).toContainEqual({ type: "hello" }));
  });

  it("takes the clicker keys and posts them as steps", async () => {
    const { user } = await start();
    const d = deck();
    await d.post(0);
    await user.keyboard("{ArrowRight}{Shift>}{ArrowRight}{/Shift}{End}");
    await vi.waitFor(() =>
      expect(d.heard.filter((m) => m.type === "step")).toEqual([
        { type: "step", action: "next" },
        { type: "step", action: "nextSlide" },
        { type: "step", action: "last" },
      ]),
    );
  });

  it("sends the slide number from the overview", async () => {
    const { user } = await start();
    const d = deck();
    await d.post(0);
    await user.click(screen.getByRole("button", { name: "Overview" }));
    const dialog = screen.getByRole("dialog", { name: "Slides" });
    await user.click(within(dialog).getByRole("link", { name: "Third" }));
    await vi.waitFor(() =>
      expect(d.heard).toContainEqual({ type: "step", action: "goTo", n: 3 }),
    );
  });

  it("falls back to stepping on its own when the deck window says bye", async () => {
    const { user } = await start();
    const d = deck();
    await d.post(1);
    d.channel.postMessage({ type: "bye" });
    await vi.waitFor(() => expect(handle?.connected).toBe(false));
    expect(screen.getByText(/Deck window closed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Slide 1 of 3: First")).toBeInTheDocument();
  });

  describe("time", () => {
    it("starts the clock on the first step past the title and counts whole seconds", async () => {
      const d = deck();
      await start();
      await advance(1000);
      expect(value("Elapsed")).toBe("00:00");
      await d.post(1);
      await advance(1000);
      expect(value("Elapsed")).toBe("00:01");
      await advance(64_000);
      expect(value("Elapsed")).toBe("01:05");
    });

    it("starts on the Start button, which then stays off", async () => {
      const { user } = await start();
      await user.click(screen.getByRole("button", { name: "Start" }));
      await advance(3000);
      expect(value("Elapsed")).toBe("00:03");
      expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    });

    it("reads the pace against the plan, in words", async () => {
      const d = deck();
      await start();
      await d.post(1); // plan: the 1 minute of slide one
      await advance(1000);
      expect(value("Pace")).toBe("+0:59 ahead");
      await advance(50_000); // 51 s against a plan of 60 s
      expect(value("Pace")).toBe("On pace");
    });

    it("says behind after the plan runs out, and announces the crossing once", async () => {
      const d = deck();
      await start();
      await d.post(1);
      const announcer = screen.getByRole("status", {
        name: "Pace (announcement)",
      });
      // Second by second, because an announcement clears itself after a second.
      const spoken: string[] = [];
      for (let s = 0; s < 80; s++) {
        await advance(1000);
        if (announcer.textContent) spoken.push(announcer.textContent);
      }
      expect(value("Pace")).toBe("−0:20 behind");
      expect(spoken.length).toBeGreaterThan(0);
      expect(new Set(spoken)).toEqual(new Set(["−0:16 behind"]));
    });

    it("does not announce seconds", async () => {
      const d = deck();
      await start();
      await d.post(0, 0);
      await advance(5000);
      expect(
        screen.getByRole("status", { name: "Elapsed (announcement)" }),
      ).toBeEmptyDOMElement();
    });

    it("asks twice before it resets", async () => {
      const { user } = await start();
      await user.click(screen.getByRole("button", { name: "Start" }));
      await advance(5000);
      await user.click(screen.getByRole("button", { name: "Reset" }));
      expect(value("Elapsed")).toBe("00:05");
      await user.click(screen.getByRole("button", { name: "Confirm reset" }));
      expect(value("Elapsed")).toBe("00:00");
      expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
    });

    it("gives the first press of Reset back when focus leaves it", async () => {
      const { user } = await start();
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await user.click(screen.getByRole("button", { name: "Keys" }));
      expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    });

    it("stops ticking while the page is hidden and goes on when it is shown", async () => {
      const { user } = await start();
      await user.click(screen.getByRole("button", { name: "Start" }));
      const hidden = vi.spyOn(document, "hidden", "get");
      hidden.mockReturnValue(true);
      // oxlint-disable-next-line dox-test/no-dispatch-event -- page visibility has no user-event
      document.dispatchEvent(new window.Event("visibilitychange"));
      expect(vi.getTimerCount()).toBe(1); // the grace timer only
      await advance(5000);
      hidden.mockReturnValue(false);
      // oxlint-disable-next-line dox-test/no-dispatch-event -- page visibility has no user-event
      document.dispatchEvent(new window.Event("visibilitychange"));
      expect(value("Elapsed")).toBe("00:05");
      hidden.mockRestore();
    });
  });

  describe("demo", () => {
    it("shows Waiting, Live and Recorded, and announces only the switch to Recorded", async () => {
      const d = deck();
      await start();
      await d.post(0, 0, { demo: { id: "ask", source: "pending" } });
      expect(value("Demo")).toBe("Waiting");
      const announcer = screen.getByRole("status", {
        name: "Demo (announcement)",
      });
      await d.post(0, 0, { demo: { id: "ask", source: "live" } });
      await vi.waitFor(() => expect(value("Demo")).toBe("Live"));
      expect(announcer).toBeEmptyDOMElement();
      d.channel.postMessage({
        type: "state",
        slide: 0,
        build: 0,
        blanked: false,
        env: ENV,
        demo: { id: "ask", source: "recorded" },
      });
      await vi.waitFor(() => expect(value("Demo")).toBe("Recorded"));
      expect(announcer).toHaveTextContent("Recorded");
    });
  });

  describe("readiness", () => {
    it("lists every check with its result in words once the deck has had its moment", async () => {
      const d = deck();
      await start();
      await d.post(0);
      await advance(DECK_GRACE_MS);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Check again" }),
        ).toBeEnabled(),
      );
      const list = screen.getByRole("list");
      // The test deck has no runtime, so no file list of its own beside the eight every deck has.
      expect(within(list).getAllByRole("listitem")).toHaveLength(8);
      expect(within(list).getByText("WebGPU")).toBeInTheDocument();
      expect(within(list).getAllByText(/^Failed/).length).toBeGreaterThan(0);
    });

    it("runs again on Check again", async () => {
      const { user } = await start();
      await advance(DECK_GRACE_MS);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Check again" }),
        ).toBeEnabled(),
      );
      const calls = vi.mocked(fetch).mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Check again" }));
      await vi.waitFor(() =>
        expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(calls),
      );
    });
  });

  it("has no accessibility violations", async () => {
    const { root } = await start();
    // axe waits on real timers.
    vi.useRealTimers();
    await expectNoAxeViolations(root);
  });

  it("leaves no timer behind after destroy, running or not", async () => {
    const { user } = await start();
    await user.click(screen.getByRole("button", { name: "Start" }));
    await advance(2000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    handle?.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
