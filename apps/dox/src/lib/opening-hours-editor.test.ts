import { describe, expect, it } from "vitest";
import {
  editorFromSchedule,
  holidayLines,
  rowOfPart,
  scheduleFromEditor,
  type EditorState,
} from "./opening-hours-editor";

const state: EditorState = {
  timeZone: "Asia/Tokyo",
  weekdays: [
    [{ from: "09:00", to: "18:00" }],
    [],
    [],
    [],
    [{ from: " 09:00", to: "12:00" }],
    [],
    [],
  ],
  holidays: "2024-06-12\n\n 2024-06-13\r\n",
  overrides: [{ date: "2024-06-14", windows: [] }],
};

describe("scheduleFromEditor", () => {
  it("builds the schedule as typed, leaving out empty parts", () => {
    expect(scheduleFromEditor(state)).toEqual({
      timeZone: "Asia/Tokyo",
      weekly: {
        "1": [{ from: "09:00", to: "18:00" }],
        "5": [{ from: " 09:00", to: "12:00" }],
      },
      holidays: ["2024-06-12", " 2024-06-13"],
      overrides: [{ date: "2024-06-14", windows: [] }],
    });
  });

  it("omits holidays and overrides when there are none", () => {
    expect(
      scheduleFromEditor({ ...state, holidays: "", overrides: [] }),
    ).toEqual({
      timeZone: "Asia/Tokyo",
      weekly: {
        "1": [{ from: "09:00", to: "18:00" }],
        "5": [{ from: " 09:00", to: "12:00" }],
      },
    });
  });
});

describe("holidayLines", () => {
  it("drops only empty lines", () => {
    expect(holidayLines("a\n\n b \r\nc")).toEqual(["a", " b ", "c"]);
  });
});

describe("editorFromSchedule", () => {
  it("round-trips what the editor builds", () => {
    const back = editorFromSchedule(scheduleFromEditor(state));
    expect(back.kind).toBe("fits");
    if (back.kind === "fits") {
      expect(scheduleFromEditor(back.state)).toEqual(scheduleFromEditor(state));
    }
  });

  it("does not fit a weekday key of 8, another field or a non-string", () => {
    const base = { timeZone: "Asia/Tokyo" };
    expect(editorFromSchedule({ ...base, weekly: { "8": [] } }).kind).toBe(
      "does-not-fit",
    );
    expect(editorFromSchedule({ ...base, weekly: {}, extra: 1 }).kind).toBe(
      "does-not-fit",
    );
    expect(editorFromSchedule({ timeZone: 1, weekly: {} }).kind).toBe(
      "does-not-fit",
    );
    expect(editorFromSchedule("x").kind).toBe("does-not-fit");
    expect(
      editorFromSchedule({ ...base, weekly: { "1": [{ from: 9, to: "x" }] } })
        .kind,
    ).toBe("does-not-fit");
  });
});

describe("rowOfPart", () => {
  it("maps the paths the probe names", () => {
    expect(rowOfPart('weekly["1"]')).toEqual({ kind: "weekday", day: 0 });
    expect(rowOfPart('weekly["5"][1]')).toEqual({
      kind: "weekday",
      day: 4,
      window: 1,
    });
    expect(rowOfPart("holidays")).toEqual({ kind: "holidays" });
    expect(rowOfPart("holidays[2]")).toEqual({ kind: "holidays", line: 2 });
    expect(rowOfPart("overrides[0]")).toEqual({ kind: "override", index: 0 });
    expect(rowOfPart('weekly["9"]')).toBeNull();
    expect(rowOfPart("timeZone")).toBeNull();
  });
});
