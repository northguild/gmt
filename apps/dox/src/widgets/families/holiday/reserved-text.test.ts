// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { reservedText } from "./reserved-text";

describe("reservedText", () => {
  it("shows its text once, with every sample reserved and hidden from a reader", () => {
    renderHtml(
      reservedText({ text: "kept", samples: ["kept", "moved later", "moved"] }),
    );
    // The live text and its hidden twin.
    expect(screen.getAllByText("kept")).toHaveLength(2);
    expect(screen.getByText("moved later")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      reservedText({ text: "⟨ NO SIGNAL ⟩", state: "signal", samples: ["x"] }),
    );
    await expectNoAxeViolations(host);
  });
});
