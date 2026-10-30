// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { html } from "../../builders/html";
import { MIN_ARC_SPAN, rolledArc, rolledMark } from "./rolled-marks";

describe("rolledMark", () => {
  it("is a named image, so a reader hears where the cut-off would have been", () => {
    renderHtml(
      rolledMark({
        label: "gate-in without the calendar: Sat 15 Jun 17:00",
        at: 0.4,
        series: 1,
      }),
    );
    expect(
      screen.getByRole("img", {
        name: "gate-in without the calendar: Sat 15 Jun 17:00",
      }),
    ).toBeInTheDocument();
  });
});

describe("rolled marks and arcs", () => {
  it("have no axe violations", async () => {
    const fx = renderHtml(
      html`${rolledMark({ label: "gate-in without the calendar", at: 0.4, series: 1 })}${rolledArc({ from: 0.2, to: 0.6, series: 2 })}`,
    );
    await expectNoAxeViolations(fx.host);
  });
});

describe("rolledArc", () => {
  it("is drawn only: nothing in the accessibility tree", () => {
    const far = renderHtml(rolledArc({ from: 0.2, to: 0.6, series: 2 }));
    expect(far.host).not.toBeEmptyDOMElement();
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
  });

  it("is left out when the two places all but coincide", () => {
    const near = renderHtml(
      html`${rolledArc({ from: 0.5, to: 0.5 + MIN_ARC_SPAN / 2, series: 1 })}`,
    );
    expect(near.host).toBeEmptyDOMElement();
  });
});
