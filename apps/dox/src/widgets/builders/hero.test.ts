// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { hero } from "./hero";

describe("hero", () => {
  it("is a figure that holds its caption and value", () => {
    renderHtml(hero({ caption: "GPS week", value: "2400", samples: ["9999"] }));
    const figure = screen.getByRole("figure");
    expect(figure).toHaveTextContent("GPS week");
    expect(figure).toHaveTextContent("2400");
  });

  it("hides reserved samples from assistive technology", () => {
    renderHtml(hero({ caption: "GPS week", value: "2400", samples: ["9999"] }));
    expect(screen.getByText("9999")).toHaveAttribute("aria-hidden", "true");
  });

  it("has no axe violations in either tone", async () => {
    const a = renderHtml(hero({ caption: "A", value: "1" }));
    const b = renderHtml(
      hero({ caption: "B", value: "⟨ NO SIGNAL ⟩", tone: "sentinel" }),
    );
    await expectNoAxeViolations(a.host);
    await expectNoAxeViolations(b.host);
  });
});
