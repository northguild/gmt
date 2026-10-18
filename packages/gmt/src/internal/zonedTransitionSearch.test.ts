import { Temporal } from "./temporal";
import {
  TRANSITION_SEARCH_STEP_NANOSECONDS,
  clearTransitionMemo,
  nextTransitionAfter,
  previousTransitionBefore,
} from "./zonedTransitionSearch";
import { offsetAt } from "./zonedWallClock";
import {
  zonedNextTransition,
  zonedPreviousTransition,
} from "./zonedWallClockOperations";

// The offset reader is the one `Intl` read a search pays for; the spy passes every call through.
vi.mock("./zonedWallClock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./zonedWallClock")>();
  return { ...actual, offsetAt: vi.fn(actual.offsetAt) };
});

const epochOf = (instant: string): bigint =>
  Temporal.Instant.from(instant).epochNanoseconds;

const at = (instant: string, timeZone: string): Temporal.ZonedDateTime =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);

const instantOf = (zoned: Temporal.ZonedDateTime | null): string | null =>
  zoned === null ? null : zoned.toInstant().toString();

/**
 * Expected values: Node 26.10.0's native Temporal and `zdump -v` (tz 2026c), TC39
 * `GetNamedTimeZoneNextTransition` / `GetNamedTimeZonePreviousTransition`. Every row is settled
 * history, the same in tz 2025c.
 */
describe("zonedNextTransition (temporalCompat D13)", () => {
  // America/Boa_Vista: -04→-03 2000-10-08T04:00Z, -03→-04 2000-10-15T03:00Z (601,200 s apart,
  // the closest pair in the tz database), and no change since.
  it.each`
    from                                | expected
    ${"2000-07-01T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-07-02T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-01T12:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-07T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T03:59:59Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T03:59:59.999999999Z"} | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T04:00:00Z"}           | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T02:59:59.999999999Z"} | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T03:00:00Z"}           | ${null}
  `(
    "finds $expected after $from in America/Boa_Vista",
    ({ from, expected }) => {
      expect(
        instantOf(zonedNextTransition(at(from, "America/Boa_Vista"))),
      ).toBe(expected);
    },
    10_000,
  );

  // Three offsets inside 14 days, where the polyfill's own search never returns.
  it.each`
    timeZone               | from                      | expected
    ${"Europe/Riga"}       | ${"1944-04-15T12:00:00Z"} | ${"1944-10-02T01:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-09-25T00:00:00Z"} | ${"1944-10-02T01:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-02T01:00:00Z"} | ${"1944-10-12T23:00:00Z"}
    ${"Europe/Simferopol"} | ${"1943-10-15T12:00:00Z"} | ${"1944-04-03T01:00:00Z"}
    ${"Europe/Simferopol"} | ${"1944-04-03T01:00:00Z"} | ${"1944-04-12T22:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-03-28T00:30:00Z"} | ${"1976-04-14T01:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-04-14T00:30:00Z"} | ${"1976-04-14T01:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-04-14T01:00:00Z"} | ${"1976-05-01T00:00:00Z"}
  `(
    "finds $expected after $from in $timeZone",
    ({ timeZone, from, expected }) => {
      expect(instantOf(zonedNextTransition(at(from, timeZone)))).toBe(expected);
    },
    10_000,
  );

  it.each`
    timeZone              | from                      | expected
    ${"Asia/Tokyo"}       | ${"1960-01-01T00:00:00Z"} | ${null}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T07:00:00Z"}
    ${"UTC"}              | ${"2000-01-01T00:00:00Z"} | ${null}
    ${"+05:00"}           | ${"2000-01-01T00:00:00Z"} | ${null}
  `(
    "finds $expected after $from in $timeZone",
    ({ timeZone, from, expected }) => {
      expect(instantOf(zonedNextTransition(at(from, timeZone)))).toBe(expected);
    },
    10_000,
  );

  it.each`
    until                               | expected
    ${"2000-10-08T04:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T03:59:59.999999999Z"} | ${null}
    ${"2000-10-02T00:00:00Z"}           | ${null}
    ${"2001-10-01T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
  `(
    "finds $expected after 2000-10-01T12:00:00Z in America/Boa_Vista when the search ends at $until",
    ({ until, expected }) => {
      expect(
        instantOf(
          zonedNextTransition(
            at("2000-10-01T12:00:00Z", "America/Boa_Vista"),
            epochOf(until),
          ),
        ),
      ).toBe(expected);
    },
  );
});

