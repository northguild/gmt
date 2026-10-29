/**
 * @vitest-environment jsdom
 */
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import {
  cronAxis,
  cronFieldList,
  cronLane,
  cronLegend,
  cronNoSignal,
  cronPlot,
  kindCell,
} from "./cron-night";
import { html, type SafeHtml } from "../../builders";
import { renderHtml, type Fixture } from "../../test-fixture";

let page: Fixture;

const show = (markup: SafeHtml): void => {
  page = renderHtml(html`<div>${markup}</div>`);
};

describe("cronLegend", () => {
  it("names the three drawings in words", async () => {
    show(cronLegend());
    const list = screen.getByRole("list", { name: "Legend" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Solid line: an ordinary time",
      "Dashed line on hatching: a skipped time",
      "Double line: a repeated time",
    ]);
    await expectNoAxeViolations(page.host);
  });
});

describe("cronAxis", () => {
  it("draws every tick label and hides the row from a reader", () => {
    show(
      cronAxis({
        id: "ax",
        caption: "UTC",
        ticks: [
          { at: 0, label: "22:00" },
          { at: 0.5, label: "01:00" },
          { at: 1, label: "04:00" },
        ],
      }),
    );
    for (const label of ["22:00", "01:00", "04:00"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("cronLane", () => {
  const lane = (pct: number, count: number) =>
    cronLane({
      policy: "daemonCatchUp",
      line: "A rule line.",
      plate: "1 run",
      marks: [
        {
          pct,
          count,
          classification: "nonexistent",
          instant: "2024-03-31T01:00:00Z",
        },
      ],
    });

  it("names its track with the policy and its plate", async () => {
    show(lane(50, 1));
    expect(
      screen.getByRole("img", { name: "daemonCatchUp: 1 run" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A rule line.")).toBeInTheDocument();
    await expectNoAxeViolations(page.host);
  });

  it("writes a count only when a mark stands for more than one run", () => {
    show(lane(50, 1));
    expect(screen.queryByText("×1")).not.toBeInTheDocument();
    show(lane(50, 3));
    expect(screen.getByText("×3")).toBeInTheDocument();
  });
});

describe("cronFieldList", () => {
  it("lists the five fields and flags a star", () => {
    show(
      cronFieldList([
        { key: "minute", label: "Minute", text: "30", star: false },
        { key: "hour", label: "Hour", text: "0, 1, 2", star: true },
        { key: "dayOfMonth", label: "Day of month", text: "1", star: false },
        { key: "month", label: "Month", text: "1", star: false },
        { key: "dayOfWeek", label: "Day of week", text: "7", star: false },
      ]),
    );
    expect(screen.getAllByRole("term")).toHaveLength(5);
    expect(screen.getByText("star")).toBeInTheDocument();
    expect(screen.getByText("0, 1, 2")).toBeInTheDocument();
  });
});

describe("cronNoSignal", () => {
  it("shows the sentinel text and its note", () => {
    show(cronNoSignal("⟨ NO SIGNAL ⟩", html`Outside the grammar.`));
    expect(screen.getByText("⟨ NO SIGNAL ⟩")).toBeInTheDocument();
    expect(screen.getByText("Outside the grammar.")).toBeInTheDocument();
  });
});

describe("kindCell", () => {
  it("says the kind in words", () => {
    show(kindCell("ambiguous", null));
    expect(screen.getByText("repeated time")).toBeInTheDocument();
    expect(screen.queryByText(/only under/)).not.toBeInTheDocument();
  });

  it("names the policy a run appears under alone", () => {
    show(kindCell("nonexistent", "daemonCatchUp"));
    expect(screen.getByText(/only under/)).toHaveTextContent(
      "only under daemonCatchUp",
    );
  });
});

describe("cronPlot", () => {
  it("draws the chip, both axes and both lanes", async () => {
    const axis = (id: string, caption: string) => ({
      id,
      caption,
      ticks: [
        { at: 0, label: "22:00" },
        { at: 1, label: "04:00" },
      ],
    });
    const lane = (policy: "crontabMatch" | "daemonCatchUp") => ({
      policy,
      line: "A rule.",
      plate: "no runs",
      marks: [],
    });
    show(
      cronPlot({
        chip: "clock change, +00:00 → +01:00",
        utc: axis("u", "UTC"),
        wall: axis("w", "Wall"),
        lanes: [lane("crontabMatch"), lane("daemonCatchUp")],
      }),
    );
    expect(
      screen.getByText("clock change, +00:00 → +01:00"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByText("22:00")).toHaveLength(2);
    await expectNoAxeViolations(page.host);
  });
});
