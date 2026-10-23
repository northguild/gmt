import { describe, expect, it } from "vitest";
import { classifyLocal } from "../../instant/convert/classifyLocal";
import { Temporal } from "../../internal/temporal";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import type {
  CronExpression,
  CronRun,
  CronTransitionPolicy,
  OccurrenceWindow,
} from "../../types";
import { parseCronExpression } from "../parse/parseCronExpression";
import { cronRuns } from "./cronRuns";

const NY = "America/New_York";

function cron(text: string): CronExpression {
  const parsed = parseCronExpression(text);
  if (parsed === null) throw new Error(`test cron ${text} did not parse`);
  return parsed;
}

const between = (start: string, end: string): OccurrenceWindow => ({
  start,
  end,
});

function instants(
  text: string,
  zone: string,
  window: OccurrenceWindow,
  policy: CronTransitionPolicy,
): string[] {
  return cronRuns(cron(text), zone, window, policy).map((run) => run.instant);
}

describe("cronRuns, gaps and overlaps in America/New_York", () => {
  // Rule: crontab(5) "will never match" for a skipped wall time; cronie cron(8) / Debian cron(8)
  // run a fixed-time job once soon after a forward change of under 3 h (cron.c: shift + 1 minute tick
  // must not exceed 3 * MINUTE_COUNT) and do not re-run it after a backward change of up to 3 h. New York's gap is
  // 02:00 to 03:00 EST on 2024-03-10 (07:00Z); 02:30 EST would be 07:30Z, so the transition 07:00Z
  // is where the catch-up run lands.
  const marchWindow = between("2024-03-09T00:00:00Z", "2024-03-12T00:00:00Z");

  it("crontabMatch skips the nonexistent 02:30 of March 10", () => {
    expect(instants("30 2 * * *", NY, marchWindow, "crontabMatch")).toEqual([
      "2024-03-09T07:30:00Z",
      "2024-03-11T06:30:00Z",
    ]);
  });

  it("daemonCatchUp runs 02:30 once at the transition, marked nonexistent", () => {
    expect(
      cronRuns(cron("30 2 * * *"), NY, marchWindow, "daemonCatchUp"),
    ).toEqual([
      {
        local: "2024-03-09T02:30:00",
        instant: "2024-03-09T07:30:00Z",
        classification: "unique",
      },
      {
        local: "2024-03-10T02:30:00",
        instant: "2024-03-10T07:00:00Z",
        classification: "nonexistent",
      },
      {
        local: "2024-03-11T02:30:00",
        instant: "2024-03-11T06:30:00Z",
        classification: "unique",
      },
    ]);
  });

  it("daemonCatchUp keeps two skipped minutes as two rows at one instant, in local order", () => {
    // cronie runs each skipped minute's jobs; the rows are not collapsed.
    expect(
      cronRuns(
        cron("0,30 2 * * *"),
        NY,
        between("2024-03-10T00:00:00Z", "2024-03-11T00:00:00Z"),
        "daemonCatchUp",
      ),
    ).toEqual([
      {
        local: "2024-03-10T02:00:00",
        instant: "2024-03-10T07:00:00Z",
        classification: "nonexistent",
      },
      {
        local: "2024-03-10T02:30:00",
        instant: "2024-03-10T07:00:00Z",
        classification: "nonexistent",
      },
    ]);
  });

  // Overlap: 01:00 to 02:00 repeats on 2024-11-03; 01:30 EDT is 05:30Z, 01:30 EST is 06:30Z.
  const novWindow = between("2024-11-03T00:00:00Z", "2024-11-04T00:00:00Z");

  it("crontabMatch runs an ambiguous 01:30 twice", () => {
    expect(cronRuns(cron("30 1 * * *"), NY, novWindow, "crontabMatch")).toEqual(
      [
        {
          local: "2024-11-03T01:30:00",
          instant: "2024-11-03T05:30:00Z",
          classification: "ambiguous",
        },
        {
          local: "2024-11-03T01:30:00",
          instant: "2024-11-03T06:30:00Z",
          classification: "ambiguous",
        },
      ],
    );
  });

  it("daemonCatchUp runs a fixed-time ambiguous 01:30 once, at the earlier reading", () => {
    // Debian cron(8): jobs "will not be re-run" after the clock falls back.
    expect(
      cronRuns(cron("30 1 * * *"), NY, novWindow, "daemonCatchUp"),
    ).toEqual([
      {
        local: "2024-11-03T01:30:00",
        instant: "2024-11-03T05:30:00Z",
        classification: "ambiguous",
      },
    ]);
  });

  it("daemonCatchUp runs two fixed-time minutes of the repeated hour once each", () => {
    expect(instants("0,30 1 * * *", NY, novWindow, "daemonCatchUp")).toEqual([
      "2024-11-03T05:00:00Z",
      "2024-11-03T05:30:00Z",
    ]);
  });

  it.each`
    policy
    ${"crontabMatch"}
    ${"daemonCatchUp"}
  `(
    "*/5 across the spring gap runs the wall times that exist, $policy",
    ({ policy }) => {
      // Wildcard job: the 02:xx wall times never occur, so every real five-minute mark runs once.
      expect(
        instants(
          "*/5 * * * *",
          NY,
          between("2024-03-10T06:50:00Z", "2024-03-10T07:10:00Z"),
          policy,
        ),
      ).toEqual([
        "2024-03-10T06:50:00Z",
        "2024-03-10T06:55:00Z",
        "2024-03-10T07:00:00Z",
        "2024-03-10T07:05:00Z",
      ]);
    },
  );

  it.each`
    policy
    ${"crontabMatch"}
    ${"daemonCatchUp"}
  `(
    "*/30 across the autumn overlap runs each half hour of both passes, $policy",
    ({ policy }) => {
      // A wildcard job is not fixed-time, so the repeated hour runs again.
      const runs = cronRuns(
        cron("*/30 * * * *"),
        NY,
        between("2024-11-03T05:00:00Z", "2024-11-03T07:00:00Z"),
        policy,
      );

      expect(runs.map((run) => run.instant)).toEqual([
        "2024-11-03T05:00:00Z",
        "2024-11-03T05:30:00Z",
        "2024-11-03T06:00:00Z",
        "2024-11-03T06:30:00Z",
      ]);
      expect(runs.map((run) => run.classification)).toEqual([
        "ambiguous",
        "ambiguous",
        "ambiguous",
        "ambiguous",
      ]);
    },
  );

  it("daemonCatchUp does not catch up 30 * * * * (hour is a star, so it is a wildcard job)", () => {
    // 00:30 EST, 01:30 EST, 03:30 EDT and 04:30 EDT exist; the skipped 02:30 gets no run.
    expect(
      instants(
        "30 * * * *",
        NY,
        between("2024-03-10T05:00:00Z", "2024-03-10T09:00:00Z"),
        "daemonCatchUp",
      ),
    ).toEqual([
      "2024-03-10T05:30:00Z",
      "2024-03-10T06:30:00Z",
      "2024-03-10T07:30:00Z",
      "2024-03-10T08:30:00Z",
    ]);
  });
});

