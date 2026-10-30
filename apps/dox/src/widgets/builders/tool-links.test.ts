// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { toolLinks } from "./tool-links";

const markup = () =>
  toolLinks({
    label: "Open in another tool",
    links: [{ text: "Converter", href: "/dox/converter" }, { text: "Planner" }],
  });

describe("toolLinks", () => {
  it("is a named group with real links", () => {
    renderHtml(markup());
    expect(
      screen.getByRole("group", { name: "Open in another tool" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Converter" })).toHaveAttribute(
      "href",
      "/dox/converter",
    );
  });

  it("marks a link that is not ready as disabled", () => {
    renderHtml(markup());
    expect(screen.getByText("Planner")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});
