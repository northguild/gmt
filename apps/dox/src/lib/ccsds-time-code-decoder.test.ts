/**
 * The Decoder's pure logic against the real library. Every figure is a literal value read from a
 * run of the built library; the spec's tables are checked here, not assumed.
 */
import { lib } from "~/test/ccsds-lib";
import {
  CODE_PRESETS,
  CUSTOM_PRESET_ID,
  WRITE_PRESETS,
  cutLineOf,
  isSeeded,
  matchCodePreset,
  matchWritePreset,
  permalinkOf,
  precisionWords,
  presetState,
  readArgs,
  readCode,
  writeInstant,
} from "./ccsds-time-code-decoder";
import {
  REASON_CASE,
  REASON_COARSE,
  REASON_DAY_366,
  REASON_FALSE_60,
} from "./ccsds-picture";

const preset = (id: string) => CODE_PRESETS.find((p) => p.id === id)!.text;

describe("reading each preset", () => {
  it("reads the 2016 leap second as Code B", () => {
    const r = readCode(lib, preset("leap-2016-b"));
    expect(r.which).toBe("B");
    expect(r.instant).toBe("2016-12-31T23:59:60.5Z");
    expect(r.secondSixty).toBe(true);
    expect(r.dayCaption).toBe("day 366 = 31 December");
  });

  it("reads Code A at six digits", () => {
    const r = readCode(lib, preset("code-a"));
    expect(r.which).toBe("A");
    expect(r.digits).toBe(6);
    expect(r.secondSixty).toBe(false);
  });

  it("reads the same instant as Code B", () => {
    const a = readCode(lib, preset("code-a"));
    const b = readCode(lib, preset("code-b"));
    expect(b.which).toBe("B");
    expect(b.instant).toBe(a.instant);
    expect(b.dayCaption).toBe("day 018 = 18 January");
  });

  it("reads a code without Z and says so", () => {
    const r = readCode(lib, preset("no-z"));
    expect(r.which).toBe("B");
    expect(r.zSent).toBe(false);
    expect(readCode(lib, preset("code-a")).zSent).toBe(true);
  });

  it("keeps nine digits and drops three", () => {
    const r = readCode(lib, preset("twelve-digits"));
    expect(r.digits).toBe(9);
    expect(r.dropped).toBe(3);
  });

  it.each([
    ["false-60", REASON_FALSE_60],
    ["day-366-common", REASON_DAY_366],
    ["minutes-only", REASON_COARSE],
    ["lower-case", REASON_CASE],
  ])("refuses %s with its reason", (id, reason) => {
    const r = readCode(lib, preset(id));
    expect(r.kind).toBe("refused");
    expect(r.reason).toBe(reason);
    expect(r.calls).toHaveLength(2);
    expect(r.calls.map((c) => c.result)).toEqual(["", ""]);
  });

  it("drops no digits for any other preset", () => {
    for (const p of CODE_PRESETS) {
      expect(readCode(lib, p.text).dropped).toBe(
        p.id === "twelve-digits" ? 3 : 0,
      );
    }
  });

  it("makes no call for an empty box", () => {
    const r = readCode(lib, "");
    expect(r.kind).toBe("empty");
    expect(r.calls).toEqual([]);
  });

  it("passes the text exactly as typed", () => {
    const r = readCode(lib, " 2016-366T23:59:60.5Z");
    expect(r.kind).toBe("refused");
    expect(r.calls[0]!.args).toEqual([" 2016-366T23:59:60.5Z"]);
  });

  it("throws when both parsers would read one text", () => {
    const both = {
      ...lib,
      parseCcsdsAsciiA: () => "2024-06-15T00:00:00Z",
      parseCcsdsAsciiB: () => "2024-06-15T00:00:00Z",
    };
    expect(() => readCode(both, "x")).toThrow(/cannot both apply/);
  });
});

