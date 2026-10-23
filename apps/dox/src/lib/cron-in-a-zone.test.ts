import { Temporal } from "@js-temporal/polyfill";
import type { CronLib, CronLibRun } from "./cron-lib";
import {
  CRON_PRESETS,
  LIST_ROWS,
  TOUCHED_ROWS,
  cronView,
  joinLists,
  marksOf,
  permalinkOf,
  presetIdOf,
  readArgs,
  stateOfPreset,
  valuesText,
  yearOf,
} from "./cron-in-a-zone";

const run = (
  instant: string,
  classification: CronLibRun["classification"] = "unique",
): CronLibRun => ({ local: instant.replace("Z", ""), instant, classification });

const EXPR = {
  minute: { values: [30], star: false },
  hour: { values: [1], star: false },
  dayOfMonth: { values: [1, 2, 3], star: true },
  month: { values: [1], star: true },
  dayOfWeek: { values: [1], star: true },
};

function fakeLib(opts: {
  zoneOk?: boolean;
  expr?: unknown;
  transitions?: {
    instant: string;
    offsetBefore: string;
    offsetAfter: string;
  }[];
  runs?: (policy: string) => CronLibRun[];
}) {
  const log: string[] = [];
  const lib: CronLib = {
    isValidTimeZone: (z: string) => {
      log.push("isValidTimeZone");
      void z;
      return opts.zoneOk ?? true;
    },
    parseCronExpression: () => {
      log.push("parseCronExpression");
      return (opts.expr === undefined ? EXPR : opts.expr) as never;
    },
    getDstTransitions: () => {
      log.push("getDstTransitions");
      return opts.transitions ?? [];
    },
    cronRuns: (_e, _z, _w, policy) => {
      log.push(`cronRuns:${policy}`);
      return opts.runs ? opts.runs(policy) : [];
    },
  };
  return { lib, log };
}

const TRANSITION = {
  instant: "2024-03-31T01:00:00Z",
  offsetBefore: "+00:00",
  offsetAfter: "+01:00",
};

describe("readArgs", () => {
  it("defaults to the first preset and never trims the line", () => {
    expect(readArgs({}).line).toBe("30 1 * * *");
    expect(readArgs({ line: " 0 0 * * * " }).line).toBe(" 0 0 * * * ");
  });

  it("keeps an ordinal past the list for the view to explain, and drops a bad one", () => {
    expect(readArgs({ change: "9" }).change).toBe("9");
    expect(readArgs({ change: "x" }).change).toBe("1");
  });

  it("treats a blank after as absent", () => {
    expect(readArgs({ after: "   " }).after).toBe("");
    expect(readArgs({ after: " 2024-01-01T00:00:00Z " }).after).toBe(
      "2024-01-01T00:00:00Z",
    );
  });
});

describe("presets and permalinks", () => {
  it("recognises every preset from its own state", () => {
    for (const p of CRON_PRESETS) {
      expect(presetIdOf(stateOfPreset(p))).toBe(p.id);
    }
    expect(presetIdOf({ ...stateOfPreset(CRON_PRESETS[0]!), line: "x" })).toBe(
      "custom",
    );
  });

  it("writes the year as a number and omits a blank after", () => {
    const p = permalinkOf(stateOfPreset(CRON_PRESETS[0]!));
    expect(p["year"]).toBe(2024);
    expect("after" in p).toBe(false);
    expect(
      permalinkOf(stateOfPreset(CRON_PRESETS.find((x) => x.after)!))["after"],
    ).toBe("2023-12-31T23:00:00Z");
  });

  it("reads only four-digit years", () => {
    expect(yearOf("2024")).toBe(2024);
    expect(yearOf("24")).toBeNull();
    expect(yearOf("2024.5")).toBeNull();
  });
});

describe("valuesText", () => {
  it("writes runs of three or more as a range, and leaves pairs alone", () => {
    expect(valuesText([1, 2, 3, 4])).toBe("1–4");
    expect(valuesText([1, 2])).toBe("1, 2");
    expect(valuesText([0, 5, 6, 7, 20])).toBe("0, 5–7, 20");
  });
});

