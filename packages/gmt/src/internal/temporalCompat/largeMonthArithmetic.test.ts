import { runInBoundedChild } from "../../test/boundedChild";

/*
 * D9: polyfill 0.5.1 adds and counts non-ISO months one month at a time (`addMonthsCalendar`,
 * `untilCalendar`), retaining memory per step, so an in-range amount of a few million months is a
 * fatal heap OOM. Every row runs in a child process (256 MB heap, 20 s timeout): the red state is
 * the child crashing or timing out, never the Vitest worker.
 *
 * `temporal-polyfill` 1.0.8 does in-range months in bounded work but throws RangeError for an
 * out-of-range amount only after work linear in it (hebrew, 4,294,967,295 months: about 5 s); the
 * last describe block covers that half, which `monthRange.ts` answers by throwing first.
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

/*
 * One child per describe block, not per row: a child costs 0.3 s to start and several seconds when
 * the machine is busy (a full-suite run put four rows past the 5 s test timeout), while the calls
 * themselves take under 0.1 s each. `rowsOf` records each table's expressions as the table is
 * read; the first row to run starts the one child for the whole block, and every row then checks
 * its own call. A crash or timeout still fails the rows from the failing call on; each call is
 * still timed inside the child against MAX_CALL_MS.
 */
function rowsOf(each: typeof it.each) {
  const expressions: string[] = [];
  let run: ReturnType<typeof runInBoundedChild> | undefined;
  const table = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const columns = strings[0]?.split("|").length ?? 1;
    values.forEach((value, index) => {
      if (index % columns === 0) expressions.push(String(value));
    });
    return each(strings, ...values);
  }) as typeof each;
  async function expectBoundedValue(expression: string, expected: unknown) {
    run ??= runInBoundedChild(expressions, { timeoutMs: 60_000 });
    const result = await run;
    expect(
      { timedOut: result.timedOut, crashed: result.crashed },
      result.stderr,
    ).toEqual({
      timedOut: false,
      crashed: false,
    });
    const call = result.calls[expressions.indexOf(expression)];
    expect(call?.value).toEqual(expected);
    expect(call?.ms).toBeLessThan(MAX_CALL_MS);
  }
  return { table, expectBoundedValue };
}

describe("D9 large non-ISO month arithmetic — addDate / subtractDate", () => {
  const { table, expectBoundedValue } = rowsOf(it.each.bind(it));
  table`
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
  `("$expression → '$expected' ($why)", async ({ expression, expected }) => {
    await expectBoundedValue(expression, expected);
  });
});

