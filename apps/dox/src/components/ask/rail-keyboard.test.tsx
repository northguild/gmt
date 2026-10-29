/**
 * @vitest-environment jsdom
 *
 * `DOX-C3b`'s DoD: *"A mounted widget is keyboard-operable inside the panel,
 * matching its standalone page."*
 *
 * The mount modules' own tests prove the keyboard path works when the widget is
 * wired directly. This proves it survives the trip through the panel — the
 * registry's dispatch, the type-erased entry, `MountedWidget`'s effect, and the
 * template being written into a host React owns. Those are exactly the layers
 * that could swallow a `keydown` (a stray `preventDefault`, a re-render that
 * replaces the node between focus and key, a template rendered without
 * `tabindex`), and none of them are exercised by a direct mount.
 *
 * Driven through `resolveWidget` rather than by importing the mount directly,
 * so the test enters by the same door a streamed tool call does.
 */
import { getNodeText } from "@testing-library/dom";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import {
  CHAT_STARTERS,
  EXAMPLE_AREAS,
  startersByArea,
} from "~/lib/chat-constants";
import type { WidgetHandle } from "~/lib/widget-mount";
import { installJsdomShims } from "~/test/jsdom-shims";
import DoxPage from "./DoxPage";
import { MountedWidget } from "./MountedWidget";
import { type AnyWidgetEntry, resolveWidget } from "./widget-registry";

installJsdomShims();

/**
 * Render a widget through the panel and resolve once `mount()` has finished.
 *
 * `renderTemplate` writes the controls synchronously, but `mount` seeds values and
 * attaches listeners only after it has loaded gmt — a cold dynamic import that
 * can take well over a second when the whole workspace's suites run at once.
 * Polling the DOM for "looks ready" (`waitFor` / `findBy*`, 1s default) raced
 * that import and made this file flaky. `onHandle` fires exactly when the mount
 * resolves, so awaiting it removes the race instead of widening the timeout;
 * after it, every read below is synchronous.
 */
async function renderMounted(name: string, rawArgs: unknown, idPrefix: string) {
  const resolved = resolveWidget(name, rawArgs);
  expect(resolved.ok).toBe(true);
  if (!resolved.ok) throw new Error(`unknown widget ${name}`);

  return mountEntry(resolved.entry, resolved.args, idPrefix);
}

async function mountEntry(
  entry: AnyWidgetEntry,
  args: unknown,
  idPrefix: string,
) {
  let resolveHandle!: (handle: WidgetHandle) => void;
  const mounted = new Promise<WidgetHandle>((resolve) => {
    resolveHandle = resolve;
  });

  const { container } = render(
    <MountedWidget
      entry={entry}
      args={args}
      idPrefix={idPrefix}
      onHandle={(handle) => {
        if (handle) resolveHandle(handle);
      }}
    />,
  );

  // If validate() reports a problem or mount() throws, `onHandle` never fires and
  // MountedWidget renders its error instead. Watch for that element so the helper
  // rejects at once with the widget's own message rather than hanging until the
  // Vitest timeout.
  let observer: MutationObserver | undefined;
  const failed = new Promise<never>((_resolve, reject) => {
    const check = () => {
      const error = within(container).queryByRole("alert", {
        name: `${entry.title} couldn\u2019t be shown`,
      });
      if (error) {
        const said = within(error).getByText(/couldn.t be shown\./);
        reject(
          new Error(
            `widget "${entry.title}" failed to mount: ${getNodeText(said).trim()}`,
          ),
        );
      }
    };
    observer = new MutationObserver(check);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    check();
  });

  // The race is awaited outside `act`: inside it, React holds MountedWidget's
  // `setError` in the act queue until the callback settles, so the error element
  // would never render and the observer could never fire.
  try {
    await Promise.race([mounted, failed]);
  } finally {
    observer?.disconnect();
  }

  // Let React settle whatever the mount scheduled, so every read after this is synchronous.
  await waitFor(() => expect(container).not.toBeEmptyDOMElement());

  return { container };
}

afterEach(cleanup);

