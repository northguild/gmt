// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { intervalBar } from "./interval-bar";

describe("intervalBar", () => {
  it("is a named image", async () => {
    const fx = renderHtml(
      intervalBar({
        label: "Interval A, 10:00 to 11:00",
        at: 0.25,
        span: 0.5,
        series: 1,
        valid: true,
      }),
    );
    expect(
      screen.getByRole("img", { name: "Interval A, 10:00 to 11:00" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(fx.host);
  });

  it("marks a refused interval in its state, not only in its colour", () => {
    renderHtml(
      intervalBar({
        label: "Interval A, invalid",
        at: 0,
        span: 0.1,
        series: 1,
        valid: false,
      }),
    );
    expect(
      screen.getByRole("img", { name: "Interval A, invalid" }),
    ).toBeInTheDocument();
  });
});
