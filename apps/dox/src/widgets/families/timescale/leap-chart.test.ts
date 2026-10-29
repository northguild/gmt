/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml, type Fixture } from "../../test-fixture";

let page: Fixture;
import { html } from "../../builders";
import {
  LEAP_NO_SIGNAL,
  insertionCell,
  leapCaption,
  leapChart,
  leapLegend,
  type LeapChartView,
} from "./leap-chart";

const id = (local: string) => `t-${local}`;

const view = (over: Partial<LeapChartView> = {}): LeapChartView => ({
  label: "Two leap seconds are inserted.",
  yTicks: [
    { level: 0, text: "10" },
    { level: 100, text: "12" },
  ],
  line: "0,100 50,100 50,0 100,0",
  area: "M0,100 L0,100 L50,100 L50,0 L100,0 L100,100 Z",
  risers: [{ x: 50, y1: 100, y2: 0, series: 2 }],
  marks: [{ at: 50, level: 100, series: 2 }],
  years: [{ pct: 0, year: 1972 }],
  chips: [{ at: 50, text: "2005-12", series: 2 }],
  pin: null,
  dot: null,
  pinFlag: null,
  band: null,
  bandFlag: null,
  ghost: null,
  sentinel: false,
  continuousAt: 90,
  continuousText: "continuous UTC from 2027-05-20",
  ...over,
});

const show = (v: LeapChartView) => {
  page = renderHtml(
    html`<div>${leapCaption()}${leapChart(v, id)}${leapLegend()}</div>`,
  );
};

describe("leapChart", () => {
  it("is one image named by the reading, with its axes, chips and legend as text", async () => {
    show(view());
    expect(
      screen.getByRole("img", { name: "Two leap seconds are inserted." }),
    ).toBeInTheDocument();
    for (const text of [
      "10",
      "1972",
      "2005-12",
      "continuous UTC from 2027-05-20",
      "TAI − UTC, in seconds",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(
      screen.getByText("counted between the two dates"),
    ).toBeInTheDocument();
    await expectNoAxeViolations(page.host);
  });

  it("writes the cursor's readout, the band's and the ghost only when given", async () => {
    show(view());
    expect(screen.queryByText("never inserted")).not.toBeInTheDocument();
    expect(screen.queryByText(LEAP_NO_SIGNAL)).not.toBeInTheDocument();
    show(
      view({
        pin: { at: 10 },
        dot: { at: 10, level: 20 },
        pinFlag: { at: 10, side: "start", text: "2000-01-01 · 32 s" },
        band: { from: 10, to: 60 },
        bandFlag: { at: 35, text: "5 leap seconds counted" },
        ghost: { at: 70, level: 80, side: "end" },
        sentinel: true,
      }),
    );
    expect(screen.getByText("2000-01-01 · 32 s")).toBeInTheDocument();
    expect(screen.getByText("5 leap seconds counted")).toBeInTheDocument();
    expect(screen.getByText("never inserted")).toBeInTheDocument();
    expect(screen.getByText(LEAP_NO_SIGNAL)).toBeInTheDocument();
    await expectNoAxeViolations(page.host);
  });
});

describe("insertionCell", () => {
  it("says counted and your second 60 in words, and nothing for an unlit second", () => {
    page = renderHtml(
      html`<p>${insertionCell("2005-12-31T23:59:60Z", 2)}</p><p>${insertionCell("2008-12-31T23:59:60Z", 3)}</p><p>${insertionCell("2012-06-30T23:59:60Z", 0)}</p>`,
    );
    expect(screen.getByText("counted")).toBeInTheDocument();
    expect(screen.getByText("your second 60")).toBeInTheDocument();
    expect(screen.getByText("2012-06-30T23:59:60Z")).toBeInTheDocument();
  });
});