// Asia/Tokyo's last change is 1951-09-08T15:00:00Z. A limit thousands of years away does not
// lengthen the search: nothing within three 366-day years of the later of the start and now means
// no further change, with or without a limit. America/New_York's rules repeat, so a limit at the
// very change (3000-03-09T07:00:00Z) still finds it, and one nanosecond less does not.
describe("a limited search and the no-further-change horizon (temporalCompat D13)", () => {
  it.each`
    timeZone              | from                      | until                               | expected
    ${"Asia/Tokyo"}       | ${"2000-01-01T00:00:00Z"} | ${"6000-01-01T00:00:00Z"}           | ${null}
    ${"Asia/Tokyo"}       | ${"2000-01-01T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"}        | ${null}
    ${"America/Phoenix"}  | ${"1970-01-01T00:00:00Z"} | ${"5000-01-01T00:00:00Z"}           | ${null}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T07:00:00Z"}           | ${"3000-03-09T07:00:00Z"}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T06:59:59.999999999Z"} | ${null}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"6000-01-01T00:00:00Z"}           | ${"3000-03-09T07:00:00Z"}
  `(
    "finds $expected after $from in $timeZone when the search ends at $until",
    ({ timeZone, from, until, expected }) => {
      expect(
        instantOf(zonedNextTransition(at(from, timeZone), epochOf(until))),
      ).toBe(expected);
    },
    10_000,
  );

  it.each`
    timeZone              | from                         | since                        | expected
    ${"Asia/Tokyo"}       | ${"6000-01-01T00:00:00Z"}    | ${"2000-01-01T00:00:00Z"}    | ${null}
    ${"Asia/Tokyo"}       | ${"6000-01-01T00:00:00Z"}    | ${"1900-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}
    ${"Asia/Tokyo"}       | ${"6000-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}    | ${null}
    ${"Asia/Tokyo"}       | ${"+275760-09-13T00:00:00Z"} | ${"-271821-04-20T00:00:00Z"} | ${"1951-09-08T15:00:00Z"}
    ${"America/New_York"} | ${"3000-06-01T00:00:00Z"}    | ${"2000-01-01T00:00:00Z"}    | ${"3000-03-09T07:00:00Z"}
    ${"America/New_York"} | ${"3000-06-01T00:00:00Z"}    | ${"3000-03-09T07:00:00Z"}    | ${null}
  `(
    "finds $expected before $from in $timeZone when the search stops after $since",
    ({ timeZone, from, since, expected }) => {
      expect(
        instantOf(zonedPreviousTransition(at(from, timeZone), epochOf(since))),
      ).toBe(expected);
    },
    10_000,
  );
});

// The spec's row "cleared before each row": the answers of the table above do not depend on what
// the memo holds, so the same calls with the memo cleared before every one give the same values.
describe("zonedNextTransition with the memo cleared before each row (temporalCompat D13)", () => {
  beforeEach(() => {
    clearTransitionMemo();
  });

  it.each`
    timeZone               | from                      | expected
    ${"America/Boa_Vista"} | ${"2000-10-01T00:00:00Z"} | ${"2000-10-08T04:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-08T04:00:00Z"} | ${"2000-10-15T03:00:00Z"}
    ${"Europe/London"}     | ${"2024-01-01T00:00:00Z"} | ${"2024-03-31T01:00:00Z"}
    ${"Europe/London"}     | ${"2024-03-31T01:00:00Z"} | ${"2024-10-27T01:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-02T01:00:00Z"} | ${"1944-10-12T23:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-04-14T01:00:00Z"} | ${"1976-05-01T00:00:00Z"}
    ${"America/New_York"}  | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T07:00:00Z"}
  `(
    "finds $expected after $from in $timeZone from a cold memo",
    ({ timeZone, from, expected }) => {
      expect(nextTransitionAfter(timeZone, epochOf(from))).toBe(
        epochOf(expected),
      );
    },
  );
});

