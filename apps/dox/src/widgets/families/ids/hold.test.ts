// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { hold } from "./hold";

describe("hold", () => {
  it("shows the live content and keeps ghost text out of the page's text", () => {
    renderHtml(
      hold(html`<p>live words</p>`, ["a longer ghost sentence", "another"]),
    );
    expect(screen.getByText("live words")).toBeInTheDocument();
    expect(screen.queryByText(/ghost sentence/)).not.toBeInTheDocument();
  });

  it("hides a markup ghost from the accessibility tree but keeps it in the cell", () => {
    const { host } = renderHtml(
      hold(html`<code>live</code>`, [html`<code>ghost markup</code>`]),
    );
    expect(screen.getAllByRole("code")).toHaveLength(1);
    expect(screen.getAllByRole("code", { hidden: true })).toHaveLength(2);
    expect(host).toHaveTextContent("liveghost markup");
  });

  it("has no axe violations with text or markup ghosts", async () => {
    const { host } = renderHtml(
      hold(html`<code>live</code>`, [html`<code>ghost markup</code>`, "ghost"]),
    );
    await expectNoAxeViolations(host);
  });

  it("escapes a ghost sample", () => {
    renderHtml(hold("", ['"><img src=x>']));
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
  });
});
