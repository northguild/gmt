import { unexpectedCapitalised } from "~/test/no-proper-names";
import { feastsLib as lib } from "~/test/holiday-lib";
import { showMovingFeastsInput } from "./dox-tools";
import { readArgs as readBuilderArgs } from "./holiday-rule-builder";
import {
  CUSTOM_PRESET_ID,
  FEAST_OFFSETS,
  FEAST_PRESETS,
  GRID_FROM,
  GRID_TO,
  NOTE_NOT_TAKEN,
  builderHandoff,
  builderRules,
  callsSizerText,
  easterCalls,
  easterPlates,
  feastMarks,
  drawableMonths,
  gridMonths,
  matchPreset,
  nthModel,
  nthNoteSizers,
  ORDINAL_VALUES,
  permalinkOf,
  presetState,
  readArgs,
  seriesOf,
  sliderRange,
  undrawnCount,
  yearNote,
  yearOfDate,
  yearTaken,
} from "./moving-feasts";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

const preset = (id: string) => FEAST_PRESETS.find((p) => p.id === id)!;

describe("the presets", () => {
  it("open with the first, and every one matches itself", () => {
    expect(FEAST_PRESETS[0]!.year).toBe(2026);
    for (const p of FEAST_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.label).not.toMatch(/[,;]/u);
    }
  });

  it("name no place or body: every capitalised word is a feast, weekday or month", () => {
    const labels = FEAST_OFFSETS.map((o) => o.label).join("\n");
    const text = [
      labels,
      ...FEAST_PRESETS.flatMap((p) => [p.label, p.description]),
    ].join("\n");
    const words = labels.match(/\p{L}+/gu) ?? [];
    // A plural of a weekday ("Sundays") is the weekday.
    const unexpected = unexpectedCapitalised(text, words).filter(
      (word) =>
        !(
          word.endsWith("s") &&
          unexpectedCapitalised(word.slice(0, -1)).length === 0
        ),
    );
    expect(unexpected).toEqual([]);
  });
});

describe("the Easter plates", () => {
  it("2024: the two Easters are 35 days apart", () => {
    const plates = easterPlates(lib, 2024);
    expect(plates.gregorian).toBe("2024-03-31");
    expect(plates.julian).toBe("2024-05-05");
    expect(plates.apart).toBe("35 days");
    expect(plates.side).toBe("Julian after Gregorian");
  });

  it("2025: the same day, and the library says so", () => {
    const plates = easterPlates(lib, 2025);
    expect(plates.apart).toBe("same day");
    expect(plates.gregorian).toBe(plates.julian);
    expect(plates.side).toBe("");
  });

  it("a year the library does not place is NO SIGNAL, not a date", () => {
    const plates = easterPlates(lib, Number.NaN);
    expect(plates.gregorian).toBeNull();
    expect(plates.julian).toBeNull();
    expect(plates.apart).toBeNull();
  });

  it("every slider-range end places every offset in the drawn months, in both computuses", () => {
    const range = sliderRange(2026);
    for (const year of [range.min, range.max]) {
      const { dates } = feastMarks(
        lib,
        year,
        FEAST_OFFSETS.map((o) => o.offset),
        "both",
      );
      expect(dates.length).toBe(FEAST_OFFSETS.length * seriesOf("both").length);
      const months = gridMonths(dates, year);
      expect(months.outside).toBe(0);
      expect(months.from).toBe(GRID_FROM);
      expect(months.to).toBe(GRID_TO);
    }
  });
});

describe("the marks", () => {
  it("a date both series land on is the crosshatch with both chips", () => {
    const { marks } = feastMarks(lib, 2025, [0], "both");
    const entries = Object.entries(marks);
    expect(entries.length).toBe(1);
    const [, mark] = entries[0]!;
    expect(mark.pick).toBe(3);
    expect(mark.chips).toEqual(["G0", "J0"]);
  });

  it("the Gregorian series is solid and the Julian one hatched", () => {
    const { marks } = feastMarks(lib, 2024, [0], "both");
    const picks = Object.values(marks).map((m) => m.pick);
    expect(picks.sort()).toEqual([1, 2]);
  });
});

