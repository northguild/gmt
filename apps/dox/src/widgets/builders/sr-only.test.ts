// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { renderHtml } from "../test-fixture";
import { srOnly } from "./sr-only";

describe("srOnly", () => {
  it("keeps the text in the accessibility tree", () => {
    renderHtml(html`<p>5 ${srOnly("minutes late")}</p>`);
    expect(screen.getByText("minutes late")).toBeInTheDocument();
    expect(screen.getByText("minutes late")).not.toHaveAttribute("aria-hidden");
  });

  it("escapes its text", () => {
    renderHtml(html`<p>${srOnly("<i>x</i>")}</p>`);
    expect(screen.getByText("<i>x</i>")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const r = renderHtml(html`<p>5 ${srOnly("minutes late")}</p>`);
    await expectNoAxeViolations(r.host);
  });
});
