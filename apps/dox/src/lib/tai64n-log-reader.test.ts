/**
 * The TAI64N Log Reader's pure logic against the real library, and against a stub whose
 * every return is a marked string, so a value the widget computed itself would show. The
 * figures in the preset table are literal values read from a run of the built library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fromTai64n, toTAI, toTai64n } from "@northguild/gmt/timescale/convert";
import { taiMinusUtc } from "@northguild/gmt/timescale/calculate";
import { isLeapSecond } from "@northguild/gmt/timescale/validate";
import {
  LOG_MAX_CHARS,
  LOG_MAX_LINES,
  TAI64N_PRESETS,
  matchPreset,
  permalinkOf,
  readArgs,
  readLog,
  splitLog,
  writeLabel,
} from "./tai64n-log-reader";
import type { Tai64nLib } from "./tai64n-lib";

const lib = {
  fromTai64n,
  toTai64n,
  toTAI,
  taiMinusUtc,
  isLeapSecond,
} as Tai64nLib;

const presetRows = (id: string) =>
  readLog(
    splitLog(TAI64N_PRESETS.find((p) => p.id === id)!.lines.join("\n")).lines,
    lib,
  );

describe("splitLog", () => {
  it("reads CRLF and skips blank and whitespace-only lines", () => {
    const s = splitLog("a b\r\n\r\n   \t\nc\r\n");
    expect(s.lines.map((l) => l.raw)).toEqual(["a b", "c"]);
    expect(s.dropped).toBe(0);
  });

  it("splits at the first tab as well as the first space", () => {
    const [tab, space] = splitLog("tok\tmessage here\ntok2 message  two").lines;
    expect(tab).toMatchObject({ token: "tok", message: "message here" });
    expect(space).toMatchObject({ token: "tok2", message: "message  two" });
  });

  it("keeps twelve lines, says how many it dropped and cuts each to eighty characters", () => {
    const text = Array.from(
      { length: 15 },
      (_, i) => `l${i} ${"x".repeat(100)}`,
    ).join("\n");
    const s = splitLog(text);
    expect(s.lines).toHaveLength(LOG_MAX_LINES);
    expect(s.lines).toHaveLength(12);
    expect(s.dropped).toBe(3);
    expect(LOG_MAX_CHARS).toBe(80);
    for (const l of s.lines) expect(l.raw).toHaveLength(80);
  });

  it("gives a line that starts with a space an empty token, and trims nothing", () => {
    const [l] = splitLog(" @40000000659200a500000000 x").lines;
    expect(l).toEqual({
      raw: " @40000000659200a500000000 x",
      token: "",
      message: "@40000000659200a500000000 x",
    });
    expect(splitLog("a  b").lines[0]).toMatchObject({
      token: "a",
      message: " b",
    });
  });
});

/** [preset, line, instant, TAI reading, TAI - UTC, inside an inserted second], from the library. */
const READINGS: ReadonlyArray<
  [string, number, string, string, number, boolean]
> = [
  ["today", 1, "2024-01-01T00:00:00Z", "2024-01-01T00:00:37 TAI", 37, false],
  [
    "today",
    2,
    "2024-01-01T00:00:00.123456789Z",
    "2024-01-01T00:00:37.123456789 TAI",
    37,
    false,
  ],
  [
    "today",
    3,
    "2024-01-01T00:00:00.123456789Z",
    "2024-01-01T00:00:37.123456789 TAI",
    37,
    false,
  ],
  [
    "bernstein-1992",
    1,
    "1992-06-02T08:06:43Z",
    "1992-06-02T08:07:09 TAI",
    26,
    false,
  ],
  [
    "daemontools-doc",
    1,
    "1999-08-24T04:03:43.7874925Z",
    "1999-08-24T04:04:15.7874925 TAI",
    32,
    false,
  ],
  [
    "across-2016",
    1,
    "2016-12-31T23:59:59Z",
    "2017-01-01T00:00:35 TAI",
    36,
    false,
  ],
  [
    "across-2016",
    2,
    "2016-12-31T23:59:60Z",
    "2017-01-01T00:00:36 TAI",
    36,
    true,
  ],
  [
    "across-2016",
    3,
    "2017-01-01T00:00:00Z",
    "2017-01-01T00:00:37 TAI",
    37,
    false,
  ],
  [
    "tai64na",
    1,
    "2024-01-01T00:00:00.123456789Z",
    "2024-01-01T00:00:37.123456789 TAI",
    37,
    false,
  ],
  [
    "utc-clock-daemontools",
    1,
    "2023-12-31T23:59:33Z",
    "2024-01-01T00:00:10 TAI",
    37,
    false,
  ],
];