describe("cronRuns, zones with other transition sizes", () => {
  it("daemonCatchUp does not catch up a gap of exactly 3 h (Antarctica/Casey, 2020-10-04)", () => {
    // Casey moved from +08 to +11 at 2020-10-03T16:01:00Z: a 3 h gap. cronie cron.c adds the one
    // minute tick to a forward shift (180 + 1 = 181), which is over 3 * MINUTE_COUNT, so it is
    // "large" and nothing is caught up. 01:30 local on the 4th did not exist: no run, as in crontabMatch.
    const window = between("2020-10-03T00:00:00Z", "2020-10-05T00:00:00Z");
    const unique = {
      local: "2020-10-05T01:30:00",
      instant: "2020-10-04T14:30:00Z",
      classification: "unique",
    };

    expect(
      cronRuns(cron("30 1 * * *"), "Antarctica/Casey", window, "daemonCatchUp"),
    ).toEqual([unique]);
    expect(
      cronRuns(cron("30 1 * * *"), "Antarctica/Casey", window, "crontabMatch"),
    ).toEqual([unique]);
  });

  it("daemonCatchUp runs once for an overlap of exactly 3 h (Antarctica/Casey, 2021-03-13)", () => {
    // Casey moved from +11 to +08 at 2021-03-13T13:00:00Z, so local 21:00 to 24:00 on the 13th
    // repeats. cron.c gives a backward shift of 180 minutes -180 + 1 = -179: "negative", so the job
    // is not run again. 22:30 is 11:30Z at +11 and 14:30Z at +08.
    const window = between("2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z");
    const first = {
      local: "2021-03-13T22:30:00",
      instant: "2021-03-13T11:30:00Z",
      classification: "ambiguous",
    };

    expect(
      cronRuns(
        cron("30 22 * * *"),
        "Antarctica/Casey",
        window,
        "daemonCatchUp",
      ),
    ).toEqual([first]);
    expect(
      cronRuns(cron("30 22 * * *"), "Antarctica/Casey", window, "crontabMatch"),
    ).toEqual([first, { ...first, instant: "2021-03-13T14:30:00Z" }]);
  });

  it("daemonCatchUp leaves out a skipped day (Pacific/Apia, shift of 24 h)", () => {
    // Apia skipped 2011-12-30 entirely; a 24 h shift is over 3 h, and both policies agree.
    const window = between("2011-12-29T00:00:00Z", "2011-12-31T12:00:00Z");

    for (const policy of ["crontabMatch", "daemonCatchUp"] as const) {
      expect(
        cronRuns(cron("0 12 * * *"), "Pacific/Apia", window, policy).map(
          (run) => [run.instant, run.local],
        ),
      ).toEqual([
        ["2011-12-29T22:00:00Z", "2011-12-29T12:00:00"],
        ["2011-12-30T22:00:00Z", "2011-12-31T12:00:00"],
      ]);
    }
  });

  it("daemonCatchUp catches up a 30 minute gap (Australia/Lord_Howe, 2024-10-06)", () => {
    // 02:00 +10:30 becomes 02:30 +11:00 at 2024-10-05T15:30:00Z.
    const window = between("2024-10-05T00:00:00Z", "2024-10-06T00:00:00Z");

    expect(
      cronRuns(
        cron("15 2 * * *"),
        "Australia/Lord_Howe",
        window,
        "daemonCatchUp",
      ),
    ).toEqual([
      {
        local: "2024-10-06T02:15:00",
        instant: "2024-10-05T15:30:00Z",
        classification: "nonexistent",
      },
    ]);
    expect(
      cronRuns(
        cron("15 2 * * *"),
        "Australia/Lord_Howe",
        window,
        "crontabMatch",
      ),
    ).toEqual([]);
  });

  it("crontabMatch runs an ambiguous 03:00 twice an hour apart (Pacific/Chatham, 2024-04-07)", () => {
    expect(
      instants(
        "0 3 * * *",
        "Pacific/Chatham",
        between("2024-04-06T00:00:00Z", "2024-04-07T00:00:00Z"),
        "crontabMatch",
      ),
    ).toEqual(["2024-04-06T13:15:00Z", "2024-04-06T14:15:00Z"]);
  });

  it("a 30 minute repeat runs once under daemonCatchUp and twice under crontabMatch (Australia/Lord_Howe, 2024-04-07)", () => {
    // 01:45 +11:00 is 14:45Z and 01:45 +10:30 is 15:15Z: a shift of 30 minutes, at most 3 h.
    const window = between("2024-04-06T00:00:00Z", "2024-04-07T00:00:00Z");

    expect(
      instants("45 1 * * *", "Australia/Lord_Howe", window, "daemonCatchUp"),
    ).toEqual(["2024-04-06T14:45:00Z"]);
    expect(
      instants("45 1 * * *", "Australia/Lord_Howe", window, "crontabMatch"),
    ).toEqual(["2024-04-06T14:45:00Z", "2024-04-06T15:15:00Z"]);
  });

  it("daemonCatchUp runs a fixed-time job in a repeat larger than 3 h twice (America/Sitka, 1867-10-19)", () => {
    // Sitka's clock went back 24 h at 1867-10-18T15:30 -09:01, so 1867-10-19 12:00 happened at
    // 1867-10-18T21:01:13Z (+14:59) and again at 1867-10-19T21:01:13Z (-09:01). A shift over 3 h is
    // "large" in cronie, so both policies run it twice.
    const window = between("1867-10-17T00:00:00Z", "1867-10-21T00:00:00Z");

    for (const policy of ["crontabMatch", "daemonCatchUp"] as const) {
      expect(
        cronRuns(cron("0 12 * * *"), "America/Sitka", window, policy).map(
          (run) => [run.instant, run.local, run.classification],
        ),
      ).toEqual([
        ["1867-10-17T21:01:13Z", "1867-10-18T12:00:00", "unique"],
        ["1867-10-18T21:01:13Z", "1867-10-19T12:00:00", "ambiguous"],
        ["1867-10-19T21:01:13Z", "1867-10-19T12:00:00", "ambiguous"],
        ["1867-10-20T21:01:13Z", "1867-10-20T12:00:00", "unique"],
      ]);
    }
  });
});

