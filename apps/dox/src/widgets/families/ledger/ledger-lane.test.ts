// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  axisTicks,
  ledgerAxis,
  ledgerBar,
  ledgerFrame,
  ledgerGate,
  ledgerLane,
  ledgerLegend,
} from "./ledger-lane";

const lane = () =>
  renderHtml(
    ledgerFrame(
      html`${ledgerLane(
        { id: "t", label: "Clock", daysLabel: "Local days" },
        html`${ledgerBar({ id: "t-bar" })}${ledgerGate({ id: "t-gate", label: "expires" })}`,
      )}${ledgerAxis("t-axis", ["13 Jun", "20 Jun"])}${ledgerLegend([
        { text: "free", swatch: "lit" },
        { text: "closed", swatch: "closed" },
      ])}`,
      { gate: "frame" },
    ),
  );

describe("ledgerLane", () => {
  it("holds an empty list of days named for the reader", () => {
    lane();
    expect(
      screen.getByRole("list", { name: "Local days" }),
    ).toBeInTheDocument();
  });

  it("starts with the bar and the gate hidden, for the mount to place", () => {
    const { host } = lane();
    expect(within(host).getByText("expires")).not.toBeVisible();
  });

  it("names its legend and lists each item", () => {
    lane();
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(2);
    expect(within(legend).getByText("closed")).toBeInTheDocument();
  });

  it("draws the axis labels as text", () => {
    lane();
    expect(screen.getByText("13 Jun")).toBeInTheDocument();
  });

  it("escapes a tick label", () => {
    renderHtml(html`<p>${axisTicks(["<i>x</i>"])}</p>`);
    expect(screen.getByText("<i>x</i>")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = lane();
    await expectNoAxeViolations(host);
  });
});
