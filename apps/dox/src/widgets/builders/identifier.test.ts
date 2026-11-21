// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { html } from "./html";
import { identifier } from "./identifier";

const breaks = (v: object) => (v.toString().match(/<wbr \/>/g) ?? []).length;

describe("identifier", () => {
  it("breaks a camelCase name before each capital and keeps its text", async () => {
    const fx = renderHtml(html`<p>${identifier("formatHumanDuration")}</p>`);
    expect(screen.getByText("formatHumanDuration")).toBeVisible();
    expect(breaks(identifier("formatHumanDuration"))).toBe(2);
    await expectNoAxeViolations(fx.host);
  });

  it("breaks a name joined by hyphens or slashes after each one", () => {
    const fx = renderHtml(
      html`<p>${identifier("madrid-chamartin")}${identifier("America/Argentina/Buenos_Aires")}</p>`,
    );
    expect(
      breaks(identifier("madrid-chamartin")) +
        breaks(identifier("America/Argentina/Buenos_Aires")),
    ).toBe(3);
    expect(fx.host).toHaveTextContent(
      "madrid-chamartinAmerica/Argentina/Buenos_Aires",
    );
  });

  it("leaves a date, a time and a phrase with a hyphen alone", () => {
    for (const text of ["2026-06-15", "10:30-11:00", "a well-known name"]) {
      expect(breaks(identifier(text))).toBe(0);
    }
  });

  it("leaves a word, a phrase and a name with no capital alone", () => {
    for (const text of ["Written", "Hours from Fri", "unit", "UTC"]) {
      const fx = renderHtml(html`<p>${identifier(text)}</p>`);
      expect(breaks(identifier(text))).toBe(0);
      expect(fx.host).toHaveTextContent(text);
    }
  });

  it("escapes text that holds markup", () => {
    renderHtml(html`<p>${identifier("<b>x</b>")}</p>`);
    expect(screen.getByText("<b>x</b>")).toBeVisible();
  });
});
