import {
  bestAvailable,
  classifyPunctuality,
  crossingTime,
  cutoffAt,
  cutoffSchedule,
  dwellTime,
  estimateDrift,
  etaAtZone,
  isPastCutoff,
  nextDeparture,
  punctualityRate,
  scheduleDelivery,
  scheduleDeviation,
  timeToCutoff,
  transitTime,
} from "./index";
import { hostileProxy, revokedProxy } from "../test/noThrow";

/**
 * RFC 9557 annotations on a transport instant, read by every transport function.
 *
 * RFC 9557 §3.3: an elective annotation with an unknown key is ignored and a critical one
 * (`!`) is rejected; `u-ca` is a known key, so a calendar is accepted either way. A time-zone
 * annotation is a bracket without `=` (RFC 9557 §4.1 `time-zone`), and `!` on it is allowed.
 * `Temporal.Instant.from` and `isValidInstant` follow the same rules, so `etaAtZone`,
 * `dwellTime` (which read only the instant when a target zone is given) and `crossingTime`
 * (whose target zone is always the rendering zone) accept exactly what `transitTime` accepts,
 * except a zone that does not exist: `transitTime` keeps the departure's zone, so it must be
 * real, while those three never read it. A `scheduleDelivery` departure reads its bracket the
 * way `transitTime` does — the bracket makes the departure exact, so it must be real — and its
 * sentinel is `null`.
 *
 * The planned-versus-actual functions split the same way. `scheduleDeviation`,
 * `classifyPunctuality`, `punctualityRate`, `bestAvailable` and `estimateDrift` compare instants
 * and echo what they were given, so they never validate the zone, as `timeToCutoff` does not.
 * The one thing an instant-only function takes from a bracket is the real offset behind a
 * minute-rounded one (`subMinuteOffsets.test.ts`); no row here has a sub-minute zone.
 * `nextDeparture` reads every moment as `transitTime` reads a departure — a headway result is
 * written in `from`'s zone, so the zone must be real — in both the list and the headway form.
 */
const departure = "2024-06-15T10:00:00Z";

/**
 * The instant-only planned-versus-actual functions: the bracket is never validated, so they
 * accept exactly what `etaAtZone` accepts, and echo the value as written.
 */
function expectPlannedVersusActualReads(
  value: string,
  instantAccepted: boolean,
): void {
  expect(scheduleDeviation(value, departure)).toBe(
    instantAccepted ? "PT0S" : "",
  );
  expect(classifyPunctuality(departure, value, { late: "PT15M" })).toBe(
    instantAccepted ? "onTime" : null,
  );
  expect(
    punctualityRate([{ planned: value, actual: departure }], { late: "PT15M" }),
  ).toEqual(instantAccepted ? { onTime: 1, total: 1, rate: 1 } : null);
  expect(
    bestAvailable([{ classifier: "ACT", at: value, recordedAt: value }]),
  ).toEqual(instantAccepted ? { at: value, classifier: "ACT" } : null);
  const drift = estimateDrift([
    { classifier: "EST", at: value, recordedAt: value },
    { classifier: "EST", at: departure, recordedAt: "2024-06-15T11:00:00Z" },
  ]);
  expect(drift).toEqual(
    instantAccepted
      ? {
          first: value,
          last: departure,
          drift: "PT0S",
          revisions: 2,
          exceedsTolerance: null,
        }
      : null,
  );
}

/**
 * `nextDeparture` reads every moment as `transitTime` reads a departure, in both forms: a list
 * entry is echoed, and an hourly service from `value` departs at 11:00 written the way `value`
 * was written — exactly `transitTime(value, "PT1H")`.
 */
function expectNextDepartureReads(value: string, transit: string): void {
  const accepted = transit !== "";
  expect(nextDeparture(value, [departure])).toBe(accepted ? departure : "");
  expect(nextDeparture(departure, [value])).toBe(accepted ? value : "");
  expect(
    nextDeparture("2024-06-15T10:30:00Z", {
      headway: "PT1H",
      from: value,
      to: "2024-06-15T12:00:00Z",
    }),
  ).toBe(transit);
}

