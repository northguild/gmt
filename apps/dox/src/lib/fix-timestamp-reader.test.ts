import { realFinanceLib as lib } from "~/test/finance-fixture";
import {
  CUSTOM_PRESET_ID,
  CUT_NOTE,
  PAD_NOTE,
  STAMP_PRESETS,
  WRITE_PRESETS,
  digitsLine,
  isSeeded,
  matchStampPreset,
  matchWritePreset,
  permalinkOf,
  presetState,
  readArgs,
  readStamp,
  writeInstant,
} from "./fix-timestamp-reader";

const stamp = (id: string) => STAMP_PRESETS.find((p) => p.id === id)!.text;
const outs = (text: string) => writeInstant(lib, text).rows.map((r) => r.out);

describe("readStamp", () => {
  it("reads .100 as a millisecond stamp and keeps the digits it sent", () => {
    const r = readStamp(lib, stamp("milliseconds"));
    expect(r.parsed?.precision).toBe("millisecond");
    expect(r.parsed?.instant.endsWith(".100Z")).toBe(true);
    expect(r.belowNanosecond).toBeNull();
    expect(digitsLine(r)).toBe("3 fraction digits sent");
    expect(r.verdict).toEqual({
      tone: "good",
      title: "Read at millisecond",
      detail: "3 digits sent; nothing finer was measured.",
    });
  });

  it("shows the picosecond digits apart from the instant", () => {
    const r = readStamp(lib, stamp("picoseconds"));
    expect(r.parsed?.precision).toBe("picosecond");
    expect(r.belowNanosecond).toBe("012");
    expect(r.parsed?.instant).toBe("2024-06-15T14:30:00.123456789Z");
  });

  it("says no digits were sent for whole seconds, not zero picoseconds", () => {
    const r = readStamp(lib, stamp("whole-seconds"));
    expect(r.belowNanosecond).toBeNull();
    expect(r.digits).toBe(0);
    expect(r.verdict.detail).toBe(
      "No fraction digits sent; nothing finer was measured.",
    );
  });

  it("calls the parser and the validator, which agree", () => {
    for (const p of STAMP_PRESETS) {
      const r = readStamp(lib, p.text);
      expect(r.calls.map((c) => c.fn)).toEqual([
        "parseFixUtcTimestamp",
        "isValidFixUtcTimestamp",
      ]);
      expect(r.calls[1]!.result).toBe(r.calls[0]!.result !== null);
    }
  });

  it("reads a leap second as one UTC inserted", () => {
    for (const id of ["fix-leap-second", "inside-2016"]) {
      const r = readStamp(lib, stamp(id));
      expect(r.parsed?.leapSecond).toBe(true);
      expect(r.verdict.title).toBe("A leap second UTC inserted");
    }
    expect(readStamp(lib, stamp("inside-2016")).parsed?.instant).toBe(
      "2016-12-31T23:59:60.500Z",
    );
  });

  it("gives the leap-second reason for second 60 on an ordinary day", () => {
    const r = readStamp(lib, stamp("second-60-ordinary"));
    expect(r.kind).toBe("refused");
    expect(r.parsed).toBeNull();
    expect(r.verdict).toEqual({
      tone: "bad",
      title: "Refused",
      detail: "Second 60 on a day UTC inserted no second.",
    });
    expect(r.calls[1]!.result).toBe(false);
  });

  it("gives the unnamed-width reason for an eight-digit fraction", () => {
    expect(readStamp(lib, stamp("eight-digits")).verdict.detail).toMatch(
      /^A fraction of 8 digits states no precision FIX names/,
    );
  });

  it("passes the text on untouched: a trailing space is refused, not trimmed", () => {
    const r = readStamp(lib, `${stamp("milliseconds")} `);
    expect(r.kind).toBe("refused");
    expect(r.calls[0]!.args).toEqual([`${stamp("milliseconds")} `]);
  });

  it("makes no call for an empty box, and that is not a lost signal", () => {
    const r = readStamp(lib, "");
    expect(r.kind).toBe("empty");
    expect(r.calls).toEqual([]);
    expect(r.verdict.tone).toBe("neutral");
  });
});

describe("writeInstant", () => {
  it("cuts …59.999600Z to …23:59:59.999 under millisecond and pads 000 under picosecond", () => {
    const w = writeInstant(lib, "2024-12-31T23:59:59.999600Z");
    expect(w.rows.map((r) => r.out)).toEqual([
      "20241231-23:59:59",
      "20241231-23:59:59.999",
      "20241231-23:59:59.999600",
      "20241231-23:59:59.999600000",
      "20241231-23:59:59.999600000000",
    ]);
    expect(w.rows.map((r) => r.note)).toEqual([
      CUT_NOTE,
      CUT_NOTE,
      "",
      "",
      PAD_NOTE,
    ]);
  });

  it("converts an offset to UTC", () => {
    expect(outs(WRITE_PRESETS[1]!.text)[0]).toBe("20240615-14:30:00");
    expect(outs(WRITE_PRESETS[1]!.text)[4]).toBe(
      "20240615-14:30:00.123456789000",
    );
  });

  it("writes second 60 back, so a leap second round-trips", () => {
    expect(outs(WRITE_PRESETS[2]!.text)[1]).toBe("20161231-23:59:60.500");
    const parsed = readStamp(lib, "20161231-23:59:60.500").parsed!;
    expect(outs(parsed.instant)[1]).toBe("20161231-23:59:60.500");
  });

  it("gives the sentinel for a local time", () => {
    const w = writeInstant(lib, WRITE_PRESETS[3]!.text);
    expect(w.kind).toBe("refused");
    expect(w.rows.every((r) => r.out === "" && r.note === "")).toBe(true);
  });

  it("writes nothing for an empty box", () => {
    expect(writeInstant(lib, "")).toEqual({
      kind: "empty",
      text: "",
      rows: [],
    });
  });
});

describe("presets and permalinks", () => {
  it("matches a preset by its exact text and anything else is yours", () => {
    expect(matchStampPreset(stamp("milliseconds"))).toBe("milliseconds");
    expect(matchStampPreset("x")).toBe(CUSTOM_PRESET_ID);
    expect(matchWritePreset(WRITE_PRESETS[0]!.text)).toBe("near-midnight");
  });

  it("round-trips a preset and typed text, blank included", () => {
    expect(permalinkOf(presetState())).toEqual({
      preset: "milliseconds",
      writePreset: "near-midnight",
    });
    const typed = { stamp: "", write: "2024-01-01T00:00:00Z" };
    expect(permalinkOf(typed)).toEqual({ stamp: "", write: typed.write });
    expect(readArgs(permalinkOf(typed))).toEqual(typed);
    expect(readArgs(permalinkOf(presetState()))).toEqual(presetState());
  });

  it("counts a blank stamp as a seed", () => {
    expect(isSeeded({ stamp: "" })).toBe(true);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded(undefined)).toBe(false);
  });
});