describe("the ordinal weekday", () => {
  it("February 2026 has no fifth Friday", () => {
    const p = preset("fifth-friday");
    const m = nthModel(lib, p.year, p.month, p.weekday, p.ordinal);
    expect(m.date).toBe("");
    expect(m.reason).toMatch(/no fifth Friday/u);
    expect(m.occurrences.length).toBeGreaterThan(0);
  });

  it("January 2026 puts the fifth Friday on the 30th, which is also the last", () => {
    const m = nthModel(lib, 2026, 1, 5, "5");
    expect(m.date).toBe("2026-01-30");
    expect(m.marks["2026-01-30"]!.chips).toEqual(["5", "-1"]);
    expect(m.marks["2026-01-30"]!.pick).toBe(1);
    expect(m.reason).toBe("");
  });

  it("derives the occurrences from ten library calls", () => {
    const m = nthModel(lib, 2026, 3, 7, "last");
    const found = new Set(
      [1, 2, 3, 4, 5, -1, -2, -3, -4, -5].map((n) =>
        lib.nthWeekdayOfMonth(2026, 3, 7, n as 1),
      ),
    );
    found.delete("");
    expect(m.occurrences.length).toBe(found.size);
    expect(m.calls.length).toBeGreaterThan(0);
  });
});

describe("arguments and the permalink", () => {
  it("round-trip the state", () => {
    const state = readArgs({
      year: 2024,
      offsets: "-2,0,1",
      computus: "julian",
      month: 1,
      weekday: 5,
      n: -1,
    });
    expect(state.offsets).toEqual([-2, 0, 1]);
    expect(state.computus).toBe("julian");
    expect(state.ordinal).toBe("-1");
    const again = readArgs(permalinkOf(state) as never);
    expect(again).toEqual(state);
    expect(matchPreset(state)).toBe(CUSTOM_PRESET_ID);
  });

  it("drops an offset the page does not offer", () => {
    expect(readArgs({ offsets: "99" }).offsets).toEqual(readArgs({}).offsets);
  });

  it("keeps no offsets through the link", () => {
    expect(readArgs({ offsets: [] }).offsets).toEqual([]);
    const state = { ...presetState(FEAST_PRESETS[0]!), offsets: [] };
    const url = encodeWidgetPermalink("feasts", permalinkOf(state));
    const seeded = seedFromLocation("feasts", url.slice(url.indexOf("?")));
    expect(readArgs(seeded as never)).toEqual(state);
  });

  // The chat schema keeps its own copy of the offsets: it may import only `ai` and `zod`.
  it("lets the chat send exactly the offsets the page offers", () => {
    const offered = FEAST_OFFSETS.map((o) => o.offset);
    expect(showMovingFeastsInput.safeParse({ offsets: offered }).success).toBe(
      true,
    );
    for (const offset of [7, -1, 400]) {
      expect(
        showMovingFeastsInput.safeParse({ offsets: [0, offset] }).success,
        String(offset),
      ).toBe(false);
    }
  });
});

describe("the Builder hand-off", () => {
  it("seeds one rule per toggled offset under the selected computus", () => {
    const state = readArgs({
      year: 2024,
      offsets: "-2,0,1",
      computus: "julian",
    });
    const { href } = builderHandoff(state, true);
    const seeded = seedFromLocation(
      "holidays",
      new URL(href!, "https://example.test").search,
    );
    const builder = readBuilderArgs(seeded as never);
    expect(builder.rows.length).toBe(state.offsets.length);
    for (const row of builder.rows) {
      expect(row.kind).toBe("easterRelative");
      expect(row.julian).toBe(true);
    }
    expect(builder.rows.map((r) => Number(r.offset))).toEqual(state.offsets);
    expect(builder.weekend).toEqual([6, 7]);
    expect(builder.zone).toBe("UTC");
    expect(builder.year).toBe("2024");
  });

  it("is off with a reason when it cannot be sent", () => {
    const base = readArgs({ year: 2024, offsets: "0", computus: "both" });
    expect(builderHandoff(base, false).href).toBeNull();
    expect(builderHandoff({ ...base, offsets: [] }, true).href).toBeNull();
    expect(builderHandoff({ ...base, year: "3000" }, true).href).toBeNull();
    const many = {
      ...base,
      offsets: FEAST_OFFSETS.map((o) => o.offset),
      computus: "both" as const,
    };
    expect(builderRules(many).length).toBe(FEAST_OFFSETS.length * 2);
    const handoff = builderHandoff(many, true);
    expect(handoff.href === null ? handoff.hint.length : 1).toBeGreaterThan(0);
  });
});

