// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { badge } from "./badge";

describe("badge", () => {
  it("shows its text and takes no focus", () => {
    renderHtml(badge({ text: "Cut-off 17:00", tone: "cyan" }));
    expect(screen.getByText("Cut-off 17:00")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("escapes its text", () => {
    renderHtml(badge({ text: "<b>x</b>", tone: "neutral" }));
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });

  it("has no axe violations in any tone, dim or not", async () => {
    const tones = ["neutral", "cyan", "spring", "purple", "danger"] as const;
    for (const tone of tones) {
      const a = renderHtml(badge({ text: tone, tone }));
      const b = renderHtml(badge({ text: `${tone} dim`, tone, dim: true }));
      await expectNoAxeViolations(a.host);
      await expectNoAxeViolations(b.host);
    }
  });
});
