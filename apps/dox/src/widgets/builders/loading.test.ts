// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { loading } from "./loading";

describe("loading", () => {
  it("announces which widget is on its way", () => {
    renderHtml(loading({ title: "Time Zone Converter" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading Time Zone Converter…",
    );
  });

  it("shows a title as text, never as markup", () => {
    renderHtml(loading({ title: "<b>Bold</b> & co" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading <b>Bold</b> & co…",
    );
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(loading({ title: "Zones" }));
    await expectNoAxeViolations(fx.host);
  });
});
