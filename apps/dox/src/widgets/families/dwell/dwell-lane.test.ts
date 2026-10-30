// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { dwellLane, dwellTimeline } from "./dwell-lane";

const id = (local: string): string => `t-${local}`;

describe("dwellLane", () => {
  it("is a group over a list of days", async () => {
    const fx = renderHtml(
      dwellTimeline(
        dwellLane({ id, name: "dwell", series: 1, gate: "drawn track" }),
      ),
    );
    const group = screen.getByRole("group");
    expect(within(group).getByRole("list")).toBeInTheDocument();
    await expectNoAxeViolations(fx.host);
  });

  it("keeps the second lane out of the tree while it is hidden", () => {
    renderHtml(
      dwellTimeline(
        html`${dwellLane({ id, name: "dwell", series: 1, gate: "drawn track" })}${dwellLane({ id, name: "compare", series: 2, hidden: true, gate: "drawn" })}`,
      ),
    );
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getAllByRole("group", { hidden: true })).toHaveLength(2);
  });

  it("puts handles on the first row only", () => {
    renderHtml(
      dwellLane({
        id,
        name: "dwell",
        series: 1,
        gate: "drawn track",
        handles: html`<button type="button">Entry grip</button>`,
      }),
    );
    expect(
      screen.getByRole("button", { name: "Entry grip" }),
    ).toBeInTheDocument();
  });
});
