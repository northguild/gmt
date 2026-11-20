import { Temporal } from "./temporal";
import { zoneNamesEqual } from "./zoneNamesEqual";

/*
 * Two zones are one only by name: the same identifier ignoring ASCII case, or two of the names
 * ECMA-402 §6.5.1 resolves to "UTC" (Etc/UTC, Etc/GMT, GMT). A Link and its Zone are two zones on
 * every host (GMT rule), so no row branches on the host.
 */

function at(zone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from("2024-01-01T00:00:00Z").toZonedDateTimeISO(zone);
}

describe("zoneNamesEqual", () => {
  it.each`
    one                   | two                   | expected | label
    ${"UTC"}              | ${"Etc/UTC"}          | ${true}  | ${"UTC names"}
    ${"UTC"}              | ${"GMT"}              | ${true}  | ${"UTC names"}
    ${"UTC"}              | ${"Etc/GMT"}          | ${true}  | ${"UTC names"}
    ${"GMT"}              | ${"Etc/GMT"}          | ${true}  | ${"UTC names"}
    ${"utc"}              | ${"UTC"}              | ${true}  | ${"letter case"}
    ${"america/new_york"} | ${"America/New_York"} | ${true}  | ${"letter case"}
    ${"Europe/Brussels"}  | ${"Europe/Brussels"}  | ${true}  | ${"same name"}
    ${"+00:00"}           | ${"+0000"}            | ${true}  | ${"offset spellings"}
    ${"UTC"}              | ${"+00:00"}           | ${false} | ${"offset zone is not a named zone"}
    ${"Etc/GMT+0"}        | ${"UTC"}              | ${false} | ${"Etc/GMT+0 is its own name"}
    ${"Etc/UCT"}          | ${"UTC"}              | ${false} | ${"UCT is not in the UTC set"}
    ${"Asia/Calcutta"}    | ${"Asia/Kolkata"}     | ${false} | ${"a Link and its Zone"}
    ${"Europe/Kiev"}      | ${"Europe/Kyiv"}      | ${false} | ${"a Link and its Zone"}
    ${"US/Eastern"}       | ${"America/New_York"} | ${false} | ${"a Link and its Zone"}
    ${"Europe/Brussels"}  | ${"Europe/Paris"}     | ${false} | ${"two zones"}
  `(
    "'$one' and '$two' are $expected, both ways round ($label)",
    ({
      one,
      two,
      expected,
    }: {
      one: string;
      two: string;
      expected: boolean;
    }) => {
      expect(zoneNamesEqual(at(one), at(two))).toBe(expected);
      expect(zoneNamesEqual(at(two), at(one))).toBe(expected);
    },
  );
});
