// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { cutoffGate, cutoffTransitionLine } from "./gate";

describe("cutoffGate", () => {
  it("is a named image, so a screen reader hears the cut-off", () => {
    renderHtml(
      html`<div>${cutoffGate({ label: "cut-off 17:00", at: 0.4 })}</div>`,
    );
    expect(
      screen.getByRole("img", { name: "cut-off 17:00" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      html`<div>${cutoffGate({ label: "cut-off 17:00", at: 0.5 })}</div>`,
    );
    await expectNoAxeViolations(host);
  });
});

describe("cutoffTransitionLine", () => {
  it("is a named image for a gap and for an overlap", () => {
    renderHtml(
      html`<div>${cutoffTransitionLine({ label: "go forward 1 h", at: 0.2, kind: "gap" })}${cutoffTransitionLine({ label: "go back 1 h", at: 0.6, kind: "overlap" })}</div>`,
    );
    expect(
      screen.getByRole("img", { name: "go forward 1 h" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "go back 1 h" }),
    ).toBeInTheDocument();
  });

  it("escapes its label", () => {
    renderHtml(
      html`<div>${cutoffTransitionLine({ label: '"><b>x</b>', at: 0.1, kind: "gap" })}</div>`,
    );
    expect(screen.getByRole("img", { name: '"><b>x</b>' })).toBeInTheDocument();
  });
});
