/**
 * The GTFS Trip Board's pure half, against the real library in `dist`: the reader's rules and
 * messages, every preset against the values the spec states, the ghost against the library, and
 * the permalink both ways.
 */
import { tripBoardLib as lib } from "~/test/trip-board-lib";
import { convertUtcToZoned } from "@northguild/gmt/utc/convert";
import { showGtfsTripBoardInput } from "./dox-tools";
import {
  AGENCY_ZONE,
  CALLS_SIZER,
  CUSTOM_PRESET_ID,
  GHOST_UTC,
  GHOST_ZONED,
  NOTES,
  NOTHING_TYPED,
  NOTHING_TO_MISREAD,
  NOT_GIVEN,
  NOT_READ,
  PRESETS,
  WIDEST_ZONE,
  computeTrip,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  printRecord,
  readArgs,
  readTrip,
  rowCount,
  type TripState,
} from "./gtfs-trip-board";
import { REASONS } from "./gtfs-service-day-clock";

const preset = (id: string) => {
  const found = PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
};

const run = (id: string) => computeTrip(lib, presetState(preset(id)));
const HEADER = "stop_id,arrival_time,departure_time,stop_timezone";
const board = (...rows: string[]): TripState => ({
  rows: [HEADER, ...rows].join("\n"),
  date: "20260615",
  zone: "Europe/Madrid",
});

describe("the chat tool's preset list", () => {
  it("names exactly the page's presets", () => {
    for (const p of PRESETS) {
      expect(showGtfsTripBoardInput.safeParse({ preset: p.id }).success).toBe(
        true,
      );
    }
    expect(showGtfsTripBoardInput.safeParse({ preset: "far" }).success).toBe(
      false,
    );
  });
});

describe("printRecord", () => {
  it("drops zero hours and writes one minus sign", () => {
    expect(printRecord({ hours: 2, minutes: 10 })).toBe("2 h 10 min");
    expect(printRecord({ hours: 0, minutes: 50 })).toBe("50 min");
    expect(printRecord({ hours: 0, minutes: -40 })).toBe("−40 min");
    expect(printRecord({ hours: -1, minutes: -40 })).toBe("−1 h 40 min");
    expect(printRecord({ hours: 2, minutes: 0 })).toBe("2 h 0 min");
  });
});

