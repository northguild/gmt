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

  it("takes an extended year as one date, so the date stays whole", () => {
    const { host } = renderHtml(instant("+275760-09-13T00:00:00Z"));
    expect(screen.getByText("+275760-09-13")).toBeVisible();
    expect(screen.getByText("T00:00:00Z")).toBeVisible();
    expect(host).toHaveTextContent("+275760-09-13T00:00:00Z");
    renderHtml(instant("-000001-01-01T00:00:00Z"));
    expect(screen.getByText("-000001-01-01")).toBeVisible();
  });

  it.each([
    "12345-01-01T00:00:00Z",
    "123456-01-01T00:00:00Z",
    "+2024-01-01T00:00:00Z",
    "-12345-01-01T00:00:00Z",
    "+27576-09-13T00:00:00Z",
  ])("does not take %s for an instant: it stays one word", (text) => {
    renderHtml(instant(text));
    expect(screen.getByText(text)).toBeVisible();
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