describe("cronRuns, the day rule (UTC)", () => {
  const utc = (text: string, window: OccurrenceWindow) =>
    cronRuns(cron(text), "UTC", window, "crontabMatch").map((run) =>
      run.local.slice(0, 16),
    );

  it("ORs both restricted day fields: 0 0 1,15 * 1 over January and February 2024", () => {
    // Mondays (1, 8, 15, 22, 29 Jan; 5, 12, 19, 26 Feb) plus the 1st and 15th of each month.
    expect(
      utc(
        "0 0 1,15 * 1",
        between("2024-01-01T00:00:00Z", "2024-03-01T00:00:00Z"),
      ),
    ).toEqual([
      "2024-01-01T00:00",
      "2024-01-08T00:00",
      "2024-01-15T00:00",
      "2024-01-22T00:00",
      "2024-01-29T00:00",
      "2024-02-01T00:00",
      "2024-02-05T00:00",
      "2024-02-12T00:00",
      "2024-02-15T00:00",
      "2024-02-19T00:00",
      "2024-02-26T00:00",
    ]);
  });

  it("ANDs when dayOfMonth is a star: 0 0 * 1 1 gives Mondays in January only", () => {
    expect(
      utc("0 0 * 1 1", { after: "2024-01-01T00:00:00Z", count: 6 }),
    ).toEqual([
      "2024-01-08T00:00",
      "2024-01-15T00:00",
      "2024-01-22T00:00",
      "2024-01-29T00:00",
      "2025-01-06T00:00",
      "2025-01-13T00:00",
    ]);
  });

  it("ANDs when dayOfMonth is */2: Mondays on odd days of the month", () => {
    expect(
      utc(
        "0 0 */2 * 1",
        between("2024-01-01T00:00:00Z", "2024-02-01T00:00:00Z"),
      ),
    ).toEqual(["2024-01-01T00:00", "2024-01-15T00:00", "2024-01-29T00:00"]);
  });

  it("30 4 1,15 * 5 (crontab(5) NOTES) runs on the 1st, the 15th and every Friday", () => {
    expect(
      utc(
        "30 4 1,15 * 5",
        between("2024-02-01T00:00:00Z", "2024-03-01T00:00:00Z"),
      ),
    ).toEqual([
      "2024-02-01T04:30",
      "2024-02-02T04:30",
      "2024-02-09T04:30",
      "2024-02-15T04:30",
      "2024-02-16T04:30",
      "2024-02-23T04:30",
    ]);
  });

  it("0 */23 * * * runs at 00:00 and 23:00 each day (crontab(5) example)", () => {
    expect(
      utc(
        "0 */23 * * *",
        between("2024-01-01T00:00:00Z", "2024-01-03T00:00:00Z"),
      ),
    ).toEqual([
      "2024-01-01T00:00",
      "2024-01-01T23:00",
      "2024-01-02T00:00",
      "2024-01-02T23:00",
    ]);
  });

  it("@weekly runs Sundays at 00:00 and @monthly only on the 1st", () => {
    const january = between("2024-01-01T00:00:00Z", "2024-02-01T00:00:00Z");
    expect(utc("@weekly", january)).toEqual([
      "2024-01-07T00:00",
      "2024-01-14T00:00",
      "2024-01-21T00:00",
      "2024-01-28T00:00",
    ]);
    // 2024-09-01 is a Sunday and 2024-06-01 a Saturday; dayOfWeek is a star, so @monthly is ANDed.
    expect(
      utc("@monthly", between("2024-06-01T00:00:00Z", "2024-10-01T00:00:00Z")),
    ).toEqual([
      "2024-06-01T00:00",
      "2024-07-01T00:00",
      "2024-08-01T00:00",
      "2024-09-01T00:00",
    ]);
  });
});

