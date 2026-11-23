/** The Board's facts against the real library: one row per kind, and every preset. */
import { Temporal } from "@js-temporal/polyfill";
import { toEpochMs } from "./dwell-ledger";
import { loadHoursLib, type HoursLib } from "./hours-lib";
import {
  barLabel,
  barsOf,
  boardFacts,
  gatePlace,
  localText,
  weekCanvas,
  type BoardState,
} from "./opening-hours-board";
import {
  BOARD_PRESETS,
  permalinkOf,
  presetBoardState,
} from "./opening-hours-board-seed";
import { editorFromSchedule } from "./opening-hours-editor";
import { OPERATING_SCHEDULE_PRESETS } from "~/data/operating-schedule-presets";

let lib: HoursLib;
beforeAll(async () => {
  lib = await loadHoursLib();
});

const tokyo = () =>
  presetBoardState(BOARD_PRESETS.find((p) => p.id === "tokyo-desk")!);
const run = (over: Partial<BoardState> = {}) =>
  boardFacts(lib, { ...tokyo(), ...over });
const reading = (over: Partial<BoardState> = {}) => {
  const f = run(over);
  if (f.kind !== "accepted") throw new Error("expected an accepted schedule");
  return f.reading;
};
const fns = (f: ReturnType<typeof run>) => f.calls.map((c) => c.fn);

describe("every Board preset", () => {
  const refused = new Map([
    [
      "kolkata-annotated-holiday",
      { kind: "parts-refused", parts: ["holidays[0]"] },
    ],
    ["sao-paulo-two-overrides", { kind: "refused-together" }],
  ]);
  it.each(BOARD_PRESETS.map((p) => [p.id, p] as const))(
    "%s fits the editor and the library answers",
    (id, p) => {
      expect(editorFromSchedule(JSON.parse(p.text)).kind).toBe("fits");
      const f = boardFacts(lib, presetBoardState(p));
      if (refused.has(id)) {
        expect(f.kind).toBe("refused");
        if (f.kind === "refused") expect(f.probe).toEqual(refused.get(id));
      } else {
        expect(f.kind).toBe("accepted");
        if (f.kind === "accepted") {
          expect(f.week).not.toBeNull();
          expect(f.reading.kind).toBe("read");
        }
      }
    },
  );

  it("leaves out only the preset the editor cannot hold", () => {
    const left = OPERATING_SCHEDULE_PRESETS.filter(
      (p) => !BOARD_PRESETS.includes(p as never),
    );
    expect(left.map((p) => p.id)).toEqual(["london-weekday-8"]);
  });
});

describe("one row per BoardFacts kind", () => {
  it("refused: a window the library refuses names its part and asks nothing else", () => {
    const state = tokyo();
    state.editor.weekdays[0] = [{ from: "9am", to: "18:00" }];
    const f = boardFacts(lib, state);
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") {
      expect(f.probe).toEqual({
        kind: "parts-refused",
        parts: ['weekly["1"][0]'],
      });
    }
    expect(fns(f)).toEqual(["isValidOperatingSchedule"]);
  });

  it("refused: a blank zone is refused by the library", () => {
    const f = run({ editor: { ...tokyo().editor, timeZone: "" } });
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") expect(f.probe.kind).toBe("zone-refused");
  });

  it("accepted: draws one bar per open interval of the week", () => {
    const f = run();
    expect(f.kind).toBe("accepted");
    if (f.kind !== "accepted") return;
    expect(f.intervals).toHaveLength(5);
    expect(fns(f).slice(0, 2)).toEqual([
      "isValidOperatingSchedule",
      "operatingIntervals",
    ]);
    const bars = barsOf(f.intervals, "Asia/Tokyo", f.week!);
    expect(bars).toHaveLength(5);
    expect(bars[0]!.label).toBe("Open Mon 10 Jun 09:00 to 18:00 local");
  });
});

describe("one row per Reading kind", () => {
  it("blank: From empty makes no reading call", () => {
    const f = run({ from: "", weekOf: "2024-06-10" });
    expect(f.kind === "accepted" && f.reading).toEqual({ kind: "blank" });
    expect(fns(f)).toEqual(["isValidOperatingSchedule", "operatingIntervals"]);
  });

  it("from-refused: the library's own check says so", () => {
    const f = run({ from: "tomorrow" });
    expect(f.kind === "accepted" && f.reading).toEqual({
      kind: "from-refused",
    });
    expect(fns(f)).toContain("isValidInterval");
    expect(fns(f)).not.toContain("isOpenAt");
  });

  it("read: a Friday evening is closed, and the next opening is Monday", () => {
    const r = reading();
    expect(r).toMatchObject({ kind: "read", openAtFrom: true });
    const closed = reading({ from: "2024-06-14T18:30:00+09:00" });
    expect(closed).toMatchObject({ kind: "read", openAtFrom: false });
    if (closed.kind === "read") {
      expect(closed.nextOpen).toEqual({
        kind: "at",
        instant: "2024-06-16T23:59:00Z"
          .replace("23:59", "00:00")
          .replace("06-16", "06-17"),
      });
    }
  });
});