describe("the reader", () => {
  it("refuses an empty paste, and a header without rows", () => {
    for (const rows of ["", "\n\n", HEADER]) {
      expect(readTrip(rows)).toEqual({
        kind: "refused",
        blank: true,
        note: "Paste a header line and up to 12 stop_times.txt rows.",
      });
    }
  });

  it("refuses a paste over 2,000 characters", () => {
    const r = readTrip(`${HEADER}\n${"a".repeat(2000)}`);
    expect(r).toMatchObject({ kind: "refused", note: NOTES.tooLong });
    expect(NOTES.tooLong).toBe(
      "The paste is over 2,000 characters. The board reads one trip of up to 12 stops.",
    );
  });

  it("names every missing column", () => {
    expect(readTrip("stop_id\nx")).toMatchObject({
      note: "The header has no `arrival_time`, `departure_time` columns.",
    });
    expect(readTrip("stop_id,arrival_time\nx,1")).toMatchObject({
      note: "The header has no `departure_time` column.",
    });
  });

  it("refuses a column named twice", () => {
    expect(
      readTrip("stop_id,arrival_time,departure_time,stop_id\na,b,c,d"),
    ).toMatchObject({ note: "The header names `stop_id` twice." });
  });

  it("numbers physical lines, skips blank ones and drops one trailing CR", () => {
    const r = readTrip(
      `${HEADER}\r\n\r\na,08:00:00,08:00:00,\r\nb,09:00:00,09:00:00,`,
    );
    expect(r.kind).toBe("rows");
    if (r.kind !== "rows") return;
    expect(r.rows.map((x) => x.line)).toEqual([3, 4]);
    expect(r.rows[0]).toMatchObject({ ok: true, zoneCell: "" });
  });

  it("rejects a row and keeps it in place", () => {
    const long = `x${"y".repeat(150)},08:00:00,08:00:00,`;
    const r = readTrip(
      [
        HEADER,
        long,
        "a,08:00:00",
        'b,"08:00:00",08:00:00,',
        ",08:00:00,08:00:00,",
        "ok,08:00:00,08:00:00,",
      ].join("\n"),
    );
    if (r.kind !== "rows") throw new Error("rows");
    expect(r.rows.map((x) => (x.ok ? "ok" : x.reason))).toEqual([
      "is over 150 characters",
      "has 2 cells; the header has 4",
      "has a quoted field; the board reads unquoted rows only",
      "has no stop_id",
      "ok",
    ]);
  });

  it("reads twelve stops and counts the rest", () => {
    const rows = Array.from(
      { length: 14 },
      (_, i) => `s${i},08:00:00,08:00:00,`,
    );
    const r = readTrip([HEADER, ...rows].join("\n"));
    if (r.kind !== "rows") throw new Error("rows");
    expect(r.rows).toHaveLength(12);
    expect(r.extra).toBe(2);
    expect(rowCount([HEADER, ...rows].join("\n"))).toBe(12);
  });

  it("reads a paste with no stop_timezone column", () => {
    const r = readTrip(
      "stop_id,arrival_time,departure_time\na,08:00:00,08:00:00",
    );
    if (r.kind !== "rows") throw new Error("rows");
    expect(r.rows[0]).toMatchObject({ ok: true, zoneCell: "" });
    expect(r.zoneColumn).toBe(false);
  });

  it("reads a header that starts with a byte order mark", () => {
    const r = readTrip(`﻿${HEADER}\r\na,08:00:00,08:00:00,Europe/Lisbon`);
    if (r.kind !== "rows") throw new Error("rows");
    expect(r.rows[0]).toMatchObject({
      ok: true,
      stopId: "a",
      zoneCell: "Europe/Lisbon",
    });
    expect(r.zoneColumn).toBe(true);
  });

  it("trims the header cells and leaves the data cells as typed", () => {
    const r = readTrip(
      "stop_id, arrival_time ,departure_time,\tstop_timezone\na, 08:00:00,08:00:00,",
    );
    if (r.kind !== "rows") throw new Error("rows");
    expect(r.rows[0]).toMatchObject({ ok: true, arrival: " 08:00:00" });
    expect(r.zoneColumn).toBe(true);
    expect(
      readTrip("stop_id, stop_id,arrival_time,departure_time\na,b,c,d"),
    ).toMatchObject({ note: "The header names `stop_id` twice." });
  });
});

describe("the notes on a read paste", () => {
  it("says why every stop is read in the agency's zone when the column is missing", () => {
    const r = computeTrip(lib, {
      rows: "stop_id,arrival_time,departure_time\na,08:00:00,08:00:00",
      date: "20260615",
      zone: "Europe/Madrid",
    });
    expect(r.notes).toEqual([NOTES.noZoneColumn]);
    expect(r.rows[0]!.wrong.text).toBe(NOTHING_TO_MISREAD);
    expect(run("border").notes).not.toContain(NOTES.noZoneColumn);
  });

  it("sends a time with a stray space to the library, which refuses it", () => {
    const r = computeTrip(lib, board("a, 08:00:00,08:00:00,"));
    expect(r.rows[0]!.arrival.state).toBe("signal");
    expect(r.rows[0]!.calls[0]).toContain(
      'gtfsToInstant("20260615", " 08:00:00"',
    );
    expect(r.rows[0]!.departure.state).toBe("live");
  });
});

