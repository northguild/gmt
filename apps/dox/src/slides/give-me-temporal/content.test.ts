import { describe, expect, it } from "vitest";
import { monthGrid } from "~/lib/slides/calendar-figures";
import { codeText, gmtSteps } from "~/lib/slides/gmt-call";
import { GMT_CALLS, REPORTS, SOURCES, VISUALS, newMoonFacts } from "./content";
import { KINDS } from "./kinds";

describe("what the bug slides draw", () => {
  it("runs each filing's own reproduction, with what it printed and what the filing expects", () => {
    const { crash, weekYear, engines } = VISUALS.runs;
    for (const [run, report, want] of [
      [crash, REPORTS.abort[0], REPORTS.abort[0].expected],
      [weekYear, REPORTS.abort[1], REPORTS.abort[1].repro.want],
      [engines, REPORTS.engines[0], REPORTS.engines[0].repro.want],
    ] as const) {
      expect(run.steps).toEqual([
        {
          code: report.repro.code,
          out: report.repro.output,
          outcome: "wrong",
          want,
        },
      ]);
    }
  });

  it("prints the next year where the calendar year belongs, as the report says", () => {
    const { repro, observed } = REPORTS.abort[1];
    expect(observed).toContain("week-of-year year");
    expect(repro.code).toContain("Date.UTC(2024,11,30)"); // date-ban: reads the quoted command
    expect(repro.output).toEqual([repro.want.replace("2024", "2025")]);
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

  it("adds one month to a whole year rounded to months, as the report says", () => {
    const { repro, observed } = REPORTS.engines[0];
    expect(observed).toContain("until() or round()");
    expect(repro.code).toContain(".until(");
    expect(repro.code).toContain('smallestUnit: "months"');
    expect(repro.want).toBe('"P1Y"');
    expect(repro.output).toEqual(['"P1Y1M"']);
  });
});

describe("what each GMT step says the filed bug gives", () => {
  it("quotes each filing's own value or words", () => {
    const [date, parts] = GMT_CALLS.abort;
    expect(date.bug.gives).toBe(`"${REPORTS.abort[1].repro.output[0]}"`);
    expect(parts.bug.gives).toBe(REPORTS.abort[0].observed);
    expect(GMT_CALLS.years[1].bug.gives).toBe(REPORTS.years[3].observed);
    expect(GMT_CALLS.dayOff[0].bug.gives).toBe(REPORTS.dayOff[1].observed);
    expect(GMT_CALLS.engines[0].bug.gives).toBe(
      REPORTS.engines[0].repro.output[0],
    );
  });

  it("restates the Persian and Manila filings with their own dates", () => {
    const [persian] = GMT_CALLS.years;
    const { code } = REPORTS.years[1].repro;
    expect(code).toContain("year: 1503");
    expect(persian.bug.gives).toBe(
      `${persian.want} is ${REPORTS.years[1].observed.split(" ")[0]}.`,
    );
    const skipped = GMT_CALLS.manila[1];
    expect(REPORTS.manila[0].observed).toContain("before 1847 miss");
    expect(REPORTS.manila[0].observed).toContain(skipped.args[0].slice(0, 10));
    expect(skipped.bug.gives).toContain("before 1847 miss");
  });
});

describe("what each GMT step expects", () => {
  it("expects the Gaelic date, and its parts, to spell the calendar year the Unicode ticket wants", () => {
    const [date, parts] = GMT_CALLS.abort;
    expect(date.want).toBe(REPORTS.abort[1].repro.want);
    expect(parts.want.map((p) => p.value).join("")).toBe(
      REPORTS.abort[1].repro.want,
    );
  });

  it("expects the Persian date native Temporal gives, and the Gregorian era for 1870", () => {
    const [persian, japanese] = GMT_CALLS.years;
    expect(REPORTS.years[1].expected).toContain(persian.args[0]);
    expect(REPORTS.years[1].repro.code).toContain(
      'year: 1503, monthCode: "M01", day: 1',
    );
    expect(persian.want).toBe("Farvardin 1, 1503 AP");
    expect(REPORTS.years[3].repro.code).toContain(japanese.args[0]);
    expect(REPORTS.years[3].expected).toContain(
      `year ${japanese.want.split(" ")[0]}`,
    );
  });

  it("expects Chinese New Year 2027 on the day the report gives", () => {
    const { shanghai } = VISUALS.calendars;
    expect(GMT_CALLS.dayOff[0].want).toEqual([
      `${shanghai.month}-${String(shanghai.expected.day).padStart(2, "0")}`,
    ]);
  });

  it("expects the whole year the report wants", () => {
    expect(codeText(GMT_CALLS.engines[0].want)).toBe(
      REPORTS.engines[0].repro.want,
    );
  });

  it("gets every expected value, except the Chinese date GMT refuses on every host", async () => {
    const outcomes = Object.fromEntries(
      await Promise.all(
        Object.entries(GMT_CALLS).map(async ([slide, calls]) => [
          slide,
          (await gmtSteps(calls)).map((s) => s.outcome),
        ]),
      ),
    );
    expect(outcomes).toEqual({
      abort: ["right", "right"],
      years: ["right", "right"],
      // Runtimes put Chinese New Year 2027 on 6 or 7 February, so GMT returns its empty value for
      // a Chinese date on every host: no date, not a wrong one. The day-off step's note says so.
      dayOff: ["lost"],
      manila: ["right", "right", "right"],
      engines: ["right"],
      kinds: ["right"],
    });
  });
});

describe("the kinds slide", () => {
  const { grid, file } = KINDS;

  it("is ready: every call's run record is current and ran in every zone the slide shows", () => {
    expect(grid.ready ? "ready" : grid.problem).toBe("ready");
  });

  it("gives GMT's call the wanted date, and its red value one the grid shows", () => {
    const [call] = GMT_CALLS.kinds;
    expect(call.want).toBe(file.want);
    if (!grid.ready) return;
    const wrong = grid.rows.flatMap((r) =>
      r.cells.filter((c) => c.outcome === "wrong").map((c) => c.label),
    );
    expect(wrong).toContain(call.bug.gives);
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