describe("zonedPreviousTransition (temporalCompat D13)", () => {
  it.each`
    timeZone               | from                         | expected
    ${"America/Boa_Vista"} | ${"2001-06-01T00:00:00Z"}    | ${"2000-10-15T03:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-20T12:00:00Z"}    | ${"2000-10-15T03:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-15T03:00:00Z"}    | ${"2000-10-08T04:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-08T04:00:00Z"}    | ${"2000-02-27T03:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-20T12:00:00Z"}    | ${"1944-10-12T23:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-12T23:00:00Z"}    | ${"1944-10-02T01:00:00Z"}
    ${"Europe/Simferopol"} | ${"1944-04-20T12:00:00Z"}    | ${"1944-04-12T22:00:00Z"}
    ${"Europe/Simferopol"} | ${"1944-04-12T22:00:00Z"}    | ${"1944-04-03T01:00:00Z"}
    ${"Asia/Tokyo"}        | ${"2024-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}
    ${"Asia/Tokyo"}        | ${"3000-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}
    ${"America/New_York"}  | ${"+275760-09-13T00:00:00Z"} | ${"+275760-03-09T07:00:00Z"}
    ${"UTC"}               | ${"2000-01-01T00:00:00Z"}    | ${null}
  `(
    "finds $expected before $from in $timeZone",
    ({ timeZone, from, expected }) => {
      expect(instantOf(zonedPreviousTransition(at(from, timeZone)))).toBe(
        expected,
      );
    },
    10_000,
  );

  it.each`
    since                               | expected
    ${"2000-10-01T00:00:00Z"}           | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T02:59:59.999999999Z"} | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T03:00:00Z"}           | ${null}
    ${"2000-10-18T00:00:00Z"}           | ${null}
  `(
    "finds $expected before 2000-10-20T12:00:00Z in America/Boa_Vista when the search stops after $since",
    ({ since, expected }) => {
      expect(
        instantOf(
          zonedPreviousTransition(
            at("2000-10-20T12:00:00Z", "America/Boa_Vista"),
            epochOf(since),
          ),
        ),
      ).toBe(expected);
    },
  );
});

/**
 * The sampling assumption behind the search step, read from the runtime's own data through
 * `Intl.DateTimeFormat`, not through Temporal or GMT: every zone's offset is sampled every 2.5 days
 * from 1847 to 2100 and each change pinned to the second. Two changes of one zone 2.5 days or more
 * apart are both seen, so a pair closer than the step plus a day fails here. A pair under 2.5 days
 * apart could pass unseen; `zdump -v` shows none in tz 2026c (minimum 601,200 s).
 */
describe("the tz database's closest pair of offset changes", () => {
  const SECOND = 1_000;
  const DAY = 86_400 * SECOND;
  const GUARD_STEP = 2.5 * DAY;
  const SEARCH_STEP_SECONDS = Number(
    TRANSITION_SEARCH_STEP_NANOSECONDS / 1_000_000_000n,
  );
  const MARGIN_SECONDS = 86_400;

  /**
   * A proleptic Gregorian wall clock as milliseconds since 1970-01-01T00:00, by the days-from-civil
   * count (months from March, 146,097 days per 400 years).
   */
  function wallClockMilliseconds(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): number {
    const marchYear = month <= 2 ? year - 1 : year;
    const era = Math.floor(marchYear / 400);
    const yearOfEra = marchYear - era * 400;
    const dayOfYear =
      Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
    const dayOfEra =
      yearOfEra * 365 +
      Math.floor(yearOfEra / 4) -
      Math.floor(yearOfEra / 100) +
      dayOfYear;
    const days = era * 146_097 + dayOfEra - 719_468;

    return ((days * 24 + hour) * 60 + minute) * 60_000 + second * SECOND;
  }

  function offsetReader(timeZone: string): (epochMs: number) => number {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    return (epochMs) => {
      const [month, day, year, era, hour, minute, second] = formatter
        .format(epochMs)
        .split(/[^\w]+/);
      const isoYear = era.startsWith("B") ? 1 - Number(year) : Number(year);
      return (
        wallClockMilliseconds(
          isoYear,
          Number(month),
          Number(day),
          Number(hour) % 24,
          Number(minute),
          Number(second),
        ) - epochMs
      );
    };
  }

  /** The smallest gap, in seconds, between two consecutive offset changes of one zone. */
  function closestPair(): { seconds: number; where: string } {
    const from = Number(epochOf("1847-01-01T00:00:00Z") / 1_000_000n);
    const to = Number(epochOf("2100-01-01T00:00:00Z") / 1_000_000n);
    let closest = { seconds: Number.POSITIVE_INFINITY, where: "" };

    for (const timeZone of Intl.supportedValuesOf("timeZone")) {
      const offsetAt = offsetReader(timeZone);
      let offset = offsetAt(from);
      let lastChange = Number.NEGATIVE_INFINITY;

      for (let sample = from + GUARD_STEP; sample <= to; sample += GUARD_STEP) {
        const sampled = offsetAt(sample);
        if (sampled === offset) continue;

        let before = sample - GUARD_STEP;
        let after = sample;
        while (after - before > SECOND) {
          const middle = Math.floor((before + after) / (2 * SECOND)) * SECOND;
          if (offsetAt(middle) === offset) before = middle;
          else after = middle;
        }

        const seconds = (after - lastChange) / SECOND;
        if (seconds < closest.seconds) {
          closest = {
            seconds,
            where: `${timeZone} ${Temporal.Instant.fromEpochMilliseconds(after).toString()}`,
          };
        }
        lastChange = after;
        offset = sampled;
      }
    }

    return closest;
  }

  it("is a 5-day step: 432,000 s", () => {
    expect(SEARCH_STEP_SECONDS).toBe(432_000);
  });

  // Worst CI run 107 s on the slowest runner; the timeout is three times that.
  it("is more than the search step plus a day apart, in every zone the runtime knows", () => {
    const closest = closestPair();

    expect(
      closest.seconds,
      `closest pair: ${closest.where}, ${closest.seconds} s apart`,
    ).toBeGreaterThanOrEqual(SEARCH_STEP_SECONDS + MARGIN_SECONDS);
    // The reader measures something: it finds the pair zdump gives as the closest (America/
    // Boa_Vista, Noronha and Recife, 2000), so an empty reading cannot pass.
    // A tz release that changes the closest pair needs a conscious edit here and to the step.
    expect(closest.seconds).toBe(601_200);
  }, 360_000);
});