describe("the mount helper", () => {
  // A widget that cannot be shown must fail the test with its own message, straight away —
  // not leave the helper waiting for a handle that will never come until Vitest times out.
  it("rejects with the widget's error text as soon as the panel shows it", async () => {
    const resolved = resolveWidget("showConverterBench", {
      value: "2024-03-15T14:30:00.000-04:00[America/New_York]",
      from: "America/New_York",
      to: "Europe/London",
    });
    if (!resolved.ok) throw new Error("unknown widget showConverterBench");

    const problem = "Mars/Olympus_Mons is not a real time zone.";
    const failing: AnyWidgetEntry = {
      ...resolved.entry,
      validate: () => Promise.resolve(problem),
    };

    const startedAt = performance.now();
    await expect(mountEntry(failing, resolved.args, "rail-3")).rejects.toThrow(
      problem,
    );
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});

describe("a widget mounted in the panel", () => {
  it("is reachable and operable by keyboard, exactly as on its own page", async () => {
    await renderMounted(
      "showIntervalVisualizer",
      {
        aStart: "2024-01-01T00:00:00+00:00[UTC]",
        aEnd: "2024-06-30T00:00:00+00:00[UTC]",
        bStart: "2024-04-01T00:00:00+00:00[UTC]",
        bEnd: "2024-12-31T00:00:00+00:00[UTC]",
      },
      "rail-1",
    );
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: "A start" });
    expect(input).not.toHaveValue("");

    // Reachable: a real slider, in the tab order, with a name.
    const handle = screen.getByRole("slider", { name: "Interval A start" });
    expect(handle).toHaveAttribute("tabindex", "0");

    handle.focus();
    expect(handle).toHaveFocus();

    // Operable: the key actually moves the interval, through the panel.
    const before = (input as HTMLInputElement).value;
    await user.keyboard("{ArrowRight}");
    expect(input).not.toHaveValue(before);

    // And the answer recomputed, so the keyboard drives the whole widget and
    // not just the control it touched.
    expect(
      screen.getByRole("status", { name: "Intersection result" }),
    ).not.toBeEmptyDOMElement();
  });

  it("keeps the converter's controls keyboard-operable in the panel", async () => {
    await renderMounted(
      "showConverterBench",
      {
        value: "2024-03-15T14:30:00.000-04:00[America/New_York]",
        from: "America/New_York",
        to: "Europe/London",
      },
      "rail-2",
    );

    const user = userEvent.setup();
    const out = screen.getByRole("status", { name: "Converted value" });
    expect(out).toHaveTextContent("[Europe/London]");

    const select = screen.getByRole("combobox", { name: "To" });
    select.focus();
    expect(select).toHaveFocus();

    // Changing a select by keyboard fires `change`, not `input` — the mount
    // listens for both, and this is the half a pointer test never covers.
    await user.selectOptions(select, "Asia/Tokyo");

    // The answer is redrawn, so ask for it again rather than reading the old node.
    expect(
      screen.getByRole("status", { name: "Converted value" }),
    ).toHaveTextContent("Asia/Tokyo");
  });
});

/* ------------------------------------------------------------------ *
 * The examples rail, driven through the whole page with real keys.
 * ------------------------------------------------------------------ */

const PHONE_QUERY = "(max-width: 60rem)";

function stubMatchMedia(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_QUERY,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** `/api/chat` answers with plain text, or with a tool call; `/api/brains` is 404. */
function stubFetch(reply: "text" | { tool: string; input: unknown }) {
  const chat = vi.fn(async () =>
    createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          if (reply === "text") {
            writer.write({ type: "text-start", id: "t1" });
            writer.write({
              type: "text-delta",
              id: "t1",
              delta: "Here you go.",
            });
            writer.write({ type: "text-end", id: "t1" });
          } else {
            writer.write({
              type: "tool-input-available",
              toolCallId: "call-model-1",
              toolName: reply.tool,
              input: reply.input,
            });
          }
        },
      }),
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/chat")
        ? chat()
        : new Response("{}", { status: 404 }),
    ),
  );
  return chat;
}

const starterFor = (widget: string) =>
  CHAT_STARTERS.find((s) => s.widget === widget)!;

/** A starter card, found by its question: that is its accessible name. */
const card = (widget: string) =>
  screen.getByRole("button", { name: starterFor(widget).text });

/** The title of the open widget, in its panel. */
const panelTitle = (title: string) =>
  within(screen.getByRole("complementary", { name: "Widget panel" })).getByText(
    title,
  );