describe("cronRuns, windows", () => {
  it("is half-open: 0 * * * * over [00:00Z, 03:00Z) gives 00, 01 and 02", () => {
    expect(
      instants(
        "0 * * * *",
        "UTC",
        between("2024-01-01T00:00:00Z", "2024-01-01T03:00:00Z"),
        "crontabMatch",
      ),
    ).toEqual([
      "2024-01-01T00:00:00Z",
      "2024-01-01T01:00:00Z",
      "2024-01-01T02:00:00Z",
    ]);
  });

  it("is strictly after the instant for the count form", () => {
    expect(
      instants(
        "0 * * * *",
        "UTC",
        { after: "2024-01-01T00:00:00Z", count: 2 },
        "crontabMatch",
      ),
    ).toEqual(["2024-01-01T01:00:00Z", "2024-01-01T02:00:00Z"]);
  });

  it("gives 2028-02-29 and 2032-02-29 for 0 0 29 2 * after 2025-01-01", () => {
    expect(
      instants(
        "0 0 29 2 *",
        "UTC",
        { after: "2025-01-01T00:00:00Z", count: 2 },
        "crontabMatch",
      ),
    ).toEqual(["2028-02-29T00:00:00Z", "2032-02-29T00:00:00Z"]);
  });

  it("gives Mar 31, May 31 and Jul 31 for 0 0 31 * * after 2024-01-31", () => {
    expect(
      instants(
        "0 0 31 * *",
        "UTC",
        { after: "2024-01-31T00:00:00Z", count: 3 },
        "crontabMatch",
      ),
    ).toEqual([
      "2024-03-31T00:00:00Z",
      "2024-05-31T00:00:00Z",
      "2024-07-31T00:00:00Z",
    ]);
  });

  it("returns [] for 0 0 30 2 * (never matches)", () => {
    expect(
      instants(
        "0 0 30 2 *",
        "UTC",
        { after: "2024-01-01T00:00:00Z", count: 1 },
        "crontabMatch",
      ),
    ).toEqual([]);
  });

  it("returns 8,640 runs for * * * * * over 6 days and [] over 7 (10,080 is over the cap)", () => {
    expect(
      cronRuns(
        cron("* * * * *"),
        "UTC",
        between("2024-01-01T00:00:00Z", "2024-01-07T00:00:00Z"),
        "crontabMatch",
      ),
    ).toHaveLength(8_640);
    expect(
      cronRuns(
        cron("* * * * *"),
        "UTC",
        between("2024-01-01T00:00:00Z", "2024-01-08T00:00:00Z"),
        "crontabMatch",
      ),
    ).toEqual([]);
  });

  it("returns exactly 10,000 runs for the count form at its limit", () => {
    expect(
      cronRuns(
        cron("* * * * *"),
        "UTC",
        { after: "2024-01-01T00:00:00Z", count: 10_000 },
        "crontabMatch",
      ),
    ).toHaveLength(10_000);
  });

  it("returns [] when the work cap is spent before the count is found", () => {
    // 10,000 leap days are about 40,000 years away, far past 2,000,000 scanned days.
    expect(
      cronRuns(
        cron("0 0 29 2 *"),
        "UTC",
        { after: "2024-01-01T00:00:00Z", count: 10_000 },
        "crontabMatch",
      ),
    ).toEqual([]);
  });

  it("places every run of a fixed offset zone at local minus the offset", () => {
    const runs = cronRuns(
      cron("0 9 * * *"),
      "+05:30",
      between("2024-01-01T00:00:00Z", "2024-01-03T00:00:00Z"),
      "daemonCatchUp",
    );

    expect(runs).toEqual([
      {
        local: "2024-01-01T09:00:00",
        instant: "2024-01-01T03:30:00Z",
        classification: "unique",
      },
      {
        local: "2024-01-02T09:00:00",
        instant: "2024-01-02T03:30:00Z",
        classification: "unique",
      },
    ]);
  });

  it("includes a run whose local day is before the window's first UTC day (Pacific/Apia, +13)", () => {
    // 2024-06-02 03:00 +13:00 is 2024-06-01T14:00Z; the lower bound's own UTC day does not hold it.
    expect(
      instants(
        "0 3 * * *",
        "Pacific/Apia",
        between("2024-06-01T13:00:00Z", "2024-06-01T15:00:00Z"),
        "crontabMatch",
      ),
    ).toEqual(["2024-06-01T14:00:00Z"]);
  });
});

