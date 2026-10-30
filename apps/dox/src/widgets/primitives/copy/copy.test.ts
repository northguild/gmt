// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { copy, COPIED_TEXT, FAILED_TEXT, type GmtCopy } from "./copy";

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("the copy element", () => {
  it("copies its text and says so in the live region", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    renderHtml(copy({ label: "Copy call", text: "now()" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy call" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith("now()");
    expect(await screen.findByRole("status")).toHaveTextContent(COPIED_TEXT);
  });

  it("says so when the clipboard refuses", async () => {
    clipboard(vi.fn().mockRejectedValue(new Error("denied")));
    renderHtml(copy({ label: "Copy call", text: "now()" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy call" }));
    expect(await screen.findByRole("status")).toHaveTextContent(FAILED_TEXT);
  });

  it("shows text that is on screen nowhere else when the copy fails, and keeps it there", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // setup() installs its own clipboard, so the refusing one goes in after it.
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      clipboard(vi.fn().mockRejectedValue(new Error("denied")));
      renderHtml(
        copy({
          label: "Copy link",
          text: "https://x.test/a?b=1",
          reveal: true,
        }),
      );
      await user.click(screen.getByRole("button", { name: "Copy link" }));
      const status = await screen.findByRole("status");
      await vi.waitFor(() => expect(status).toHaveTextContent(FAILED_TEXT));
      expect(status).toHaveTextContent("https://x.test/a?b=1");
      await vi.advanceTimersByTimeAsync(1600);
      expect(status).toHaveTextContent("https://x.test/a?b=1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a failure short when the text is already on screen", async () => {
    clipboard(vi.fn().mockRejectedValue(new Error("denied")));
    renderHtml(copy({ label: "Copy call", text: "now()" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy call" }));
    expect(await screen.findByRole("status")).not.toHaveTextContent("now()");
  });

  it("resets after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      clipboard(vi.fn().mockResolvedValue(undefined));
      renderHtml(copy({ label: "Copy call", text: "x" }));
      await userEvent
        .setup({ advanceTimers: vi.advanceTimersByTime })
        .click(screen.getByRole("button", { name: "Copy call" }));
      expect(await screen.findByRole("status")).toHaveTextContent(COPIED_TEXT);
      await vi.advanceTimersByTimeAsync(1600);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });

  it("copies once per click after connect, disconnect, connect", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    const fx = renderHtml(copy({ label: "Copy call", text: "x" }));
    const el = fx.element<GmtCopy>("copy");
    fx.reconnect(el);
    fx.reconnect(el);
    await userEvent.click(screen.getByRole("button", { name: "Copy call" }));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(copy({ label: "Copy call", text: "x" }));
    await expectNoAxeViolations(fx.host);
  });
});
