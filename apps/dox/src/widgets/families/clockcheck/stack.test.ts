// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/dom";
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

  // jsdom has no layout, so the steps are read from the sheet. The rows go to two columns at 48rem;
  // the top row waits until the browser card (4/9 of the row less the 1rem gap) is 32rem, which is
  // a stack of 32 x 9/4 + 1 = 73rem.
  it("puts the top row in two columns only once the browser card is 32rem wide", () => {
    const css = readFileSync(
      join(import.meta.dirname, "stack.module.css"),
      "utf8",
    );
    const blockOf = (query: string): string => {
      const open = css.search(new RegExp(`@container [\\w-]+ \\(${query}\\)`));
      expect(open).toBeGreaterThanOrEqual(0);
      const start = css.indexOf("{", open);
      let depth = 0;
      for (let i = start; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        if (css[i] === "}" && --depth === 0) return css.slice(start, i);
      }
      throw new Error("unclosed block");
    };
    const rows = blockOf("min-width: 48rem");
    const top = blockOf("min-width: 73rem");
    expect(rows).toMatch(/\.row\s*\{/);
    expect(rows).not.toMatch(/\.top/);
    expect(top).toMatch(/\.top\s*\{[^}]*5fr[^}]*4fr/);
    expect(top).not.toMatch(/\.row/);
    expect((73 - 1) * (4 / 9)).toBe(32);
  });

  it("have no accessibility violations", async () => {
    const fixture = renderHtml(stack(row(html`<p>one</p>`)));
    await expectNoAxeViolations(fixture.host);
  });
});