/**
 * The per-zone memo. Expected instants: `zdump -v` (tz 2026c). Europe/London
 * springs forward 2024-03-31T01:00:00Z; America/Boa_Vista changes 2000-10-08T04:00:00Z and
 * 2000-10-15T03:00:00Z; Asia/Kolkata's last change before 1950 is 1945, none since.
 */
describe("the transition memo", () => {
  const reads = vi.mocked(offsetAt);
  const LONDON = "Europe/London";
  const SPRING = "2024-03-31T01:00:00Z";

  beforeEach(() => {
    clearTransitionMemo();
    reads.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers a repeated search with the same instant and no offset read", () => {
    const first = nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"));
    expect(first).toBe(epochOf(SPRING));
    reads.mockClear();
    const second = nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"));
    expect(second).toBe(epochOf(SPRING));
    expect(reads).not.toHaveBeenCalled();
  });

  it("never turns a stored empty span into a stored null", () => {
    expect(
      nextTransitionAfter(
        LONDON,
        epochOf("2024-01-01T00:00:00Z"),
        epochOf("2024-02-01T00:00:00Z"),
      ),
    ).toBeNull();
    expect(nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"))).toBe(
      epochOf(SPRING),
    );
  });

  it("answers a later start from the span a earlier search stored", () => {
    nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"));
    reads.mockClear();
    expect(nextTransitionAfter(LONDON, epochOf("2024-02-01T00:00:00Z"))).toBe(
      epochOf(SPRING),
    );
    expect(reads).not.toHaveBeenCalled();
  });

  it("answers a backward search from a span a forward search stored", () => {
    nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"));
    reads.mockClear();
    expect(
      previousTransitionBefore(
        LONDON,
        epochOf("2024-03-31T01:00:00.000000001Z"),
      ),
    ).toBe(epochOf(SPRING));
    expect(reads).not.toHaveBeenCalled();
  });

  it("answers a forward search from the change a backward search stored", () => {
    expect(
      previousTransitionBefore(LONDON, epochOf("2024-06-01T00:00:00Z")),
    ).toBe(epochOf(SPRING));
    reads.mockClear();
    expect(
      nextTransitionAfter(LONDON, epochOf("2024-03-31T00:59:59.999999999Z")),
    ).toBe(epochOf(SPRING));
    expect(reads).not.toHaveBeenCalled();
  });

  it("gives the same answers as a cold memo across a pair 601,200 s apart", () => {
    const warm: (bigint | null)[] = [];
    const cold: (bigint | null)[] = [];
    for (const out of [warm, cold]) {
      let from = epochOf("2000-10-01T00:00:00Z");
      for (let i = 0; i < 3; i++) {
        if (out === cold) clearTransitionMemo();
        const next = nextTransitionAfter("America/Boa_Vista", from);
        out.push(next);
        if (next !== null) from = next;
      }
    }
    expect(warm).toEqual(cold);
    expect(warm).toEqual([
      epochOf("2000-10-08T04:00:00Z"),
      epochOf("2000-10-15T03:00:00Z"),
      null,
    ]);
  });

  it("follows each horizon: an empty span is reused, a null is not", () => {
    const from = epochOf("1950-01-01T00:00:00Z");
    const setNow = (instant: string) =>
      vi
        .spyOn(Temporal.Now, "instant")
        .mockReturnValue(Temporal.Instant.from(instant));
    setNow("2026-01-01T00:00:00Z");
    expect(nextTransitionAfter("Asia/Kolkata", from)).toBeNull();
    reads.mockClear();
    expect(nextTransitionAfter("Asia/Kolkata", from)).toBeNull();
    expect(reads).toHaveBeenCalledTimes(0);

    setNow("2040-01-01T00:00:00Z");
    expect(nextTransitionAfter("Asia/Kolkata", from)).toBeNull();
    expect(reads.mock.calls.length).toBeGreaterThan(0);
    // Only the 14 years the horizon moved (about 1,024 five-day steps), not the 90 from 1950.
    expect(reads.mock.calls.length).toBeLessThan(1_100);
  });

  it("evicts the first zone past 64 and still answers it correctly", () => {
    const from = epochOf("2024-01-01T00:00:00Z");
    nextTransitionAfter(LONDON, from);
    const others = Intl.supportedValuesOf("timeZone")
      .filter((zone) => zone !== LONDON)
      .slice(0, 64);
    for (const zone of others) nextTransitionAfter(zone, from);
    reads.mockClear();
    expect(nextTransitionAfter(LONDON, from)).toBe(epochOf(SPRING));
    expect(reads.mock.calls.length).toBeGreaterThan(0);
  });
});