describe("cronRuns, Temporal's range limits", () => {
  // Rule: Temporal's instants run from -271821-04-20T00:00:00Z to +275760-09-13T00:00:00Z
  // (TC39 ISODateTimeWithinLimits, +-8.64e21 ns). A run past the last instant is past the end of
  // the schedule: it is dropped and the runs found are returned. 0 * * * * fires on each hour.
  const lastDay = "+275760-09-12";

  it.each`
    count | expected
    ${5}  | ${["19", "20", "21", "22", "23"]}
    ${6}  | ${["19", "20", "21", "22", "23", "00"]}
    ${7}  | ${["19", "20", "21", "22", "23", "00"]}
    ${50} | ${["19", "20", "21", "22", "23", "00"]}
  `(
    "count $count after +275760-09-12T18:00Z returns the runs up to the last instant",
    ({ count, expected }) => {
      // After 18:00 the hours 19 to 23 and then 00:00 on the 13th, the last instant, are the 6 runs.
      const runs = cronRuns(
        cron("0 * * * *"),
        "UTC",
        { after: `${lastDay}T18:00:00Z`, count },
        "crontabMatch",
      );

      expect(runs.map((run) => run.instant)).toEqual(
        (expected as string[]).map((hour) =>
          hour === "00"
            ? "+275760-09-13T00:00:00Z"
            : `${lastDay}T${hour}:00:00Z`,
        ),
      );
    },
  );

  it.each`
    zone        | first               | last
    ${"+09:00"} | ${"09-13T06:00:00"} | ${"09-13T09:00:00"}
    ${"-05:00"} | ${"09-12T16:00:00"} | ${"09-12T19:00:00"}
  `(
    "count form in $zone near the last instant keeps the runs up to $last",
    ({ zone, first, last }) => {
      // After 20:00Z: the instants are 21:00Z, 22:00Z, 23:00Z and 00:00Z on the 13th. The offset
      // is a whole number of hours, so the wall hour is the UTC hour plus the offset.
      const runs = cronRuns(
        cron("0 * * * *"),
        zone,
        { after: `${lastDay}T20:00:00Z`, count: 10 },
        "crontabMatch",
      );

      expect(runs.map((run) => run.instant)).toEqual([
        `${lastDay}T21:00:00Z`,
        `${lastDay}T22:00:00Z`,
        `${lastDay}T23:00:00Z`,
        "+275760-09-13T00:00:00Z",
      ]);
      expect(runs[0]!.local).toBe(`+275760-${first}`);
      expect(runs[3]!.local).toBe(`+275760-${last}`);
    },
  );

  it.each`
    zone        | locals
    ${"+09:00"} | ${["-271821-04-20T09:00:00", "-271821-04-20T10:00:00", "-271821-04-20T11:00:00"]}
    ${"-05:00"} | ${["-271821-04-19T19:00:00", "-271821-04-19T20:00:00", "-271821-04-19T21:00:00"]}
  `(
    "interval form in $zone from the first instant holds the 3 runs",
    ({ zone, locals }) => {
      // 00:00Z, 01:00Z and 02:00Z on -271821-04-20, the first instant and the two after it.
      const runs = cronRuns(
        cron("0 * * * *"),
        zone,
        between("-271821-04-20T00:00:00Z", "-271821-04-20T03:00:00Z"),
        "crontabMatch",
      );

      expect(runs.map((run) => run.local)).toEqual(locals);
      expect(runs[0]!.instant).toBe("-271821-04-20T00:00:00Z");
    },
  );

  it.each`
    zone
    ${"+09:00"}
    ${"-05:00"}
  `(
    "interval form in $zone ending at the last instant holds the 2 runs before it",
    ({ zone }) => {
      const runs = cronRuns(
        cron("0 * * * *"),
        zone,
        between("+275760-09-12T22:00:00Z", "+275760-09-13T00:00:00Z"),
        "crontabMatch",
      );

      expect(runs.map((run) => run.instant)).toEqual([
        "+275760-09-12T22:00:00Z",
        "+275760-09-12T23:00:00Z",
      ]);
    },
  );
});

