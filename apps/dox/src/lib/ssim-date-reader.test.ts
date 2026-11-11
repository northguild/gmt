/**
 * The SSIM Date Reader's pure half, against the real library in `dist`: every preset's
 * outputs, a reason for each row of the reason table, the permalink and the chat seed.
 */
import { aviationLib } from "~/test/aviation-lib";
import {
  CUSTOM_PRESET_ID,
  MONTH_COUNT,
  READ_REASONS,
  SSIM_PRESETS,
  WRITE_REASONS,
  blankState,
  buildModel,
  callsSizerText,
  isSeeded,
  matchPreset,
  monthTable,
  optionsOf,
  permalinkOf,
  presetState,
  readArgs,
  readSsim,
  writeSsim,
  type SsimState,
} from "./ssim-date-reader";

const state = (over: Partial<SsimState>): SsimState => ({
  ...blankState(),
  ...over,
});

const preset = (id: string) => {
  const found = SSIM_PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
};

/** What the library and the browser-checked locale data give for each preset. */
const EXPECTED = {
  "french-locale": ["2026-01-01", "read", null, true, "01JAN26", "2026-01-01"],
  "english-locale": ["2026-01-01", "read", "2026-01-01", false, null, null],
  "turkish-locale": ["2026-10-25", "read", null, true, null, null],
  "lower-case": [null, "lowerCase", "2026-01-01", true, null, null],
  "spanish-locale": [null, "shape", "2026-01-01", true, null, null],
  archive: ["2009-12-16", "read", "2009-12-16", false, null, null],
  "leap-2000": ["2000-02-29", "read", "2000-02-29", false, null, null],
  "leap-1900": [null, "noSuchDay", null, false, null, null],
  "no-window": [null, "noWindow", null, false, null, null],
  "write-outside": ["2026-01-01", "read", "2026-01-01", false, null, null],
} as const;

describe("the presets, against the library", () => {
  it.each(Object.entries(EXPECTED))(
    "%s gives its outputs",
    (id, [ssim, reason, pattern, differs, written, back]) => {
      const model = buildModel(aviationLib, presetState(preset(id)));
      expect(model.read.ssim).toBe(ssim);
      expect(model.read.reason).toBe(reason);
      expect(model.read.valid).toBe(ssim !== null);
      expect(model.pattern.date).toBe(pattern);
      expect(model.pattern.differs).toBe(differs);
      expect(model.write.written).toBe(written);
      expect(model.write.back).toBe(back);
    },
  );

  it("the opening preset shows a difference before anything is touched", () => {
    expect(SSIM_PRESETS[0]!.id).toBe("french-locale");
    const model = buildModel(aviationLib, presetState(SSIM_PRESETS[0]!));
    expect(model.read.ssim).toBe("2026-01-01");
    expect(model.pattern.differs).toBe(true);
  });

  it("the write-outside preset is refused for the window, not the calendar", () => {
    const model = buildModel(aviationLib, presetState(preset("write-outside")));
    expect(model.write.written).toBeNull();
    expect(model.write.reason).toBe("outside");
  });

  it("the rolling preset reads the text with a rolling window", () => {
    const options = optionsOf(presetState(preset("rolling")));
    expect(options).toEqual({ yearWindow: "rolling" });
    expect(
      readSsim(aviationLib, presetState(preset("rolling"))).calls[0],
    ).toContain('"rolling"');
  });

  it("no preset uses an out-of-scope form", () => {
    for (const p of SSIM_PRESETS) {
      expect(p.value).not.toMatch(/X/);
      expect(p.value).toMatch(/^\d{2}[A-Za-z]{3}\d{2}$/);
    }
  });

  it("each preset matches itself", () => {
    for (const p of SSIM_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
    }
    expect(matchPreset(state({ value: "x" }))).toBe(CUSTOM_PRESET_ID);
  });
});

