// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { clockPlot, type ClockLaneView } from "./clock-plot";

const lane = (n: number, over: Partial<ClockLaneView> = {}): ClockLaneView => ({
  n,
  scope: "demurrage",
  label: "demurrage",
  aria: `demurrage lane ${String(n)}`,
  chosen: false,
  bar: { from: 10, to: 60 },
  why: null,
  ...over,
});

const draw = (empty = "") =>
  renderHtml(
    clockPlot({
      id: "p",
      empty,
      events: [
        {
          n: 1,
          type: "discharged",
          word: "discharged",
          local: "Fri 14 Jun 20:00",
          pct: 10,
          aria: "discharged, Fri 14 Jun 20:00 on the Europe/London clock",
        },
      ],
      lanes: [
        lane(1, { chosen: true }),
        lane(2, { bar: null, why: "no result" }),
      ],
    }),
  );

describe("clockPlot", () => {
  it("names the group, its event list and its clock list", async () => {
    const { host } = draw();
    const group = screen.getByRole("group", {
      name: "Events and the four clocks over the terminal's local days",
    });
    const events = within(group).getByRole("list", { name: "Events" });
    expect(
      within(events).getByRole("listitem", {
        name: "discharged, Fri 14 Jun 20:00 on the Europe/London clock",
      }),
    ).toBeInTheDocument();
    const clocks = within(group).getByRole("list", { name: "Clocks" });
    expect(within(clocks).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(clocks).getByRole("listitem", {
        name: "demurrage lane 1, the chosen clock",
      }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("shows the empty text only when it has some", () => {
    draw("Add an event.");
    expect(screen.getByText("Add an event.")).toBeVisible();
  });
});
