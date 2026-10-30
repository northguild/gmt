// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { codeFrame } from "./code-frame";
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