describe("the read", () => {
  it("makes no call for an empty field", () => {
    const read = readSsim(aviationLib, blankState());
    expect(read.blank).toBe(true);
    expect(read.calls).toEqual([]);
    expect(read.valid).toBeNull();
  });

  it("never upper-cases the typed text before a call", () => {
    const read = readSsim(
      aviationLib,
      state({ value: "01jan26", first: "2000" }),
    );
    expect(read.calls[0]).toContain('parseSsimDate("01jan26"');
    expect(read.reason).toBe("lowerCase");
  });

  it("a blank window is the library's refusal with its own reason, never a default", () => {
    const read = readSsim(aviationLib, state({ value: "01JAN26" }));
    expect(read.ssim).toBeNull();
    expect(read.reason).toBe("noWindow");
    expect(read.calls[0]).toBe('parseSsimDate("01JAN26", {}); // ""');
  });

  it("a non-integer first year sends no window", () => {
    expect(optionsOf(state({ first: "20x0" }))).toEqual({});
    expect(optionsOf(state({ first: " 2000 " }))).toEqual({ yearWindow: 2000 });
  });

  it("gives a reason for each row of the reason table", () => {
    const seen = new Set<string>();
    const cases: [SsimState, string][] = [
      [blankState(), "empty"],
      [state({ value: "01JAN26" }), "noWindow"],
      [state({ value: "01JAN26", first: "10000" }), "badWindow"],
      [state({ value: "01jan26", first: "2000" }), "lowerCase"],
      [state({ value: "31APR26", first: "2000" }), "noSuchDay"],
      [state({ value: "1JAN26", first: "2000" }), "shape"],
      [state({ value: "01JAN26", first: "2000" }), "read"],
    ];
    for (const [s, key] of cases) {
      const r = readSsim(aviationLib, s);
      expect(r.reason).toBe(key);
      seen.add(r.reason);
    }
    expect([...seen].sort()).toEqual(Object.keys(READ_REASONS).sort());
  });

  // Each reason is decided by hand from the grammar and the window rule (a first year is an
  // integer from 0 to 9900), never read from the probes under test.
  it.each`
    value        | first      | reason         | why
    ${"31APR26"} | ${"2000"}  | ${"noSuchDay"} | ${"April has 30 days"}
    ${"30FEB26"} | ${"2000"}  | ${"noSuchDay"} | ${"February never has 30 days"}
    ${"29FEB25"} | ${"2000"}  | ${"noSuchDay"} | ${"2025 is not a leap year"}
    ${"29FEB00"} | ${"1900"}  | ${"noSuchDay"} | ${"1900 is not a leap year"}
    ${"29FEB00"} | ${"1800"}  | ${"noSuchDay"} | ${"00 reads as 1900 in a window from 1800"}
    ${"30FEB00"} | ${"1900"}  | ${"noSuchDay"} | ${"February never has 30 days"}
    ${"00JAN26"} | ${"2000"}  | ${"noSuchDay"} | ${"there is no day 0"}
    ${"32JAN26"} | ${"2000"}  | ${"noSuchDay"} | ${"January has 31 days"}
    ${"01JAN26"} | ${"10000"} | ${"badWindow"} | ${"a first year above 9900"}
    ${"01JAN26"} | ${"9901"}  | ${"badWindow"} | ${"a first year above 9900"}
    ${"01JAN26"} | ${"-1"}    | ${"badWindow"} | ${"a first year below 0"}
    ${"01JAN00"} | ${"-1"}    | ${"badWindow"} | ${"the window probe's own text"}
    ${"31APR26"} | ${"-1"}    | ${"badWindow"} | ${"the window is named before the day"}
    ${"01jan26"} | ${"10000"} | ${"badWindow"} | ${"the window is named before the case"}
    ${"01jan26"} | ${"2000"}  | ${"lowerCase"} | ${"lower case"}
    ${"31apr26"} | ${"2000"}  | ${"shape"}     | ${"lower case, and upper-cased it names no day"}
    ${"abJAN26"} | ${"2000"}  | ${"shape"}     | ${"no digits of day to swap"}
    ${"01ENE26"} | ${"2000"}  | ${"shape"}     | ${"ENE is not a month code"}
    ${"1JAN26"}  | ${"2000"}  | ${"shape"}     | ${"one digit of day"}
  `(
    "names $reason for '$value' from $first: $why",
    ({ value, first, reason }) => {
      expect(readSsim(aviationLib, state({ value, first })).reason).toBe(
        reason,
      );
    },
  );

  it("prints each probe it runs, and none whose text is the typed text", () => {
    expect(
      readSsim(aviationLib, state({ value: "31APR26", first: "2000" })).calls,
    ).toEqual([
      'parseSsimDate("31APR26", { yearWindow: 2000 }); // ""',
      'isValidSsimDate("31APR26", { yearWindow: 2000 }); // false',
      'parseSsimDate("01JAN00", { yearWindow: 2000 }); // "2000-01-01"',
      'parseSsimDate("01APR26", { yearWindow: 2000 }); // "2026-04-01"',
    ]);
    expect(
      readSsim(aviationLib, state({ value: "01JAN00", first: "-1" })).calls,
    ).toHaveLength(2);
  });

  it("the widest printed read is a path the library can take", () => {
    const widest = callsSizerText("read").split("\n").length;
    const real = readSsim(
      aviationLib,
      state({ value: "31apr26", first: "2000" }),
    );
    expect(real.calls).toHaveLength(widest);
  });

  it("valid is true exactly when the read gives a date", () => {
    for (const p of SSIM_PRESETS) {
      const r = readSsim(aviationLib, presetState(p));
      expect(r.valid).toBe(r.ssim !== null);
    }
  });
});

