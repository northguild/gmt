import { unexpectedCapitalised } from "~/test/no-proper-names";
import { monthDayLib as lib } from "~/test/month-day-lib";
import { showLeapDayBirthdayInput } from "./dox-tools";
import {
  CUSTOM_PRESET_ID,
  LEAP_PRESETS,
  READS_OPTIONS,
  REASONS,
  ROW_COUNT,
  VERDICT_WORDS,
  buildModel,
  callsSizerText,
  isSeeded,
  longestMonthText,
  matchPreset,
  pastedString,
  permalinkOf,
  presetState,
  readArgs,
  readInput,
  toolHref,
  yearRow,
  type LeapState,
} from "./leap-day-birthday";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

const THIS_YEAR = 2026;
const state = (value: string, year: string, locale = "en"): LeapState => ({
  value,
  year,
  locale,
});

describe("the presets", () => {
  it("every one matches itself, and none leads with en-US", () => {
    for (const p of LEAP_PRESETS) {
      expect(matchPreset(presetState(p, THIS_YEAR), THIS_YEAR)).toBe(p.id);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.locale).not.toBe("en-US");
    }
    expect(LEAP_PRESETS[0]!.locale).toBe("en");
  });

  it("name no place, body or statute", () => {
    const text = LEAP_PRESETS.flatMap((p) => [p.label, p.description])
      .concat(Object.values(REASONS))
      .join("\n");
    const allowed = [
      "February",
      "March",
      "NO",
      "SIGNAL",
      "Thirty",
      "Only",
      "MM",
      "DD",
    ];
    expect(unexpectedCapitalised(text, allowed)).toEqual([]);
  });

  it("cover the five readings the spec names", () => {
    expect(LEAP_PRESETS.map((p) => p.id)).toEqual([
      "leap-day-birth",
      "century",
      "short-form",
      "from-date-time",
      "not-a-day",
    ]);
  });
});

describe("reading the input", () => {
  it("stops at the first reader that answers, and prints each call that ran", () => {
    const month = readInput(lib, "--02-29");
    expect(month.monthDay).toBe("--02-29");
    expect(month.calls).toEqual([
      'isValidMonthDay("--02-29"); // true',
      'parseMonthDay("--02-29"); // "--02-29"',
    ]);
    const date = readInput(lib, "2000-02-29");
    expect(date.monthDay).toBe("--02-29");
    expect(date.calls.at(-1)).toBe(
      'parseMonthDayFromDate("2000-02-29"); // "--02-29"',
    );
    expect(date.calls).toHaveLength(3);
    const dateTime = readInput(lib, "2024-02-29T08:30:00");
    expect(dateTime.monthDay).toBe("--02-29");
    expect(dateTime.calls).toHaveLength(4);
  });

  it("reads MM-DD and writes --MM-DD", () => {
    expect(readInput(lib, "12-25").monthDay).toBe("--12-25");
  });

  it("gives nothing for a day no month has, the basic form and an empty field", () => {
    for (const value of ["--02-30", "--1225", ""]) {
      expect(readInput(lib, value).monthDay, value).toBe("");
      expect(readInput(lib, value).calls, value).toHaveLength(4);
    }
  });
});

