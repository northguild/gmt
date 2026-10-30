// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { iconKey, modeIcon } from "./transport-icon";

describe("modeIcon", () => {
  it("is decorative without a label", () => {
    renderHtml(modeIcon("truck"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("is a named image with a label", () => {
    renderHtml(modeIcon("rail", { label: "Rail" }));
    expect(screen.getByRole("img", { name: "Rail" })).toBeInTheDocument();
  });

  it("falls back to the generic icon for a mode with no icon", () => {
    expect(iconKey("  Barge ")).toBe("barge");
    expect(iconKey("hovercraft")).toBe("generic");
    expect(iconKey("")).toBe("generic");
    expect(iconKey("toString")).toBe("generic");
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(modeIcon("air", { label: "Air" }));
    await expectNoAxeViolations(host);
  });
});
