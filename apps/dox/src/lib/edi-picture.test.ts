/// <reference types="vitest/globals" />
/**
 * `edi-picture.ts`: the value taken apart, and the shared UTC timeline's layout.
 */
import { formatEdifactDtm } from "@northguild/gmt/intermodal/format";
import { cutValue, shapeOf } from "./edi-shape";
import {
  figureAria,
  picHalves,
  plainHalves,
  takenApartHtml,
  timelineAria,
  timelineHtml,
  timelineLayout,
} from "./edi-picture";

describe("takenApartHtml", () => {
  const shape = shapeOf(formatEdifactDtm, "203")!;
  const halves = picHalves(cutValue("202406151430", shape)!, false);

  it("draws a box and a mask letter for each field, bracketed by group", () => {
    const html = takenApartHtml(halves, "", "no offset");
    expect(html.match(/gmt-edi-box"/g)).toHaveLength(5);
    expect(html).toContain(">CCYY<");
    expect(html).toContain('data-group="date"');
    expect(html).toContain('data-group="time"');
    expect(html).toContain("no offset");
    expect(html).toContain(">date<");
    expect(html).toContain(">time<");
  });

  it("escapes what a reader typed", () => {
    const html = takenApartHtml(plainHalves('"><img src=x>'), "", "");
    expect(html).not.toContain("<img");
    expect(html).toContain('data-group="neutral"');
  });

  it("says the same thing in words", () => {
    expect(figureAria("202406151430", "203", halves, "no offset")).toBe(
      "202406151430 under code 203: year 2024, month 06, day 15, hour 14, minute 30; no offset",
    );
  });
});

describe("timelineLayout", () => {
  const inputs = [
    { n: 1, instant: "2024-06-15T18:30:00Z" },
    { n: 2, instant: "2024-06-15T12:30:00Z" },
    { n: 3, instant: "2024-06-15T06:30:00Z" },
    { n: 4, instant: "2024-06-15T21:30:00Z" },
  ];

  it("orders the marks by instant, from the earliest to the latest", () => {
    const layout = timelineLayout(inputs)!;
    expect(layout.marks.map((m) => m.n)).toEqual([3, 2, 1, 4]);
    expect(layout.marks.every((m) => m.at > 0 && m.at < 100)).toBe(true);
    expect(layout.span!.from).toBeLessThan(layout.span!.to);
  });

  it("puts a tick on every whole hour, and labels fewer than eight", () => {
    const layout = timelineLayout(inputs)!;
    // 06:30 to 21:30 is 15 hours; the axis pads it by ceil(15 / 10) = 2 whole hours
    // each side, 04:00 to 00:00, and holds 21 ticks.
    expect(layout.ticks).toHaveLength(21);
    const labelled = layout.ticks.filter((t) => t.label !== "");
    expect(labelled.length).toBeLessThanOrEqual(9);
    expect(labelled.every((t) => t.label.endsWith(":00"))).toBe(true);
  });

  it("labels midnight with its date", () => {
    const layout = timelineLayout([
      { n: 1, instant: "2024-06-15T22:00:00Z" },
      { n: 2, instant: "2024-06-16T02:00:00Z" },
    ])!;
    expect(layout.ticks.find((t) => t.day !== "")).toMatchObject({ label: "00:00", day: "06-16" });
  });

  it("stacks marks that fall close into lanes, so none hides another", () => {
    const layout = timelineLayout([
      { n: 1, instant: "2024-06-15T12:00:00Z" },
      { n: 2, instant: "2024-06-15T12:00:00Z" },
      { n: 3, instant: "2024-06-15T12:00:00Z" },
      { n: 4, instant: "2024-06-15T12:00:00Z" },
    ])!;
    expect(layout.marks.map((m) => m.lane)).toEqual([0, 1, 2, 3]);
    expect(layout.span).toBeNull();
  });

  it("centres one instant alone, and has nothing for none", () => {
    const layout = timelineLayout([{ n: 1, instant: "2024-06-15T12:30:00Z" }])!;
    expect(layout.marks[0]!.at).toBeCloseTo(50, 0);
    expect(timelineLayout([])).toBeNull();
  });

  it("draws numbered pins in their series, and a pin with no number for a stated instant", () => {
    const layout = timelineLayout(inputs)!;
    const html = timelineHtml(layout, { stated: false, gap: "15 h" });
    expect(html).toContain('data-series="3"');
    expect(html).toContain(">15 h<");
    const stated = timelineHtml(timelineLayout([inputs[0]!])!, { stated: true, gap: "" });
    expect(stated).toContain("data-stated");
    expect(stated).not.toContain("data-series");
  });

  it("says each zone's instant in words", () => {
    expect(
      timelineAria([{ n: 1, zone: "Europe/Berlin", instant: "2024-06-15T12:30:00Z" }], "", ""),
    ).toBe("A UTC timeline with 1 zone marked: 1, Europe/Berlin, 2024-06-15T12:30:00Z.");
  });
});
