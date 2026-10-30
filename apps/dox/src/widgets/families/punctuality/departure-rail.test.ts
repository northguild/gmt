// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  departureRail,
  departureStage,
  departureTicks,
} from "./departure-rail";

describe("departure rail pieces", () => {
  it("names the rail from its summary and holds the handle", async () => {
    const { host } = renderHtml(
      html`<p id="sum">Arrival 10:05. Made: 10:15.</p>${departureStage({
        railId: "rail",
        ticksId: "ticks",
        summaryId: "sum",
        handleBoxId: "box",
        handle: html`<button type="button">Arrival</button>`,
      })}`,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Arrival 10:05. Made: 10:15.",
    );
    expect(screen.getByRole("button", { name: "Arrival" })).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("writes every label as words on the rail", async () => {
    const { host } = renderHtml(
      html`<div role="group" aria-label="Rail">${departureRail({
        conn: { left: 10, width: 5 },
        ticks: [15, 40],
        made: 40,
        naive: 15,
        labels: [
          { text: "20 min to connect", x: 10, y: 92 },
          { text: "made: 10:40", x: 40, y: 80 },
          { text: "naive", x: 15, y: 80, dim: true },
        ],
      })}</div>`,
    );
    const group = screen.getByRole("group", { name: "Rail" });
    expect(within(group).getByText("20 min to connect")).toBeInTheDocument();
    expect(within(group).getByText("made: 10:40")).toBeInTheDocument();
    expect(within(group).getByText("naive")).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("draws a window with its closed start and open end in words", () => {
    renderHtml(
      html`<div>${departureRail({
        window: { left: 20, width: 40 },
        beyond: { left: 60, width: 40 },
        from: 20,
        to: 60,
        ticks: [],
        labels: [
          { text: "from", x: 20, y: 11 },
          { text: "to, excluded", x: 60, y: 11 },
        ],
      })}</div>`,
    );
    expect(screen.getByText("from")).toBeInTheDocument();
    expect(screen.getByText("to, excluded")).toBeInTheDocument();
  });

  it("writes the tick labels", () => {
    renderHtml(
      html`<div>${departureTicks([
        { at: 0, label: "10:00" },
        { at: 50, label: "10:30" },
      ])}</div>`,
    );
    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(screen.getByText("10:30")).toBeInTheDocument();
  });
});
