// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { nobreak } from "./nobreak";
import { renderHtml } from "../test-fixture";

describe("nobreak", () => {
  it("shows its content as text", () => {
    renderHtml(nobreak(html`2026-03-29`));
    expect(screen.getByText("2026-03-29")).toBeVisible();
  });

  it("holds markup the caller already made safe", () => {
    renderHtml(nobreak(html`<a href="/x">link</a>`));
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute(
      "href",
      "/x",
    );
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(nobreak(html`2026-03-29`));
    await expectNoAxeViolations(host);
  });
});