describe("the board for a refused paste", () => {
  it("reads nothing typed for an empty box and no call is made", () => {
    const r = computeTrip(lib, {
      rows: "",
      date: "20260615",
      zone: "Europe/Madrid",
    });
    expect(r.rows).toEqual([]);
    expect(r.trip).toEqual({ state: "note", text: NOTHING_TYPED });
  });

  it("reads not read for a paste the board refused", () => {
    const r = computeTrip(lib, {
      rows: "stop_id\nx",
      date: "20260615",
      zone: "Europe/Madrid",
    });
    expect(r.trip).toEqual({ state: "note", text: NOT_READ });
    expect(r.notes[0]).toContain("no `arrival_time`");
  });

  it("makes no call while the date or the zone is empty", () => {
    for (const patch of [{ date: "" }, { zone: "" }]) {
      const r = computeTrip(lib, {
        ...presetState(preset("border")),
        ...patch,
      });
      expect(r.rows).toHaveLength(6);
      expect(r.rows.every((x) => x.calls.length === 0)).toBe(true);
      expect(r.rows[0]!.arrival.text).toBe(NOTHING_TYPED);
      expect(r.trip.text).toBe(NOTHING_TYPED);
    }
  });
});

describe("a stop with an empty time", () => {
  it("is not given, makes no call for it, and says not a timepoint when both are empty", () => {
    const r = computeTrip(
      lib,
      board("a,08:00:00,08:00:00,", "b,,,", "c,,09:00:00,"),
    );
    const [a, b, c] = r.rows;
    expect(b!.arrival.text).toBe(NOT_GIVEN);
    expect(b!.calls).toEqual([]);
    expect(b!.zoneNote).toBe(`${AGENCY_ZONE}, not a timepoint`);
    expect(b!.leg.text).toBe(NOT_GIVEN);
    expect(c!.arrival.text).toBe(NOT_GIVEN);
    expect(c!.calls.every((l) => !l.includes('""'))).toBe(true);
    // The leg runs from the nearest earlier stop that gave a time.
    expect(c!.leg.state).toBe("live");
    expect(c!.leg.text).toBe("1 h 0 min");
    expect(a!.leg.text).toBe("first stop");
  });
});

describe("a refusal", () => {
  it("is NO SIGNAL with the library's reason", () => {
    const r = computeTrip(lib, board("a,25:99:99,08:00:00,"));
    expect(r.rows[0]!.arrival.state).toBe("signal");
    expect(r.notes).toContain(`Line 2, arrival_time: ${REASONS.time}`);
  });

  it("names a stop_timezone the library does not know", () => {
    const r = computeTrip(lib, board("a,08:00:00,08:00:00,Europe/Wien"));
    expect(r.rows[0]!.arrival.state).toBe("signal");
    expect(r.notes).toContain(
      "Line 2: stop_timezone is not an IANA name or an offset.",
    );
    expect(r.rows[0]!.wrong.state).toBe("signal");
  });
});

describe("the ghost", () => {
  it("is the library's reading in the widest zone", () => {
    expect(convertUtcToZoned("2026-03-08T11:00:00Z", WIDEST_ZONE)).toBe(
      GHOST_ZONED,
    );
  });

  it("is wider than every preset's reading", () => {
    for (const p of PRESETS) {
      for (const row of computeTrip(lib, presetState(p)).rows) {
        for (const text of [row.arrival.text, row.wrong.text]) {
          expect(text.length).toBeLessThanOrEqual(GHOST_ZONED.length);
        }
        expect(row.arrival.instant.length).toBeLessThanOrEqual(
          GHOST_UTC.length,
        );
      }
    }
  });
});

/** The stop's platform reading, cut to the clock and offset. */
const clock = (zoned: string) =>
  /T(\d{2}:\d{2})(?::00)?([+-]\d{2})/.exec(zoned)?.slice(1).join(" ");

