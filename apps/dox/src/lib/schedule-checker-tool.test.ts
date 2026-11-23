/** The chat tool's schema, docs and starter agree with the presets and the library. */
import { OPERATING_SCHEDULE_PRESETS } from "~/data/operating-schedule-presets";
import { CHAT_STARTERS } from "./chat-constants";
import {
  DOX_TOOL_DOCS,
  operatingScheduleTextSchema,
  showScheduleCheckerInput,
} from "./dox-tool-schemas";
import { SCHEDULE_TEXT_MAX } from "./schedule-text-max";

describe("showScheduleChecker", () => {
  it("takes every preset id the presets file holds, and no other", () => {
    for (const p of OPERATING_SCHEDULE_PRESETS) {
      expect(showScheduleCheckerInput.safeParse({ preset: p.id }).success).toBe(
        true,
      );
    }
    expect(showScheduleCheckerInput.safeParse({ preset: "nope" }).success).toBe(
      false,
    );
  });

  it("needs a schedule or a preset, and caps the text", () => {
    expect(showScheduleCheckerInput.safeParse({}).success).toBe(false);
    expect(showScheduleCheckerInput.safeParse({ schedule: "{}" }).success).toBe(
      true,
    );
    expect(operatingScheduleTextSchema.safeParse("").success).toBe(false);
    expect(
      operatingScheduleTextSchema.safeParse("x".repeat(SCHEDULE_TEXT_MAX + 1))
        .success,
    ).toBe(false);
  });

  it("is told when a schedule returns no hours", () => {
    const doc = DOX_TOOL_DOCS.find((d) => d.name === "showScheduleChecker")!;
    expect(doc.when).toContain("isValidOperatingSchedule");
    expect(doc.when).toContain("operatingIntervals returns []");
  });

  it("has a starter that opens the Kolkata preset", () => {
    const starter = CHAT_STARTERS.find(
      (s) => s.widget === "showScheduleChecker",
    )!;
    expect(starter.args).toEqual({ preset: "kolkata-annotated-holiday" });
  });
});
