// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { instant } from "./instant";

describe("instant", () => {
  it("splits an instant into its date, time, fraction and zone", () => {
    renderHtml(instant("2024-03-15T14:30:00.123+01:00"));
    expect(screen.getByText("2024-03-15")).toBeVisible();
    expect(screen.getByText("T14:30:00")).toBeVisible();
    expect(screen.getByText(".123")).toBeVisible();
    expect(screen.getByText("+01:00")).toBeVisible();
  });

  it("leaves the fraction and zone empty when there is no fraction", () => {
    const { host } = renderHtml(instant("2024-03-15T14:30:00Z"));
    expect(host).toHaveTextContent("2024-03-15T14:30:00Z");
  });

  it("keeps a word whole in the first piece", () => {
    renderHtml(instant("no result"));
    expect(screen.getByText("no result")).toBeVisible();
  });

  it("escapes its text", async () => {
    const { host } = renderHtml(instant("<b>x</b>"));
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});
