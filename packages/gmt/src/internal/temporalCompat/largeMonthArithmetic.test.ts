import { describe, expect, it } from "vitest";
import { runInBoundedChild } from "../../test/boundedChild";

/*
 * D9: polyfill 0.5.1 adds and counts non-ISO months one month at a time (`addMonthsCalendar`,
 * `untilCalendar`), retaining memory per step, so an in-range amount of a few million months is a
 * fatal heap OOM. Every row runs in a child process (256 MB heap, 20 s timeout): the red state is
 * the child crashing or timing out, never the Vitest worker.
 *
 * Expected values are the Intl era/monthCode proposal's NonISODateAdd / NonISODateUntil results,
 * derived without GMT:
 * - persian, islamic-civil, japanese: 12 months in every year, coptic and ethiopic 13 (proposal
 *   §4.1.4 Table 3 gives these calendars no leap month code), so 3,000,000 months is
 *   250,000 years, or 230,769 years and 3 months.
 * - hebrew: the Dershowitz–Reingold month count `floor((235y − 234) / 19)`, evaluated in a
 *   scratch script; the same script and the polyfill agree at 50,000 months (`9826-12-05`).
 * - day counts: the polyfill's fields → ISO reads of both ends, then ISO day arithmetic.
 */

/** Generous per-call ceiling: the defect is minutes or an abort, the fix is milliseconds. */
const MAX_CALL_MS = 1_000;

function expectBoundedValue(expression: string, expected: unknown) {
  const run = runInBoundedChild([expression]);
  expect({ timedOut: run.timedOut, crashed: run.crashed }, run.stderr).toEqual({
    timedOut: false,
    crashed: false,
  });
  expect(run.calls[0]?.value).toEqual(expected);
  expect(run.calls[0]?.ms).toBeLessThan(MAX_CALL_MS);
}

describe("D9 large non-ISO month arithmetic — addDate / subtractDate", () => {
  it.each`
    expression                                                                   | expected                               | why
    ${'gmt.addDate("2024-01-15[u-ca=persian]", { months: 1 })'}                  | ${"2024-02-14[u-ca=persian]"}          | ${"harness control: a small amount"}
    ${'gmt.addDate("2024-01-15[u-ca=persian]", { months: 50000 })'}              | ${"6190-09-15[u-ca=persian]"}          | ${"cross-check: the polyfill's own month loop gives the same at 50,000"}
    ${'gmt.subtractDate("2024-01-14[u-ca=islamic-civil]", { months: 50000 })'}   | ${"-002019-06-11[u-ca=islamic-civil]"} | ${"cross-check: the polyfill's own month loop gives the same at 50,000"}
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: 50000 })'}               | ${"6066-08-22[u-ca=hebrew]"}           | ${"cross-check: the polyfill and D–R agree at 50,000"}
    ${'gmt.addDate("2024-01-15[u-ca=persian]", { months: 3000000 })'}            | ${"+252023-12-27[u-ca=persian]"}       | ${"persian 3,000,000 months = 250,000 years"}
    ${'gmt.subtractDate("2024-01-14[u-ca=islamic-civil]", { months: 3000000 })'} | ${"-240532-04-17[u-ca=islamic-civil]"} | ${"islamic-civil back 250,000 years"}
    ${'gmt.addDate("2024-01-15[u-ca=japanese]", { months: 3000000 })'}           | ${"+252024-01-15[u-ca=japanese]"}      | ${"japanese 250,000 years, still reiwa"}
    ${'gmt.addDate("2024-01-15[u-ca=gregory]", { months: 3000000 })'}            | ${"+252024-01-15[u-ca=gregory]"}       | ${"gregory 250,000 years (Chromium 153)"}
    ${'gmt.addDate("2024-03-15[u-ca=ethiopic]", { months: 3000000 })'}           | ${"+232798-03-10[u-ca=ethiopic]"}      | ${"ethiopic 13-month years: 230,769 years + 3 months"}
    ${'gmt.addDate("2024-03-15[u-ca=coptic]", { months: 3000000 })'}             | ${"+232798-03-10[u-ca=coptic]"}        | ${"coptic 13-month years: 230,769 years + 3 months"}
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: 3000000 })'}             | ${"+244580-02-07[u-ca=hebrew]"}        | ${"hebrew leap-month years (D–R month count)"}
    ${'gmt.addDate("2024-01-15[u-ca=persian]", { months: 4000000 })'}            | ${""}                                  | ${"persian year 334735 is past the maximum"}
    ${'gmt.addDate("2024-01-15[u-ca=persian]", { months: 4294967295 })'}         | ${""}                                  | ${"the largest valid Duration months field, far past the maximum"}
    ${'gmt.addDate("2023-10-04[u-ca=persian]", { months: 3284844 })'}            | ${"+275760-09-13[u-ca=persian]"}       | ${"lands exactly on the persian maximum (test262 extreme-dates)"}
    ${'gmt.addDate("2023-10-05[u-ca=persian]", { months: 3284844 })'}            | ${""}                                  | ${"one day past the persian maximum"}
    ${'gmt.subtractDate("2023-03-29[u-ca=persian]", { months: 3286128 })'}       | ${"-271821-04-19[u-ca=persian]"}       | ${"lands exactly on the persian minimum (test262 extreme-dates)"}
    ${'gmt.subtractDate("2023-03-28[u-ca=persian]", { months: 3286128 })'}       | ${""}                                  | ${"one day before the persian minimum"}
    ${'gmt.addDate("2024-06-17[u-ca=hebrew]", { months: 3385645 })'}             | ${"+275760-09-13[u-ca=hebrew]"}        | ${"lands exactly on the hebrew maximum; both years leap, ordinal 10 = M09"}
    ${'gmt.addDate("2024-06-18[u-ca=hebrew]", { months: 3385645 })'}             | ${""}                                  | ${"one day past the hebrew maximum"}
  `("$expression → $expected ($why)", ({ expression, expected }) => {
    expectBoundedValue(expression, expected);
  });
});

