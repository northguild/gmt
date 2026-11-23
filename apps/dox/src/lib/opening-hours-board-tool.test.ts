/** The chat tool's schema, docs and starter agree with the Board's presets. */
import { BOARD_PRESETS } from "~/data/operating-schedule-presets";
import { CHAT_STARTERS } from "./chat-constants";
import { DOX_TOOL_DOCS, showOpeningHoursBoardInput } from "./dox-tool-schemas";

describe("showOpeningHoursBoard", () => {
  it("takes every Board preset id, and no Checker-only one", () => {
    for (const p of BOARD_PRESETS) {
      expect(
        showOpeningHoursBoardInput.safeParse({ preset: p.id }).success,
      ).toBe(true);
    }
    expect(
      showOpeningHoursBoardInput.safeParse({ preset: "london-weekday-8" })
        .success,
    ).toBe(false);
  });

  it("needs a schedule or a preset", () => {
    expect(showOpeningHoursBoardInput.safeParse({}).success).toBe(false);
    expect(
      showOpeningHoursBoardInput.safeParse({ schedule: "{}" }).success,
    ).toBe(true);
  });

  it("is told when to be called, and its starter opens the Tokyo desk", () => {
    const doc = DOX_TOOL_DOCS.find((d) => d.name === "showOpeningHoursBoard")!;
    expect(doc.when).toContain("operatingTimeBetween");
    const starter = CHAT_STARTERS.find(
      (s) => s.widget === "showOpeningHoursBoard",
    )!;
    expect(starter.args).toMatchObject({ preset: "tokyo-desk" });
    expect(CHAT_STARTERS.indexOf(starter)).toBeGreaterThanOrEqual(5);
  });
});