describe("border", () => {
  const r = run("border");
  it("has the instants and the platform clocks", () => {
    expect(r.rows.map((x) => x.arrival.instant)).toEqual([
      "2026-06-15T06:00:00Z",
      "2026-06-15T08:32:00Z",
      "2026-06-15T09:25:00Z",
      "2026-06-15T09:52:00Z",
      "2026-06-15T11:20:00Z",
      "2026-06-15T12:15:00Z",
    ]);
    expect(r.rows.map((x) => clock(x.arrival.text))).toEqual([
      "08:00 +02",
      "10:32 +02",
      "11:25 +02",
      "10:52 +01",
      "12:20 +01",
      "13:15 +01",
    ]);
  });
  it("has the legs", () => {
    expect(
      r.rows.map((x) => [x.leg.text, x.leg.clocks, x.leg.verdict]),
    ).toEqual([
      ["first stop", "", ""],
      ["2 h 32 min", "2 h 32 min", "clocks agree"],
      ["50 min", "50 min", "clocks agree"],
      ["20 min", "−40 min", "zone change"],
      ["1 h 26 min", "1 h 26 min", "clocks agree"],
      ["53 min", "53 min", "clocks agree"],
    ]);
  });
  it("has the wrong readings", () => {
    expect(r.rows.map((x) => x.wrong.badge?.text ?? x.wrong.text)).toEqual([
      NOTHING_TO_MISREAD,
      NOTHING_TO_MISREAD,
      NOTHING_TO_MISREAD,
      "60 min later",
      "60 min later",
      "60 min later",
    ]);
    expect(r.rows[3]!.wrong.instant).toBe("2026-06-15T10:52:00Z");
    expect(clock(r.rows[3]!.wrong.text)).toBe("11:52 +01");
  });
  it("has the plates", () => {
    expect(r.trip).toEqual({ state: "live", text: "6 h 15 min" });
    expect(r.moved).toEqual({ state: "live", text: "3 of 6 stops" });
    expect(r.firstMoved).toBe(5);
  });
});

describe("night-train", () => {
  const r = run("night-train");
  it("has the instants", () => {
    expect(r.rows.map((x) => x.arrival.instant)).toEqual([
      "2026-10-24T18:13:00Z",
      "2026-10-24T19:28:00Z",
      "2026-10-24T20:43:00Z",
      "2026-10-24T23:10:00Z",
      "2026-10-25T00:25:00Z",
      "2026-10-25T02:40:00Z",
      "2026-10-25T03:50:00Z",
      "2026-10-25T05:20:00Z",
    ]);
  });
  it("shows the clock change in the Goettingen leg", () => {
    const leg = r.rows[5]!.leg;
    expect([leg.text, leg.clocks, leg.verdict]).toEqual([
      "2 h 10 min",
      "1 h 10 min",
      "clock change in leg",
    ]);
    expect(leg.changes).toEqual(["2026-10-25T01:00:00Z"]);
  });
  it("moves nothing", () => {
    expect(r.rows.every((x) => x.wrong.shift === 0)).toBe(true);
    expect(r.rows.every((x) => x.wrong.badge?.text === "same instant")).toBe(
      true,
    );
    expect(r.trip.text).toBe("11 h 7 min");
    expect(r.moved.text).toBe("0 of 8 stops");
  });
  it("has the other legs agree", () => {
    expect(r.rows.map((x) => x.leg.verdict)).toEqual([
      "",
      "clocks agree",
      "clocks agree",
      "clocks agree",
      "clocks agree",
      "clock change in leg",
      "clocks agree",
      "clocks agree",
    ]);
  });
});

describe("andes-june", () => {
  const r = run("andes-june");
  it("has the instants and the plates", () => {
    expect(r.rows.map((x) => x.arrival.instant)).toEqual([
      "2026-06-15T12:00:00Z",
      "2026-06-15T13:20:00Z",
      "2026-06-15T15:30:00Z",
      "2026-06-15T18:10:00Z",
      "2026-06-15T20:00:00Z",
    ]);
    expect(r.trip.text).toBe("8 h 0 min");
    expect(r.moved.text).toBe("3 of 5 stops");
  });
  it("has the border leg and its wrong reading", () => {
    const row = r.rows[2]!;
    expect([row.leg.text, row.leg.clocks, row.leg.verdict]).toEqual([
      "2 h 0 min",
      "3 h 0 min",
      "zone change",
    ]);
    expect(row.wrong.instant).toBe("2026-06-15T14:30:00Z");
    expect(clock(row.wrong.text)).toBe("11:30 -03");
    expect(row.wrong.badge?.text).toBe("60 min earlier");
    expect(
      r.rows.slice(2).every((x) => x.wrong.badge?.text === "60 min earlier"),
    ).toBe(true);
  });
  it("is labelled a coach timetable", () => {
    expect(preset("andes-june").label).toMatch(/coach timetable/);
    expect(preset("andes-january").label).toMatch(/coach timetable/);
  });
});

