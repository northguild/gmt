// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { codeFrame, paintCodeFrame } from "./code-frame";
import { html } from "./html";

const markup = () =>
  codeFrame({
    label: "Live call",
    copyText: "now()",
    copyLabel: "Copy call",
    code: html`now()`,
  });

describe("codeFrame", () => {
  it("is a named group holding the code and a copy button", () => {
    renderHtml(markup());
    const group = screen.getByRole("group", { name: "Live call" });
    expect(group).toHaveTextContent("now()");
    expect(
      screen.getByRole("button", { name: "Copy call" }),
    ).toBeInTheDocument();
  });

  it("lets the code scroll by keyboard", async () => {
    renderHtml(markup());
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByText("now()")).toBeInTheDocument();
    expect(document.activeElement?.tagName).toBe("PRE");
  });

  it("is the same group when it holds room for more lines", async () => {
    const fx = renderHtml(
      codeFrame({
        label: "Live call",
        copyText: "now()",
        code: html`now()`,
        minLines: 12,
      }),
    );
    expect(screen.getByRole("group", { name: "Live call" })).toHaveTextContent(
      "now()",
    );
    await expectNoAxeViolations(fx.host);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});

describe("paintCodeFrame", () => {
  it("writes the code and the copy text in place, so focus on the copy button stays", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { host } = renderHtml(markup());
    const button = screen.getByRole("button", { name: "Copy call" });
    button.focus();
    paintCodeFrame(host, "later()");
    expect(screen.getByRole("group", { name: "Live call" })).toHaveTextContent(
      "later()",
    );
    expect(screen.getByRole("button", { name: "Copy call" })).toBe(button);
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(writeText).toHaveBeenCalledExactlyOnceWith("later()");
  });
});
