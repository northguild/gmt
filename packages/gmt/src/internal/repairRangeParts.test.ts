import { repairRangeParts, type RangePart } from "./repairRangeParts";

type Source = "startRange" | "endRange" | "shared";
type Part = Intl.DateTimeFormatPart;

const part = (type: string, value: string): Part => ({ type, value }) as Part;
const ranged = (source: Source, type: string, value: string) =>
  ({ type, value, source }) as RangePart;

/**
 * The part merge behind `formatZonedRange`'s repairs for D16 (ICU-20548: `timeZoneName` width) and
 * D17 (a flexible `dayPeriod` written as AM or PM).
 *
 * The input parts are the shapes the engines return. The expected text is the requested form: each
 * endpoint shows what the requested single format shows for it (ECMA-402 §11.5.8 builds range
 * parts from the range pattern's fields; UTS #35 Matching Skeletons keeps skeleton and pattern
 * fields adjusted in parallel). Rows tagged "engine-shaped" follow what Firefox 155.0 (D17) and V8
 * (D16) return for America/New_York, en-US, 2024-02-29, as the engine records in
 * context/domination/js-temporal-polyfill-bugs.md describe it; rows tagged "constructed" exercise
 * the `shared` rule with the shape the rule describes.
 */
describe("repairRangeParts", () => {
  // { hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset" }, 10:00 and 12:00.
  const morning = [
    part("hour", "10"),
    part("literal", " "),
    part("dayPeriod", "in the morning"),
    part("literal", " "),
    part("timeZoneName", "GMT-5"),
  ];
  const noon = [
    part("hour", "12"),
    part("literal", " "),
    part("dayPeriod", "noon"),
    part("literal", " "),
    part("timeZoneName", "GMT-5"),
  ];
  // Firefox 155.0 range: "10 AM GMT-5 – 12 PM GMT-5", every endpoint whole.
  const firefoxRange = [
    ranged("startRange", "hour", "10"),
    ranged("startRange", "literal", " "),
    ranged("startRange", "dayPeriod", "AM"),
    ranged("startRange", "literal", " "),
    ranged("startRange", "timeZoneName", "GMT-5"),
    ranged("shared", "literal", " – "),
    ranged("endRange", "hour", "12"),
    ranged("endRange", "literal", " "),
    ranged("endRange", "dayPeriod", "PM"),
    ranged("endRange", "literal", " "),
    ranged("endRange", "timeZoneName", "GMT-5"),
  ];

  it("D17 engine-shaped: writes each endpoint's flexible day period over Firefox's AM and PM", () => {
    expect(
      repairRangeParts(
        firefoxRange,
        [morning, noon],
        [morning, noon],
        ["dayPeriod"],
      ),
    ).toBe("10 in the morning GMT-5 – 12 noon GMT-5");
  });

  it("D17 engine-shaped: leaves the text alone when the type is not in the list", () => {
    expect(
      repairRangeParts(firefoxRange, [morning, noon], [morning, noon], []),
    ).toBe("10 AM GMT-5 – 12 PM GMT-5");
  });

  it("D17 engine-shaped: keeps the zone name Firefox wrote when only dayPeriod is replaced", () => {
    const zoned = firefoxRange.map((p) =>
      p.type === "timeZoneName" ? { ...p, value: "EST" } : p,
    );
    expect(
      repairRangeParts(zoned, [morning, noon], [morning, noon], ["dayPeriod"]),
    ).toBe("10 in the morning EST – 12 noon EST");
  });

  it("D17 constructed: a shared day period that is the start's takes the start's form", () => {
    const sharedRange = [
      ranged("startRange", "hour", "10"),
      ranged("shared", "literal", " – "),
      ranged("endRange", "hour", "11"),
      ranged("shared", "literal", " "),
      ranged("shared", "dayPeriod", "in the morning"),
    ];
    const eleven = [part("hour", "11"), part("dayPeriod", "in the morning")];
    const ten = [part("hour", "10"), part("dayPeriod", "in the morning")];
    expect(
      repairRangeParts(
        sharedRange,
        [ten, eleven],
        [ten, eleven],
        ["dayPeriod"],
      ),
    ).toBe("10 – 11 in the morning");
  });

  it("D17 constructed: keeps the engine's own value for a part the single format lacks", () => {
    const noPeriod = [part("hour", "10")];
    expect(
      repairRangeParts(
        [ranged("startRange", "dayPeriod", "AM")],
        [noPeriod, noPeriod],
        [noPeriod, noPeriod],
        ["dayPeriod"],
      ),
    ).toBe("AM");
  });

  // { hour: "numeric", minute: "numeric", timeZoneName: "long" } on V8 and JSC: the carrier is
  // the same formatter with timeZoneName "short", whose zone survives in the range.
  const estShort = [part("timeZoneName", "EST")];
  const edtShort = [part("timeZoneName", "EDT")];
  const estLong = [part("timeZoneName", "Eastern Standard Time")];
  const edtLong = [part("timeZoneName", "Eastern Daylight Time")];

  it("D16 engine-shaped: V8's shared short zone name becomes the requested long name", () => {
    const v8Range = [
      ranged("startRange", "hour", "10"),
      ranged("startRange", "literal", ":"),
      ranged("startRange", "minute", "00"),
      ranged("shared", "literal", " – "),
      ranged("endRange", "hour", "12"),
      ranged("endRange", "literal", ":"),
      ranged("endRange", "minute", "00"),
      ranged("shared", "literal", " "),
      ranged("shared", "timeZoneName", "EST"),
    ];
    expect(
      repairRangeParts(
        v8Range,
        [estLong, estLong],
        [estShort, estShort],
        ["timeZoneName"],
      ),
    ).toBe("10:00 – 12:00 Eastern Standard Time");
  });

  it("D16 constructed: a zone name per endpoint across a clock change keeps each endpoint's name", () => {
    const crossing = [
      ranged("startRange", "timeZoneName", "EST"),
      ranged("shared", "literal", " – "),
      ranged("endRange", "timeZoneName", "EDT"),
    ];
    expect(
      repairRangeParts(
        crossing,
        [estLong, edtLong],
        [estShort, edtShort],
        ["timeZoneName"],
      ),
    ).toBe("Eastern Standard Time – Eastern Daylight Time");
  });

  it("D16 constructed: a shared name equal to the end's only takes the end's requested form", () => {
    expect(
      repairRangeParts(
        [ranged("shared", "timeZoneName", "EDT")],
        [estLong, edtLong],
        [estShort, edtShort],
        ["timeZoneName"],
      ),
    ).toBe("Eastern Daylight Time");
  });

  it("D16 constructed: a shared name equal to both endpoints' takes the start's requested form", () => {
    expect(
      repairRangeParts(
        [ranged("shared", "timeZoneName", "EST")],
        [estLong, estLong],
        [estShort, estShort],
        ["timeZoneName"],
      ),
    ).toBe("Eastern Standard Time");
  });

  it("D16 constructed: the short carrier's name becomes the requested offset name", () => {
    expect(
      repairRangeParts(
        [
          ranged("startRange", "timeZoneName", "EST"),
          ranged("endRange", "timeZoneName", "EST"),
        ],
        [[part("timeZoneName", "GMT-5")], [part("timeZoneName", "GMT-5")]],
        [estShort, estShort],
        ["timeZoneName"],
      ),
    ).toBe("GMT-5GMT-5");
  });

  it("D16 and D17 together replace both part types in one pass", () => {
    const both = [
      ranged("startRange", "dayPeriod", "AM"),
      ranged("startRange", "timeZoneName", "EST"),
      ranged("endRange", "dayPeriod", "PM"),
      ranged("endRange", "timeZoneName", "EST"),
    ];
    const wanted: [Part[], Part[]] = [
      [part("dayPeriod", "in the morning"), part("timeZoneName", "GMT-5")],
      [part("dayPeriod", "noon"), part("timeZoneName", "GMT-5")],
    ];
    expect(
      repairRangeParts(
        both,
        wanted,
        [estShort, estShort],
        ["timeZoneName", "dayPeriod"],
      ),
    ).toBe("in the morningGMT-5noonGMT-5");
  });
});
