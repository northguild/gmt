import {
  bolTimestamp, diffDateAsDuration, formatDuration, formatFHIR, formatHL7, formatTimeZoneName, parseDateWithPattern,
} from "../index";
const S = new String("x");
const rows: [string, () => unknown, unknown][] = [
  ["formatDuration style", () => formatDuration("PT90M", "en", { style: new String("short") } as never), ""],
  ["formatDuration zero", () => formatDuration("P1DT0H30M", "en", { zero: "yes" } as never), ""],
  ["diffDateAsDuration toStringSmallestUnit", () => diffDateAsDuration("2024-01-01", "2024-03-01", "month", { toStringSmallestUnit: new String("day") } as never), ""],
  ["diffDateAsDuration fractionalSecondDigits", () => diffDateAsDuration("2024-01-01", "2024-03-01", "month", { fractionalSecondDigits: "2" } as never), ""],
  ["diffDateAsDuration toStringRoundingMode", () => diffDateAsDuration("2024-01-01", "2024-03-01", "month", { toStringRoundingMode: new String("floor") } as never), ""],
  ["diffDateAsDuration roundingMode", () => diffDateAsDuration("2024-01-01", "2024-03-01", "month", { roundingMode: new String("floor") } as never), ""],
  ["formatFHIR precision", () => formatFHIR("2024-06-15T10:00:00Z", { precision: new String("day") } as never), ""],
  ["formatHL7 precision", () => formatHL7("2024-06-15T10:00:00Z", { precision: new String("day") } as never), ""],
  ["parseDateWithPattern yearWindow", () => parseDateWithPattern("15/06/24", "dd/MM/yy", { yearWindow: "2000" } as never), ""],
  ["formatTimeZoneName style", () => formatTimeZoneName("2024-06-15T10:00:00+00:00[UTC]", "en", { style: new String("long") } as never), ""],
];
describe("probe", () => {
  it.each(rows)("%s", (_n, run, want) => { expect(run()).toBe(want); });
});
