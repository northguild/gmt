// @vitest-environment jsdom
import { isInaccessible, screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import type { DayStripResult } from "~/lib/billing-deadlines";
import { setHtml } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { billingCalendar, billingCells, billingLegend } from "./billing-strip";

const strip: DayStripResult = {
  summary: "3 days from 2026-03-01 to 2026-03-03.",
  items: [
    { kind: "day", date: "2026-02-28", padding: true, marks: [], lanes: [] },
    {
      kind: "day",
      date: "2026-03-01",
      padding: false,
      marks: ["anchor"],
      lanes: [{ lane: 1, state: "zero", day: 0 }],
    },
    {
      kind: "day",
      date: "2026-03-02",
      padding: false,
      marks: [],
      lanes: [{ lane: 1, state: "deadline", day: 1 }],
    },
    { kind: "gap", from: "2026-03-03", to: "2026-09-01", days: 183 },
  ],
};

function drawn(result: DayStripResult | null) {
  renderHtml(billingCalendar("strip"));
  const list = screen.getByRole("list", { name: "Day strip" });
  setHtml(list, billingCells(result));
  return { list };
}

describe("billingCalendar", () => {
  it("is a named, empty list under a header the tree does not read", () => {
    renderHtml(billingCalendar("strip"));
    expect(
      within(screen.getByRole("list", { name: "Day strip" })).queryAllByRole(
        "listitem",
      ),
    ).toHaveLength(0);
    expect(isInaccessible(screen.getByText("Mon"))).toBe(true);
  });
});

describe("billingCells", () => {
  it("names a real day by its date, marks and lane, and a gap by the days it leaves out", async () => {
    const { list } = drawn(strip);
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((c) => c.getAttribute("aria-label")),
    ).toEqual([
      "Sun 1 Mar 2026: anchor; issue window day 0",
      "Mon 2 Mar 2026: issue window day 1, invoice deadline",
      "2026-03-03 to 2026-09-01: 183 days not drawn",
    ]);
    await expectNoAxeViolations(list);
  });

  it("hides a padding cell from the tree", () => {
    const { list } = drawn(strip);
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("draws nothing for a null strip", () => {
    const { list } = drawn(null);
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("names a day in a negative year and in a year above 9999 by its true weekday", () => {
    const { list } = drawn({
      summary: "",
      items: [
        {
          kind: "day",
          date: "-000001-01-30",
          padding: false,
          marks: [],
          lanes: [],
        },
        {
          kind: "day",
          date: "+010000-01-30",
          padding: false,
          marks: [],
          lanes: [],
        },
      ],
    });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((c) => c.getAttribute("aria-label")),
    ).toEqual(["Sat 30 Jan -1", "Sun 30 Jan 10000"]);
  });
});

describe("billingLegend", () => {
  it("is a list of six keys, each said in words", async () => {
    renderHtml(billingLegend());
    const legend = screen.getByRole("list", { name: "Legend" });
    const items = within(legend).getAllByRole("listitem");
    const words = [
      "anchor, day zero",
      "invoice issued",
      "dispute request received",
      "1 issue window, solid",
      "2 dispute window, dashed",
      "3 resolution window, dotted",
    ];
    expect(items).toHaveLength(words.length);
    items.forEach((item, n) => {
      expect(item).toHaveTextContent(words[n]!);
    });
    await expectNoAxeViolations(legend);
  });
});