describe("writing an instant", () => {
  const write = (id: string) => WRITE_PRESETS.find((p) => p.id === id)!;

  it("cuts the end of a year without carrying", () => {
    const p = write("year-end-cut");
    const w = writeInstant(lib, p.text, p.digits);
    expect(w.b).toBe("2026-365T23:59:59.999Z");
    expect(w.cut?.dropped).toBe("9999");
  });

  it("keeps second 60 when the fraction is cut", () => {
    const p = write("leap-2016");
    const w = writeInstant(lib, p.text, p.digits);
    expect(w.b).toBe("2016-366T23:59:60Z");
    expect(w.a).toBe("2016-12-31T23:59:60Z");
  });

  it("converts an offset to UTC", () => {
    const p = write("offset");
    const w = writeInstant(lib, p.text, p.digits);
    expect(w.a).toBe("2024-06-15T14:30:00.123456789Z");
    expect(w.cut).toBeNull();
  });

  it("refuses a local time", () => {
    const p = write("local-time");
    const w = writeInstant(lib, p.text, p.digits);
    expect(w.kind).toBe("refused");
    expect(w.a).toBe("");
    expect(w.b).toBe("");
  });

  it("prints auto as a call with no second argument", () => {
    const w = writeInstant(lib, "2024-06-15T14:30:00Z", "auto");
    expect(w.calls.map((c) => c.args)).toEqual([
      ["2024-06-15T14:30:00Z"],
      ["2024-06-15T14:30:00Z"],
    ]);
    const n = writeInstant(lib, "2024-06-15T14:30:00Z", 3);
    expect(n.calls[0]!.args).toEqual(["2024-06-15T14:30:00Z", 3]);
  });

  it("makes no call for an empty box", () => {
    expect(writeInstant(lib, "", "auto").kind).toBe("empty");
  });
});

describe("cutLineOf", () => {
  it("is the auto fraction past the cut fraction", () => {
    expect(
      cutLineOf("2024-06-15T14:30:00.123456Z", "2024-06-15T14:30:00.12Z"),
    ).toEqual({
      kept: "2024-06-15T14:30:00.12Z",
      dropped: "3456",
    });
  });

  it("is null when nothing was cut or a code is empty", () => {
    expect(
      cutLineOf("2024-06-15T14:30:00Z", "2024-06-15T14:30:00Z"),
    ).toBeNull();
    expect(cutLineOf("", "x")).toBeNull();
  });
});

describe("words", () => {
  it("names the precision", () => {
    expect(precisionWords(0)).toBe("whole seconds");
    expect(precisionWords(6)).toBe("6 digits (microseconds)");
    expect(precisionWords(1)).toBe("1 digit");
  });
});

describe("presets and the permalink", () => {
  it("matches each preset's own text", () => {
    for (const p of CODE_PRESETS) expect(matchCodePreset(p.text)).toBe(p.id);
    expect(matchCodePreset("x")).toBe(CUSTOM_PRESET_ID);
    for (const p of WRITE_PRESETS) {
      expect(matchWritePreset(p.text, p.digits)).toBe(p.id);
    }
    expect(matchWritePreset(WRITE_PRESETS[0]!.text, 9)).toBe(CUSTOM_PRESET_ID);
  });

  it("writes presets by id and custom text by value", () => {
    expect(permalinkOf(presetState())).toEqual({
      preset: "leap-2016-b",
      writePreset: "year-end-cut",
    });
    expect(permalinkOf({ code: "abc", instant: "", digits: 4 })).toEqual({
      code: "abc",
      instant: "",
      digits: "4",
    });
  });

  it("round-trips every key", () => {
    const state = { code: "abc", instant: "def", digits: 7 as const };
    expect(readArgs(permalinkOf(state))).toEqual(state);
    expect(readArgs({ preset: "no-z", writePreset: "offset" })).toEqual(
      presetState(CODE_PRESETS[3], WRITE_PRESETS[2]),
    );
  });

  it("counts a blank text as a seed", () => {
    expect(isSeeded({ code: "" })).toBe(true);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded(undefined)).toBe(false);
  });
});
