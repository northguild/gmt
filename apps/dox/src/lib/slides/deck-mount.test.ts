/**
 * @vitest-environment jsdom
 *
 * The deck's DOM side over a fixture of three slides with 0, 2 and 1 builds, built with the same
 * controls and dialogs the page renders (`deck-controls.ts`).
 */
import { screen, within } from "@testing-library/dom";
import { deckRoot, recordDeckStates } from "~/test/deck-events";
import { expectNoAxeViolations, renderWidget } from "~/test/render-widget";
import { installDialogFullscreenShims } from "~/test/dialog-fullscreen-shims";
import { installJsdomShims } from "~/test/jsdom-shims";
import { html, type SafeHtml } from "~/widgets/builders/html";
import { deckControls, deckDialogs } from "~/widgets/builders/deck-controls";
import { KEY_TABLE } from "./keys";
import { mountDeck, type DeckHandle } from "./deck-mount";
import type { SpaceStage } from "./stage";
import { channelName, PRESENTER_WINDOW } from "./sync";
import { UNLOCK_STORAGE_KEY } from "./unlock";

installJsdomShims();

function slide(
  id: string,
  title: string,
  minutes: number,
  body: SafeHtml,
  place = "",
  extra = "",
): SafeHtml {
  return html`<section id="${id}" data-slide data-minutes="${minutes}" data-place="${place}" data-lapse="${extra}" aria-labelledby="${id}-title">
    <h2 id="${id}-title">${title}</h2>
    ${body}
  </section>`;
}

function fixture(slides = 3): SafeHtml {
  const all = [
    slide("first", "First", 1, html`<p>Opening words</p>`, "Europe/Helsinki"),
    slide(
      "second",
      "Second",
      2,
      html`<div data-build="1"><p>Build one</p></div><div data-build="2" data-place="Asia/Tokyo" data-lapse="tokyo"><p>Build two</p></div>`,
      "Asia/Tehran",
      "tehran",
    ),
    slide(
      "third",
      "Third",
      1,
      html`<div data-build="1"><p>Last build</p></div>`,
    ),
  ].slice(0, slides);
  return html`<article data-deck-root data-deck-slug="test-deck">
    <div data-deck-stage>
      <div data-deck-slides>${all}</div>
      <div data-deck-blank aria-hidden="true" hidden></div>
    </div>
    ${deckControls(KEY_TABLE, [])}${deckDialogs(KEY_TABLE)}
  </article>`;
}

let shims: ReturnType<typeof installDialogFullscreenShims>;
let session: Awaited<ReturnType<typeof renderWidget>> | undefined;
let handle: DeckHandle | null = null;
let space: { [K in keyof SpaceStage]: ReturnType<typeof vi.fn> };

async function start(slides = 3): Promise<NonNullable<typeof session>> {
  session = await renderWidget(
    {
      renderTemplate: () => fixture(slides),
      mount: async (root, _args, signal) => {
        // The mount's own root, which has no role to find it by.
        // oxlint-disable-next-line dox-test/no-class-query, testing-library/no-node-access
        const article = root.querySelector<HTMLElement>("[data-deck-root]");
        handle = article
          ? mountDeck(article, {
              signal,
              space: () => space as unknown as SpaceStage,
            })
          : null;
        return { destroy: () => handle?.destroy() };
      },
    },
    {},
  );
  return session;
}

/** Whether the text is in a build the deck has revealed. */
function revealed(text: string): boolean {
  // A build not yet reached is inert: jsdom keeps `inert` as a property, a browser as the attribute too.
  // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query
  const build = screen.getByText(text).closest<HTMLElement>("[data-build]");
  return build?.inert === false;
}

const live = (): string => screen.getByRole("status").textContent ?? "";
/** The info menu's Unlock (or Lock) tool: the unlock dialog's own button is named Unlock too. */
const lockTool = (): HTMLElement => {
  // oxlint-disable-next-line testing-library/no-node-access
  const tool = document.getElementById("deck-unlock");
  if (!tool) throw new Error("the deck has no lock tool");
  return tool;
};

beforeEach(() => {
  space = {
    goTo: vi.fn(),
    overview: vi.fn(),
    steer: vi.fn(),
    returnHome: vi.fn(),
    lapse: vi.fn(),
    pinFilings: vi.fn(),
    destroy: vi.fn(),
  };
  shims = installDialogFullscreenShims();
  // Every test but the lock's own runs on an unlocked deck.
  window.localStorage.setItem(UNLOCK_STORAGE_KEY, "yes");
});

