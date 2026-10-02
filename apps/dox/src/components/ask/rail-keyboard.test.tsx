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
/// <reference types="vitest/globals" />
import { act, render, screen, waitFor, within } from "@testing-library/react";
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

/** jsdom gives every element a zero-sized rect; the drag maths needs a real one. */
function stubTrackGeometry(root: ParentNode) {
  for (const track of root.querySelectorAll(".gmt-interval-track")) {
    (track as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 20,
        right: 1000,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

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
      const error = container.querySelector(".gmt-hive-widget-error");
      if (error) {
        reject(
          new Error(
            `widget "${entry.title}" failed to mount: ${error.textContent?.trim() ?? ""}`,
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

  // Flush whatever the mount scheduled, so every read after this is synchronous.
  await act(async () => {});

  return { container, view: within(container) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

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
    const { container, view } = await renderMounted(
      "showIntervalVisualizer",
      {
        aStart: "2024-01-01T00:00:00+00:00[UTC]",
        aEnd: "2024-06-30T00:00:00+00:00[UTC]",
        bStart: "2024-04-01T00:00:00+00:00[UTC]",
        bEnd: "2024-12-31T00:00:00+00:00[UTC]",
      },
      "rail-1",
    );
    stubTrackGeometry(container);

    const input = view.getByLabelText("A start") as HTMLInputElement;
    expect(input.value).not.toBe("");

    // Reachable: a real slider, in the tab order, with a name.
    const handle = view.getByRole("slider", { name: "Interval A start" });
    expect(handle.getAttribute("tabindex")).toBe("0");

    handle.focus();
    expect(document.activeElement).toBe(handle);

    // Operable: the key actually moves the interval, through the panel.
    const before = input.value;
    await act(async () => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(input.value).not.toBe(before);

    // And the answer recomputed, so the keyboard drives the whole widget and
    // not just the control it touched.
    const output = container.querySelector(
      '[data-role="op-output-intersection"]',
    ) as HTMLElement;
    expect(output.textContent?.trim()).not.toBe("");
  });

  it("keeps the converter's controls keyboard-operable in the panel", async () => {
    const { container, view } = await renderMounted(
      "showConverterBench",
      {
        value: "2024-03-15T14:30:00.000-04:00[America/New_York]",
        from: "America/New_York",
        to: "Europe/London",
      },
      "rail-2",
    );

    const out = container.querySelector(
      '[data-role="convert-result"]',
    ) as HTMLElement;
    expect(out.textContent).toContain("[Europe/London]");

    const select = view.getByLabelText("To") as HTMLSelectElement;
    select.focus();
    expect(document.activeElement).toBe(select);

    // Changing a select by keyboard fires `change`, not `input` — the mount
    // listens for both, and this is the half a pointer test never covers.
    await act(async () => {
      select.value = "Asia/Tokyo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(out.textContent).toContain("Asia/Tokyo");
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

const card = (widget: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-widget="${widget}"]`)!;

const starterFor = (widget: string) =>
  CHAT_STARTERS.find((s) => s.widget === widget)!;

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

    expect(document.querySelector(".gmt-hive-starters")).toBeNull();
    const rail = screen.getByRole("complementary", { name: "Examples" });
    expect(within(rail).getAllByRole("button")).toHaveLength(
      CHAT_STARTERS.length,
    );
    for (const { label } of EXAMPLE_AREAS) {
      expect(within(rail).getByRole("region", { name: label })).toBeTruthy();
    }
    // The accessible name is exactly the question; the chip is the description.
    const globe = starterFor("showGlobe");
    expect(
      within(rail).getByRole("button", {
        name: globe.text,
        description: "Zoned Earth",
      }),
    ).toBeTruthy();
  });

  it("is reached by Tab, card by card, in order", async () => {
    stubMatchMedia(false);
    stubFetch("text");
    render(<DoxPage />);
    const user = userEvent.setup();
    const expected = startersByArea().flatMap((g) =>
      g.starters.map((s) => s.widget),
    );

    const rail = screen.getByRole("complementary", { name: "Examples" });
    const seen: string[] = [];
    for (let i = 0; i < 80 && seen.length < expected.length; i++) {
      await user.tab();
      const active = document.activeElement as HTMLElement | null;
      if (active && rail.contains(active) && active.dataset.widget) {
        seen.push(active.dataset.widget);
      }
    }
    expect(seen).toEqual(expected);
  });

  it("opens a widget on Enter or Space, sends once, focuses the title, and returns focus on close", async () => {
    stubMatchMedia(false);
    const chat = stubFetch("text");
    render(<DoxPage />);
    const user = userEvent.setup();

    // Enter on the converter card.
    card("showConverterBench").focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: "Widget panel" }),
      ).toBeTruthy(),
    );
    expect(chat).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        "Converter + format bench",
      ),
    );

    // Closing brings the list back, focus on the card that opened it.
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: "Examples" }),
      ).toBeTruthy(),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(card("showConverterBench")),
    );

    // Space on the interval card.
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    card("showIntervalVisualizer").focus();
    await user.keyboard(" ");
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: "Widget panel" }),
      ).toBeTruthy(),
    );
    expect(chat).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        "Interval algebra visualizer",
      ),
    );
  });

  it("on a phone, folds the examples behind a bar once a conversation has started", async () => {
    stubMatchMedia(true);
    stubFetch("text");
    render(<DoxPage />);
    const user = userEvent.setup();
    const name = `Examples ${CHAT_STARTERS.length}`;
    expect(screen.queryByRole("button", { name })).toBeNull();

    card("showConverterBench").focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: "Widget panel" }),
      ).toBeTruthy(),
    );
    // No bar while a widget is open.
    expect(screen.queryByRole("button", { name })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Close" }));
    const bar = await screen.findByRole("button", { name });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(document.activeElement).toBe(bar));

    const rail = screen.getByRole("complementary", { name: "Examples" });
    expect(rail.hasAttribute("data-collapsed")).toBe(true);
    expect(bar.getAttribute("aria-controls")).toBe(rail.id);

    await user.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    expect(rail.hasAttribute("data-collapsed")).toBe(false);
  });

  it("never moves focus for a widget the model opens", async () => {
    stubMatchMedia(false);
    const converter = starterFor("showConverterBench");
    stubFetch({ tool: "showConverterBench", input: converter.args });
    render(<DoxPage />);
    const user = userEvent.setup();

    const box = screen.getByRole("textbox");
    await user.type(box, "Convert 2:30pm New York to Tokyo please{Enter}");
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: "Widget panel" }),
      ).toBeTruthy(),
    );
    expect(document.activeElement).not.toBe(
      screen.getByText("Converter + format bench", {
        selector: ".gmt-hive-artifact-title",
      }),
    );
    expect(document.activeElement).toBe(box);
  });
});
