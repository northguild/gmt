// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { row, stack } from "./stack";

describe("stack and row", () => {
  it("hold their children in the order given", () => {
    renderHtml(
      stack(
        html`${row(html`<p>one</p><p>two</p>`, { top: true })}${row(html`<p>three</p>`)}`,
      ),
    );
    const paragraphs = screen.getAllByText(/^(one|two|three)$/);
    expect(paragraphs.map((p) => p.textContent)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("have no accessibility violations", async () => {
    const fixture = renderHtml(stack(row(html`<p>one</p>`)));
    await expectNoAxeViolations(fixture.host);
  });
});