describe("D9 large non-ISO month arithmetic — differences, Duration relativeTo, zoned", () => {
  const { table, expectBoundedValue } = rowsOf(it.each.bind(it));
  table`
    expression                                                                                                                                      | expected                                                     | why                                                                               | label
    ${'gmt.diffDate("2024-01-15[u-ca=persian]", "+252023-12-27[u-ca=persian]", "months")'}                                                          | ${3_000_000}                                                 | ${"persian 250,000 years of months"}                                              | ${"3_000_000"}
    ${'gmt.diffDate("-247976-02-03[u-ca=persian]", "+252023-12-27[u-ca=persian]", "months")'}                                                       | ${6_000_000}                                                 | ${"persian 500,000 years of months, across year 0"}                               | ${"6_000_000"}
    ${'gmt.diffDateAsDuration("2024-01-31[u-ca=gregory]", "+252024-01-15[u-ca=gregory]", "months")'}                                                | ${"P2999999M15D"}                                            | ${"gregory month-end start, month-end overshoot at 250,000 years (Chromium 153)"} | ${"'P2999999M15D'"}
    ${'gmt.diffDate("2024-01-15[u-ca=hebrew]", "+244580-02-07[u-ca=hebrew]", "months")'}                                                            | ${3_000_000}                                                 | ${"hebrew: inverse of the addDate row"}                                           | ${"3_000_000"}
    ${'gmt.diffDate("2024-03-15[u-ca=coptic]", "+232798-03-10[u-ca=coptic]", "months")'}                                                            | ${3_000_000}                                                 | ${"coptic: inverse of the addDate row"}                                           | ${"3_000_000"}
    ${'gmt.intervalLengthDate("2024-01-15[u-ca=persian]", "+252023-12-27[u-ca=persian]", "months")'}                                                | ${3_000_000}                                                 | ${"interval length in months"}                                                    | ${"3_000_000"}
    ${'gmt.totalDuration("P3000000M", "days", { relativeTo: "2024-01-15[u-ca=persian]" })'}                                                         | ${91_310_606}                                                | ${"ISO 2024-01-15 → +252023-12-27"}                                               | ${"91_310_606"}
    ${'gmt.totalDuration("P3000000M", "days", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                          | ${88_591_783}                                                | ${"hebrew 5784-05-05 → 248337-07-05 in ISO days"}                                 | ${"88_591_783"}
    ${'gmt.totalDuration("P3000000M", "days", { relativeTo: "2024-03-15[u-ca=coptic]" })'}                                                          | ${84_288_467}                                                | ${"coptic 1740-07-06 → 232509-10-06 in ISO days"}                                 | ${"84_288_467"}
    ${'gmt.normalizeDuration("P90000000D", { largestUnit: "month", relativeTo: "2024-01-15[u-ca=persian]" })'}                                      | ${"P2956940M5D"}                                             | ${"target persian 247814-06-30: 246,412 years − 4 months, 5 days"}                | ${"'P2956940M5D'"}
    ${'gmt.normalizeDuration("P90000000D", { largestUnit: "month", relativeTo: "2024-03-15[u-ca=ethiopic]" })'}                                     | ${"P3203285M24D"}                                            | ${"target ethioaa 253923-01-30, 13-month years"}                                  | ${"'P3203285M24D'"}
    ${'gmt.compareDurations("P3000000M", "P1D", { relativeTo: "2024-03-15[u-ca=ethiopic]" })'}                                                      | ${1}                                                         | ${"3,000,000 months is longer than a day"}                                        | ${"1"}
    ${'gmt.compareDurations("P4000000M", "P1D", { relativeTo: "2024-01-15[u-ca=persian]" })'}                                                       | ${null}                                                      | ${"relativeTo + 4,000,000 months is past the maximum (a spec RangeError)"}        | ${"null"}
    ${'gmt.addZoned("2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]", { months: 3000000 })'}                                                  | ${"+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]"} | ${"Tehran has kept +03:30 without DST since 2022"}                                | ${"'+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]'"}
    ${'gmt.subtractZoned("+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]", { months: 3000000 })'}                                          | ${"2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]"}    | ${"inverse of the addZoned row"}                                                  | ${"'2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]'"}
    ${'gmt.addZoned("2025-09-05T00:30:00-04:00[America/Santiago][u-ca=ethioaa]", { months: 4294967295 })'}                                          | ${""}                                                        | ${"far past the maximum"}                                                         | ${"''"}
    ${'gmt.diffDate("2024-01-15[u-ca=hebrew]", "+244580-02-07[u-ca=hebrew]", "years")'}                                                             | ${242_553}                                                   | ${"years stay cheap: M07 follows M05"}                                            | ${"242_553"}
    ${'gmt.diffZoned("2024-01-15T12:00:00+03:30[Asia/Tehran][u-ca=persian]", "+252023-12-27T12:00:00+03:30[Asia/Tehran][u-ca=persian]", "months")'} | ${3_000_000}                                                 | ${"zoned difference in months"}                                                   | ${"3_000_000"}
  `("$expression → $label ($why)", async ({ expression, expected }) => {
    await expectBoundedValue(expression, expected);
  });
});

/*
 * The out-of-range half of D9 (`monthRange.ts`): `temporal-polyfill` 1.0.8 throws RangeError for a
 * month amount past the date range only after work linear in the amount (hebrew, 4,294,967,295
 * months: about 5 s; Firefox and WebKit 3–4× slower), so GMT throws first. Every row is a call
 * that the specification answers with its sentinel, and must come back inside MAX_CALL_MS. Rows are
 * hebrew where the function takes a non-ISO calendar; the date-time and year-month functions
 * accept only ISO 8601 (their guards stay by Decision 2 of CORE-108, and their rows are ISO).
 * `7365462` is the guard's bound: it and the next amount give the same sentinel either side of it.
 */
