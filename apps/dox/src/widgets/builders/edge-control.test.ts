// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { edgeControl } from "./edge-control";
import { html } from "./html";

describe("edgeControl", () => {
  it("is a button named by its label, with the chevron left out of the name", async () => {
    const fx = renderHtml(
      edgeControl({ label: "Next panel", direction: 1, caption: "More" }),
    );
    const button = screen.getByRole("button", { name: "Next panel" });
    expect(button).toHaveAccessibleName("Next panel");
    expect(screen.getByText("More")).toBeInTheDocument();
    await expectNoAxeViolations(fx.host);
  });

  it("renders one named button per direction", () => {
    renderHtml(
      html`${edgeControl({ label: "Right", direction: 1 })}${edgeControl({
        label: "Left",
        direction: -1,
      })}`,
    );
    expect(screen.getByRole("button", { name: "Right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Left" })).toBeInTheDocument();
  });

  it("names the element it operates", () => {
    renderHtml(
      edgeControl({ label: "Close", direction: 1, id: "c", controls: "panel" }),
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute(
      "aria-controls",
      "panel",
    );
  });
});