describe("cronRuns, daemonCatchUp ties and a literal overlap", () => {
  it("runs 0 3 once at the earlier reading of Pacific/Chatham's overlap on 2024-04-07", () => {
    // Chatham leaves DST at 03:45 +13:45 and goes back to 02:45 +12:45, so 03:00 is read twice.
    // The earlier reading is 03:00 at +13:45: 13:15Z the day before. The later one (14:15Z) is
    // not run. The window ends before 04-08 03:00 (14:15Z on the 7th).
    expect(
      cronRuns(
        cron("0 3 * * *"),
        "Pacific/Chatham",
        between("2024-04-06T00:00:00Z", "2024-04-07T00:00:00Z"),
        "daemonCatchUp",
      ),
    ).toEqual([
      {
        local: "2024-04-07T03:00:00",
        instant: "2024-04-06T13:15:00Z",
        classification: "ambiguous",
      },
    ]);
  });

  it("keeps a caught-up gap run and a unique run at one instant as separate rows, ordered by local", () => {
    // New York 2024-03-10: 02:00 and 02:30 do not exist and run at the transition, 07:00Z. 03:00 is
    // 07:00Z (EDT -4) too, and 03:30 is 07:30Z. Nothing is merged (cron(8): missed jobs run
    // "soon after", and the 03:00 job runs as well); equal instants sort by local.
    expect(
      cronRuns(
        cron("0,30 2,3 * * *"),
        NY,
        between("2024-03-10T00:00:00Z", "2024-03-11T00:00:00Z"),
        "daemonCatchUp",
      ).map((run) => [run.local, run.instant, run.classification]),
    ).toEqual([
      ["2024-03-10T02:00:00", "2024-03-10T07:00:00Z", "nonexistent"],
      ["2024-03-10T02:30:00", "2024-03-10T07:00:00Z", "nonexistent"],
      ["2024-03-10T03:00:00", "2024-03-10T07:00:00Z", "unique"],
      ["2024-03-10T03:30:00", "2024-03-10T07:30:00Z", "unique"],
    ]);
  });
});