describe("years near the ends of what the library takes", () => {
  const note = (year: number) => {
    const plates = easterPlates(lib, year);
    const { dates } = feastMarks(
      lib,
      year,
      FEAST_OFFSETS.map((o) => o.offset),
      "both",
    );
    const months = gridMonths(dates, year);
    const drawn = drawableMonths(year, months);
    return {
      plates,
      dates,
      drawn,
      text: yearNote({
        year: String(year),
        taken: yearTaken(year),
        gregorian: plates.gregorian,
        julian: plates.julian,
        outside: months.outside,
        undrawn: undrawnCount(dates, year, drawn),
      }),
    };
  };

  it("33808 and 33809: a plate in another ISO year is named in the note", () => {
    for (const year of [33808, 33809]) {
      const r = note(year);
      for (const [name, date] of [
        ["Gregorian", r.plates.gregorian],
        ["Julian", r.plates.julian],
      ] as const) {
        if (date !== null && yearOfDate(date) !== year) {
          expect(r.text).toContain(
            `The ${name} Easter of ${year} falls on ${date}`,
          );
        } else {
          expect(r.text).not.toContain(
            `The ${name} Easter of ${year} falls on`,
          );
        }
      }
    }
  });

  it("-271815: the note names the plate whose date leaves the year", () => {
    const r = note(-271815);
    for (const date of [r.plates.gregorian, r.plates.julian]) {
      if (date !== null && yearOfDate(date) !== -271815) {
        expect(r.text).toContain(date);
      }
    }
  });

  it("-271821 is taken: the grid draws what holidayDates returns, and the note does not say the library has nothing", () => {
    const year = -271821;
    expect(yearTaken(year)).toBe(true);
    const r = note(year);
    const returned = r.dates.filter((d) => yearOfDate(d) === year);
    expect(returned.length).toBeGreaterThan(0);
    expect(r.drawn).not.toBeNull();
    for (const d of returned) {
      const month = Number(d.split("-").at(-2));
      expect(month).toBeGreaterThanOrEqual(r.drawn!.from);
      expect(month).toBeLessThanOrEqual(r.drawn!.to);
    }
    expect(
      r.plates.julian === null ? r.text : "easterSunday places no",
    ).toContain("easterSunday places no");
    expect(r.text).not.toContain("NO SIGNAL");
    expect(r.text).toContain("neighbouring years");
  });

  it("-271822 and 275761 are not taken: full NO SIGNAL, no grid months", () => {
    for (const year of [-271822, 275761]) {
      expect(yearTaken(year)).toBe(false);
      const plates = easterPlates(lib, year);
      expect(plates.gregorian).toBeNull();
      expect(plates.julian).toBeNull();
      expect(note(year).text).toBe(NOTE_NOT_TAKEN);
    }
  });
});

describe("the ordinal note's sizers", () => {
  it("hold the longest reason any month, weekday and ordinal can give", () => {
    const sizers = nthNoteSizers();
    const longest = Math.max(...sizers.map((t) => t.length));
    for (let weekday = 1; weekday <= 7; weekday++) {
      for (const ordinal of ORDINAL_VALUES) {
        for (const month of [1, 2, 3]) {
          const m = nthModel(lib, 2026, month, weekday, ordinal);
          if (m.reason === "") continue;
          const text = `NO SIGNAL: ${m.reason}`;
          expect(text.length, text).toBeLessThanOrEqual(longest);
        }
      }
    }
  });
});

describe("the printed calls' sizer", () => {
  it("holds at least the lines and the width of the calls any year prints", () => {
    for (const p of FEAST_PRESETS) {
      const state = presetState(p);
      const sizer = callsSizerText({
        offsets: state.offsets,
        computus: state.computus,
        month: Number(state.month),
        weekday: Number(state.weekday),
        ordinal: state.ordinal,
      }).split("\n");
      const widest = Math.max(...sizer.map((l) => l.length));
      for (let year = 1990; year <= 2060; year++) {
        const lines = [
          ...easterCalls(lib, year),
          ...feastMarks(lib, year, state.offsets, state.computus).calls,
          ...nthModel(
            lib,
            year,
            Number(state.month),
            Number(state.weekday),
            state.ordinal,
          ).calls,
        ];
        expect(lines.length, `${p.id} ${year}`).toBeLessThanOrEqual(
          sizer.length,
        );
        for (const line of lines) {
          expect(line.length, line).toBeLessThanOrEqual(widest);
        }
      }
    }
  });
});
