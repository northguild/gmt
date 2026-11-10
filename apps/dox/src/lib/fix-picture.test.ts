import { realFinanceLib as lib } from "~/test/finance-fixture";
import {
  PROBE,
  REASON_SAMPLES,
  digitsSent,
  pictureOf,
  probeShape,
  reasonOf,
  widthsOf,
  widthsText,
} from "./fix-picture";
import { STAMP_PRESETS } from "./fix-timestamp-reader";
import type { FinanceLib } from "./finance-widgets";

const shape = probeShape(lib)!;
const textOf = (stamp: string, read = true) =>
  pictureOf(stamp, shape, read).halves[0]!.fields.map((f) => f.text);

describe("probeShape", () => {
  it("reads the layout off the formatter's output at the five precisions", () => {
    expect(shape.base).toBe("20161231-23:59:59");
    expect(shape.gaps).toEqual(["-", ":", ":"]);
    expect(shape.point).toBe(".");
    expect(shape.runs.map((r) => [r.name, r.width, r.offset])).toEqual([
      ["ms", 3, 0],
      ["µs", 3, 3],
      ["ns", 3, 6],
      ["ps", 3, 9],
    ]);
    expect(widthsOf(shape)).toEqual([3, 6, 9, 12]);
    expect(widthsText(shape)).toBe("3, 6, 9 or 12");
    expect(digitsSent(shape, 0)).toBe(0);
    expect(PROBE).toBe("2016-12-31T23:59:59.123456789Z");
  });

  it("gives no shape when the formatter refuses the probe", () => {
    expect(probeShape({ ...lib, formatFixUtcTimestamp: () => "" })).toBeNull();
  });

  it("holds no width of its own: a formatter that writes other widths moves the cut", () => {
    const stub: FinanceLib = {
      ...lib,
      formatFixUtcTimestamp: (value, precision) => {
        const base = lib.formatFixUtcTimestamp(value, "second");
        const width = {
          second: 0,
          millisecond: 2,
          microsecond: 4,
          nanosecond: 5,
          picosecond: 7,
        }[precision];
        return width === 0 ? base : `${base}.${"1234567".slice(0, width)}`;
      },
    };
    const moved = probeShape(stub)!;
    expect(widthsOf(moved)).toEqual([2, 4, 5, 7]);
    const fields = pictureOf("20240615-14:30:00.12", moved, true).halves[0]!
      .fields;
    expect(fields.filter((f) => f.run === "ms").map((f) => f.text)).toEqual([
      "12",
    ]);
    // The real shape cannot cut a two-digit fraction.
    expect(textOf("20240615-14:30:00.12")).toEqual(["20240615-14:30:00.12"]);
  });
});

describe("pictureOf", () => {
  it("lights one run for .100 and leaves three dashed", () => {
    const fields = pictureOf("20240615-14:30:00.100", shape, true).halves[0]!
      .fields;
    expect(
      fields
        .filter((f) => f.run !== undefined)
        .map((f) => [f.run, f.text, f.group, f.bracket]),
    ).toEqual([
      ["ms", "100", "time", "ms"],
      ["µs", "", "none", "not sent"],
      ["ns", "", "none", "not sent"],
      ["ps", "", "none", "not sent"],
    ]);
  });

  it("cuts every preset that has a probed length", () => {
    expect(textOf("20240615-14:30:00")).toEqual([
      "20240615",
      "-",
      "14",
      ":",
      "30",
      ":",
      "00",
      "",
      "",
      "",
      "",
    ]);
    expect(textOf("20240615-14:30:00.123456")).toEqual([
      "20240615",
      "-",
      "14",
      ":",
      "30",
      ":",
      "00",
      ".",
      "123",
      "456",
      "",
      "",
    ]);
    expect(textOf("20240615-14:30:00.123456789012").slice(-4)).toEqual([
      "123",
      "456",
      "789",
      "012",
    ]);
  });

  it("draws a refused stamp in neutral boxes, and keeps the dashed runs", () => {
    const fields = pictureOf("19981231-23:59:60", shape, false).halves[0]!
      .fields;
    expect(
      fields.filter((f) => f.group !== "neutral" && f.group !== "none"),
    ).toEqual([]);
  });

  it("draws one neutral box when no probed length fits", () => {
    const picture = pictureOf("20240615-14:30:00.12345678", shape, false);
    expect(picture.halves[0]!.fields).toHaveLength(1);
    expect(picture.halves[0]!.fields[0]!.group).toBe("neutral");
  });

  it("draws one neutral box when the punctuation is not the shape's", () => {
    expect(textOf("2024061514x30x00")).toHaveLength(1);
    expect(textOf("20240615-14:30:00,100")).toHaveLength(1);
  });

  it("says the stamp in words for a screen reader", () => {
    expect(pictureOf("20240615-14:30:00.100", shape, true).aria).toBe(
      "FIX timestamp 20240615-14:30:00.100: date 20240615, hour 14, minute 30, second 00, ms 100, µs not sent, ns not sent, ps not sent.",
    );
  });
});

describe("reasonOf", () => {
  const reasons = Object.fromEntries(
    STAMP_PRESETS.map((p) => [
      p.id,
      lib.parseFixUtcTimestamp(p.text) === null
        ? reasonOf(lib, p.text, shape)
        : null,
    ]),
  );

  it("fires each reason for its preset and for no other", () => {
    expect(reasons).toEqual({
      milliseconds: null,
      microseconds: null,
      picoseconds: null,
      "whole-seconds": null,
      "fix-leap-second": null,
      "inside-2016": null,
      "second-60-ordinary": "Second 60 on a day UTC inserted no second.",
      "eight-digits":
        "A fraction of 8 digits states no precision FIX names; other widths need the parties' agreement.",
    });
  });

  it("tells a 60 at the wrong minute of an insertion day from a 60 on an ordinary day", () => {
    const wrongTime =
      "Second 60 at a time UTC inserted no second; it inserts one only at 23:59:60.";
    // 2016-12-31 inserted a second, at 23:59:60 and at no other minute.
    expect(reasonOf(lib, "20161231-23:58:60", shape)).toBe(wrongTime);
    expect(reasonOf(lib, "20161231-22:59:60", shape)).toBe(wrongTime);
    expect(reasonOf(lib, "20161231-00:00:60.500", shape)).toBe(wrongTime);
    // 2017-12-31 inserted none, so a 60 at any minute is the wrong-day reason.
    expect(reasonOf(lib, "20171231-23:58:60", shape)).toBe(
      "Second 60 on a day UTC inserted no second.",
    );
    expect(wrongTime.length).toBeLessThanOrEqual(
      Math.max(...REASON_SAMPLES.map((s) => s.length)),
    );
  });

  it("gives the general sentence for any other refusal", () => {
    const general =
      "Not a FIX UTCTimestamp: YYYYMMDD-HH:MM:SS, then a period and 3, 6, 9 or 12 digits, or nothing.";
    expect(reasonOf(lib, "2024-06-15", shape)).toBe(general);
    expect(reasonOf(lib, "20240615-14:30:00.", shape)).toBe(general);
    expect(reasonOf(lib, "20240615-25:30:00", shape)).toBe(general);
    // Second 60 with a fraction the library also refuses falls through to the general reason.
    expect(reasonOf(lib, "20171231-23:59:60.12345678", shape)).toBe(general);
  });

  it("has a reservation at least as long as every reason", () => {
    const longest = Math.max(...REASON_SAMPLES.map((s) => s.length));
    for (const r of Object.values(reasons)) {
      if (r !== null) expect(r.length).toBeLessThanOrEqual(longest);
    }
  });
});
