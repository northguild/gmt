import { runInBoundedChild } from "../test/boundedChild";

/*
 * CORE-112 (D23): V8 without commit 0426b0d1045d aborts the whole process (SIGTRAP, exit 133,
 * nodejs/node#67076) in `formatToParts` and `formatRangeToParts` on a pattern with the week-of-year
 * year field. Each call below reached that abort through a library function before the guard. It
 * runs in a child process, so the failing state is the child crashing, never the Vitest worker.
 * The native abort itself is confirmed by the D23 canary (`scripts/canary/weekYear.mjs`), not here:
 * a test cannot assert an engine defect without failing on the engine that fixed it.
 */
describe("public functions on week-year patterns do not abort the process (D23)", () => {
  it.each`
    expression                                                                                                                           | label
    ${'gmt.formatCalendar("2026-07-01T10:00:00", "gl-u-ca-hebrew", { reference: "2026-07-01T09:00:00" })'}                               | ${"formatCalendar gl hebrew"}
    ${'gmt.formatCalendar("2026-07-01T10:00:00", "gl-u-ca-buddhist", { reference: "2026-07-01T09:00:00" })'}                             | ${"formatCalendar gl buddhist"}
    ${'gmt.formatCalendar("2026-07-01T10:00:00", "gl-u-ca-roc", { reference: "2026-07-01T09:00:00" })'}                                  | ${"formatCalendar gl roc"}
    ${'gmt.formatDateToParts("2024-12-30", "gd", { year: "numeric", month: "short" })'}                                                  | ${"formatDateToParts gd month short"}
    ${'gmt.formatDateToParts("2026-09-12", "gl-u-ca-hebrew", { dateStyle: "full" })'}                                                    | ${"formatDateToParts gl hebrew dateStyle full"}
    ${'gmt.formatDateToParts("2026-07-01", "my-u-ca-japanese", { year: "numeric", month: "numeric", day: "numeric" })'}                  | ${"formatDateToParts my japanese"}
    ${'gmt.formatDateTimeToParts("2024-12-30T14:05:00", "gd", { year: "numeric", month: "short", hour: "numeric", minute: "numeric" })'} | ${"formatDateTimeToParts gd with time"}
    ${'gmt.formatYearMonth("2026-10", "gl", { dateStyle: "full" })'}                                                                     | ${"formatYearMonth gl dateStyle full"}
  `("returns from $label", async ({ expression }) => {
    const run = await runInBoundedChild([expression]);
    expect(
      { timedOut: run.timedOut, crashed: run.crashed },
      run.stderr,
    ).toEqual({ timedOut: false, crashed: false });
    expect(run.calls).toHaveLength(1);
  });

  it("returns a string from formatCalendar on the Hebrew calendar", async () => {
    const run = await runInBoundedChild([
      'gmt.formatCalendar("2026-07-01T10:00:00", "gl-u-ca-hebrew", { reference: "2026-07-01T09:00:00" })',
    ]);
    expect(run.calls[0]?.value).toEqual(expect.any(String));
    expect(run.calls[0]?.value).not.toBe("");
  });
});
