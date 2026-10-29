// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { callOutput } from "./call-output";

describe("callOutput", () => {
  it("is a named output holding one line for each call", () => {
    renderHtml(
      callOutput({
        label: "Results",
        state: "live",
        lines: [
          { text: "2024-01-01T00:00:00Z", lost: false },
          { text: "ignored", lost: true },
        ],
      }),
    );
    const out = screen.getByRole("status", { name: "Results" });
    expect(out).toHaveTextContent("2024-01-01T00:00:00Z NO SIGNAL");
  });

  it("escapes a result's text", () => {
    renderHtml(
      callOutput({
        label: "Results",
        state: "live",
        lines: [{ text: "<b>x</b>", lost: false }],
      }),
    );
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      callOutput({
        label: "Results",
        state: "sentinel",
        lines: [{ text: "", lost: true }],
      }),
    );
    await expectNoAxeViolations(host);
  });
});
