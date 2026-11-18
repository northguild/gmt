import { describe, expect, it } from "vitest";
import { monthGrid } from "~/lib/slides/calendar-figures";
import { REPORTS, VISUALS } from "./content";

describe("what the bug slides draw", () => {
  it("shows the recorded command and the observed line of its report", () => {
    expect(VISUALS.terminal.command).toBe(REPORTS.abort[0].repro.code);
    expect(VISUALS.terminal.output).toBe(REPORTS.abort[0].observed);
    expect(VISUALS.terminal.expected).toBe(REPORTS.abort[0].expected);
  });

  it("lands the Persian board on the dates and sources the report gives", () => {
    const { tehran } = VISUALS.counters;
    expect(REPORTS.years[1].expected).toContain(
      `${tehran.expected.value}, as ${tehran.expected.label}`,
    );
    expect(REPORTS.years[1].observed).toContain(
      `${tehran.observed.value} in ${tehran.observed.label}`,
    );
    expect(tehran.input).toBe(REPORTS.years[1].repro.code);
  });

  it("lands the Japanese board on the era and year the report gives", () => {
    const { tokyo } = VISUALS.counters;
    expect(REPORTS.years[3].expected).toContain(
      `${tokyo.expected.label} ${tokyo.expected.value}`,
    );
    expect(REPORTS.years[3].observed).toContain(
      `${tokyo.observed.label} ${tokyo.observed.value}`,
    );
  });

  it("puts the Kolkata pages one day apart, as the report says", () => {
    const { kolkata } = VISUALS.calendars;
    expect(REPORTS.dayOff[0].observed).toContain(kolkata.caption);
    expect(kolkata.observed.day - kolkata.expected.day).toBe(1);
  });

  it("marks the Shanghai month page on the two dates the report gives", () => {
    const { shanghai } = VISUALS.calendars;
    const { month } = monthGrid(shanghai.month);
    expect(REPORTS.dayOff[1].observed).toContain(
      `${shanghai.month.slice(0, 4)} on ${shanghai.observed.day} ${month}`,
    );
    expect(REPORTS.dayOff[1].expected).toContain(
      `${shanghai.expected.day} ${month}`,
    );
    expect(REPORTS.dayOff[1].observed).toContain(shanghai.caption);
  });

  it("names the call both engines are asked as the report does", () => {
    expect(REPORTS.engines[0].observed).toContain("until() or round()");
    expect(VISUALS.engines.call).toBe("until() or round()");
    expect(REPORTS.engines[0].observed).toContain(
      VISUALS.engines.observedLabel,
    );
  });
});