describe("andes-january", () => {
  const r = run("andes-january");
  it("has the same rows an offset apart", () => {
    expect(r.rows.map((x) => x.arrival.instant)).toEqual([
      "2026-01-15T11:00:00Z",
      "2026-01-15T12:20:00Z",
      "2026-01-15T14:30:00Z",
      "2026-01-15T17:10:00Z",
      "2026-01-15T19:00:00Z",
    ]);
    expect(r.rows.every((x) => clock(x.arrival.text)?.endsWith("-03"))).toBe(
      true,
    );
    expect(r.rows[2]!.leg.text).toBe("2 h 0 min");
    expect(r.rows[2]!.leg.clocks).toBe("2 h 0 min");
    expect(r.rows.slice(1).every((x) => x.leg.verdict === "clocks agree")).toBe(
      true,
    );
    expect(
      r.rows.slice(2).every((x) => x.wrong.badge?.text === "same instant"),
    ).toBe(true);
    expect(r.trip.text).toBe("8 h 0 min");
    expect(r.moved.text).toBe("0 of 5 stops");
  });
});

describe("no-noon", () => {
  const r = run("no-noon");
  it("refuses every cell, every leg and both plates", () => {
    expect(r.rows).toHaveLength(3);
    for (const row of r.rows) {
      expect(row.arrival.state).toBe("signal");
      expect(row.departure.state).toBe("signal");
    }
    expect(r.rows.slice(1).every((x) => x.leg.state === "signal")).toBe(true);
    expect(r.trip.state).toBe("signal");
    expect(r.moved.state).toBe("signal");
    expect(r.notes.every((n) => n.endsWith(REASONS.nonexistent))).toBe(true);
    expect(r.notes).toHaveLength(6);
  });
});

describe("the calls", () => {
  it("print as call and result", () => {
    const calls = run("border").rows[3]!.calls;
    expect(calls[0]).toBe(
      'gtfsToInstant("20260615", "11:52:00", "Europe/Madrid"); // "2026-06-15T09:52:00Z"',
    );
    expect(calls).toContain(
      'diffUtc("2026-06-15T09:52:00Z", "2026-06-15T10:52:00Z", "minutes"); // 60',
    );
  });

  it("are sized for the most a stop prints", () => {
    for (const p of PRESETS) {
      for (const row of computeTrip(lib, presetState(p)).rows) {
        expect(row.calls.length).toBeLessThanOrEqual(CALLS_SIZER.lines);
        for (const line of row.calls) {
          expect(line.length).toBeLessThanOrEqual(CALLS_SIZER.widest.length);
        }
      }
    }
  });
});

describe("presets, seeds and the permalink", () => {
  it("has five presets with distinct ids", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "border",
      "night-train",
      "andes-june",
      "andes-january",
      "no-noon",
    ]);
  });

  it("matches a preset by its three boxes", () => {
    for (const p of PRESETS) expect(matchPreset(presetState(p))).toBe(p.id);
    expect(matchPreset({ ...presetState(preset("border")), date: "1" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("gives a preset's id alone, else every value", () => {
    expect(permalinkOf(presetState(preset("no-noon")))).toEqual({
      preset: "no-noon",
    });
    const custom = { rows: "", date: "", zone: "" };
    expect(permalinkOf(custom)).toEqual({ stopTimes: "", date: "", zone: "" });
  });

  it("reads a seed: the preset, then any text over it", () => {
    expect(isSeeded(undefined)).toBe(false);
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ stopTimes: "" })).toBe(true);
    expect(readArgs({ preset: "night-train" })).toEqual(
      presetState(preset("night-train")),
    );
    expect(readArgs({ preset: "border", date: "" }).date).toBe("");
    expect(readArgs({ stopTimes: "x" }).rows).toBe("x");
  });
});
