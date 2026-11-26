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
  it("shows a call that fits on one line", () => {
    expect(callText("addDate", ["2024-01-31", { months: 1 }])).toBe(
      'addDate("2024-01-31", { months: 1 })',
    );
  });

  it("keeps a wide call's head and opens its last object there, one entry a line, as Prettier does", () => {
    expect(
      callText("diffDateAsDuration", [
        "2000-01-01",
        "2001-01-01",
        "years",
        { smallestUnit: "months", roundingMode: "halfExpand" },
      ]),
    ).toBe(
      [
        'diffDateAsDuration("2000-01-01", "2001-01-01", "years", {',
        '  smallestUnit: "months",',
        '  roundingMode: "halfExpand"',
        "})",
      ].join("\n"),
    );
    expect(
      callText("resolveLocal", [
        "2027-03-28T03:30:00",
        "Europe/Helsinki",
        { disambiguation: "reject" },
      ]),
    ).toBe(
      [
        'resolveLocal("2027-03-28T03:30:00", "Europe/Helsinki", {',
        '  disambiguation: "reject"',
        "})",
      ].join("\n"),
    );
  });

  it("opens a first object in place when the arguments after it are plain, so the slide keeps its height", () => {
    const rule = {
      name: "Spring Festival",
      kind: "calendarFixed",
      calendar: "chinese",
      monthCode: "M01",
      day: 1,
    };
    expect(callText("holidayDates", [rule, 2027])).toBe(
      [
        "holidayDates({",
        '  name: "Spring Festival",',
        '  kind: "calendarFixed",',
        '  calendar: "chinese",',
        '  monthCode: "M01",',
        "  day: 1",
        "}, 2027)",
      ].join("\n"),
    );
  });

  it("puts each argument on a line of its own when no object can open in place, and opens one too wide for its line", () => {
    const wide = { name: "Spring Festival", kind: "calendarFixed", day: 1 };
    expect(callText("f", ["x", wide, 2027])).toBe(
      [
        "f(",
        '  "x",',
        '  { name: "Spring Festival", kind: "calendarFixed", day: 1 },',
        "  2027",
        ")",
      ].join("\n"),
    );
  });

  it("keeps a nested object or array whole while it fits its line, and never splits a string", () => {
    const text = callText("f", [
      { a: "x, y", nested: { deep: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
      ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "cccccccccccccccccccccccccccccc"],
    ]);
    expect(text).toBe(
      [
        "f(",
        "  {",
        '    a: "x, y",',
        '    nested: { deep: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }',
        "  },",
        "  [",
        '    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",',
        '    "cccccccccccccccccccccccccccccc"',
        "  ]",
        ")",
      ].join("\n"),
    );
    for (const line of text.split("\n"))
      expect(line.length).toBeLessThanOrEqual(66);
  });
});

describe("importText", () => {
  const call = (module: string, name: string) => ({ module, name, args: [] });

  it("imports every function once from the package root, in the order the calls use them", () => {
    expect(
      importText([
        call("instant/convert", "resolveLocal"),
        call("utc/get", "now"),
        call("instant/convert", "resolveLocal"),
      ]),
    ).toBe('import { resolveLocal, now } from "@northguild/gmt";');
  });

  it("puts the from on a line of its own when the import is wide", () => {
    expect(
      importText([
        call("plain/format", "formatDateToParts"),
        call("plain/calculate", "diffDateAsDuration"),
        call("instant/convert", "classifyLocal"),
      ]),
    ).toBe(
      [
        "import { formatDateToParts, diffDateAsDuration, classifyLocal }",
        '  from "@northguild/gmt";',
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