describe("cronRuns, invalid input", () => {
  const good = cron("0 0 * * *");
  const window = between("2024-01-01T00:00:00Z", "2024-01-03T00:00:00Z");

  it.each`
    name                      | expression                                             | zone              | win                                                        | policy
    ${"a missing policy"}     | ${good}                                                | ${"UTC"}          | ${window}                                                  | ${undefined}
    ${"policy skip"}          | ${good}                                                | ${"UTC"}          | ${window}                                                  | ${"skip"}
    ${"zone Nowhere/Here"}    | ${good}                                                | ${"Nowhere/Here"} | ${window}                                                  | ${"crontabMatch"}
    ${"expression {}"}        | ${{}}                                                  | ${"UTC"}          | ${window}                                                  | ${"crontabMatch"}
    ${"expression null"}      | ${null}                                                | ${"UTC"}          | ${window}                                                  | ${"crontabMatch"}
    ${"dayOfWeek values [0]"} | ${{ ...good, dayOfWeek: { values: [0], star: true } }} | ${"UTC"}          | ${window}                                                  | ${"crontabMatch"}
    ${"count 0"}              | ${good}                                                | ${"UTC"}          | ${{ after: "2024-01-01T00:00:00Z", count: 0 }}             | ${"crontabMatch"}
    ${"an inverted interval"} | ${good}                                                | ${"UTC"}          | ${between("2024-01-03T00:00:00Z", "2024-01-01T00:00:00Z")} | ${"crontabMatch"}
    ${"a non-object window"}  | ${good}                                                | ${"UTC"}          | ${"2024"}                                                  | ${"crontabMatch"}
    ${"a non-string zone"}    | ${good}                                                | ${42}             | ${window}                                                  | ${"crontabMatch"}
  `("returns [] for $name", ({ expression, zone, win, policy }) => {
    expect(cronRuns(expression, zone, win, policy)).toEqual([]);
  });
});

// A seeded generator, so a failure names its inputs and reruns identically.
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!;

/**
 * The instants one scheduled wall time runs at, derived with Temporal only: unique gives one,
 * a gap gives none (or the transition when it is caught up) and an overlap gives its readings.
 */
function readingsOf(
  wall: Temporal.PlainDateTime,
  zone: string,
  caughtUp: (shiftHours: number, ambiguous: boolean) => boolean,
): Array<[bigint, string]> {
  const earlier = wall.toZonedDateTime(zone, { disambiguation: "earlier" });
  const later = wall.toZonedDateTime(zone, { disambiguation: "later" });

  if (earlier.epochNanoseconds === later.epochNanoseconds) {
    return [[earlier.epochNanoseconds, "unique"]];
  }

  const ambiguous =
    Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), wall) === 0;
  const once = caughtUp(
    Number(later.epochNanoseconds - earlier.epochNanoseconds) / 3.6e12,
    ambiguous,
  );

  if (ambiguous) {
    return once
      ? [[earlier.epochNanoseconds, "ambiguous"]]
      : [
          [earlier.epochNanoseconds, "ambiguous"],
          [later.epochNanoseconds, "ambiguous"],
        ];
  }

  // The gap starts where the offset next changes after the earlier reading.
  return once
    ? [[earlier.getTimeZoneTransition("next")!.epochNanoseconds, "nonexistent"]]
    : [];
}

/**
 * The expected rows for a list expression run every day, computed with Temporal only. It is a
 * differential check against Temporal, not an oracle: it re-applies the policy table.
 */
