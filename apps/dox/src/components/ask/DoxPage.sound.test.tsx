/**
 * @vitest-environment jsdom
 *
 * The /dox rail's open and close Steel breath: null to a widget opens it, a widget back to null
 * closes it, and one widget swapped for another is neither. A pill carries `data-cue`, so the press
 * hook is silent on it: a press that opens the rail plays `open` once, and a swap plays a button's
 * press ping, the Deep sonar.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_STARTERS } from "~/lib/chat-constants";
import { installJsdomShims } from "~/test/jsdom-shims";
import DoxPage from "./DoxPage";

const cue = vi.hoisted(() => vi.fn());
// The chat's own cues (send, stream, done) are DoxChat.sound.test.tsx's; this file hears the panels.
vi.mock("~/lib/sound/cue", () => ({
  cue: (name: string) => {
    if (name === "open" || name === "close" || name === "press") cue(name);
  },
  loop: () => () => {},
}));

installJsdomShims();

const original = window.matchMedia;

beforeEach(() => {
  cue.mockClear();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/chat")
        ? createUIMessageStreamResponse({
            stream: createUIMessageStream({
              execute: ({ writer }) => {
                writer.write({ type: "text-start", id: "t1" });
                writer.write({ type: "text-delta", id: "t1", delta: "Here." });
                writer.write({ type: "text-end", id: "t1" });
              },
            }),
          })
        : new Response("{}", { status: 404 }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.matchMedia = original;
});

const card = (widget: string) =>
  screen.getByRole("button", {
    name: CHAT_STARTERS.find((s) => s.widget === widget)!.text,
  });

describe("the /dox widget rail's sound", () => {
  it("is silent on load, opens on a widget and closes when it is closed", async () => {
    const user = userEvent.setup();
    render(<DoxPage />);
    expect(cue).not.toHaveBeenCalled();

    await user.click(card("showConverterBench"));
    await screen.findByRole("complementary", { name: "Widget panel" });
    await waitFor(() => expect(cue.mock.calls).toEqual([["open"]]));

    await user.click(screen.getByRole("button", { name: "Close" }));
    await screen.findByRole("complementary", { name: "Examples" });
    await waitFor(() => expect(cue.mock.calls).toEqual([["open"], ["close"]]));
  });

  it("pings a pill press that sends nothing, since the pill stays silent for the press hook", async () => {
    // An answer that never finishes keeps the chat busy, so the next question is not sent.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const user = userEvent.setup();
    render(<DoxPage />);

    await user.click(card("showConverterBench"));
    await screen.findByRole("complementary", { name: "Widget panel" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await screen.findByRole("complementary", { name: "Examples" });
    await waitFor(() => expect(cue.mock.calls).toEqual([["open"], ["close"]]));

    cue.mockClear();
    await user.click(card("showZonePlanner"));
    expect(cue.mock.calls).toEqual([["press"]]);
    expect(
      screen.getByRole("complementary", { name: "Examples" }),
    ).toBeInTheDocument();
  });
});
