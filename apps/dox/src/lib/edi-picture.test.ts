/// <reference types="vitest/globals" />
/**
 * `edi-picture.ts`: the value taken apart, and the shared UTC timeline's layout.
 */
import {
  formatEdifactDateTime,
  formatEdifactDateTimePeriod,
  formatEdifactOffsetDateTime,
  formatX12Date,
  formatX12DateRange,
} from "@northguild/gmt/intermodal/format";
import {
  cutValue,
  figureAria,
  maskOf,
  partWord,
  probeFamily,
  shapeOf,
  picHalves,
  plainHalves,
  takenApartHtml,
  timelineAria,
  timelineHtml,
  timelineLayout,
} from "./edi-picture";

describe("shapeOf, read off the formatter's own output", () => {
  it("finds the fields of a date-time and cuts a value along them", () => {
    const shape = shapeOf((a) => formatEdifactDateTime(a, "203"), "dateTime")!;
    expect(shape.start.map((f) => maskOf(f.part))).toEqual([
      "CCYY",
      "MM",
      "DD",
      "HH",
      "MM",
    ]);
    expect(
      cutValue("202406151430", shape)!.halves[0]!.map((c) => c.text),
    ).toEqual(["2024", "06", "15", "14", "30"]);
  });

  it("refuses a value of the wrong length instead of half-cutting it", () => {
    const shape = shapeOf((a) => formatEdifactDateTime(a, "203"), "dateTime")!;
    expect(cutValue("20240615143", shape)).toBeNull();
  });

  it("finds the order a qualifier writes", () => {
    const shape = shapeOf((a) => formatX12Date(a, "DB"), "date")!;
    expect(shape.start.map((f) => f.part)).toEqual(["MM", "DD", "CCYY"]);
  });

  it("finds a signed hour and a signed hour and minutes as different widths", () => {
    const hours = shapeOf(
      (a) => formatEdifactOffsetDateTime(a, "303"),
      "offsetDateTime",
    )!;
    const minutes = shapeOf(
      (a) => formatEdifactOffsetDateTime(a, "205"),
      "offsetDateTime",
    )!;
    expect(hours.start.at(-1)).toMatchObject({ part: "ZZZ", width: 3 });
    expect(minutes.start.at(-1)).toMatchObject({ part: "ZHHMM", width: 5 });
  });

  it("finds a period's two halves and what sits between them", () => {
    const edifact = shapeOf(
      (a, b) => formatEdifactDateTimePeriod(a, b, "719"),
      "dateTime",
    )!;
    expect(edifact.separator).toBe("");
    expect(edifact.end).toHaveLength(5);
    const x12 = shapeOf((a, b) => formatX12DateRange(a, b, "RD8"), "date")!;
    expect(x12.separator).toBe("-");
    expect(cutValue("20240615-20240620", x12)!.halves).toHaveLength(2);
  });

  it("is null for a writer that writes nothing", () => {
    expect(shapeOf(() => "", "date")).toBeNull();
  });

  it("maps a kind to its probe family and names a part in words", () => {
    expect(probeFamily("dateTimeRange")).toBe("dateTime");
    expect(probeFamily("offsetDateTime")).toBe("offsetDateTime");
    expect(probeFamily("datePeriod")).toBe("date");
    expect(probeFamily("time")).toBe("time");
    expect(partWord("ZHHMM")).toBe("offset");
    expect(partWord("MI")).toBe("minute");
  });
});

describe("takenApartHtml", () => {
  const shape = shapeOf((a) => formatEdifactDateTime(a, "203"), "dateTime")!;
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
    expect(layout.ticks.find((t) => t.day !== "")).toMatchObject({
      label: "00:00",
      day: "06-16",
    });
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
    const stated = timelineHtml(timelineLayout([inputs[0]!])!, {
      stated: true,
      gap: "",
    });
    expect(stated).toContain("data-stated");
    expect(stated).not.toContain("data-series");
  });

  it("says each zone's instant in words", () => {
    expect(
      timelineAria(
        [{ n: 1, zone: "Europe/Berlin", instant: "2024-06-15T12:30:00Z" }],
        "",
        "",
      ),
    ).toBe(
      "A UTC timeline with 1 zone marked: 1, Europe/Berlin, 2024-06-15T12:30:00Z.",
    );
  });
});
