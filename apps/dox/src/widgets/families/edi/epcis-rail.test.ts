// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import type { RailSpec } from "~/lib/epcis-event-reader";
import { renderHtml } from "../../test-fixture";
import { epcisRail, railContent } from "./epcis-rail";

const drawn: RailSpec = {
  role: "local",
  name: "Local clock +02:00",
  date: "2024-06-16",
  layout: {
    days: [
      { from: 0, to: 20, lit: false, date: "2024-06-15" },
      { from: 20, to: 100, lit: true, date: "2024-06-16" },
    ],
    ticks: [20],
  },
  pin: 50,
  emptyText: "",
  aria: "Local clock +02:00: the event falls on 2024-06-16.",
};

const empty: RailSpec = {
  role: "utc",
  name: "UTC",
  date: "no result",
  layout: null,
  pin: 50,
  emptyText: "Nothing to place yet.",
  aria: "UTC: Nothing to place yet.",
};

describe("railContent", () => {
  it("is one picture named for the clock and the date", async () => {
    const { host } = renderHtml(railContent(drawn));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Local clock +02:00: the event falls on 2024-06-16.",
    );
    expect(host).toHaveTextContent("Local clock +02:00");
    expect(host).toHaveTextContent("2024-06-16");
    expect(host).toHaveTextContent("00:00");
    await expectNoAxeViolations(host);
  });

  it("says why there is nothing to draw, in words", async () => {
    const { host } = renderHtml(railContent(empty));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "UTC: Nothing to place yet.",
    );
    expect(host).toHaveTextContent("Nothing to place yet.");
    expect(host).not.toHaveTextContent("00:00");
    await expectNoAxeViolations(host);
  });

  it("escapes the words it prints", () => {
    const { host } = renderHtml(
      railContent({
        ...empty,
        name: '"><img src=x>',
        emptyText: "<script>alert(1)</script>",
      }),
    );
    expect(host).toHaveTextContent('"><img src=x>');
    expect(host).toHaveTextContent("<script>alert(1)</script>");
  });
});

describe("epcisRail", () => {
  it("reserves the widest rail without adding a second picture", async () => {
    const { host } = renderHtml(
      epcisRail({ id: "rail", spec: empty, reserve: [drawn, empty] }),
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    await expectNoAxeViolations(host);
  });
});
