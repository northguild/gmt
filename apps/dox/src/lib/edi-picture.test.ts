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
  spanAria,
  spanLayout,
  timelineAria,
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

describe("figureAria", () => {
  const shape = shapeOf((a) => formatEdifactDateTime(a, "203"), "dateTime")!;
  const halves = picHalves(cutValue("202406151430", shape)!, false);

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

  describe("the reference mark", () => {
    const zones = [
      { n: 1, instant: "2024-06-15T05:00:00Z" },
      { n: 2, instant: "2024-06-15T09:30:00Z" },
    ];

    it("is null without a reference, and the layout is unchanged", () => {
      const without = timelineLayout(zones)!;
      expect(without.reference).toBeNull();
      expect(timelineLayout(zones, null)).toEqual(without);
    });

    it("widens the axis to span the reference", () => {
      const without = timelineLayout(zones)!;
      const withLater = timelineLayout(zones, "2024-06-15T14:30:00Z")!;
      expect(withLater.ticks.length).toBeGreaterThan(without.ticks.length);
      expect(withLater.reference!.at).toBeGreaterThan(0);
      expect(withLater.reference!.at).toBeLessThan(100);
      expect(withLater.marks.every((m) => m.at < withLater.reference!.at)).toBe(
        true,
      );
    });

    it("leaves the span (the widest gap) among the zones", () => {
      const without = timelineLayout(zones)!;
      const withFar = timelineLayout(zones, "2024-06-16T10:30:00Z")!;
      const gapWidth = (l: typeof without) => l.span!.to - l.span!.from;
      // The span is still the zones' two marks: a wider axis makes it a smaller share.
      expect(gapWidth(withFar)).toBeLessThan(gapWidth(without));
      expect(withFar.marks.map((m) => m.n)).toEqual([1, 2]);
    });

    it("writes its label on the side with room", () => {
      expect(
        timelineLayout(zones, "2024-06-15T05:00:00Z")!.reference!.side,
      ).toBe("end");
      expect(
        timelineLayout(zones, "2024-06-15T09:30:00Z")!.reference!.side,
      ).toBe("start");
    });

    it("takes a lane with no zone mark near its label", () => {
      const stacked = timelineLayout(
        [
          { n: 1, instant: "2024-06-15T12:00:00Z" },
          { n: 2, instant: "2024-06-15T12:00:00Z" },
        ],
        "2024-06-15T12:00:00Z",
      )!;
      expect(stacked.marks.map((m) => m.lane)).toEqual([0, 1]);
      expect(stacked.reference!.lane).toBe(2);
    });

    it("never takes a fifth lane", () => {
      const four = [1, 2, 3, 4].map((n) => ({
        n,
        instant: "2024-06-15T12:00:00Z",
      }));
      expect(
        timelineLayout(four, "2024-06-15T12:00:00Z")!.reference!.lane,
      ).toBe(0);
    });
  });

  it("adds the reference to the spoken line, after the gap", () => {
    expect(
      timelineAria(
        [{ n: 1, zone: "Europe/Berlin", instant: "2024-06-15T12:30:00Z" }],
        "",
        "",
        { label: "Read as UTC", instant: "2024-06-15T10:30:00Z" },
      ),
    ).toBe(
      "A UTC timeline with 1 zone marked: 1, Europe/Berlin, 2024-06-15T12:30:00Z. Read as UTC: 2024-06-15T10:30:00Z.",
    );
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

describe("spanLayout", () => {
  const year = spanLayout({
    from: "2024-01-01",
    to: "2025-01-01",
    unit: "year",
    reference: "2024-01-01",
  });
  const month = spanLayout({
    from: "2024-02-01",
    to: "2024-03-01",
    unit: "month",
    reference: "2024-02-01",
  });
  const day = spanLayout({
    from: "2024-06-15",
    to: "2024-06-16",
    unit: "day",
    reference: "2024-06-15",
  });
  const labelled = (l: typeof year) => l.ticks.filter((t) => t.label !== "");

  it("fills the middle half of the axis with the span, whatever the unit", () => {
    for (const l of [year, month, day]) {
      expect(l.span!.from).toBeCloseTo(25, 5);
      expect(l.span!.to).toBeCloseTo(75, 5);
      expect(l.marks).toEqual([]);
    }
  });

  it("puts the reference at the start of the span", () => {
    for (const l of [year, month, day]) {
      expect(l.reference!.at).toBeCloseTo(l.span!.from, 5);
    }
  });

  it("draws no reference when none is given", () => {
    expect(
      spanLayout({
        from: "2024-06-15",
        to: "2024-06-16",
        unit: "day",
        reference: null,
      }).reference,
    ).toBeNull();
  });

  it("gives a year monthly ticks, labelled by quarter, with the year under January", () => {
    expect(year.ticks.length).toBeGreaterThanOrEqual(12);
    expect(labelled(year).every((t) => /^\d\d$/.test(t.label))).toBe(true);
    expect(labelled(year).filter((t) => t.day !== "")).toEqual([
      expect.objectContaining({ label: "01", day: "2024" }),
      expect.objectContaining({ label: "01", day: "2025" }),
    ]);
  });

  it("gives a leap-year February a tick on every day, the 1st and each Monday labelled", () => {
    const days = month.ticks.length;
    // 29 days padded by 14.5 days a side, minus the ticks at or beyond the ends.
    expect(days).toBeGreaterThanOrEqual(43);
    expect(labelled(month).filter((t) => t.day !== "")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "01", day: "2024-02" }),
        expect.objectContaining({ label: "01", day: "2024-03" }),
      ]),
    );
  });

  it("gives a day three-hour ticks, labelled HH:00, with the date under midnight", () => {
    expect(labelled(day).every((t) => /^\d\d:00$/.test(t.label))).toBe(true);
    expect(labelled(day).filter((t) => t.day !== "")).toEqual([
      expect.objectContaining({ label: "00:00", day: "06-15" }),
      expect.objectContaining({ label: "00:00", day: "06-16" }),
    ]);
  });

  it("never labels more than eight ticks, nor two within the least room", () => {
    for (const l of [year, month, day]) {
      const at = labelled(l).map((t) => t.at);
      expect(at.length).toBeLessThanOrEqual(8);
      for (let i = 1; i < at.length; i++) {
        expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(10.9);
      }
      expect(l.ticks.every((t) => t.at > 0 && t.at < 100)).toBe(true);
    }
  });

  it("reads the span in words", () => {
    expect(spanAria("2024-06-01 to 2024-06-30", "2024-06-01T00:00:00Z")).toBe(
      "Spans 2024-06-01 to 2024-06-30; padded reading at 2024-06-01T00:00:00Z. Calendar dates, no zone.",
    );
  });
});
