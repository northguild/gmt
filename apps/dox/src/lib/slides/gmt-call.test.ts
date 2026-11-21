import {
  callGmt,
  callText,
  codeText,
  gmtSteps,
  importText,
  isSentinel,
} from "./gmt-call";

describe("callGmt", () => {
  it("returns the value gmt computes", async () => {
    expect(
      await callGmt("plain/calculate", "addDate", [
        "2024-01-31",
        { months: 1 },
      ]),
    ).toBe("2024-02-29");
  });

  it("returns the sentinel for a wall time that never happened, when asked to reject it", async () => {
    const value = await callGmt("instant/convert", "resolveLocal", [
      "2027-03-28T03:30:00",
      "Europe/Helsinki",
      { disambiguation: "reject" },
    ]);
    expect(value).toBe("");
    expect(isSentinel(value)).toBe(true);
  });

  it("throws for an unknown module or function", async () => {
    await expect(callGmt("nowhere/none", "addDate", [])).rejects.toThrow(
      /Unknown gmt module/,
    );
    await expect(callGmt("plain/calculate", "noSuchFn", [])).rejects.toThrow(
      /no function/,
    );
    await expect(
      callGmt("plain/calculate", "constructor", []),
    ).rejects.toThrow();
  });
});

describe("isSentinel", () => {
  it("is true for gmt's four invalid values and false for a real answer", () => {
    for (const v of ["", null, false, []]) expect(isSentinel(v)).toBe(true);
    for (const v of ["2024-02-29", 0, true, ["x"]])
      expect(isSentinel(v)).toBe(false);
  });
});

describe("callText", () => {
  it("shows a short call on one line and fills a long one with whole arguments", () => {
    expect(callText("addDate", ["2024-01-31", { months: 1 }])).toBe(
      'addDate("2024-01-31", { months: 1 })',
    );
    expect(
      callText("resolveLocal", [
        "2027-03-28T03:30:00",
        "Europe/Helsinki",
        { disambiguation: "reject" },
      ]),
    ).toBe(
      [
        'resolveLocal("2027-03-28T03:30:00",',
        '  "Europe/Helsinki", { disambiguation: "reject" })',
      ].join("\n"),
    );
    const rule = {
      name: "Spring Festival",
      kind: "calendarFixed",
      calendar: "chinese",
      monthCode: "M01",
      day: 1,
    };
    expect(callText("holidayDates", [rule, 2027])).toBe(
      `holidayDates(${codeText(rule)},\n  2027)`,
    );
  });
});

describe("importText", () => {
  it("imports each module's functions once, in the order the calls use them, its from on a line of its own when wide", () => {
    const call = (module: string, name: string) => ({ module, name, args: [] });
    expect(
      importText([
        call("instant/convert", "resolveLocal"),
        call("instant/convert", "classifyLocal"),
        call("instant/convert", "resolveLocal"),
        call("utc/get", "now"),
      ]),
    ).toBe(
      [
        "import { resolveLocal, classifyLocal }",
        '  from "@northguild/gmt/instant/convert";',
        'import { now } from "@northguild/gmt/utc/get";',
      ].join("\n"),
    );
  });
});

describe("codeText", () => {
  it("prints a value as code, a string quoted", () => {
    expect(codeText("2024-02-29")).toBe('"2024-02-29"');
    expect(codeText("")).toBe('""');
    expect(codeText([])).toBe("[]");
    expect(codeText([{ type: "year", value: "2024" }])).toBe(
      '[ { type: "year", value: "2024" } ]',
    );
  });
});

describe("gmtSteps", () => {
  it("gives each call with the value gmt returned, the sentinel marked lost", async () => {
    expect(
      await gmtSteps([
        {
          module: "plain/calculate",
          name: "addDate",
          args: ["2024-01-31", { months: 1 }],
        },
        {
          module: "instant/convert",
          name: "resolveLocal",
          args: [
            "2027-03-28T03:30:00",
            "Europe/Helsinki",
            { disambiguation: "reject" },
          ],
        },
      ]),
    ).toEqual([
      {
        code: 'addDate("2024-01-31", { months: 1 })',
        out: ['"2024-02-29"'],
        outcome: "right",
      },
      {
        code: callText("resolveLocal", [
          "2027-03-28T03:30:00",
          "Europe/Helsinki",
          { disambiguation: "reject" },
        ]),
        out: ['""'],
        outcome: "lost",
      },
    ]);
  });

  it("holds a value to its want: right when it prints the same, wrong when not, lost for the sentinel", async () => {
    const add = {
      module: "plain/calculate",
      name: "addDate",
      args: ["2024-01-31", { months: 1 }],
    } as const;
    const steps = await gmtSteps([
      { ...add, want: "2024-02-29" },
      { ...add, want: "2024-03-02" },
      {
        module: "instant/convert",
        name: "resolveLocal",
        args: [
          "2027-03-28T03:30:00",
          "Europe/Helsinki",
          { disambiguation: "reject" },
        ],
        want: "2027-03-28T01:30:00Z",
      },
    ]);
    expect(steps.map((s) => [s.outcome, s.want])).toEqual([
      ["right", '"2024-02-29"'],
      ["wrong", '"2024-03-02"'],
      ["lost", '"2027-03-28T01:30:00Z"'],
    ]);
  });
});
