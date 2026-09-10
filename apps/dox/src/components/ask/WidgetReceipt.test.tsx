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
/// <reference types="vitest/globals" />
import type { ToolUIPart } from "ai";
import { fireEvent, render, screen } from "@testing-library/react";
import { installJsdomShims } from "~/test/jsdom-shims";
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
  it("renders an output-error without crashing, and never opens the rail", () => {
    const onOpen = vi.fn();
    render(
      <WidgetReceipt
        part={part({ state: "output-error", errorText: "upstream refused" })}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/couldn.t build that widget/i)).toBeTruthy();
    expect(screen.getByText(/upstream refused/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open in panel" })).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders an output-error that carries no input at all", () => {
    // The hazard the ordering exists for: reading `part.input` first would
    // parse undefined against a schema on a part that legitimately has none.
    expect(() =>
      render(
        <WidgetReceipt
          part={part({
            state: "output-error",
            errorText: "boom",
            input: undefined,
          })}
          onOpen={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it("renders an output-error with no errorText either", () => {
    render(
      <WidgetReceipt
        part={part({
          state: "output-error",
          errorText: undefined,
          input: undefined,
        })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/couldn.t build that widget/i)).toBeTruthy();
  });

  it("shows a placeholder while the arguments are still streaming", () => {
    // `part.input` is partial JSON at this point and must not be parsed.
    render(
      <WidgetReceipt
        part={part({ state: "input-streaming", input: { zon: "Asia/To" } })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/preparing a widget/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open in panel" })).toBeNull();
  });
});

describe("WidgetReceipt — unknown and malformed calls", () => {
  it("renders an inert chip for a tool this build does not have", () => {
    const onOpen = vi.fn();
    render(
      <WidgetReceipt
        part={part({ type: "tool-showSomethingElse", input: {} })}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/doesn.t have/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open in panel" })).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders an inert chip when the arguments do not fit the schema", () => {
    render(
      <WidgetReceipt part={part({ input: { zone: 42 } })} onOpen={() => {}} />,
    );
    expect(screen.getByText(/don.t fit/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open in panel" })).toBeNull();
  });

  it("survives a dynamic-tool part, which is how the SDK coerces an unknown terminal call", () => {
    expect(() =>
      render(
        <WidgetReceipt
          part={part({ type: "dynamic-tool", toolName: "whatever" })}
          onOpen={() => {}}
        />,
      ),
    ).not.toThrow();
  });
});

describe("WidgetReceipt — a real call", () => {
  it("names the widget and offers to open it", () => {
    const onOpen = vi.fn();
    render(<WidgetReceipt part={part({})} onOpen={onOpen} />);

    expect(screen.getByText("Zoned Earth")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open in panel" }));
    expect(onOpen).toHaveBeenCalledWith("call-1", "showGlobe", {
      zone: "Asia/Tokyo",
    });
  });

  it("links to the widget's own page, seeded, and never to /dox", () => {
    render(<WidgetReceipt part={part({})} onOpen={() => {}} />);

    const link = screen.getByRole("link", { name: /full page/i });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/tools/zoned-earth/");
    expect(href).not.toContain("/dox");
    expect(href).toContain("w=globe");
    expect(decodeURIComponent(href)).toContain("Asia/Tokyo");
  });

  it("still opens the rail for a shape-valid but nonsense zone", () => {
    // Semantics are the mount boundary's job, not the receipt's — the reader
    // gets an explanatory error state in the panel rather than a dead chip.
    const onOpen = vi.fn();
    render(
      <WidgetReceipt
        part={part({ input: { zone: "Mars/Olympus_Mons" } })}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in panel" }));
    expect(onOpen).toHaveBeenCalled();
  });
});
