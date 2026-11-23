/** The chat tool for the Operating Schedule Checker words a non-object schedule as the page does. */
import { def } from "./tools/operating-schedule-checker";

describe("check_operating_schedule", () => {
  it.each(["null", "7", '"text"', "[]"])(
    "says what a schedule is when it is sent as %s",
    async (schedule) => {
      const out = await def.run(
        { schedule, start: "2026-06-16T09:00", end: "2026-06-16T17:00" },
        new AbortController().signal,
      );
      expect(out.notes).toContain(
        "A schedule is an object with a `timeZone` and a `weekly`.",
      );
      expect(out.notes.join(" ")).not.toMatch(/accepted on its own/);
    },
  );
});