describe("transport annotations (RFC 9557)", () => {
  it.each`
    annotation               | transit                                       | instantAccepted | kind
    ${""}                    | ${"2024-06-15T11:00:00Z"}                     | ${true}         | ${"no annotation"}
    ${"[foo=bar]"}           | ${"2024-06-15T11:00:00Z"}                     | ${true}         | ${"elective unknown key: ignored"}
    ${"[!foo=bar]"}          | ${""}                                         | ${false}        | ${"critical unknown key: rejected"}
    ${"[u-ca=gregory]"}      | ${"2024-06-15T11:00:00Z"}                     | ${true}         | ${"elective calendar: an instant has none"}
    ${"[!u-ca=gregory]"}     | ${"2024-06-15T11:00:00Z"}                     | ${true}         | ${"critical calendar: a known key"}
    ${"[UTC]"}               | ${"2024-06-15T11:00:00+00:00[UTC]"}           | ${true}         | ${"elective zone"}
    ${"[!UTC]"}              | ${"2024-06-15T11:00:00+00:00[UTC]"}           | ${true}         | ${"critical zone"}
    ${"[Europe/London]"}     | ${"2024-06-15T12:00:00+01:00[Europe/London]"} | ${true}         | ${"zone differing from Z"}
    ${"[UTC][foo=bar]"}      | ${"2024-06-15T11:00:00+00:00[UTC]"}           | ${true}         | ${"zone then elective unknown key"}
    ${"[UTC][!foo=bar]"}     | ${""}                                         | ${false}        | ${"zone then critical unknown key"}
    ${"[UTC][u-ca=iso8601]"} | ${"2024-06-15T11:00:00+00:00[UTC]"}           | ${true}         | ${"zone then ISO calendar"}
    ${"[UTC][u-ca=gregory]"} | ${""}                                         | ${true}         | ${"zone then non-ISO calendar: a zoned departure's calendar must be ISO"}
    ${"[Not/AZone]"}         | ${""}                                         | ${true}         | ${"zone that does not exist: only transitTime reads it"}
  `(
    "reads $annotation on an instant consistently ($kind)",
    ({ annotation, transit, instantAccepted }) => {
      const value = `${departure}${annotation}`;

      expect(transitTime(value, "PT1H")).toBe(transit);
      expect(etaAtZone(value, "UTC")).toBe(
        instantAccepted ? "2024-06-15T10:00:00+00:00[UTC]" : "",
      );
      expect(dwellTime(value, value, "UTC")).toEqual(
        instantAccepted
          ? {
              duration: "PT0S",
              enter: "2024-06-15T10:00:00+00:00[UTC]",
              exit: "2024-06-15T10:00:00+00:00[UTC]",
              calendarDays: 1,
            }
          : null,
      );
      expect(crossingTime(value, value, "UTC")).toEqual(
        instantAccepted
          ? {
              duration: "PT0S",
              enter: "2024-06-15T10:00:00+00:00[UTC]",
              exit: "2024-06-15T10:00:00+00:00[UTC]",
            }
          : null,
      );
      // The cut-off functions read only the instant, as etaAtZone does: the bracket never
      // supplies the zone, so one that does not exist is ignored.
      expect(cutoffAt(value, "PT1H", { timeZone: "UTC" })).toBe(
        instantAccepted ? "2024-06-15T09:00:00+00:00[UTC]" : "",
      );
      expect(
        cutoffSchedule(value, [{ name: "gate-in", offset: "PT1H" }], {
          timeZone: "UTC",
        }),
      ).toEqual(
        instantAccepted
          ? [{ name: "gate-in", at: "2024-06-15T09:00:00+00:00[UTC]" }]
          : [],
      );
      expect(isPastCutoff(value, departure)).toBe(instantAccepted);
      expect(timeToCutoff(departure, value)).toBe(
        instantAccepted ? "PT0S" : "",
      );
      // The departure reads its bracket, so scheduleDelivery accepts exactly what transitTime
      // accepts; the arrival instant (10:00Z + 1h) is the same whatever zone rendered the input.
      expectPlannedVersusActualReads(value, instantAccepted);
      expectNextDepartureReads(value, transit);
      expect(
        scheduleDelivery([
          { departure: value, duration: "PT1H", timeZone: "UTC" },
        ]),
      ).toEqual(
        transit === ""
          ? null
          : {
              eta: "2024-06-15T11:00:00+00:00[UTC]",
              legTimes: [
                {
                  arrival: "2024-06-15T11:00:00Z",
                  localArrival: "2024-06-15T11:00:00+00:00[UTC]",
                  dwellAfter: "PT0S",
                },
              ],
            },
      );
    },
  );

  it.each`
    annotation           | transit                        | kind
    ${"[foo=bar]"}       | ${"2024-06-15T11:00:00+09:00"} | ${"elective unknown key"}
    ${"[!u-ca=gregory]"} | ${"2024-06-15T11:00:00+09:00"} | ${"critical calendar"}
    ${"[!foo=bar]"}      | ${""}                          | ${"critical unknown key"}
  `(
    "keeps an offset departure's offset past $annotation ($kind)",
    ({ annotation, transit }) => {
      expect(
        transitTime(`2024-06-15T10:00:00+09:00${annotation}`, "PT1H"),
      ).toBe(transit);
      expect(
        nextDeparture("2024-06-15T01:30:00Z", {
          headway: "PT1H",
          from: `2024-06-15T10:00:00+09:00${annotation}`,
          to: "2024-06-15T12:00:00+09:00",
        }),
      ).toBe(transit);
    },
  );
});

