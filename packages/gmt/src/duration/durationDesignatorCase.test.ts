import { addDuration } from "./calculate/addDuration";
import { absDuration } from "./calculate/absDuration";
import { getDurationSign } from "./calculate/getDurationSign";
import { getDurationUnit } from "./calculate/getDurationUnit";
import { negateDuration } from "./calculate/negateDuration";
import { subtractDuration } from "./calculate/subtractDuration";
import { totalDuration } from "./calculate/totalDuration";
import { compareDurations } from "./compare/compareDurations";
import { formatDuration } from "./format/formatDuration";
import { formatHumanDuration } from "./format/formatHumanDuration";
import { normalizeDuration } from "./normalize/normalizeDuration";
import { parseDuration } from "./parse/parseDuration";
import { isValidDuration } from "./validate/isValidDuration";
import { intervalFromDurationDate } from "../plain/interval/intervalFromDurationDate";
import { intervalFromDurationDateTime } from "../plain/interval/intervalFromDurationDateTime";
import { intervalFromDurationTime } from "../plain/interval/intervalFromDurationTime";
import { intervalFromDurationUnix } from "../unix/interval/intervalFromDurationUnix";
import { intervalFromDurationUtc } from "../utc/interval/intervalFromDurationUtc";
import { intervalFromDurationZoned } from "../zoned/interval/intervalFromDurationZoned";
import { cutoffAt } from "../transport/calculate/cutoffAt";

// ISO 8601-1 writes the designators P, Y, M, W, D, T, H and S in upper case. Temporal also reads
// them in lower case; GMT never copies that, so every reader of a duration string refuses a
// lower-case letter and returns its sentinel (the decimal comma stays: ISO 8601-1 allows it).
describe("a duration string with a designator in lower case", () => {
  const upper = "P1DT2H";
  const lowers = ["p1dt2h", "P1dT2H", "P1Dt2H", "P1DT2h"];

  it.each`
    name                              | call
    ${"isValidDuration"}              | ${(d: string) => !isValidDuration(d)}
    ${"addDuration a"}                | ${(d: string) => addDuration(d, "PT1H") === ""}
    ${"addDuration b"}                | ${(d: string) => addDuration("PT1H", d) === ""}
    ${"subtractDuration a"}           | ${(d: string) => subtractDuration(d, "PT1H") === ""}
    ${"subtractDuration b"}           | ${(d: string) => subtractDuration("PT1H", d) === ""}
    ${"negateDuration"}               | ${(d: string) => negateDuration(d) === ""}
    ${"absDuration"}                  | ${(d: string) => absDuration(d) === ""}
    ${"getDurationSign"}              | ${(d: string) => getDurationSign(d) === null}
    ${"getDurationUnit"}              | ${(d: string) => getDurationUnit(d, "hour") === null}
    ${"totalDuration"}                | ${(d: string) => totalDuration(d, "hours") === null}
    ${"compareDurations a"}           | ${(d: string) => compareDurations(d, "PT1H") === null}
    ${"compareDurations b"}           | ${(d: string) => compareDurations("PT1H", d) === null}
    ${"normalizeDuration"}            | ${(d: string) => normalizeDuration(d) === ""}
    ${"formatDuration"}               | ${(d: string) => formatDuration(d, "en") === ""}
    ${"formatHumanDuration"}          | ${(d: string) => formatHumanDuration(d) === ""}
    ${"parseDuration"}                | ${(d: string) => parseDuration(d) === ""}
    ${"intervalFromDurationDate"}     | ${(d: string) => intervalFromDurationDate("2024-06-15", d, "start") === null}
    ${"intervalFromDurationDateTime"} | ${(d: string) => intervalFromDurationDateTime("2024-06-15T10:00:00", d, "start") === null}
    ${"intervalFromDurationUnix"}     | ${(d: string) => intervalFromDurationUnix(1718445600, d, "start") === null}
    ${"intervalFromDurationUtc"}      | ${(d: string) => intervalFromDurationUtc("2024-06-15T10:00:00Z", d, "start") === null}
    ${"intervalFromDurationZoned"}    | ${(d: string) => intervalFromDurationZoned("2024-06-15T10:00:00+02:00[Europe/Berlin]", d, "start") === null}
    ${"cutoffAt"}                     | ${(d: string) => cutoffAt("2024-06-14T16:00:00Z", d, { timeZone: "UTC" }) === ""}
  `("$name refuses every such spelling", ({ call }) => {
    // The upper-case spelling is not the sentinel, so the sentinel check above is the right one.
    expect(call(upper), upper).toBe(false);
    for (const lower of lowers) {
      expect(call(lower), lower).toBe(true);
    }
  });

  // A time carries hours, minutes and seconds only, so it has its own upper-case spelling.
  it.each(["pt2h", "Pt2H", "PT2h"])(
    "intervalFromDurationTime refuses %s",
    (lower) => {
      expect(
        intervalFromDurationTime("10:00:00", "PT2H", "start"),
      ).not.toBeNull();
      expect(intervalFromDurationTime("10:00:00", lower, "start")).toBeNull();
    },
  );
});

// The decimal comma is ISO 8601-1's own spelling, so every reader takes `PT0,5H` (half an hour,
// checked against the polyfill's `PT0.5H`: PT30M, plus PT1H is PT1H30M, negated is -PT30M, 30
// minutes) and still refuses it with a lower-case designator.
describe("a duration string with a decimal comma", () => {
  it.each`
    name                 | call                                          | expected
    ${"isValidDuration"} | ${(d: string) => isValidDuration(d)}          | ${true}
    ${"parseDuration"}   | ${(d: string) => parseDuration(d)}            | ${"PT30M"}
    ${"addDuration"}     | ${(d: string) => addDuration(d, "PT1H")}      | ${"PT1H30M"}
    ${"negateDuration"}  | ${(d: string) => negateDuration(d)}           | ${"-PT30M"}
    ${"totalDuration"}   | ${(d: string) => totalDuration(d, "minutes")} | ${30}
  `("$name reads PT0,5H as half an hour", ({ call, expected }) => {
    expect(call("PT0,5H")).toBe(expected);
  });

  it.each`
    name                 | call                                          | sentinel
    ${"isValidDuration"} | ${(d: string) => isValidDuration(d)}          | ${false}
    ${"parseDuration"}   | ${(d: string) => parseDuration(d)}            | ${""}
    ${"addDuration"}     | ${(d: string) => addDuration(d, "PT1H")}      | ${""}
    ${"negateDuration"}  | ${(d: string) => negateDuration(d)}           | ${""}
    ${"totalDuration"}   | ${(d: string) => totalDuration(d, "minutes")} | ${null}
  `("$name refuses pt0,5h and PT0,5h", ({ call, sentinel }) => {
    expect(call("pt0,5h")).toBe(sentinel);
    expect(call("PT0,5h")).toBe(sentinel);
  });
});
