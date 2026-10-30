// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { cutoffBands, cutoffScale } from "./bands";

describe("cutoffBands", () => {
  it("draws each band word", () => {
    renderHtml(
      html`<div>${cutoffBands([
        { kind: "open", from: 0, to: 0.4, word: "open" },
        { kind: "closed", from: 0.4, to: 1, word: "closed" },
      ])}</div>`,
    );
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});

describe("cutoffScale", () => {
  it("draws each label as text", () => {
    renderHtml(
      html`<div>${cutoffScale([
        { at: 0, label: "8 Apr", rank: 0, day: true },
        { at: 0.5, label: "12:00", rank: 1 },
      ])}</div>`,
    );
    expect(screen.getByText("8 Apr")).toBeVisible();
    expect(screen.getByText("12:00")).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      html`<div>${cutoffBands([{ kind: "hour", from: 0, to: 1, word: "h" }])}${cutoffScale([{ at: 0, label: "00:00", rank: 0 }])}</div>`,
    );
    await expectNoAxeViolations(host);
  });
});
