/**
 * @vitest-environment jsdom
 *
 * `DOX-C3b`'s Definition of Done names two cases and insists on how they are
 * checked:
 *
 * > An **unknown tool name** and an `output-error` part are both handled
 * > without crashing — verified with direct tests, not inferred from the happy
 * > path.
 *
 * `WidgetReceipt` is where both are decided, before anything mounts, which is
 * what makes them cheap to assert here rather than by driving a whole chat.
 *
 * The `output-error` case carries a specific hazard: such a part may have no
 * usable `input` at all, so the component must reach its terminal-state checks
 * *before* it reads `part.input` — otherwise a schema parse runs on undefined
 * and the panel takes the transcript down with it.
 */
import type { ToolUIPart } from "ai";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import { WidgetReceipt } from "./WidgetReceipt";

installJsdomShims();

function part(overrides: Record<string, unknown>): ToolUIPart {
  return {
    type: "tool-showGlobe",
    toolCallId: "call-1",
    state: "output-available",
    input: { zone: "Asia/Tokyo" },
    output: { ok: true, widget: "globe" },
    ...overrides,
  } as unknown as ToolUIPart;
}

describe("WidgetReceipt — terminal failure states", () => {
  it("renders an output-error without crashing, and never opens the rail", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <WidgetReceipt
        part={part({ state: "output-error", errorText: "upstream refused" })}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/couldn.t build that widget/i)).toBeInTheDocument();
    expect(screen.getByText(/upstream refused/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open in panel" }),
    ).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it("renders an output-error that carries no input at all", async () => {
    // The hazard the ordering exists for: reading `part.input` first would
    // parse undefined against a schema on a part that legitimately has none.
    const { container } = render(
      <WidgetReceipt
        part={part({
          state: "output-error",
          errorText: "boom",
          input: undefined,
        })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/couldn.t build that widget/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("renders an output-error with no errorText either", async () => {
    const { container } = render(
      <WidgetReceipt
        part={part({
          state: "output-error",
          errorText: undefined,
          input: undefined,
        })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/couldn.t build that widget/i)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("shows a placeholder while the arguments are still streaming", async () => {
    // `part.input` is partial JSON at this point and must not be parsed.
    const { container } = render(
      <WidgetReceipt
        part={part({ state: "input-streaming", input: { zon: "Asia/To" } })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/preparing a widget/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open in panel" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe("WidgetReceipt — unknown and malformed calls", () => {
  it("renders an inert chip for a tool this build does not have", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <WidgetReceipt
        part={part({ type: "tool-showSomethingElse", input: {} })}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/doesn.t have/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open in panel" }),
    ).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it("renders an inert chip when the arguments do not fit the schema", async () => {
    const { container } = render(
      <WidgetReceipt part={part({ input: { zone: 42 } })} onOpen={() => {}} />,
    );
    expect(screen.getByText(/don.t fit/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open in panel" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("survives a dynamic-tool part, which is how the SDK coerces an unknown terminal call", async () => {
    const { container } = render(
      <WidgetReceipt
        part={part({ type: "dynamic-tool", toolName: "whatever" })}
        onOpen={() => {}}
      />,
    );
    // No chip to open: the reader is not offered a panel for a tool it cannot build.
    expect(
      screen.queryByRole("button", { name: "Open in panel" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe("WidgetReceipt — a real call", () => {
  it("names the widget and offers to open it", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { container } = render(
      <WidgetReceipt part={part({})} onOpen={onOpen} />,
    );

    expect(screen.getByText("Zoned Earth")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open in panel" }));
    expect(onOpen).toHaveBeenCalledWith("call-1", "showGlobe", {
      zone: "Asia/Tokyo",
    });
    await expectNoAxeViolations(container);
  });

  it("links to the widget's own page, seeded, and never to /dox", async () => {
    const { container } = render(
      <WidgetReceipt part={part({})} onOpen={() => {}} />,
    );

    const link = screen.getByRole("link", { name: /full page/i });
    const href = link.getAttribute("href") ?? "";
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/tools/zoned-earth/"),
    );
    expect(link).not.toHaveAttribute("href", expect.stringContaining("/dox"));
    expect(link).toHaveAttribute("href", expect.stringContaining("w=globe"));
    expect(decodeURIComponent(href)).toContain("Asia/Tokyo");
    await expectNoAxeViolations(container);
  });

  it("still opens the rail for a shape-valid but nonsense zone", async () => {
    // Semantics are the mount boundary's job, not the receipt's — the reader
    // gets an explanatory error state in the panel rather than a dead chip.
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { container } = render(
      <WidgetReceipt
        part={part({ input: { zone: "Mars/Olympus_Mons" } })}
        onOpen={onOpen}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open in panel" }));
    expect(onOpen).toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });
});