describe("cronView", () => {
  it("makes no other call for an unknown zone", () => {
    const { lib, log } = fakeLib({ zoneOk: false });
    const v = cronView(lib, readArgs({ zone: "Nope/Nowhere" }));
    expect(v.zoneError).toMatch(/Nope\/Nowhere/);
    expect(log).toEqual(["isValidTimeZone"]);
  });

  it("makes no cronRuns call when the line is refused", () => {
    const { lib, log } = fakeLib({ expr: null, transitions: [TRANSITION] });
    const v = cronView(lib, readArgs({ line: "@reboot" }));
    expect(v.expr).toBeNull();
    expect(v.fields).toBeNull();
    expect(log.some((l) => l.startsWith("cronRuns"))).toBe(false);
  });

  it("shows change 1 with a note when the ordinal is past the list", () => {
    const { lib } = fakeLib({ transitions: [TRANSITION] });
    const v = cronView(lib, readArgs({ change: "5" }));
    expect(v.ordinal).toBe(1);
    expect(v.changeNote).toMatch(/change 5 shows change 1/);
  });

  it("explains a year with no clock change and still lists the runs from 1 January", () => {
    const { lib, log } = fakeLib({ transitions: [] });
    const v = cronView(lib, readArgs({ year: 2024 }));
    expect(v.night).toBeNull();
    expect(v.noChangeNote).toMatch(/2024/);
    expect(v.afterUsed).toBe("2024-01-01T00:00:00Z");
    expect(log.filter((l) => l.startsWith("cronRuns"))).toHaveLength(2);
  });

  it("refuses an after that is not an instant", () => {
    const { lib } = fakeLib({ transitions: [TRANSITION] });
    const v = cronView(lib, readArgs({ after: "tomorrow" }));
    expect(v.afterError).toMatch(/tomorrow/);
    expect(v.lists).toBeNull();
  });

  it("keeps the touched rows to the reserved count and counts the rest", () => {
    const many = Array.from({ length: TOUCHED_ROWS + 3 }, (_, i) =>
      run(`2024-03-31T01:${String(i).padStart(2, "0")}:00Z`, "ambiguous"),
    );
    const { lib } = fakeLib({
      transitions: [TRANSITION],
      runs: (p) => (p === "crontabMatch" ? many : []),
    });
    const lane = cronView(lib, readArgs({})).night!.lanes[0];
    expect(lane.touched).toHaveLength(TOUCHED_ROWS);
    expect(lane.more).toBe(3);
  });

  it("prints the isValidTimeZone call first", () => {
    const { lib } = fakeLib({ transitions: [TRANSITION] });
    expect(cronView(lib, readArgs({})).calls[0]!.fn).toBe("isValidTimeZone");
  });
});

describe("marksOf and joinLists", () => {
  it("stacks two runs at one instant as one mark counted twice", () => {
    const start = Temporal.Instant.from(
      "2024-03-30T22:00:00Z",
    ).epochMilliseconds;
    const marks = marksOf(
      [run("2024-03-31T01:00:00Z"), run("2024-03-31T01:00:00Z")],
      start,
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]!.count).toBe(2);
    expect(marks[0]!.pct).toBeCloseTo(50);
  });

  it("joins by instant, not by index", () => {
    const a = [run("2024-01-01T00:00:00Z"), run("2024-01-08T00:00:00Z")];
    const b = [run("2024-01-08T00:00:00Z")];
    const [x, y] = joinLists(a, b, LIST_ROWS);
    expect(x.map((r) => r.only)).toEqual(["crontabMatch", null]);
    expect(y.map((r) => r.only)).toEqual([null]);
  });

  it("says nothing about absence past the end of a full list", () => {
    const own = [run("2024-01-01T00:00:00Z"), run("2024-01-02T00:00:00Z")];
    const other = [run("2024-01-01T00:00:00Z")];
    const [x] = joinLists(own, other, 1);
    expect(x.map((r) => r.only)).toEqual([null, null]);
  });
});
