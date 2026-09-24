import { chargeableDays, demurrageClock, freeTimeExpiry } from "./index";

/**
 * RFC 9557 annotations on an intermodal instant, read by all three functions.
 *
 * RFC 9557 §3.3: an elective annotation with an unknown key is ignored and a critical one
 * (`!`) is rejected; `u-ca` is a known key, so a calendar is accepted either way. A time-zone
 * annotation is a bracket without `=` (RFC 9557 §4.1 `time-zone`), and `!` on it is allowed.
 * `freeTimeExpiry` and `chargeableDays` read only the instant (the counting zone is an option),
 * as `Temporal.Instant.from` and `isValidInstant` do, so a bracketed zone that does not exist is
 * accepted; `demurrageClock` validates each event the same way and echoes its string.
 */
const clockStart = "2024-06-14T19:00:00Z";
const terms = {
  basis: "calendar",
  chargeBasis: "calendar",
  timeZone: "UTC",
  firstDay: "eventDay",
} as const;

describe("intermodal annotations (RFC 9557)", () => {
  it.each`
    annotation               | accepted | kind
    ${""}                    | ${true}  | ${"no annotation"}
    ${"[foo=bar]"}           | ${true}  | ${"elective unknown key: ignored"}
    ${"[!foo=bar]"}          | ${false} | ${"critical unknown key: rejected"}
    ${"[u-ca=gregory]"}      | ${true}  | ${"elective calendar: an instant has none"}
    ${"[!u-ca=gregory]"}     | ${true}  | ${"critical calendar: a known key"}
    ${"[UTC]"}               | ${true}  | ${"elective zone"}
    ${"[!UTC]"}              | ${true}  | ${"critical zone"}
    ${"[Europe/London]"}     | ${true}  | ${"zone differing from Z"}
    ${"[UTC][foo=bar]"}      | ${true}  | ${"zone then elective unknown key"}
    ${"[UTC][!foo=bar]"}     | ${false} | ${"zone then critical unknown key"}
    ${"[UTC][u-ca=iso8601]"} | ${true}  | ${"zone then ISO calendar"}
    ${"[Not/AZone]"}         | ${true}  | ${"zone that does not exist: only the instant is read"}
  `(
    "reads $annotation on an instant consistently ($kind)",
    ({ annotation, accepted }) => {
      const value = `${clockStart}${annotation}`;

      expect(freeTimeExpiry(value, 1, terms)).toEqual(
        accepted
          ? {
              freeTimeStart: "2024-06-14",
              lastFreeDay: "2024-06-14",
              expiresAt: "2024-06-15T00:00:00Z",
            }
          : null,
      );
      expect(chargeableDays(value, value, 1, terms)).toEqual(
        accepted
          ? {
              freeDaysUsed: 1,
              chargeableDays: 0,
              expiresAt: "2024-06-15T00:00:00Z",
              chargedDates: [],
              byTier: [{ from: 1, to: null, days: 0 }],
            }
          : null,
      );
      expect(
        demurrageClock(
          [
            { type: "discharged", at: value },
            { type: "gatedOut", at: value },
          ],
          "demurrage",
          { direction: "import" },
        ),
      ).toEqual(accepted ? { start: value, end: value } : null);
    },
  );
});
