// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { markBad, markOk, noSignal, zoneId } from "./marks";

describe("marks", () => {
  it("draws the tick and the cross for the eye only", () => {
    renderHtml(html`<p>${markOk()} right ${markBad()} wrong</p>`);
    expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("✗")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("paragraph")).toHaveTextContent(/right.*wrong/);
  });

  it("says NO SIGNAL in words, so the sentinel never reads as a blank", async () => {
    const { host } = renderHtml(html`<p>${noSignal()}</p>`);
    expect(screen.getByText("NO SIGNAL")).toBeVisible();
    await expectNoAxeViolations(host);
  });

  it("reads a zone id whole", () => {
    renderHtml(html`<p>${zoneId("America/Los_Angeles")}</p>`);
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      "America/Los_Angeles",
    );
  });
});
