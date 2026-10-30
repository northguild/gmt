// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { aside } from "./aside";
import { html } from "./html";

describe("aside", () => {
  it("is a complementary landmark with its name, title and body", () => {
    renderHtml(
      aside(
        { label: "About leap seconds", tone: "note", title: "Note" },
        html`<p>text</p>`,
      ),
    );
    const region = screen.getByRole("complementary", {
      name: "About leap seconds",
    });
    expect(region).toHaveTextContent("Note");
    expect(region).toHaveTextContent("text");
  });

  it("has no axe violations for either tone", async () => {
    const a = renderHtml(
      aside({ label: "One", tone: "note", title: "Note" }, html`<p>a</p>`),
    );
    const b = renderHtml(
      aside(
        { label: "Two", tone: "caution", title: "Caution" },
        html`<p>b</p>`,
      ),
    );
    await expectNoAxeViolations(a.host);
    await expectNoAxeViolations(b.host);
  });
});