describe("D9 large non-ISO month arithmetic — differences, Duration relativeTo, zoned", () => {
  it.each`
    expression                                                                                                                                      | expected                                                     | why
    ${'gmt.diffDate("2024-01-15[u-ca=persian]", "+252023-12-27[u-ca=persian]", "months")'}                                                          | ${3_000_000}                                                 | ${"persian 250,000 years of months"}
    ${'gmt.diffDate("-247976-02-03[u-ca=persian]", "+252023-12-27[u-ca=persian]", "months")'}                                                       | ${6_000_000}                                                 | ${"persian 500,000 years of months, across year 0"}
    ${'gmt.diffDateAsDuration("2024-01-31[u-ca=gregory]", "+252024-01-15[u-ca=gregory]", "months")'}                                                | ${"P2999999M15D"}                                            | ${"gregory month-end start, D6 at 250,000 years (Chromium 153)"}
    ${'gmt.diffDate("2024-01-15[u-ca=hebrew]", "+244580-02-07[u-ca=hebrew]", "months")'}                                                            | ${3_000_000}                                                 | ${"hebrew: inverse of the addDate row"}
    ${'gmt.diffDate("2024-03-15[u-ca=coptic]", "+232798-03-10[u-ca=coptic]", "months")'}                                                            | ${3_000_000}                                                 | ${"coptic: inverse of the addDate row"}
    ${'gmt.intervalLengthDate("2024-01-15[u-ca=persian]", "+252023-12-27[u-ca=persian]", "months")'}                                                | ${3_000_000}                                                 | ${"interval length in months"}
    ${'gmt.durationAs("P3000000M", "days", { relativeTo: "2024-01-15[u-ca=persian]" })'}                                                            | ${91_310_606}                                                | ${"ISO 2024-01-15 → +252023-12-27"}
    ${'gmt.durationAs("P3000000M", "days", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                             | ${88_591_783}                                                | ${"hebrew 5784-05-05 → 248337-07-05 in ISO days"}
    ${'gmt.durationAs("P3000000M", "days", { relativeTo: "2024-03-15[u-ca=coptic]" })'}                                                             | ${84_288_467}                                                | ${"coptic 1740-07-06 → 232509-10-06 in ISO days"}
    ${'gmt.normalizeDuration("P90000000D", { largestUnit: "month", relativeTo: "2024-01-15[u-ca=persian]" })'}                                      | ${"P2956940M5D"}                                             | ${"target persian 247814-06-30: 246,412 years − 4 months, 5 days"}
    ${'gmt.normalizeDuration("P90000000D", { largestUnit: "month", relativeTo: "2024-03-15[u-ca=ethiopic]" })'}                                     | ${"P3203285M24D"}                                            | ${"target ethioaa 253923-01-30, 13-month years"}
    ${'gmt.compareDurations("P3000000M", "P1D", { relativeTo: "2024-03-15[u-ca=ethiopic]" })'}                                                      | ${1}                                                         | ${"3,000,000 months is longer than a day"}
    ${'gmt.compareDurations("P4000000M", "P1D", { relativeTo: "2024-01-15[u-ca=persian]" })'}                                                       | ${null}                                                      | ${"relativeTo + 4,000,000 months is past the maximum (a spec RangeError)"}
    ${'gmt.addZoned("2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]", { months: 3000000 })'}                                                  | ${"+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]"} | ${"Tehran has kept +03:30 without DST since 2022"}
    ${'gmt.subtractZoned("+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]", { months: 3000000 })'}                                          | ${"2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]"}    | ${"inverse of the addZoned row"}
    ${'gmt.addZoned("2025-09-05T00:30:00-04:00[America/Santiago][u-ca=ethioaa]", { months: 4294967295 })'}                                          | ${""}                                                        | ${"far past the maximum"}
    ${'gmt.diffDate("2024-01-15[u-ca=hebrew]", "+244580-02-07[u-ca=hebrew]", "years")'}                                                             | ${242_553}                                                   | ${"years stay cheap: M07 follows M05"}
    ${'gmt.diffZoned("2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]", "+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]", "months")'} | ${3_000_000}                                                 | ${"zoned difference in months"}
  `("$expression → $expected ($why)", ({ expression, expected }) => {
    expectBoundedValue(expression, expected);
  });
});