// Core Rule 3: every transport function returns the sentinel for a value hostile to string
// coercion or to every access, never throws (PR #281; transitTime threw on all five).
const HOSTILE: [string, () => unknown][] = [
  [
    "{ toString() { throw } }",
    () => ({
      toString: (): never => {
        throw new Error("hostile toString");
      },
    }),
  ],
  ["Object.create(null)", () => Object.create(null)],
  ["Symbol()", () => Symbol("hostile")],
  ["a Proxy that throws on any trap", () => hostileProxy()],
  ["a revoked Proxy", () => revokedProxy()],
];

describe("transport functions never throw", () => {
  it.each(HOSTILE)(
    "return the sentinel for %s in every position",
    (_label, make) => {
      const ok = "2024-06-15T10:00:00Z";
      for (const call of [
        () => transitTime(make() as never, "PT1H"),
        () => transitTime(ok, make() as never),
        () => etaAtZone(make() as never, "UTC"),
        () => etaAtZone(ok, make() as never),
        () => dwellTime(make() as never, ok, "UTC"),
        () => dwellTime(ok, make() as never, "UTC"),
        () => dwellTime(ok, ok, make() as never),
        () => crossingTime(make() as never, ok, "UTC"),
        () => crossingTime(ok, make() as never, "UTC"),
        () => crossingTime(ok, ok, make() as never),
        () => scheduleDelivery(make() as never),
        () => scheduleDelivery([make()] as never),
        () =>
          scheduleDelivery([
            { departure: make() as never, duration: "PT1H", timeZone: "UTC" },
          ]),
        () =>
          scheduleDelivery([
            { departure: ok, duration: make() as never, timeZone: "UTC" },
          ]),
        () =>
          scheduleDelivery(
            [{ departure: ok, duration: "PT1H", timeZone: "UTC" }],
            make() as never,
          ),
        () => cutoffAt(make() as never, "P1D", { timeZone: "UTC" }),
        () => cutoffAt(ok, make() as never, { timeZone: "UTC" }),
        () => cutoffAt(ok, "P1D", make() as never),
        () => cutoffAt(ok, "P1D", { timeZone: make() as never }),
        () =>
          cutoffAt(ok, "P1D", {
            timeZone: "UTC",
            atLocalTime: make() as never,
          }),
        () =>
          cutoffAt(ok, "P1D", { timeZone: "UTC", calendar: make() as never }),
        () =>
          cutoffAt(ok, "P1D", {
            timeZone: "UTC",
            calendar: { weekend: [6, 7], holidays: [], timeZone: "UTC" },
            roll: make() as never,
          }),
        () => cutoffSchedule(ok, make() as never, { timeZone: "UTC" }),
        () => cutoffSchedule(ok, [make()] as never, { timeZone: "UTC" }),
        () =>
          cutoffSchedule(ok, [{ name: make() as never, offset: "P1D" }], {
            timeZone: "UTC",
          }),
        () =>
          cutoffSchedule(ok, [{ name: "a", offset: "P1D" }], make() as never),
        () => isPastCutoff(make() as never, ok),
        () => isPastCutoff(ok, make() as never),
        () => timeToCutoff(make() as never, ok),
        () => timeToCutoff(ok, make() as never),
        () => scheduleDeviation(make() as never, ok),
        () => scheduleDeviation(ok, make() as never),
        () => classifyPunctuality(make() as never, ok, { late: "PT15M" }),
        () => classifyPunctuality(ok, make() as never, { late: "PT15M" }),
        () => classifyPunctuality(ok, ok, make() as never),
        () => classifyPunctuality(ok, ok, { late: make() as never }),
        () => punctualityRate(make() as never, { late: "PT15M" }),
        () => punctualityRate([make()] as never, { late: "PT15M" }),
        () => punctualityRate([{ planned: ok, actual: ok }], make() as never),
        () => bestAvailable(make() as never),
        () => bestAvailable([make()] as never),
        () =>
          bestAvailable([
            { classifier: "ACT", at: make() as never, recordedAt: ok },
          ]),
        () => estimateDrift(make() as never),
        () => estimateDrift([make()] as never),
        () => estimateDrift([], make() as never),
        () => estimateDrift([], { tolerance: make() as never }),
        () => nextDeparture(make() as never, [ok]),
        () => nextDeparture(ok, make() as never),
        () => nextDeparture(ok, [make()] as never),
        () => nextDeparture(ok, [ok], make() as never),
        () => nextDeparture(ok, { headway: make() as never, from: ok, to: ok }),
        () =>
          nextDeparture(ok, { headway: "PT1H", from: make() as never, to: ok }),
      ]) {
        expect(call).not.toThrow();
      }
      expect(transitTime(make() as never, "PT1H")).toBe("");
      expect(etaAtZone(ok, make() as never)).toBe("");
      expect(dwellTime(ok, ok, make() as never)).toBeNull();
      expect(crossingTime(ok, ok, make() as never)).toBeNull();
      expect(scheduleDelivery([make()] as never)).toBeNull();
      expect(cutoffAt(ok, "P1D", make() as never)).toBe("");
      expect(
        cutoffSchedule(ok, [{ name: "a", offset: "P1D" }], make() as never),
      ).toEqual([]);
      expect(isPastCutoff(ok, make() as never)).toBe(false);
      expect(timeToCutoff(make() as never, ok)).toBe("");
      expect(scheduleDeviation(ok, make() as never)).toBe("");
      expect(classifyPunctuality(ok, ok, make() as never)).toBeNull();
      expect(punctualityRate([make()] as never, { late: "PT15M" })).toBeNull();
      expect(bestAvailable([make()] as never)).toBeNull();
      expect(estimateDrift([make()] as never)).toBeNull();
      expect(nextDeparture(ok, make() as never)).toBe("");
      expect(nextDeparture(ok, [make()] as never)).toBe("");
    },
  );
});