describe("every preset", () => {
  it.each(READINGS)(
    "%s line %i reads as the library reads it",
    (id, n, utc, tai, secs, inserted) => {
      const row = presetRows(id)[n - 1]!;
      expect(row).toMatchObject({
        read: true,
        utc,
        tai,
        seconds: secs,
        inserted,
      });
      // The same values, straight from the library.
      expect(row.utc).toBe(fromTai64n(row.token));
      expect(row.tai).toBe(toTAI(row.utc));
      expect(row.seconds).toBe(taiMinusUtc(row.utc));
      expect(row.inserted).toBe(isLeapSecond(row.utc));
    },
  );

  it("covers every line of every readable preset once", () => {
    const covered = READINGS.map(([id, n]) => `${id}:${n}`);
    const lines = TAI64N_PRESETS.filter((p) => p.id !== "refused").flatMap(
      (p) => p.lines.map((_, i) => `${p.id}:${i + 1}`),
    );
    expect(covered).toEqual(lines);
  });

  it("refuses all three lines of the refused preset", () => {
    const rows = presetRows("refused");
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r).toMatchObject({
        read: false,
        utc: "",
        tai: "",
        seconds: null,
        inserted: false,
      });
    }
  });

  it("recognises each preset by its lines", () => {
    for (const p of TAI64N_PRESETS)
      expect(matchPreset(p.lines.join("\n"))).toBe(p.id);
    expect(matchPreset("something else")).toBe("custom");
  });
});

describe("across the 2016 leap second", () => {
  it("gives 36, 36 and 37 with the badge on the second row only, and no single figure", () => {
    const rows = presetRows("across-2016");
    expect(rows.map((r) => r.seconds)).toEqual([36, 36, 37]);
    expect(rows.map((r) => r.inserted)).toEqual([false, true, false]);
    // Nothing on a row, or exported for the log, is a total or a mean.
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        "calls",
        "inserted",
        "message",
        "n",
        "read",
        "seconds",
        "tai",
        "token",
        "utc",
      ].sort(),
    );
  });
});

describe("every value comes from the library", () => {
  const MARK = (name: string, arg: unknown) => `<${name}:${String(arg)}>`;
  const stub = {
    fromTai64n: (t: string) => MARK("from", t),
    toTai64n: (i: string) => MARK("to", i),
    toTAI: (i: string) => MARK("tai", i),
    taiMinusUtc: () => 7,
    isLeapSecond: () => true,
  } as unknown as Tai64nLib;

  it("draws the marks a stub returns, for a read line", () => {
    const [row] = readLog(splitLog("TOKEN message").lines, stub);
    expect(row).toMatchObject({
      read: true,
      utc: "<from:TOKEN>",
      tai: "<tai:<from:TOKEN>>",
      seconds: 7,
      inserted: true,
    });
    expect(row!.calls.map((c) => c.fn)).toEqual([
      "fromTai64n",
      "toTAI",
      "taiMinusUtc",
      "isLeapSecond",
    ]);
  });

  it("writes the marks a stub returns", () => {
    expect(writeLabel("INSTANT", stub)).toMatchObject({
      label: "<to:INSTANT>",
      back: "<from:<to:INSTANT>>",
    });
  });

  it.each(["tai64n-log-reader.ts", "tai64n-log-reader-mount.ts"])(
    "keeps no label arithmetic or digit table in %s",
    (file) => {
      const source = readFileSync(join(__dirname, file), "utf8");
      expect(source).not.toMatch(/\[0-9a-f/i);
      expect(source).not.toContain("2n ** 62n");
      expect(source).not.toContain("4000000");
    },
  );
});

describe("state", () => {
  it("opens on the first preset when the args name nothing", () => {
    expect(readArgs({}).values).toBe(TAI64N_PRESETS[0]!.lines.join("\n"));
    expect(readArgs({ line: "13" }).line).toBeNull();
    expect(readArgs({ values: "x", line: "12" }).line).toBe(12);
  });

  it("puts the lines as read, the line and the instant in the permalink", () => {
    expect(
      permalinkOf({
        values: "a b\n\nc",
        line: 2,
        instant: "2024-01-01T00:00:00Z",
      }),
    ).toEqual({
      values: "a b\nc",
      line: "2",
      instant: "2024-01-01T00:00:00Z",
    });
  });
});
