import { Temporal } from "@js-temporal/polyfill";
import { isRinexWeekSystem, RINEX_WEEK_EPOCHS } from "./rinexWeek";

function labelNs(label: string): bigint {
  return Temporal.PlainDateTime.from(label).toZonedDateTime("UTC")
    .epochNanoseconds;
}

describe("RINEX_WEEK_EPOCHS", () => {
  // Week 0 of each RINEX navigation record's continuous week count, on that system's own scale.
  it.each`
    system   | label                    | source
    ${"GPS"} | ${"1980-01-06T00:00:00"} | ${"RINEX 4.02 Table A9; Table 3"}
    ${"GAL"} | ${"1980-01-06T00:00:00"} | ${"RINEX 4.02 Table A13 footnote 5*; Table 3"}
    ${"QZS"} | ${"1980-01-06T00:00:00"} | ${"RINEX 4.02 Table A19; Table 3"}
    ${"IRN"} | ${"1980-01-06T00:00:00"} | ${"RINEX 4.02 Table A30: continuous, not mod (1024), counted from 1980"}
    ${"BDT"} | ${"2006-01-01T00:00:00"} | ${"RINEX 4.02 §5.4.6; Table A23: BDT weeks from 2006-01-01"}
  `(
    "counts RINEX $system weeks from $label on the $system scale ($source)",
    ({ system, label }) => {
      expect(
        RINEX_WEEK_EPOCHS[system as keyof typeof RINEX_WEEK_EPOCHS],
      ).toEqual({ system, epochLabel: labelNs(label) });
    },
  );

  it("has no GLONASS entry: RINEX GLONASS records carry no week number", () => {
    expect(Object.keys(RINEX_WEEK_EPOCHS)).not.toContain("GLO");
    expect(Object.keys(RINEX_WEEK_EPOCHS)).toHaveLength(5);
  });
});

describe("isRinexWeekSystem", () => {
  it.each`
    value
    ${"GPS"}
    ${"GAL"}
    ${"BDT"}
    ${"QZS"}
    ${"IRN"}
  `("accepts $value", ({ value }) => {
    expect(isRinexWeekSystem(value)).toBe(true);
  });

  it.each`
    value         | why
    ${"GLO"}      | ${"GLONASS records carry no week"}
    ${"GPS-LNAV"} | ${"a broadcast counter"}
    ${"BDS"}      | ${"the constellation name"}
    ${"gps"}      | ${"lower case"}
    ${"toString"} | ${"an inherited property name"}
    ${null}       | ${"null"}
  `("rejects $value ($why)", ({ value }) => {
    expect(isRinexWeekSystem(value)).toBe(false);
  });
});