afterEach(() => {
  session?.destroy();
  session = undefined;
  handle = null;
  shims.restore();
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});

describe("mountDeck", () => {
  it("shows the first slide as a named carousel and leaves the builds unseen", async () => {
    await start();
    expect(screen.getByRole("region", { name: "Slides" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "First", selected: true }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(revealed("Build one")).toBe(false);
  });

  it("steps builds before slides and announces only slide changes", async () => {
    const { user } = await start();
    await user.keyboard("{ArrowRight}");
    expect(live()).toBe("Slide 2 of 3: Second");
    expect(
      screen.getByRole("button", { name: "Next build" }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(revealed("Build one")).toBe(true);
    expect(revealed("Build two")).toBe(false);
    await user.keyboard("{ArrowRight}");
    expect(revealed("Build two")).toBe(true);
    expect(live()).toBe("Slide 2 of 3: Second");
    await user.keyboard("{ArrowRight}");
    expect(live()).toBe("Slide 3 of 3: Third");
    expect(window.location.hash).toBe("#third");
  });

  it("steps back onto the previous slide with every build shown", async () => {
    const { user } = await start();
    await user.keyboard("{End}");
    expect(
      screen.getByRole("tab", { name: "Third", selected: true }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(
      screen.getByRole("tab", { name: "Second", selected: true }),
    ).toBeInTheDocument();
    expect(revealed("Build one")).toBe(true);
    expect(revealed("Build two")).toBe(true);
    expect(window.location.hash).toBe("#second/2");
  });

  it("walks the pager buttons the same way", async () => {
    const { user } = await start();
    await user.click(screen.getByRole("button", { name: "Next: Second" }));
    await user.click(screen.getByRole("button", { name: "Next build" }));
    expect(revealed("Build one")).toBe(true);
    await user.click(screen.getByRole("tab", { name: "Third" }));
    expect(
      screen.getByRole("tab", { name: "Third", selected: true }),
    ).toBeInTheDocument();
    expect(revealed("Last build")).toBe(false);
  });

  it("opens on the slide and build the address names", async () => {
    window.history.replaceState(null, "", "/#second/1");
    await start();
    expect(
      screen.getByRole("tab", { name: "Second", selected: true }),
    ).toBeInTheDocument();
    expect(revealed("Build one")).toBe(true);
    expect(revealed("Build two")).toBe(false);
  });

  it("opens on the first slide when the address names none", async () => {
    window.history.replaceState(null, "", "/#nope");
    await start();
    expect(
      screen.getByRole("tab", { name: "First", selected: true }),
    ).toBeInTheDocument();
  });

  it("follows the address when it changes", async () => {
    await start();
    window.location.hash = "#third";
    expect(
      await screen.findByRole("tab", { name: "Third", selected: true }),
    ).toBeInTheDocument();
  });

  it("goes to the first, last and numbered slide and by whole slides", async () => {
    const { user } = await start();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(
      screen.getByRole("tab", { name: "Second", selected: true }),
    ).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(
      screen.getByRole("tab", { name: "Third", selected: true }),
    ).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(
      screen.getByRole("tab", { name: "First", selected: true }),
    ).toBeInTheDocument();
    await user.keyboard("3{Enter}");
    expect(
      screen.getByRole("tab", { name: "Third", selected: true }),
    ).toBeInTheDocument();
  });

  it("blanks the stage, says so, and a step key brings it back without moving", async () => {
    const { user } = await start();
    await user.keyboard("b");
    expect(live()).toBe("Screen blanked");
    expect(
      screen.getByRole("button", {
        name: "Blank",
        pressed: true,
        hidden: true,
      }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(live()).toBe("Slide 1 of 3: First");
    expect(
      screen.getByRole("tab", { name: "First", selected: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Blank",
        pressed: false,
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it("opens the help dialog from the info menu, and returns focus to the info button", async () => {
    const { user } = await start();
    const info = screen.getByRole("button", { name: "Slide options" });
    info.focus();
    await user.click(
      screen.getByRole("button", { name: "Keys", hidden: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "Keys" });
    const table = within(dialog).getByRole("table", {
      name: "Keys for the slides",
    });
    expect(
      within(table).getByRole("row", { name: /Fullscreen/ }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });

  it("opens the overview from O, lists every slide with its minutes and goes to the one chosen", async () => {
    const { user } = await start();
    await user.keyboard("o");
    const dialog = screen.getByRole("dialog", { name: "Slides" });
    const items = within(dialog).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "First 1 min",
      "Second 2 min",
      "Third 1 min",
    ]);
    expect(within(dialog).getByRole("link", { name: "First" })).toHaveFocus();
    await user.click(within(dialog).getByRole("link", { name: "Second" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Second", selected: true }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#second");
  });

  it("leaves the keys to an open dialog", async () => {
    const { user } = await start();
    await user.keyboard("?");
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("tab", { name: "First", selected: true }),
    ).toBeInTheDocument();
  });

  it("asks the deck root for fullscreen, from the key and the button", async () => {
    const { user } = await start();
    await user.keyboard("f");
    expect(shims.requests).toHaveLength(1);
    expect(shims.requests[0]).toBe(screen.getByRole("article"));
    expect(
      screen.getByRole("button", {
        name: "Fullscreen",
        pressed: true,
        hidden: true,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Fullscreen", hidden: true }),
    );
    expect(
      screen.getByRole("button", {
        name: "Fullscreen",
        pressed: false,
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it("starts presenting on F5 without a reload, and unblanks", async () => {
    const { user } = await start();
    await user.keyboard("b");
    await user.keyboard("{F5}");
    expect(shims.requests).toHaveLength(1);
    expect(live()).toBe("Slide 1 of 3: First");
  });

  it("leaves a page of one slide as the article it is", async () => {
    await start(1);
    expect(handle).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Slides" }),
    ).not.toBeInTheDocument();
  });

  describe("space stage", () => {
    it("starts at the first slide's place without a hop", async () => {
      await start();
      expect(space.goTo).toHaveBeenLastCalledWith("Europe/Helsinki", {
        hop: false,
        at: { slide: 0, build: 0 },
      });
    });

    it("hops to each slide's place, and to a build's own place once it is reached", async () => {
      const { user } = await start();
      await user.keyboard("{ArrowRight}");
      expect(space.goTo).toHaveBeenLastCalledWith("Asia/Tehran", {
        hop: true,
        at: { slide: 1, build: 0 },
      });
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(space.goTo).toHaveBeenLastCalledWith("Asia/Tokyo", {
        hop: true,
        at: { slide: 1, build: 2 },
      });
    });

    it("runs the slide's lapse, then the highest reached build's, and none where a slide names none", async () => {
      const { user } = await start();
      expect(space.lapse).toHaveBeenLastCalledWith(null);
      await user.keyboard("{ArrowRight}");
      expect(space.lapse).toHaveBeenLastCalledWith("tehran");
      await user.keyboard("{ArrowRight}");
      expect(space.lapse).toHaveBeenLastCalledWith("tehran");
      await user.keyboard("{ArrowRight}");
      expect(space.lapse).toHaveBeenLastCalledWith("tokyo");
      await user.keyboard("{ArrowRight}");
      expect(space.lapse).toHaveBeenLastCalledWith(null);
    });

    it("tells the slides' visuals where the deck is", async () => {
      const { user } = await start();
      const seen = recordDeckStates(deckRoot());
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(seen.at(-1)).toMatchObject({ id: "second", build: 1 });
    });

    it("lights the route while the overview is open and drops it on close", async () => {
      const { user } = await start();
      await user.keyboard("o");
      expect(space.overview).toHaveBeenLastCalledWith(true);
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(space.overview).toHaveBeenLastCalledWith(false);
    });

    it("hands W A S D and R to the stage", async () => {
      const { user } = await start();
      await user.keyboard("{r}");
      expect(space.returnHome).toHaveBeenCalledTimes(1);
      await user.keyboard("{d>}");
      expect(space.steer).toHaveBeenLastCalledWith(
        expect.objectContaining({ lng: expect.any(Number) }),
      );
      await user.keyboard("{/d}");
      expect(space.steer).toHaveBeenLastCalledWith({ lng: 0, lat: 0, zoom: 0 });
    });
  });

  describe("presenter window", () => {
    const channels: BroadcastChannel[] = [];
    afterEach(() => {
      for (const c of channels.splice(0)) c.close();
      vi.restoreAllMocks();
    });

    /** A presenter's end of the channel: every state the deck posts lands in `states`. */
    function presenter() {
      const channel = new BroadcastChannel(channelName("test-deck"));
      channels.push(channel);
      const heard: {
        type: string;
        slide?: number;
        build?: number;
        blanked?: boolean;
        demo?: unknown;
      }[] = [];
      channel.addEventListener("message", (e) => heard.push(e.data));
      const last = () => heard.filter((m) => m.type === "state").at(-1);
      return { channel, heard, last };
    }

    it("answers hello with its state, and the step keys with the new state", async () => {
      const { user } = await start();
      const p = presenter();
      p.channel.postMessage({ type: "hello" });
      await vi.waitFor(() =>
        expect(p.last()).toMatchObject({
          slide: 0,
          build: 0,
          blanked: false,
          demo: null,
        }),
      );
      await user.keyboard("{ArrowRight}");
      await vi.waitFor(() =>
        expect(p.last()).toMatchObject({ slide: 1, build: 0 }),
      );
      await user.keyboard("{ArrowRight}");
      await vi.waitFor(() =>
        expect(p.last()).toMatchObject({ slide: 1, build: 1 }),
      );
    });

    it("runs a step the presenter posts, and says the new state", async () => {
      await start();
      const p = presenter();
      p.channel.postMessage({ type: "step", action: "nextSlide" });
      await vi.waitFor(() =>
        expect(p.last()).toMatchObject({ slide: 1, build: 0 }),
      );
      expect(live()).toBe("Slide 2 of 3: Second");
      p.channel.postMessage({ type: "step", action: "goTo", n: 3 });
      await vi.waitFor(() => expect(p.last()).toMatchObject({ slide: 2 }));
      p.channel.postMessage({ type: "step", action: "blank" });
      await vi.waitFor(() => expect(p.last()).toMatchObject({ blanked: true }));
      expect(window.location.hash).toBe("#third");
    });

    it("tells the presenter which demo runs and where its answers come from", async () => {
      await start();
      const p = presenter();
      handle?.setDemo({ id: "ask", source: "recorded" });
      await vi.waitFor(() =>
        expect(p.last()).toMatchObject({
          demo: { id: "ask", source: "recorded" },
        }),
      );
    });

    it("opens the presenter view in its own named window with T", async () => {
      const { user } = await start();
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      await user.keyboard("t");
      expect(open).toHaveBeenCalledWith(
        "/gmt/slides/test-deck/presenter/",
        PRESENTER_WINDOW,
      );
    });

    it("says bye when the deck is destroyed", async () => {
      await start();
      const p = presenter();
      handle?.destroy();
      await vi.waitFor(() =>
        expect(p.heard.some((m) => m.type === "bye")).toBe(true),
      );
    });
  });

  describe("the lock", () => {
    beforeEach(() => window.localStorage.clear());

    const selected = (name: string) =>
      screen.getByRole("tab", { name, selected: true });

    it("keeps a locked deck on its first slide by every key, the pager, the overview and the presenter", async () => {
      const { user } = await start();
      expect(screen.getAllByRole("tab")).toHaveLength(1);
      expect(
        screen.queryByRole("button", { name: "Next: Second" }),
      ).not.toBeInTheDocument();
      for (const key of [
        "{ArrowRight}",
        "{End}",
        "3",
        "{PageDown}",
        "{Shift>}{ArrowRight}{/Shift}",
      ])
        await user.keyboard(key);
      expect(selected("First")).toBeInTheDocument();
      await user.keyboard("o");
      const dialog = screen.getByRole("dialog", { name: "Slides" });
      expect(
        within(dialog)
          .getAllByRole("listitem")
          .map((li) => li.textContent),
      ).toEqual(["First 1 min"]);
      await user.keyboard("{Escape}");
      const channel = new BroadcastChannel(channelName("test-deck"));
      channel.postMessage({ type: "step", action: "goTo", n: 3 });
      channel.postMessage({ type: "step", action: "last" });
      await new Promise((r) => setTimeout(r, 20));
      channel.close();
      expect(selected("First")).toBeInTheDocument();
      expect(window.location.hash).toBe("");
    });

    it("opens a link to a locked slide on the first, and says so in the address", async () => {
      window.history.replaceState(null, "", "/#third");
      await start();
      expect(selected("First")).toBeInTheDocument();
      expect(window.location.hash).toBe("#first");
      window.location.hash = "#second/1";
      await vi.waitFor(() => expect(window.location.hash).toBe("#first"));
      expect(selected("First")).toBeInTheDocument();
    });

    it("says a wrong secret phrase is wrong, and the right one opens every slide and is kept", async () => {
      const { user } = await start();
      const info = screen.getByRole("button", { name: "Slide options" });
      info.focus();
      expect(lockTool()).toHaveAccessibleName("Unlock");
      await user.click(lockTool());
      const dialog = screen.getByRole("dialog", { name: "Unlock the slides" });
      const code = within(dialog).getByRole("textbox", {
        name: "Secret phrase",
      });
      expect(code).toHaveFocus();
      await user.type(code, "letmein");
      await user.click(within(dialog).getByRole("button", { name: "Unlock" }));
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "That secret phrase does not unlock the slides.",
      );
      expect(code).toHaveAttribute("aria-invalid", "true");
      expect(screen.getAllByRole("tab")).toHaveLength(1);

      await user.clear(code);
      await user.type(code, "@northguild/gmt{Enter}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(info).toHaveFocus();
      expect(live()).toBe("Every slide is unlocked");
      expect(window.localStorage.getItem(UNLOCK_STORAGE_KEY)).toBe("yes");
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      expect(lockTool()).toHaveAccessibleName("Lock");
      await user.keyboard("{End}");
      expect(selected("Third")).toBeInTheDocument();
      await user.keyboard("o");
      expect(
        within(screen.getByRole("dialog", { name: "Slides" })).getAllByRole(
          "listitem",
        ),
      ).toHaveLength(3);
    });

    it("locks again from the menu: back to the first slide, the pager hidden and the unlock forgotten", async () => {
      window.localStorage.setItem(UNLOCK_STORAGE_KEY, "yes");
      const { user } = await start();
      await user.keyboard("{End}");
      expect(selected("Third")).toBeInTheDocument();
      expect(lockTool()).toHaveAccessibleName("Lock");
      await user.click(lockTool());
      expect(selected("First")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(1);
      expect(window.location.hash).toBe("#first");
      expect(window.localStorage.getItem(UNLOCK_STORAGE_KEY)).toBeNull();
      expect(live()).toBe("The slides are locked: only the first one shows");
      expect(lockTool()).toHaveAccessibleName("Unlock");
      await user.keyboard("{End}");
      expect(selected("First")).toBeInTheDocument();
    });

    it("names the tool Unlock again when the deck is torn down", async () => {
      window.localStorage.setItem(UNLOCK_STORAGE_KEY, "yes");
      await start();
      expect(lockTool()).toHaveAccessibleName("Lock");
      handle?.destroy();
      expect(lockTool()).toHaveAccessibleName("Unlock");
    });

    it("follows an unlock or a lock made in another tab", async () => {
      await start();
      const fromAnotherTab = (value: string | null) => {
        if (value === null) window.localStorage.removeItem(UNLOCK_STORAGE_KEY);
        else window.localStorage.setItem(UNLOCK_STORAGE_KEY, value);
        // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action fires another tab's storage event; the event is the input
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: UNLOCK_STORAGE_KEY,
            newValue: value,
          }),
        );
      };
      fromAnotherTab("yes");
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      fromAnotherTab(null);
      expect(screen.getAllByRole("tab")).toHaveLength(1);
    });

    it("clears a wrong phrase's alert when the dialog opens again", async () => {
      const { user } = await start();
      const tool = lockTool();
      await user.click(tool);
      const dialog = screen.getByRole("dialog", { name: "Unlock the slides" });
      const code = within(dialog).getByRole("textbox", {
        name: "Secret phrase",
      });
      await user.type(code, "nope{Enter}");
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await user.click(tool);
      expect(within(dialog).getByRole("alert")).toBeEmptyDOMElement();
      expect(code).toHaveValue("");
      expect(code).not.toHaveAttribute("aria-invalid");
    });
  });

  it("has no accessibility violations, with a dialog shut or open", async () => {
    const { user, root } = await start();
    await expectNoAxeViolations(root);
    await user.keyboard("o");
    await expectNoAxeViolations(root);
  });
});
