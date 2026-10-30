// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  noSignal,
  punctBoard,
  punctLane,
  punctNaive,
  punctRate,
  punctRow,
  punctTicks,
  punctWord,
} from "./punct-board";

describe("punctuality board pieces", () => {
  it("writes NO SIGNAL as words", () => {
    renderHtml(punctRate(html`${noSignal()} no rate`));
    expect(screen.getByText("NO SIGNAL")).toBeInTheDocument();
  });

  it("keeps the naive reading as its own line", () => {
    renderHtml(punctNaive("Read off the wall clocks (naive): 3 of 4 on time"));
    expect(screen.getByText(/Read off the wall clocks/)).toBeInTheDocument();
  });

  it("names the board group and ties it to its summary", async () => {
    const { host } = renderHtml(
      html`<p id="sum">Arrival 1</p>${punctBoard({
        id: "b",
        summaryId: "sum",
        label: "Arrivals against the tolerance",
        tolerance: punctLane({
          series: 1,
          bandId: "band",
          bandTextId: "band-text",
          late: html``,
        }),
        rowsId: "rows",
        ticksId: "ticks",
      })}`,
    );
    expect(
      screen.getByRole("group", { name: "Arrivals against the tolerance" }),
    ).toHaveAccessibleDescription("Arrival 1");
    await expectNoAxeViolations(host);
  });

  it("lists a row with its label, delta and class word", async () => {
    const { host } = renderHtml(
      html`<ol role="list">${punctRow({
        label: "Arrival 1",
        inside: { left: 50, width: 10 },
        outside: { left: 60, width: 5 },
        negative: false,
        delta: "+22 min",
        word: punctWord("late", true),
        second: "on time under 30 min",
        naive: ["wall clock: +22 min", "late (naive)"],
      })}</ol>`,
    );
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Arrival 1")).toBeInTheDocument();
    expect(within(row).getByText("+22 min")).toBeInTheDocument();
    expect(within(row).getByText("late")).toBeInTheDocument();
    expect(within(row).getByText("on time under 30 min")).toBeInTheDocument();
    expect(within(row).getByText("late (naive)")).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("draws a row with no deviation and no bar", () => {
    renderHtml(
      html`<ol role="list">${punctRow({
        label: "Arrival 2",
        inside: null,
        outside: null,
        negative: false,
        delta: noSignal(),
        word: noSignal(),
      })}</ol>`,
    );
    expect(screen.getAllByText("NO SIGNAL")).toHaveLength(2);
  });

  it("writes the axis labels, first to last", () => {
    renderHtml(
      html`<div>${punctTicks([
        { at: 0, label: "−30 min" },
        { at: 50, label: "on the plan" },
        { at: 100, label: "+30 min" },
      ])}</div>`,
    );
    expect(screen.getByText("on the plan")).toBeInTheDocument();
    expect(screen.getByText("−30 min")).toBeInTheDocument();
  });
});