/**
 * The memo's edges. Expected instants: Temporal `getTimeZoneTransition` and
 * `zdump -v` (tz 2026c): Europe/London changes 2023-10-29T01:00:00Z, 2024-03-31T01:00:00Z,
 * 2024-10-27T01:00:00Z and 2025-03-30T01:00:00Z; Asia/Kolkata has none after 1945-10-14T17:30:00Z;
 * UTC, Etc/GMT+5 and +05:00 have none. The clock is pinned, so a horizon never moves under a row.
 */
describe("the transition memo at its edges", () => {
  const reads = vi.mocked(offsetAt);
  const LONDON = "Europe/London";
  const AUTUMN_2023 = "2023-10-29T01:00:00Z";
  const SPRING = "2024-03-31T01:00:00Z";
  const AUTUMN = "2024-10-27T01:00:00Z";
  const SPRING_2025 = "2025-03-30T01:00:00Z";

  beforeEach(() => {
    clearTransitionMemo();
    reads.mockClear();
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from("2026-01-01T00:00:00Z"),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts exactly at the end of a stored span and finds the next change", () => {
    expect(nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"))).toBe(
      epochOf(SPRING),
    );
    expect(nextTransitionAfter(LONDON, epochOf(SPRING))).toBe(epochOf(AUTUMN));
    expect(nextTransitionAfter(LONDON, epochOf(AUTUMN))).toBe(
      epochOf(SPRING_2025),
    );
  });

  it("starts exactly at a stored span's start", () => {
    expect(
      nextTransitionAfter(
        LONDON,
        epochOf("2024-01-01T00:00:00Z"),
        epochOf("2024-02-01T00:00:00Z"),
      ),
    ).toBeNull();
    reads.mockClear();
    expect(
      nextTransitionAfter(
        LONDON,
        epochOf("2024-01-01T00:00:00Z"),
        epochOf("2024-02-01T00:00:00Z"),
      ),
    ).toBeNull();
    expect(reads).not.toHaveBeenCalled();
    expect(nextTransitionAfter(LONDON, epochOf("2024-01-01T00:00:00Z"))).toBe(
      epochOf(SPRING),
    );
  });

  it.each`
    until                               | expected
    ${"2024-03-15T00:00:00Z"}           | ${null}
    ${"2024-03-31T00:59:59.999999999Z"} | ${null}
    ${"2024-03-31T01:00:00Z"}           | ${SPRING}
    ${"2024-12-01T00:00:00Z"}           | ${SPRING}
  `(
    "finds $expected after 2024-02-01 across a gap between two stored spans when the search ends at $until",
    ({ until, expected }) => {
      // Stored: (2024-01-01, 2024-03-01] and (2024-04-15, 2024-06-01], both empty; the change lies
      // in the gap between them.
      nextTransitionAfter(
        LONDON,
        epochOf("2024-01-01T00:00:00Z"),
        epochOf("2024-03-01T00:00:00Z"),
      );
      nextTransitionAfter(
        LONDON,
        epochOf("2024-04-15T00:00:00Z"),
        epochOf("2024-06-01T00:00:00Z"),
      );
      expect(
        nextTransitionAfter(
          LONDON,
          epochOf("2024-02-01T00:00:00Z"),
          epochOf(until),
        ),
      ).toBe(expected === null ? null : epochOf(expected));
    },
  );

  it("finds the change in a gap between two stored spans, then the next one past the second", () => {
    nextTransitionAfter(
      LONDON,
      epochOf("2024-01-01T00:00:00Z"),
      epochOf("2024-03-01T00:00:00Z"),
    );
    nextTransitionAfter(
      LONDON,
      epochOf("2024-04-15T00:00:00Z"),
      epochOf("2024-06-01T00:00:00Z"),
    );
    expect(nextTransitionAfter(LONDON, epochOf("2024-02-01T00:00:00Z"))).toBe(
      epochOf(SPRING),
    );
    expect(nextTransitionAfter(LONDON, epochOf(SPRING))).toBe(epochOf(AUTUMN));
  });

  it.each`
    from                                | expected
    ${SPRING}                           | ${AUTUMN_2023}
    ${"2024-03-31T01:00:00.000000001Z"} | ${SPRING}
    ${"2024-03-31T00:59:59.999999999Z"} | ${AUTUMN_2023}
    ${AUTUMN}                           | ${SPRING}
  `(
    "finds $expected before $from in Europe/London with a forward search stored first",
    ({ from, expected }) => {
      nextTransitionAfter(LONDON, epochOf("2023-12-01T00:00:00Z"));
      nextTransitionAfter(LONDON, epochOf(SPRING));
      expect(previousTransitionBefore(LONDON, epochOf(from))).toBe(
        epochOf(expected),
      );
    },
  );

  it.each`
    from                                | expected
    ${SPRING}                           | ${AUTUMN_2023}
    ${"2024-03-31T01:00:00.000000001Z"} | ${SPRING}
    ${AUTUMN}                           | ${SPRING}
  `(
    "finds $expected before $from in Europe/London from a cold memo",
    ({ from, expected }) => {
      expect(previousTransitionBefore(LONDON, epochOf(from))).toBe(
        epochOf(expected),
      );
    },
  );

  // A flat zone (UTC with its offset read replaced by a constant) has no change, so a search ends
  // by reaching its limit or running out of steps, and 200,000 steps cost nothing. The clock is
  // pinned to the year 5000: a search over more than 200,000 five-day steps (2,700 years) with no
  // change in them throws a RangeError, and that must not depend on what the memo already holds.
  describe("a search past its step bound, warm or cold", () => {
    const setNow = (instant: string) =>
      vi
        .spyOn(Temporal.Now, "instant")
        .mockReturnValue(Temporal.Instant.from(instant));

    async function withFlatOffsets(run: () => void): Promise<void> {
      const actual =
        await vi.importActual<typeof import("./zonedWallClock")>(
          "./zonedWallClock",
        );
      reads.mockImplementation(() => 0n);
      try {
        run();
      } finally {
        reads.mockImplementation(actual.offsetAt);
      }
    }

    it.each`
      warmUntil
      ${"2500-01-01T00:00:00Z"}
      ${"3000-01-01T00:00:00Z"}
      ${"4000-01-01T00:00:00Z"}
    `(
      "throws after 1950 with the clock in 5000 when an earlier search to $warmUntil is remembered",
      async ({ warmUntil }) => {
        setNow("5000-01-01T00:00:00Z");
        await withFlatOffsets(() => {
          const from = epochOf("1950-01-01T00:00:00Z");
          clearTransitionMemo();
          expect(() => nextTransitionAfter("UTC", from)).toThrow(RangeError);
          clearTransitionMemo();
          expect(
            nextTransitionAfter("UTC", from, epochOf(warmUntil)),
          ).toBeNull();
          expect(() => nextTransitionAfter("UTC", from)).toThrow(RangeError);
        });
      },
      30_000,
    );

    it.each`
      warmSince
      ${"2500-01-01T00:00:00Z"}
      ${"3500-01-01T00:00:00Z"}
    `(
      "throws before 5001 with the clock in 5000 when an earlier search down to $warmSince is remembered",
      async ({ warmSince }) => {
        setNow("5000-01-01T00:00:00Z");
        await withFlatOffsets(() => {
          const from = epochOf("5001-01-01T00:00:00Z");
          clearTransitionMemo();
          expect(() => previousTransitionBefore("UTC", from)).toThrow(
            RangeError,
          );
          clearTransitionMemo();
          expect(
            previousTransitionBefore("UTC", from, epochOf(warmSince)),
          ).toBeNull();
          expect(() => previousTransitionBefore("UTC", from)).toThrow(
            RangeError,
          );
        });
      },
      30_000,
    );
  });

  it("gives the same answer after its zone is evicted and searched again", () => {
    const from = epochOf("2024-01-01T00:00:00Z");
    const before = nextTransitionAfter(LONDON, from);
    const backBefore = previousTransitionBefore(LONDON, epochOf(AUTUMN));
    const others = Intl.supportedValuesOf("timeZone")
      .filter((zone) => zone !== LONDON)
      .slice(0, 64);
    for (const zone of others) nextTransitionAfter(zone, from);
    reads.mockClear();
    expect(nextTransitionAfter(LONDON, from)).toBe(before);
    expect(reads.mock.calls.length).toBeGreaterThan(0);
    expect(previousTransitionBefore(LONDON, epochOf(AUTUMN))).toBe(backBefore);
    expect(before).toBe(epochOf(SPRING));
    expect(backBefore).toBe(epochOf(SPRING));
  });

  it("keeps 63 other zones beside the newest: the 64th zone stays remembered", () => {
    const from = epochOf("2024-01-01T00:00:00Z");
    const zones = Intl.supportedValuesOf("timeZone")
      .filter((zone) => zone !== LONDON)
      .slice(0, 63);
    nextTransitionAfter(LONDON, from);
    for (const zone of zones) nextTransitionAfter(zone, from);
    reads.mockClear();
    expect(nextTransitionAfter(LONDON, from)).toBe(epochOf(SPRING));
    expect(reads).not.toHaveBeenCalled();
  });

  // Asia/Kolkata has no change from 1970 on, so each window stores an empty span. Windows are
  // 400e12 ns (about 4.6 days) apart, so none touches another and none merges.
  describe.each`
    windows | remembered
    ${256}  | ${true}
    ${257}  | ${false}
  `("$windows disjoint spans in one zone", ({ windows, remembered }) => {
    const windowStart = (i: number) =>
      epochOf("1970-01-01T00:00:00Z") + BigInt(i) * 400_000_000_000_000n;

    it(`${remembered ? "keeps" : "clears"} the first span and answers it the same`, () => {
      for (let i = 0; i < windows; i++) {
        nextTransitionAfter(
          "Asia/Kolkata",
          windowStart(i),
          windowStart(i) + 1_000n,
        );
      }
      reads.mockClear();
      expect(
        nextTransitionAfter(
          "Asia/Kolkata",
          windowStart(0),
          windowStart(0) + 1_000n,
        ),
      ).toBeNull();
      expect(reads.mock.calls.length > 0).toBe(!remembered);
      reads.mockClear();
      expect(
        nextTransitionAfter(
          "Asia/Kolkata",
          windowStart(windows - 1),
          windowStart(windows - 1) + 1_000n,
        ),
      ).toBeNull();
      expect(reads).not.toHaveBeenCalled();
      clearTransitionMemo();
      expect(
        nextTransitionAfter(
          "Asia/Kolkata",
          windowStart(0),
          windowStart(0) + 1_000n,
        ),
      ).toBeNull();
    });
  });

  // A synthetic zone, defined here, flips its offset every 10 days (changes at multiples of
  // 10 days of epoch time), so the expected changes are known without any zone data. Chained
  // searches from each change merge into one stored span holding all its changes.
  describe.each`
    changes | remembered
    ${4096} | ${true}
    ${4097} | ${false}
  `("$changes changes in one zone", ({ changes, remembered }) => {
    const SYNTHETIC = "Synthetic/Flipper";
    const TEN_DAYS = 864_000_000_000_000n;
    const FIRST = 10_000n * TEN_DAYS;

    it(`${remembered ? "keeps" : "clears"} the zone's facts and answers the same`, async () => {
      const actual =
        await vi.importActual<typeof import("./zonedWallClock")>(
          "./zonedWallClock",
        );
      reads.mockImplementation((zone, epoch) =>
        zone === SYNTHETIC
          ? ((epoch / TEN_DAYS) % 2n) * 3_600_000_000_000n
          : actual.offsetAt(zone, epoch),
      );
      try {
        let from = FIRST - 1n;
        for (let i = 0; i < changes; i++) {
          const next = nextTransitionAfter(SYNTHETIC, from);
          expect(next).toBe(FIRST + BigInt(i) * TEN_DAYS);
          from = next as bigint;
        }
        reads.mockClear();
        expect(nextTransitionAfter(SYNTHETIC, FIRST - 1n)).toBe(FIRST);
        expect(reads.mock.calls.length > 0).toBe(!remembered);
        // The newest search is the one kept when the cap fires, and an answer after a cap equals
        // the answer from a cold memo.
        reads.mockClear();
        const last = FIRST + BigInt(changes - 1) * TEN_DAYS;
        expect(nextTransitionAfter(SYNTHETIC, last - TEN_DAYS)).toBe(last);
        expect(reads).not.toHaveBeenCalled();
        clearTransitionMemo();
        expect(nextTransitionAfter(SYNTHETIC, FIRST - 1n)).toBe(FIRST);
      } finally {
        reads.mockImplementation(actual.offsetAt);
      }
    }, 120_000);
  });

  it.each`
    timeZone          | from
    ${"UTC"}          | ${"2000-01-01T00:00:00Z"}
    ${"Etc/GMT+5"}    | ${"2000-01-01T00:00:00Z"}
    ${"+05:00"}       | ${"2000-01-01T00:00:00Z"}
    ${"Asia/Kolkata"} | ${"1970-01-01T00:00:00Z"}
  `(
    "finds no change after $from in $timeZone, cold and warm, and reads nothing the second time",
    ({ timeZone, from }) => {
      expect(nextTransitionAfter(timeZone, epochOf(from))).toBeNull();
      reads.mockClear();
      expect(nextTransitionAfter(timeZone, epochOf(from))).toBeNull();
      expect(reads).not.toHaveBeenCalled();
    },
  );

  it.each`
    timeZone          | from                      | expected
    ${"UTC"}          | ${"2000-01-01T00:00:00Z"} | ${null}
    ${"Etc/GMT+5"}    | ${"2000-01-01T00:00:00Z"} | ${null}
    ${"+05:00"}       | ${"2000-01-01T00:00:00Z"} | ${null}
    ${"Asia/Kolkata"} | ${"1970-01-01T00:00:00Z"} | ${"1945-10-14T17:30:00Z"}
  `(
    "finds $expected before $from in $timeZone, cold and warm",
    ({ timeZone, from, expected }) => {
      const want = expected === null ? null : epochOf(expected);
      expect(previousTransitionBefore(timeZone, epochOf(from))).toBe(want);
      expect(previousTransitionBefore(timeZone, epochOf(from))).toBe(want);
    },
  );

  it.each`
    until
    ${SPRING}
    ${"2024-03-30T00:00:00Z"}
    ${"2023-01-01T00:00:00Z"}
  `(
    "finds nothing after 2024-03-31T01:00:00Z when the search ends at $until, however warm the memo",
    ({ until }) => {
      // `until` equal to or before `from`: an empty or inverted window, whatever is stored.
      nextTransitionAfter(LONDON, epochOf("2023-12-01T00:00:00Z"));
      expect(
        nextTransitionAfter(LONDON, epochOf(SPRING), epochOf(until)),
      ).toBeNull();
      clearTransitionMemo();
      expect(
        nextTransitionAfter(LONDON, epochOf(SPRING), epochOf(until)),
      ).toBeNull();
    },
  );

  it.each`
    since                               | expected
    ${"2023-10-29T00:59:59.999999999Z"} | ${AUTUMN_2023}
    ${AUTUMN_2023}                      | ${null}
    ${SPRING}                           | ${null}
    ${"2024-06-01T00:00:00Z"}           | ${null}
  `(
    "finds $expected before 2024-03-31T01:00:00Z when the search stops after $since, however warm the memo",
    ({ since, expected }) => {
      const want = expected === null ? null : epochOf(expected);
      previousTransitionBefore(LONDON, epochOf(SPRING));
      expect(
        previousTransitionBefore(LONDON, epochOf(SPRING), epochOf(since)),
      ).toBe(want);
      clearTransitionMemo();
      expect(
        previousTransitionBefore(LONDON, epochOf(SPRING), epochOf(since)),
      ).toBe(want);
    },
  );
});
