// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import {
  dayClock,
  exactTrack,
  LEGEND,
  sinceClock,
  storedFigure,
  type LegendId,
} from "./stored-lanes";

const day = dayClock({
  kind: "overlap",
  bandText: "01:00 to 02:00 happens twice",
  bandLeft: 12.5,
  bandWidth: 4.17,
  pinX: 14.58,
  pinText: "stored 03:30",
  ticks: [
    { x: 0, label: "00:00" },
    { x: 50, label: "12:00" },
    { x: 100, label: "24:00" },
  ],
});

const exact = exactTrack({
  gate: { kind: "overlap", x: 50, text: "+03:00 → +02:00 01:00Z" },
  broken: false,
  marks: [
    { x: 30, text: "instant = earlier 00:30Z", title: "2016-10-30T00:30:00Z" },
    { x: 70, text: "later 01:30Z", title: "2016-10-30T01:30:00Z" },
  ],
});

function draw(
  legend: ReadonlySet<LegendId>,
  clock: Parameters<typeof storedFigure>[0]["clock"] = day,
  track: Parameters<typeof storedFigure>[0]["exact"] = exact,
) {
  return renderHtml(
    storedFigure({
      label: "The figure in a sentence.",
      clock,
      exact: track,
      legend,
    }),
  );
}

describe("storedFigure", () => {
  it("is one named group with a lane for each of the two timelines", () => {
    draw(new Set<LegendId>(["overlap", "gate", "mark"]));
    const figure = screen.getByRole("group", {
      name: "The figure in a sentence.",
    });
    expect(
      within(figure).getByRole("group", { name: "On the zone's clock" }),
    ).toBeVisible();
    expect(
      within(figure).getByRole("group", {
        name: "On the exact timeline, in UTC",
      }),
    ).toBeVisible();
  });

  it("names the band and the stored pin, and says the readings in chips", () => {
    draw(new Set<LegendId>(["overlap", "gate", "mark"]));
    expect(
      screen.getByRole("img", { name: /01:00 to 02:00 happens twice/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "stored 03:30" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+03:00 → +02:00 01:00Z")).toBeVisible();
    expect(screen.getByText("instant = earlier 00:30Z")).toHaveAttribute(
      "title",
      "2016-10-30T00:30:00Z",
    );
  });

  it("draws at most three readings", () => {
    const four = exactTrack({
      gate: null,
      broken: false,
      marks: [10, 30, 50, 70].map((x) => ({ x, text: `m${x}`, title: "" })),
    });
    draw(new Set<LegendId>(["mark"]), day, four);
    expect(screen.getByText("m50")).toBeVisible();
    expect(screen.queryByText("m70")).not.toBeInTheDocument();
  });

  it("names the break when time is not drawn to scale", () => {
    const since = exactTrack({
      gate: { kind: "since", x: 8, text: "+02:00 → +03:00 2016-03-27" },
      broken: true,
      marks: [],
    });
    draw(
      new Set<LegendId>(["gate", "break"]),
      sinceClock({
        zone: "Zone offset since 2016-03-27: +03:00",
        stored: "Stored offset: +02:00",
      }),
      since,
    );
    expect(
      screen.getByRole("img", { name: "Time not drawn" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Zone offset since 2016-03-27: +03:00"),
    ).toBeVisible();
    expect(screen.getByText("Stored offset: +02:00")).toBeVisible();
  });

  it("always holds five legend items and marks the ones that do not apply", () => {
    draw(new Set<LegendId>(["overlap", "gate", "mark"]));
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(legend).getAllByRole("listitem", { hidden: true }),
    ).toHaveLength(LEGEND.length);
    expect(within(legend).getByText("repeated hour")).toBeInTheDocument();
    expect(within(legend).getByText("skipped hour")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows no legend item when nothing is drawn", () => {
    draw(
      new Set<LegendId>(),
      "",
      exactTrack({ gate: null, broken: false, marks: [] }),
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getAllByRole("listitem", { hidden: true })).toHaveLength(5);
  });

  it("has no axe violations", async () => {
    const { host } = draw(new Set<LegendId>(["overlap", "gate", "mark"]));
    await expectNoAxeViolations(host);
  });
});
