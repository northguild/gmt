/** The Board's words, one row per fact kind, against the real library. */
import { loadHoursLib, type HoursLib } from "./hours-lib";
import { boardFacts, type BoardState } from "./opening-hours-board";
import { BOARD_PRESETS, presetBoardState } from "./opening-hours-board-seed";
import { VERDICTS, verdictOf } from "./opening-hours-board-verdict";
import { boardPlates } from "./opening-hours-board-view";

let lib: HoursLib;
beforeAll(async () => {
  lib = await loadHoursLib();
});
const tokyo = (): BoardState =>
  presetBoardState(BOARD_PRESETS.find((p) => p.id === "tokyo-desk")!);
const facts = (over: Partial<BoardState> = {}) =>
  boardFacts(lib, { ...tokyo(), ...over });
const values = (over: Partial<BoardState> = {}) =>
  boardPlates(facts(over), "Asia/Tokyo").map((row) => row.map((p) => p.value));

describe("verdictOf", () => {
  it("refused is the only sentinel", () => {
    const state = tokyo();
    state.editor.timeZone = "";
    expect(verdictOf(boardFacts(lib, state))).toBe(VERDICTS.refused);
    expect(verdictOf(facts())).toBe(VERDICTS.open);
    expect(verdictOf(facts({ weekOf: "", from: "" }))).toBe(VERDICTS.noWeek);
    const closed = tokyo();
    closed.editor.weekdays = [[], [], [], [], [], [], []];
    expect(verdictOf(boardFacts(lib, closed))).toBe(VERDICTS.closed);
    expect(VERDICTS.closed.tone).toBe("neutral");
  });
});

describe("boardPlates", () => {
  it("reads nothing before a reading", () => {
    expect(
      boardPlates(null, "Asia/Tokyo").map((r) => r.map((p) => p.value)),
    ).toEqual([
      [null, null, null],
      [null, null],
    ]);
  });

  it("a refused schedule says so on every plate", () => {
    const state = tokyo();
    state.editor.timeZone = "";
    const v = boardPlates(boardFacts(lib, state), "")
      .flat()
      .map((p) => p.value);
    expect(new Set(v)).toEqual(new Set(["Schedule refused"]));
  });

  it("answers from the library for a valid reading", () => {
    expect(
      values({ duration: "PT8H", to: "2024-06-14T18:00:00+09:00" }),
    ).toEqual([
      ["true", "14 Jun 17:30", "14 Jun 18:00"],
      ["PT30M", "17 Jun 16:30"],
    ]);
  });

  it("names a refused From, To, duration and within", () => {
    expect(values({ from: "x" })).toEqual([
      ["From refused", "From refused", "From refused"],
      ["From refused", "From refused"],
    ]);
    expect(values({ to: "2024-06-01T00:00:00+09:00" })[1]![0]).toBe(
      "To refused",
    );
    expect(values({ duration: "x" })[1]![1]).toBe("Duration refused");
    expect(values({ duration: "PT1H", within: "x" })[1]![1]).toBe(
      "Within refused",
    );
    expect(values({ within: "x" })[0]![1]).toBe("Within refused");
  });

  it("a blank From and a blank duration are not asked, and a short horizon is a plain no result", () => {
    expect(values({ from: "" })).toEqual([
      ["not asked", "not asked", "not asked"],
      ["not asked", "not asked"],
    ]);
    expect(values({ duration: "PT8H", within: "PT1H" })[1]![1]).toBeNull();
  });
});