function oracle(
  hours: readonly number[],
  minutes: readonly number[],
  zone: string,
  policy: CronTransitionPolicy,
  start: string,
  end: string,
  fixedTime: boolean,
): Array<[string, string, string]> {
  const lower = Temporal.Instant.from(start).epochNanoseconds;
  const upper = Temporal.Instant.from(end).epochNanoseconds;
  const rows: Array<[bigint, string, string]> = [];
  const last = Temporal.PlainDate.from(end.slice(0, 10)).add({ days: 2 });
  // cron.c: a gap is caught up under 3 h, an overlap is not re-run up to 3 h.
  const caughtUp = (shiftHours: number, ambiguous: boolean) =>
    policy === "daemonCatchUp" &&
    fixedTime &&
    (ambiguous ? shiftHours <= 3 : shiftHours < 3);
  let date = Temporal.PlainDate.from(start.slice(0, 10)).subtract({ days: 2 });

  for (
    ;
    Temporal.PlainDate.compare(date, last) <= 0;
    date = date.add({ days: 1 })
  ) {
    for (const wall of hours.flatMap((hour) =>
      minutes.map((minute) => date.toPlainDateTime({ hour, minute })),
    )) {
      for (const [instant, classification] of readingsOf(
        wall,
        zone,
        caughtUp,
      )) {
        if (instant >= lower && instant < upper) {
          rows.push([
            instant,
            wall.toString({ smallestUnit: "second" }),
            classification,
          ]);
        }
      }
    }
  }

  rows.sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0] < b[0] ? -1 : 1,
  );

  return rows.map(([instant, local, classification]) => [
    Temporal.Instant.fromEpochNanoseconds(instant).toString({
      smallestUnit: "second",
    }),
    local,
    classification,
  ]);
}

describe("cronRuns, differential check against Temporal and invariants across the zone matrix", () => {
  const year = { start: "2024-01-01T00:00:00Z", end: "2025-01-01T00:00:00Z" };

  it.each(
    battleTestTimeZones.flatMap((zone) =>
      (["crontabMatch", "daemonCatchUp"] as const).map((policy) => ({
        zone,
        policy,
      })),
    ),
  )(
    "agrees with the differential check against Temporal for 0,30 1,2,3 * * * in $zone under $policy",
    ({ zone, policy }) => {
      const runs = cronRuns(
        cron("0,30 1,2,3 * * *"),
        zone,
        between(year.start, year.end),
        policy,
      );

      expect(
        runs.map((run) => [run.instant, run.local, run.classification]),
      ).toEqual(
        oracle([1, 2, 3], [0, 30], zone, policy, year.start, year.end, true),
      );
    },
  );

  it.each(
    battleTestTimeZones.flatMap((zone) =>
      (["crontabMatch", "daemonCatchUp"] as const).map((policy) => ({
        zone,
        policy,
      })),
    ),
  )(
    "treats a wildcard job like crontabMatch in $zone under $policy (*/30 across both 2024 changes)",
    ({ zone, policy }) => {
      const march = {
        start: "2024-03-09T00:00:00Z",
        end: "2024-03-12T00:00:00Z",
      };
      const runs = cronRuns(cron("*/30 * * * *"), zone, march, policy);

      expect(
        runs.map((run) => [run.instant, run.local, run.classification]),
      ).toEqual(
        oracle(
          Array.from({ length: 24 }, (_, hour) => hour),
          [0, 30],
          zone,
          policy,
          march.start,
          march.end,
          false,
        ),
      );
    },
  );

  it("labels every row with classifyLocal's reading and orders rows, for seeded expressions", () => {
    const random = seeded(84);
    const minutes = [[0], [15, 45], [0, 30], [59]] as const;
    const hours = [[0], [1, 2], [2], [3, 23], [12]] as const;
    const policies = ["crontabMatch", "daemonCatchUp"] as const;

    for (let round = 0; round < 40; round += 1) {
      const minuteList = pick(random, minutes);
      const hourList = pick(random, hours);
      const zone = pick(random, battleTestTimeZones);
      const policy = pick(random, policies);
      const text = `${minuteList.join(",")} ${hourList.join(",")} * * *`;
      const runs: CronRun[] = cronRuns(
        cron(text),
        zone,
        between(year.start, year.end),
        policy,
      );

      expect(runs.length, `${text} in ${zone} under ${policy}`).toBeGreaterThan(
        300,
      );

      for (const [index, run] of runs.entries()) {
        expect(
          run.classification,
          `${text} ${zone} ${policy} ${run.local}`,
        ).toBe(classifyLocal(run.local, zone));

        if (index > 0) {
          const before = runs[index - 1]!;
          expect(
            before.instant < run.instant ||
              (before.instant === run.instant && before.local <= run.local),
          ).toBe(true);
        }
      }
    }
  });
});
