import { dwellTime, etaAtZone, transitTime } from "./index";

/**
 * RFC 9557 annotations on a transport instant, read by all three functions.
 *
 * RFC 9557 §3.3: an elective annotation with an unknown key is ignored and a critical one
 * (`!`) is rejected; `u-ca` is a known key, so a calendar is accepted either way. A time-zone
 * annotation is a bracket without `=` (RFC 9557 §4.1 `time-zone`), and `!` on it is allowed.
 * `Temporal.Instant.from` and `isValidInstant` follow the same rules, so `etaAtZone` and
 * `dwellTime` (which read only the instant when a target zone is given) accept exactly what
 * `transitTime` accepts, except a zone that does not exist: `transitTime` keeps the departure's
 * zone, so it must be real, while the other two never read it.
 */
const departure = "2024-06-15T10:00:00Z";

describe("transport annotations (RFC 9557)", () => {
  it.each`
    annotation                    | transit                                             | instantAccepted | kind
    ${""}                         | ${"2024-06-15T11:00:00Z"}                           | ${true}         | ${"no annotation"}
    ${"[foo=bar]"}                | ${"2024-06-15T11:00:00Z"}                           | ${true}         | ${"elective unknown key: ignored"}
    ${"[!foo=bar]"}               | ${""}                                               | ${false}        | ${"critical unknown key: rejected"}
    ${"[u-ca=gregory]"}           | ${"2024-06-15T11:00:00Z"}                           | ${true}         | ${"elective calendar: an instant has none"}
    ${"[!u-ca=gregory]"}          | ${"2024-06-15T11:00:00Z"}                           | ${true}         | ${"critical calendar: a known key"}
    ${"[UTC]"}                    | ${"2024-06-15T11:00:00+00:00[UTC]"}                 | ${true}         | ${"elective zone"}
    ${"[!UTC]"}                   | ${"2024-06-15T11:00:00+00:00[UTC]"}                 | ${true}         | ${"critical zone"}
    ${"[Europe/London]"}          | ${"2024-06-15T12:00:00+01:00[Europe/London]"}       | ${true}         | ${"zone differing from Z"}
    ${"[UTC][foo=bar]"}           | ${"2024-06-15T11:00:00+00:00[UTC]"}                 | ${true}         | ${"zone then elective unknown key"}
    ${"[UTC][!foo=bar]"}          | ${""}                                               | ${false}        | ${"zone then critical unknown key"}
    ${"[UTC][u-ca=iso8601]"}      | ${"2024-06-15T11:00:00+00:00[UTC]"}                 | ${true}         | ${"zone then ISO calendar"}
    ${"[Not/AZone]"}              | ${""}                                               | ${true}         | ${"zone that does not exist: only transitTime reads it"}
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
    },
  );

  it.each`
    annotation            | transit                          | kind
    ${"[foo=bar]"}        | ${"2024-06-15T11:00:00+09:00"}   | ${"elective unknown key"}
    ${"[!u-ca=gregory]"}  | ${"2024-06-15T11:00:00+09:00"}   | ${"critical calendar"}
    ${"[!foo=bar]"}       | ${""}                            | ${"critical unknown key"}
  `(
    "keeps an offset departure's offset past $annotation ($kind)",
    ({ annotation, transit }) => {
      expect(transitTime(`2024-06-15T10:00:00+09:00${annotation}`, "PT1H")).toBe(transit);
    },
  );
});