describe("the expected values", () => {
  const cases: [
    string,
    number,
    string,
    string,
    string,
    string | null,
    string | null,
  ][] = [
    [
      "--02-29",
      2023,
      "2023-02-28",
      "moved earlier",
      "x",
      "2023-03-01",
      "moved later",
    ],
    ["--02-29", 2024, "2024-02-29", "kept", "2024-02-29", "2024-02-29", "kept"],
    [
      "--02-29",
      2100,
      "2100-02-28",
      "moved earlier",
      "x",
      "2100-03-01",
      "moved later",
    ],
    ["--02-29", 2000, "2000-02-29", "kept", "2000-02-29", "2000-02-29", "kept"],
    ["12-25", 2025, "2025-12-25", "kept", "2025-12-25", "2025-12-25", "kept"],
    [
      "2000-02-29",
      2023,
      "2023-02-28",
      "moved earlier",
      "x",
      "2023-03-01",
      "moved later",
    ],
  ];
  it.each(cases)(
    "%s in %i",
    (value, year, gmt, verdict, pasted, policy, policyVerdict) => {
      const model = buildModel(lib, state(value, String(year)));
      const row = model.rows[0]!;
      expect(row.gmt).toBe(gmt);
      expect(row.verdict).toBe(verdict);
      expect(row.pasted).toBe(pasted === "x" ? null : pasted);
      expect(row.policy).toBe(policy);
      expect(row.policyVerdict).toBe(policyVerdict);
    },
  );

  it("stores the canonical form of every accepted input", () => {
    expect(buildModel(lib, state("12-25", "2025")).stored).toBe("--12-25");
    expect(buildModel(lib, state("2000-02-29", "2023")).stored).toBe("--02-29");
    const dateTime = buildModel(lib, state("2024-02-29T08:30:00", "2024"));
    expect(dateTime.stored).toBe("--02-29");
    expect(dateTime.rows[0]!.gmt).toBe("2024-02-29");
    expect(dateTime.rows[0]!.verdict).toBe("kept");
  });

  it("an invalid input is NO SIGNAL everywhere, with the word no date", () => {
    for (const value of ["--02-30", "--1225", ""]) {
      const model = buildModel(lib, state(value, "2025"));
      expect(model.stored, value).toBeNull();
      expect(model.reads, value).toBeNull();
      expect(model.reason, value).toBe(value === "--02-30" ? "day" : "input");
      expect(model.rows).toHaveLength(ROW_COUNT);
      for (const row of model.rows) {
        expect(row.gmt).toBeNull();
        expect(row.pasted).toBeNull();
        expect(row.policy).toBeNull();
        expect(row.verdict).toBe("no date");
      }
    }
  });

  it("a typed year that is no integer stores the day and gives no date", () => {
    const model = buildModel(lib, state("--12-25", "2024.5"));
    expect(model.stored).toBe("--12-25");
    expect(model.reads).toBe("December 25");
    expect(model.reason).toBe("year");
    for (const row of model.rows) {
      expect(row.year).toBeNull();
      expect(row.gmt).toBeNull();
      expect(row.verdict).toBe("no date");
    }
  });

  it("eight years from 2023 are moved, kept, moved, moved, moved, kept, moved, moved", () => {
    const model = buildModel(lib, state("--02-29", "2023"));
    expect(model.rows.map((r) => r.year)).toEqual([
      2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
    ]);
    expect(
      model.rows.map((r) => (r.verdict === "kept" ? "kept" : "moved")),
    ).toEqual([
      "moved",
      "kept",
      "moved",
      "moved",
      "moved",
      "kept",
      "moved",
      "moved",
    ]);
    expect(model.reason).toBe("moved");
  });

  it("2100 is moved and 2104 is kept", () => {
    const model = buildModel(lib, state("--02-29", "2097"));
    const byYear = new Map(model.rows.map((r) => [r.year, r.verdict]));
    expect(byYear.get(2100)).toBe("moved earlier");
    expect(byYear.get(2104)).toBe("kept");
  });

  it("a day that exists in every year is kept in every row", () => {
    const model = buildModel(lib, state("03-15", "2026", "de-DE"));
    expect(model.rows.every((r) => r.verdict === "kept")).toBe(true);
    expect(model.reason).toBe("kept");
  });

  it("a year past the date range is NO SIGNAL for that row only", () => {
    const row = yearRow(lib, "--12-25", 275761);
    expect(row.gmt).toBeNull();
    expect(row.verdict).toBe("no date");
    expect(yearRow(lib, "--12-25", 275760).gmt).toBeNull();
    expect(yearRow(lib, "--12-25", 275759).gmt).toBe("+275759-12-25");
  });

  it("a year past four digits leaves the policy where the library put the day", () => {
    const row = yearRow(lib, "--12-25", 12345);
    expect(row.gmt).toBe("+012345-12-25".replace("+0", "+0"));
    expect(row.pasted).toBeNull();
    expect(row.policy).toBe(row.gmt);
    expect(row.policyVerdict).toBe("kept");
  });
});

describe("the naive string", () => {
  it("pads 0 to 9999 to four digits and leaves other years as written", () => {
    expect(pastedString("--02-29", 2023)).toBe("2023-02-29");
    expect(pastedString("--02-29", 5)).toBe("0005-02-29");
    expect(pastedString("--02-29", 12345)).toBe("12345-02-29");
    expect(pastedString("--02-29", -1)).toBe("-1-02-29");
  });
});

describe("the plates", () => {
  it("reads December 25 in English", () => {
    expect(lib.formatMonthDay("--12-25", "en", READS_OPTIONS)).toBe(
      "December 25",
    );
    expect(buildModel(lib, state("--12-25", "2025")).reads).toBe("December 25");
  });

  it("reads the Japanese and German forms, whichever CLDR wording the ICU has", () => {
    expect(buildModel(lib, state("--03-15", "2026", "ja-JP")).reads).toBe(
      "3月15日",
    );
    expect(buildModel(lib, state("--03-15", "2026", "de-DE")).reads).toMatch(
      /^15\. März$/u,
    );
  });

  it("a locale the library refuses is NO SIGNAL on that plate only", () => {
    const model = buildModel(lib, state("--12-25", "2025", "not a locale"));
    expect(model.stored).toBe("--12-25");
    expect(model.reads).toBeNull();
    expect(model.rows[0]!.gmt).toBe("2025-12-25");
  });

  it("the longest month text is one of the twelve", () => {
    const longest = longestMonthText(lib, "en");
    expect(longest).toBe("September 28");
    expect(longestMonthText(lib, "not a locale")).toBe("");
  });
});

