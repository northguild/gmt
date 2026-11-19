import { describe, expect, it } from "vitest";
import { monthGrid } from "~/lib/slides/calendar-figures";
import { REPORTS, SOURCES, VISUALS, newMoonFacts } from "./content";

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

describe("the new moon over Shanghai", () => {
  const record = SOURCES.newMoon2027;

  it("holds the figures the Naval Observatory's API returned", () => {
    expect(record.url).toBe(
      "https://aa.usno.navy.mil/api/moon/phases/year?year=2027",
    );
    expect(record.apiVersion).toBe("4.0.1");
    expect(record.retrieved).toBe("2026-11-19");
    expect(record.timeScale).toBe("UT");
    expect(record.phase).toEqual({
      year: 2027,
      month: 2,
      day: 6,
      phase: "New Moon",
      time: "15:56",
    });
  });

  it("states the instant as the record's own date and time", () => {
    expect(record.utc).toBe("2027-02-06T15:56:00Z");
  });

  it("reads Shanghai's clock four minutes before midnight, from gmt", () => {
    const facts = newMoonFacts();
    expect(facts.localTime).toBe("23:56");
    expect(facts.localDay).toBe("6 February");
    expect(facts.minutesToMidnight).toBe(4);
    expect(facts.utcDay).toBe("6 February 2027");
    expect(facts.utcTime).toBe(record.phase.time);
  });

  it("states the month rule and its clock in the Observatory's own words", () => {
    const hko = SOURCES.chineseMonth;
    expect(hko.url).toBe(
      "https://www.hko.gov.hk/en/Observatorys-Blog/101741/Which-day-is-the-Tuen-Ng-Festival-for-this-year-2013",
    );
    expect(hko.quotes[0]).toBe(
      'Each month in the lunar calendar starts with a "New Moon"',
    );
    expect(hko.quotes[1]).toContain("(UTC) plus eight hours");
    expect(hko.offset).toBe("+08:00");
    expect(newMoonFacts().calendarClock).toBe("UTC+8");
  });

  it("puts Shanghai on the calendar's clock at the new moon, from gmt", () => {
    expect(newMoonFacts().zoneOffset).toBe(SOURCES.chineseMonth.offset);
  });

  it("makes no claim about what the timing causes", () => {
    const text = JSON.stringify(newMoonFacts());
    expect(text).not.toMatch(/caus|because|bug/i);
  });
});