describe("D9 month amounts past the date range — every family returns its sentinel in bounded time", () => {
  const { table, expectBoundedValue } = rowsOf(it.each.bind(it));
  table`
    expression                                                                                                                                                                 | expected                                                                                                                                | label                                                                            | note
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: 4294967295 })'}                                                                                                        | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDate 4294967295 months"}
    ${'gmt.subtractDate("2024-01-15[u-ca=hebrew]", { months: 4294967295 })'}                                                                                                   | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"subtractDate 4294967295 months"}
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: 7365462 })'}                                                                                                           | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDate at the guard bound 7365462"}
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: 7365463 })'}                                                                                                           | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDate one past the guard bound"}
    ${'gmt.addDateTime("2024-01-15T12:00:00", { months: 4294967295 })'}                                                                                                        | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDateTime"}
    ${'gmt.subtractDateTime("2024-01-15T12:00:00", { months: 4294967295 })'}                                                                                                   | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"subtractDateTime"}
    ${'gmt.addYearMonth("5784-05", { months: 4294967295 })'}                                                                                                                   | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addYearMonth"}
    ${'gmt.subtractYearMonth("5784-05", { months: 4294967295 })'}                                                                                                              | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"subtractYearMonth"}
    ${'gmt.addZoned("2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", { months: 4294967295 })'}                                                                        | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addZoned"}
    ${'gmt.subtractZoned("2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", { months: 4294967295 })'}                                                                   | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"subtractZoned"}
    ${'gmt.totalDuration("P4294967295M", "days", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                                                  | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"totalDuration with a date relativeTo"}
    ${'gmt.totalDuration("P4294967295M", "days", { relativeTo: "2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]" })'}                                                   | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"totalDuration with a zoned relativeTo"}
    ${'gmt.normalizeDuration("P4294967295M", { largestUnit: "month", relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                                | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"normalizeDuration with a date relativeTo"}
    ${'gmt.normalizeDuration("P4294967295M", { largestUnit: "month", relativeTo: "2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]" })'}                                 | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"normalizeDuration with a zoned relativeTo"}
    ${'gmt.compareDurations("P4294967295M", "P1D", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                                                | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"compareDurations with a date relativeTo"}
    ${'gmt.compareDurations("P4294967295M", "P1D", { relativeTo: "2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]" })'}                                                 | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"compareDurations with a zoned relativeTo"}
    ${'gmt.compareDurations("P4294967295M", "P4294967295M", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                                       | ${0}                                                                                                                                    | ${"0"}                                                                           | ${"compareDurations both past the range, date"}
    ${'gmt.intervalFromDurationDate("2024-01-15[u-ca=hebrew]", "P4294967295M", "start")'}                                                                                      | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"intervalFromDurationDate"}
    ${'gmt.intervalFromDurationDateTime("2024-01-15T12:00:00", "P4294967295M", "start")'}                                                                                      | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"intervalFromDurationDateTime"}
    ${'gmt.intervalFromDurationZoned("2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", "P4294967295M", "start")'}                                                      | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"intervalFromDurationZoned"}
    ${'gmt.addZoned("2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", { months: 4294967295 }, { disambiguation: "earlier" })'}                                         | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addZoned with disambiguation earlier"}
    ${'gmt.subtractZoned("2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", { months: 4294967295 }, { disambiguation: "later" })'}                                      | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"subtractZoned with disambiguation later"}
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: 4294967295 }, { overflow: "reject" })'}                                                                                | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDate with overflow reject"}
    ${'gmt.addDate("2024-01-15[u-ca=hebrew]", { months: -4294967295 })'}                                                                                                       | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDate with negative months"}
    ${'gmt.totalDuration("-P4294967295M", "days", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                                                 | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"totalDuration of a negative duration"}
    ${'gmt.compareDurations("P1D", "P4294967295M", { relativeTo: "2024-01-15[u-ca=hebrew]" })'}                                                                                | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"compareDurations past the range on the right"}
    ${'gmt.compareDurations("P4294967295M", "P4294967295M", { relativeTo: "2024-01-15T12:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]" })'}                                        | ${0}                                                                                                                                    | ${"0"}                                                                           | ${"compareDurations both past the range, zoned"}
    ${"gmt.addUnix(1704067200000, { months: 4294967295 })"}                                                                                                                    | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"addUnix"}
    ${"gmt.subtractUnix(1704067200000, { months: 4294967295 })"}                                                                                                               | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"subtractUnix"}
    ${"gmt.getDateIn({ months: 4294967295 })"}                                                                                                                                 | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"getDateIn"}
    ${"gmt.getDateAgo({ months: 4294967295 })"}                                                                                                                                | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"getDateAgo"}
    ${'gmt.getZonedIn("Asia/Jerusalem", { months: 4294967295 })'}                                                                                                              | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"getZonedIn"}
    ${'gmt.getZonedAgo("Asia/Jerusalem", { months: 4294967295 })'}                                                                                                             | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"getZonedAgo"}
    ${'gmt.intervalFromDurationUnix(1704067200000, "P4294967295M", "start")'}                                                                                                  | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"intervalFromDurationUnix"}
    ${'gmt.totalDuration("P4294967295M", "days")'}                                                                                                                             | ${null}                                                                                                                                 | ${"null"}                                                                        | ${"totalDuration without relativeTo"}
    ${'gmt.splitIntervalByUnitDate("2024-01-15[u-ca=hebrew]", "2024-02-15[u-ca=hebrew]", "month", 4294967295)'}                                                                | ${[{ start: "2024-01-15[u-ca=hebrew]", end: "2024-02-15[u-ca=hebrew]" }]}                                                               | ${"one slice: the first step is past the range, so the split closes at the end"} | ${"splitIntervalByUnitDate"}
    ${'gmt.splitIntervalByUnitZoned("2024-01-15T00:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", "2024-02-15T00:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", "month", 4294967295)'} | ${[{ start: "2024-01-15T00:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]", end: "2024-02-15T00:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]" }]} | ${"one slice, as for dates"}                                                     | ${"splitIntervalByUnitZoned"}
    ${'gmt.addDuration("P4294967295M", "P1D")'}                                                                                                                                | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"addDuration"}
    ${'gmt.subtractDuration("P4294967295M", "P1D")'}                                                                                                                           | ${""}                                                                                                                                   | ${"''"}                                                                          | ${"subtractDuration"}
  `("$note: $expression → $label", async ({ expression, expected }) => {
    await expectBoundedValue(expression, expected);
  });
});