describe("arguments and the permalink", () => {
  it("round-trip every preset as the preset alone", () => {
    for (const p of LEAP_PRESETS) {
      const s = presetState(p, THIS_YEAR);
      const link = permalinkOf(s, THIS_YEAR);
      expect(link).toEqual({ preset: p.id });
      expect(readArgs(link, THIS_YEAR)).toEqual(s);
    }
  });

  it("round-trip a custom state as three strings", () => {
    const s = state("--06-30", "2031", "fr-FR");
    const link = permalinkOf(s, THIS_YEAR);
    expect(matchPreset(s, THIS_YEAR)).toBe(CUSTOM_PRESET_ID);
    expect(link).toEqual({ value: "--06-30", year: "2031", locale: "fr-FR" });
    expect(readArgs(link, THIS_YEAR)).toEqual(s);
  });

  it("survive the page's own seed filter, even for a year outside 1900 to 2100", () => {
    for (const s of [
      state("--02-29", "2400"),
      state("--02-29", "-12"),
      state("--02-29", "2024.5"),
      state("", "2024"),
    ]) {
      const href = encodeWidgetPermalink("leapday", permalinkOf(s, THIS_YEAR));
      const search = href.slice(href.indexOf("?"));
      expect(readArgs(seedFromLocation("leapday", search), THIS_YEAR)).toEqual(
        s,
      );
    }
  });

  it("takes the chat's integer year and falls back to the first preset", () => {
    const seeded = readArgs({ value: "--02-29", year: 2023 }, THIS_YEAR);
    expect(seeded).toEqual(state("--02-29", "2023"));
    expect(readArgs({}, THIS_YEAR)).toEqual(
      presetState(LEAP_PRESETS[0]!, THIS_YEAR),
    );
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ value: "--02-29" })).toBe(true);
  });

  it("builds a page link that the registry would read back", () => {
    const href = toolHref("--02-29", 2023);
    expect(href).toContain("/tools/leap-day-birthday/");
    expect(href).toContain("w=leapday");
  });

  it("the chat schema takes what the page can send", () => {
    expect(
      showLeapDayBirthdayInput.safeParse({ value: "--02-29", year: 2023 })
        .success,
    ).toBe(true);
    expect(showLeapDayBirthdayInput.safeParse({ value: "" }).success).toBe(
      false,
    );
    expect(
      showLeapDayBirthdayInput.safeParse({ value: "x".repeat(65) }).success,
    ).toBe(false);
  });
});

describe("the printed calls", () => {
  it("print the readers, the locale form and the chosen year's row, in order", () => {
    const model = buildModel(lib, state("--02-29", "2023"));
    expect(model.calls).toEqual([
      'isValidMonthDay("--02-29"); // true',
      'parseMonthDay("--02-29"); // "--02-29"',
      'formatMonthDay("--02-29", "en", { month: "long", day: "numeric" }); // "February 29"',
      'monthDayToDate("--02-29", 2023); // "2023-02-28"',
      'parseMonthDayFromDate("2023-02-28"); // "--02-28"',
      'areMonthDaysEqual("--02-29", "--02-28"); // false',
      'compareMonthDays("--02-28", "--02-29"); // -1',
      'isValidDate("2023-02-29"); // false',
      'addDate("2023-02-28", { days: 1 }); // "2023-03-01"',
      'parseMonthDayFromDate("2023-03-01"); // "--03-01"',
      'areMonthDaysEqual("--02-29", "--03-01"); // false',
      'compareMonthDays("--03-01", "--02-29"); // 1',
    ]);
  });

  it("the sizer holds at least the lines any state prints", () => {
    const widest = callsSizerText().split("\n").length;
    const states = [
      ...LEAP_PRESETS.map((p) => presetState(p, THIS_YEAR)),
      state("--02-29", "2023"),
      state("--02-29", "-271821"),
      state("--12-25", "2024.5"),
      state("", "2025"),
      state("2024-02-29T08:30:00", "2023"),
    ];
    for (const s of states) {
      expect(
        buildModel(lib, s).calls.length,
        s.value + s.year,
      ).toBeLessThanOrEqual(widest);
    }
  });
});

describe("the words", () => {
  it("every verdict a row can carry has a sizer word", () => {
    const seen = new Set<string>();
    for (const s of [
      state("--02-29", "2023"),
      state("--02-30", "2023"),
      state("--12-25", "2025"),
    ]) {
      for (const row of buildModel(lib, s).rows) {
        seen.add(row.verdict);
        if (row.policyVerdict) seen.add(row.policyVerdict);
      }
    }
    for (const word of seen) expect(VERDICT_WORDS).toContain(word);
  });
});