describe("one row per Between kind", () => {
  it("blank, refused and value", () => {
    const between = (to: string) => {
      const r = reading({ to });
      return r.kind === "read" ? r.between : null;
    };
    expect(between("")).toEqual({ kind: "blank" });
    expect(between("2024-06-14T00:00:00+09:00")).toEqual({ kind: "refused" });
    expect(between("2024-06-14T18:00:00+09:00")).toEqual({
      kind: "value",
      duration: "PT30M",
    });
  });
});

describe("one row per Deadline kind", () => {
  const deadline = (over: Partial<BoardState>) => {
    const r = reading({ from: "2024-06-14T17:30:00+09:00", ...over });
    return r.kind === "read" ? r.deadline : null;
  };
  it("blank", () =>
    expect(deadline({ duration: "" })).toEqual({ kind: "blank" }));
  it("duration-refused", () =>
    expect(deadline({ duration: "8 hours" })).toEqual({
      kind: "duration-refused",
    }));
  it("within-refused", () =>
    expect(deadline({ duration: "PT8H", within: "soon" })).toEqual({
      kind: "within-refused",
    }));
  it("at: eight open hours from Friday 17:30 land on Monday", () => {
    const d = deadline({ duration: "PT8H" });
    expect(d).toMatchObject({ kind: "at" });
    if (d?.kind === "at")
      expect(localText(d.instant, "Asia/Tokyo")).toBe("17 Jun 16:30");
  });
  it("none: a horizon too short for the duration is a result of its own, not a refusal", () => {
    expect(deadline({ duration: "PT8H", within: "PT1H" })).toEqual({
      kind: "none",
    });
  });
});

describe("the options the reader picked are the options passed", () => {
  it("passes none by default and the chosen disambiguation otherwise", () => {
    const calls = (d: BoardState["disambiguation"]) =>
      run({ disambiguation: d, duration: "PT1H" }).calls.find(
        (c) => c.fn === "isOpenAt",
      )!.args;
    expect(calls("")).toHaveLength(2);
    expect(calls("reject")[2]).toEqual({ disambiguation: "reject" });
  });
});

describe("the Sydney night", () => {
  it("is a 167-hour week the handles still snap on a quarter-hour", () => {
    const p = BOARD_PRESETS.find((x) => x.id === "sydney-night-curfew")!;
    const f = boardFacts(lib, presetBoardState(p));
    expect(f.kind).toBe("accepted");
    const week = f.kind === "accepted" ? f.week! : null;
    expect(week).not.toBeNull();
    expect((week!.endMs - week!.startMs) / 3_600_000).toBe(169);
    expect(week!.snapMinutes).toBe(15);
  });
});

describe("the week", () => {
  it("is Monday to Monday, from Week of or else From, and null with neither", () => {
    const monday = (c: ReturnType<typeof weekCanvas>) =>
      Temporal.Instant.fromEpochMilliseconds(c!.startMs)
        .toZonedDateTimeISO("Asia/Tokyo")
        .toPlainDate()
        .toString();
    expect(monday(weekCanvas("Asia/Tokyo", "2024-06-13", ""))).toBe(
      "2024-06-10",
    );
    expect(
      monday(weekCanvas("Asia/Tokyo", "", "2024-06-16T10:00:00+09:00")),
    ).toBe("2024-06-10");
    expect(weekCanvas("Asia/Tokyo", "", "")).toBeNull();
    expect(weekCanvas("Nowhere/Land", "2024-06-10", "")).toBeNull();
    expect(weekCanvas("Asia/Tokyo", "not a date", "")).toBeNull();
  });

  it("places a gate inside the week and none outside", () => {
    const week = weekCanvas("Asia/Tokyo", "2024-06-10", "")!;
    expect(gatePlace(week, "2024-06-10T00:00:00Z", "Asia/Tokyo")).toMatchObject(
      { text: "10 Jun 09:00" },
    );
    expect(gatePlace(week, "2024-06-20T00:00:00Z", "Asia/Tokyo")).toBeNull();
    expect(toEpochMs("2024-06-10T00:00:00Z")).toBeGreaterThan(week.startMs);
  });

  it("labels a bar that crosses midnight with both days", () => {
    const a = toEpochMs("2024-06-14T22:00:00+09:00");
    const b = toEpochMs("2024-06-15T06:00:00+09:00");
    expect(barLabel(a, b, "Asia/Tokyo")).toBe(
      "Open Fri 14 Jun 22:00 to Sat 15 Jun 06:00 local",
    );
  });
});

describe("permalinkOf", () => {
  it("keeps what is typed and nothing for an empty box", () => {
    expect(
      permalinkOf({ ...tokyo(), weekOf: "", to: "", from: "x" }, "{}"),
    ).toEqual({
      schedule: "{}",
      from: "x",
    });
  });
});