describe("the pattern and the table", () => {
  it("makes no call while nothing is typed", () => {
    const m = buildModel(aviationLib, blankState());
    expect(m.pattern.date).toBeUndefined();
    expect(m.pattern.calls).toEqual([]);
  });

  it("no SSIM call carries a locale", () => {
    for (const p of SSIM_PRESETS) {
      const m = buildModel(aviationLib, presetState(p));
      for (const call of [...m.read.calls, ...m.write.calls]) {
        if (call.startsWith("parseDateWithPattern")) continue;
        expect(call).not.toContain(p.locale);
      }
      expect(m.pattern.calls.join("")).toContain(`"${p.locale}"`);
    }
  });

  it("the SSIM reading does not move with the locale", () => {
    const base = presetState(preset("french-locale"));
    const first = readSsim(aviationLib, base).ssim;
    for (const locale of ["en", "de-DE", "es-ES", "tr-TR", "ja-JP"]) {
      expect(readSsim(aviationLib, { ...base, locale }).ssim).toBe(first);
    }
  });

  it("the month letters come from the library, one per month", () => {
    const table = monthTable(aviationLib, "en");
    expect(table.rows).toHaveLength(MONTH_COUNT);
    expect(table.rows.map((r) => r.letters)).toEqual([
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ]);
    expect(table.rows[0]!.name).toBe("Jan");
    expect(table.calls.at(-1)).toContain("getLocaleMonthNames");
  });

  it("the letters do not change with the locale, the names do", () => {
    const en = monthTable(aviationLib, "en");
    const es = monthTable(aviationLib, "es-ES");
    expect(es.rows.map((r) => r.letters)).toEqual(
      en.rows.map((r) => r.letters),
    );
    expect(es.rows[0]!.name).not.toBe(en.rows[0]!.name);
    expect(es.widest.length).toBeGreaterThan(0);
  });
});

