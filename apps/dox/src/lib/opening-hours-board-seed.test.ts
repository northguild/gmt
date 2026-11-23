import { BOARD_PRESETS } from "~/data/operating-schedule-presets";
import {
  BLANK_EDITOR,
  isSeeded,
  matchBoardPreset,
  permalinkOf,
  presetBoardState,
  readBoardArgs,
  CUSTOM_PRESET_ID,
} from "./opening-hours-board-seed";

const tokyo = BOARD_PRESETS.find((p) => p.id === "tokyo-desk")!;

describe("readBoardArgs", () => {
  it("opens on the first preset when nothing is named", () => {
    expect(isSeeded({})).toBe(false);
    const { state, unfit } = readBoardArgs({});
    expect(state).toEqual(presetBoardState(BOARD_PRESETS[0]!));
    expect(unfit).toBe(false);
  });

  it("takes a preset's own instants and lets the args override them", () => {
    const { state } = readBoardArgs({
      preset: "tokyo-desk",
      from: "2024-06-14T17:30:00+09:00",
      duration: "PT8H",
    });
    expect(state.from).toBe("2024-06-14T17:30:00+09:00");
    expect(state.duration).toBe("PT8H");
    expect(state.editor.timeZone).toBe("Asia/Tokyo");
  });

  it("does not default the instants of a schedule the reader typed", () => {
    const { state, unfit } = readBoardArgs({ schedule: tokyo.text });
    expect(unfit).toBe(false);
    expect(state.from).toBe("");
    expect(state.to).toBe("");
    expect(state.weekOf).toBe("");
    expect(state.editor.timeZone).toBe("Asia/Tokyo");
  });

  it("marks text the editor cannot hold as unfit and blanks the editor", () => {
    for (const schedule of ["not json", '{"timeZone":"UTC","extra":1}']) {
      const { state, unfit } = readBoardArgs({ schedule });
      expect(unfit).toBe(true);
      expect(state.editor).toEqual(BLANK_EDITOR);
    }
  });
});

describe("permalinkOf", () => {
  it("carries what is typed and nothing for an empty box", () => {
    const state = presetBoardState(tokyo);
    const out = permalinkOf({ ...state, duration: "", within: "" }, "{}");
    expect(out["schedule"]).toBe("{}");
    expect(out).not.toHaveProperty("duration");
    expect(out).not.toHaveProperty("within");
  });
});

describe("matchBoardPreset", () => {
  it("names the preset whose fields these are, and custom otherwise", () => {
    for (const p of BOARD_PRESETS) {
      expect(matchBoardPreset(presetBoardState(p).editor)).toBe(p.id);
    }
    const edited = presetBoardState(tokyo).editor;
    expect(matchBoardPreset({ ...edited, timeZone: "Asia/Seoul" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });
});