describe("the examples rail on /dox", () => {
  const original = window.matchMedia;
  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = original;
  });

  it("lists one card per starter under every area, and no starter pills in the chat", () => {
    stubMatchMedia(false);
    stubFetch("text");
    render(<DoxPage />);

    const rail = screen.getByRole("complementary", { name: "Examples" });
    expect(within(rail).getAllByRole("button")).toHaveLength(
      CHAT_STARTERS.length,
    );
    for (const { label } of EXAMPLE_AREAS) {
      expect(
        within(rail).getByRole("region", { name: label }),
      ).toBeInTheDocument();
    }
    // No pill in the chat: the one button with this question is in the rail.
    expect(
      screen.getAllByRole("button", { name: starterFor("showGlobe").text }),
    ).toHaveLength(1);
    // The accessible name is exactly the question; the chip is the description.
    const globe = starterFor("showGlobe");
    expect(
      within(rail).getByRole("button", {
        name: globe.text,
        description: "Zoned Earth",
      }),
    ).toBeInTheDocument();
  });

  it("is reached by Tab, card by card, in order", async () => {
    stubMatchMedia(false);
    stubFetch("text");
    render(<DoxPage />);
    const user = userEvent.setup();
    const rail = screen.getByRole("complementary", { name: "Examples" });
    const expected = startersByArea().flatMap((g) =>
      g.starters.map((s) => within(rail).getByRole("button", { name: s.text })),
    );

    const seen: number[] = [];
    for (let i = 0; i < 80 && seen.length < expected.length; i++) {
      await user.tab();
      const at = expected.findIndex((c) => c.matches(":focus"));
      if (at >= 0) seen.push(at);
    }
    expect(seen).toEqual(expected.map((_, at) => at));
  });

  it("opens a widget on Enter or Space, sends once, focuses the title, and returns focus on close", async () => {
    stubMatchMedia(false);
    const chat = stubFetch("text");
    render(<DoxPage />);
    const user = userEvent.setup();

    // Enter on the converter card.
    card("showConverterBench").focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("complementary", { name: "Widget panel" });
    expect(chat).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(panelTitle("Converter + format bench")).toHaveFocus(),
    );

    // Closing brings the list back, focus on the card that opened it.
    await user.click(screen.getByRole("button", { name: "Close" }));
    await screen.findByRole("complementary", { name: "Examples" });
    await waitFor(() => expect(card("showConverterBench")).toHaveFocus());

    // Space on the interval card.
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    card("showIntervalVisualizer").focus();
    await user.keyboard(" ");
    await screen.findByRole("complementary", { name: "Widget panel" });
    expect(chat).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(panelTitle("Interval algebra visualizer")).toHaveFocus(),
    );
  });

  it("on a phone, folds the examples behind a bar once a conversation has started", async () => {
    stubMatchMedia(true);
    stubFetch("text");
    render(<DoxPage />);
    const user = userEvent.setup();
    const name = `Examples ${CHAT_STARTERS.length}`;
    // The bar is in the page from the start; CSS shows it before the first
    // message only on a short phone (gmt-hive.css).
    const first = screen.getByRole("button", { name });
    expect(first).toHaveAttribute("aria-expanded", "false");

    card("showConverterBench").focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("complementary", { name: "Widget panel" });
    // No bar while a widget is open.
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    const bar = await screen.findByRole("button", { name });
    expect(bar).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(bar).toHaveFocus());

    const rail = screen.getByRole("complementary", { name: "Examples" });
    expect(bar).toHaveAttribute("aria-controls", rail.id);

    await user.click(bar);
    expect(bar).toHaveAttribute("aria-expanded", "true");
  });

  it("never moves focus for a widget the model opens", async () => {
    stubMatchMedia(false);
    const converter = starterFor("showConverterBench");
    stubFetch({ tool: "showConverterBench", input: converter.args });
    render(<DoxPage />);
    const user = userEvent.setup();

    const box = screen.getByRole("textbox");
    await user.type(box, "Convert 2:30pm New York to Tokyo please{Enter}");
    await screen.findByRole("complementary", { name: "Widget panel" });
    expect(panelTitle("Converter + format bench")).not.toHaveFocus();
    expect(box).toHaveFocus();
  });
});