describe("the write", () => {
  it("makes no call for an empty date", () => {
    const w = writeSsim(aviationLib, blankState());
    expect(w.blank).toBe(true);
    expect(w.calls).toEqual([]);
  });

  it("has a reason for each row of the reason table", () => {
    const outside = writeSsim(
      aviationLib,
      state({ date: "1999-12-31", first: "2000" }),
    );
    const refused = writeSsim(
      aviationLib,
      state({ date: "2026-02-30", first: "2000" }),
    );
    const written = writeSsim(
      aviationLib,
      state({ date: "2026-01-01", first: "2000" }),
    );
    const none = writeSsim(aviationLib, state({ date: "2026-01-01" }));
    expect(outside.reason).toBe("outside");
    expect(refused.reason).toBe("refused");
    expect(written.reason).toBe("written");
    expect(none.reason).toBe("refused");
    expect(blankWrite().reason).toBe("empty");
    expect(
      new Set(
        [outside, refused, written, none, blankWrite()].map((w) => w.reason),
      ),
    ).toEqual(new Set(Object.keys(WRITE_REASONS)));
  });

  it("reads the written date back with the same window", () => {
    const w = writeSsim(
      aviationLib,
      state({ date: "2026-01-01", first: "2000" }),
    );
    expect(w.written).toBe("01JAN26");
    expect(w.back).toBe("2026-01-01");
    expect(w.calls).toHaveLength(2);
  });

  it("with no window says it is refused, not outside", () => {
    const w = writeSsim(aviationLib, state({ date: "2026-01-01" }));
    expect(w.written).toBeNull();
    expect(w.back).toBeNull();
    expect(w.calls).toHaveLength(1);
  });
});

function blankWrite() {
  return writeSsim(aviationLib, blankState());
}

describe("the permalink and the chat seed", () => {
  it("a preset's state links as that preset alone", () => {
    for (const p of SSIM_PRESETS) {
      expect(permalinkOf(presetState(p))).toEqual({ preset: p.id });
    }
  });

  it("a custom state links as four strings and reads back as itself", () => {
    const cases: SsimState[] = [
      state({
        value: "05MAR41",
        first: "1990",
        locale: "de-DE",
        date: "2041-03-05",
      }),
      state({ value: "", first: "", locale: "en", date: "" }),
      state({ value: "05MAR41", mode: "rolling", locale: "en" }),
      state({ value: "05MAR41", first: "", locale: "en" }),
    ];
    for (const s of cases) {
      const link = permalinkOf(s) as Record<string, string>;
      expect(readArgs(link)).toEqual(s);
    }
  });

  it("a cleared value survives the link", () => {
    const s = state({ value: "", first: "2000", locale: "en" });
    const link = permalinkOf(s) as Record<string, string>;
    expect(link.value).toBe("");
    expect(readArgs(link).value).toBe("");
  });

  it("a preset id in a link seeds the preset, and a named field wins", () => {
    expect(readArgs({ preset: "archive" })).toEqual(
      presetState(preset("archive")),
    );
    expect(readArgs({ preset: "archive", value: "01JAN50" }).value).toBe(
      "01JAN50",
    );
    expect(readArgs({ preset: "nope" })).toEqual(blankState());
  });

  it("a chat call with no window opens with the window blank", () => {
    const s = readArgs({ value: "01JAN26", locale: "fr-FR" });
    expect(s.mode).toBe("fixed");
    expect(s.first).toBe("");
    expect(optionsOf(s)).toEqual({});
    expect(buildModel(aviationLib, s).read.reason).toBe("noWindow");
  });

  it("a chat window is read as given, a number or a word", () => {
    expect(readArgs({ window: 2000 }).first).toBe("2000");
    expect(readArgs({ window: "rolling" }).mode).toBe("rolling");
    expect(readArgs({ window: "1950" }).first).toBe("1950");
  });

  it("a blank locale falls back to the default, never to the machine's", () => {
    const fallback = blankState().locale;
    expect(readArgs({ value: "x", locale: "  " }).locale).toBe(fallback);
    expect(fallback).toBe("en");
  });

  it("no args seed nothing", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ date: "" })).toBe(true);
  });
});

describe("the printed calls", () => {
  it("each section's widest text prints every call it can make", () => {
    // The read, the validator, and the window, case and day probes.
    expect(callsSizerText("read").split("\n").length).toBe(5);
    expect(callsSizerText("pattern").split("\n").length).toBe(
      1 + MONTH_COUNT + 1,
    );
    expect(callsSizerText("write").split("\n").length).toBe(2);
  });
});
