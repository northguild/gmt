// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { codeFrame } from "../../builders/code-frame";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { paintCalls } from "./paint-calls";

describe("paintCalls", () => {
  it("writes the call into the frame without replacing the copy button", () => {
    const { host } = renderHtml(
      html`<div>
        ${codeFrame({ label: "Calls made", copyLabel: "Copy calls", copyText: "" })}
      </div>`,
    );
    const button = screen.getByRole("button", { name: "Copy calls" });
    paintCalls(host, [{ fn: "isPastCutoff", args: ["a", "b"], result: true }]);
    expect(screen.getByRole("button", { name: "Copy calls" })).toBe(button);
    expect(screen.getByText(/isPastCutoff/)).toBeInTheDocument();
  });

  it("has no axe violations empty or painted", async () => {
    const { host } = renderHtml(
      html`<div>
        ${codeFrame({ label: "Calls made", copyLabel: "Copy calls", copyText: "" })}
      </div>`,
    );
    await expectNoAxeViolations(host);
    paintCalls(host, [{ fn: "isPastCutoff", args: ["a", "b"], result: true }]);
    await expectNoAxeViolations(host);
  });
});
