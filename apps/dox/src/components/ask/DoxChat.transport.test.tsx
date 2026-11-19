/**
 * @vitest-environment jsdom
 *
 * The two hooks the deck's slides use: `DoxChat`'s `createTransport` replaces `/api/chat`, and
 * `WidgetRail`'s `idle` replaces the examples. With neither passed, `/dox` is as it was.
 */
import { createRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessageChunk } from "ai";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import { DoxChat } from "./DoxChat";
import { WidgetRail } from "./WidgetRail";

installJsdomShims();

afterEach(() => vi.unstubAllGlobals());

describe("DoxChat createTransport", () => {
  it("sends the question through the transport it is given, not to /api/chat", async () => {
    const fetchSpy = vi.fn(
      async (..._args: unknown[]) => new Response("{}", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const seen: string[] = [];
    render(
      <DoxChat
        createTransport={() => ({
          sendMessages: async ({ messages }) => {
            seen.push(String(messages.length));
            return new ReadableStream<UIMessageChunk>({
              start(out) {
                out.enqueue({ type: "start" });
                out.enqueue({ type: "text-start", id: "t" });
                out.enqueue({
                  type: "text-delta",
                  id: "t",
                  delta: "From the deck.",
                });
                out.enqueue({ type: "text-end", id: "t" });
                out.enqueue({ type: "finish" });
                out.close();
              },
            });
          },
          reconnectToStream: async () => null,
        })}
      />,
    );
    await userEvent.setup().type(screen.getByRole("textbox"), "Hello{Enter}");
    expect(await screen.findByText("From the deck.")).toBeInTheDocument();
    expect(seen).toEqual(["1"]);
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("/api/chat")),
    ).toBe(false);
  });
});

describe("WidgetRail idle", () => {
  const rail = (idle?: { label: string; content: string }) => (
    <WidgetRail
      widget={null}
      onClose={() => {}}
      onPick={() => {}}
      railId="rail"
      focusTitleRef={createRef<boolean>() as React.RefObject<boolean>}
      {...(idle ? { idle } : {})}
    />
  );

  it("shows the examples by default", async () => {
    const { container } = render(rail());
    expect(
      screen.getByRole("complementary", { name: "Examples" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("shows what the slide passes in its place", async () => {
    const { container } = render(
      rail({ label: "Ready questions", content: "Ask me" }),
    );
    const region = screen.getByRole("complementary", {
      name: "Ready questions",
    });
    await waitFor(() => expect(region).toHaveTextContent("Ask me"));
    expect(
      screen.queryByRole("complementary", { name: "Examples" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
