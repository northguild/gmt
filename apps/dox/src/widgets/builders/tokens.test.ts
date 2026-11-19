// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { html } from "./html";
import { keepTokens } from "./tokens";

describe("keepTokens", () => {
  it("keeps the words and the tokens of a sentence in order", async () => {
    const a = renderHtml(
      html`<p>${keepTokens("Clock change at 2027-03-28T01:00:00Z, then 10:30.")}</p>`,
    );
    expect(screen.getByText(/Clock change at/)).toHaveTextContent(
      "Clock change at 2027-03-28T01:00:00Z, then 10:30.",
    );
    await expectNoAxeViolations(a.host);
  });

  it("escapes text that holds markup", () => {
    renderHtml(html`<p>${keepTokens("<b>2027-03-28</b>")}</p>`);
    expect(screen.getByText(/<b>/)).toBeVisible();
  });

  it("leaves a word without a date alone", () => {
    renderHtml(html`<p>${keepTokens("Occurs twice")}</p>`);
    expect(screen.getByText("Occurs twice")).toBeVisible();
  });
});
